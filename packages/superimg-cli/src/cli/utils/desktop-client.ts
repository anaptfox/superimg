import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createProjectionClient } from "@foxworth/boundary/client";
import { fetchTransport } from "@foxworth/boundary/http";

export interface DesktopConnection {
  version: 1;
  baseUrl: string;
  token: string;
  sessionId: string;
}

/** Machine-readable uncertainty survives the CLI client's human-readable diagnostic. */
export class DesktopInvocationError extends Error {
  readonly certainty = "unknown" as const;
  readonly code = "DESKTOP_OUTCOME_UNKNOWN";
}

/** Exhaustive typed outcome mirroring Boundary's `caller.try.*` surface. */
export type DesktopTryOutcome<Value = unknown> =
  | Readonly<{ kind: "ok"; value: Value }>
  | Readonly<{ kind: "declared-error"; code: string; message: string; details?: unknown }>
  | Readonly<{ kind: "denied"; message: string }>
  | Readonly<{ kind: "fault"; certainty: "not-started" | "unknown"; message: string }>;

export function defaultDesktopConnectionFile(): string {
  if (process.env.SUPERIMG_DESKTOP_CONNECTION_FILE) return process.env.SUPERIMG_DESKTOP_CONNECTION_FILE;
  const base = process.platform === "darwin" ? join(homedir(), "Library", "Application Support")
    : process.platform === "win32" ? process.env.APPDATA ?? join(homedir(), "AppData", "Roaming")
      : process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "SuperImg Desktop", "desktop-connection.json");
}

export async function readDesktopConnection(path = defaultDesktopConnectionFile()): Promise<DesktopConnection> {
  let raw: unknown;
  try {
    const info = await stat(path);
    if (!info.isFile() || (process.platform !== "win32" && (info.mode & 0o077) !== 0)) {
      throw new Error("Desktop connection file must be a private file (mode 0600).");
    }
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("The desktop app is not connected. Open it, or pass --connection-file for its running profile.");
    }
    if (error instanceof SyntaxError) throw new Error("Desktop connection file is invalid. Reopen the app to reconnect.");
    throw error;
  }
  if (!raw || typeof raw !== "object") throw new Error("Invalid desktop connection file.");
  const value = raw as Partial<DesktopConnection>;
  if (value.version !== 1 || typeof value.baseUrl !== "string" || typeof value.token !== "string" || !value.token || typeof value.sessionId !== "string" || !value.sessionId) throw new Error("Invalid desktop connection file.");
  let url: URL;
  try { url = new URL(value.baseUrl); } catch { throw new Error("Invalid desktop endpoint."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(url.hostname) || !url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Desktop endpoint must be a loopback HTTP origin with an explicit port.");
  return { version: 1, baseUrl: url.origin, token: value.token, sessionId: value.sessionId };
}

function classifyDesktopError(error: unknown): Exclude<DesktopTryOutcome, { kind: "ok" }> {
  if (error instanceof DesktopInvocationError) {
    return { kind: "fault", certainty: "unknown", message: error.message };
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (code === "TRANSPORT_FAILURE") {
      return {
        kind: "fault",
        certainty: "unknown",
        message: "The desktop host is disconnected or refused the connection. Reconnect explicitly; if an interaction was submitted, inspect its status before repeating it.",
      };
    }
    if (code === "REMOTE_DENIED" || code === "DENIED") {
      return {
        kind: "denied",
        message: error instanceof Error ? error.message : "Desktop interaction denied.",
      };
    }
    if (code === "REMOTE_DOMAIN_ERROR" && "value" in error) {
      const val = (error as { value?: { code?: unknown; details?: { message?: unknown; certainty?: unknown } } }).value;
      const details = val?.details;
      const message = typeof details?.message === "string"
        ? details.message
        : error instanceof Error ? error.message : "Desktop interaction failed.";
      if (details?.certainty === "unknown") {
        return {
          kind: "fault",
          certainty: "unknown",
          message: `${message} Inspect the current state before repeating a mutation.`,
        };
      }
      return {
        kind: "declared-error",
        code: typeof val?.code === "string" ? val.code : code,
        message,
        ...(details === undefined ? {} : { details }),
      };
    }
  }
  return {
    kind: "fault",
    certainty: "not-started",
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Every call pins one live Binding; this transport never retries mutations. */
export function desktopClient(connection: DesktopConnection, fetcher: typeof fetch = globalThis.fetch) {
  const client = createProjectionClient(fetchTransport({
    baseUrl: `${connection.baseUrl}/boundary/v1`,
    headers: { authorization: `Bearer ${connection.token}` },
    fetch: async (input, init) => {
      try {
        return await fetcher(input, { ...init, redirect: "error", signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) });
      } catch {
        throw new DesktopInvocationError("Desktop connection ended. A submitted interaction may have started; inspect its status after reconnecting before repeating it.");
      }
    },
  }));
  const run = async <T>(action: () => Promise<T>): Promise<T> => {
    try { return await action(); } catch (error) {
      const classified = classifyDesktopError(error);
      if (classified.kind === "fault" && classified.certainty === "unknown") {
        throw new DesktopInvocationError(classified.message);
      }
      if (classified.kind === "declared-error") {
        throw new Error(classified.message);
      }
      throw error;
    }
  };
  const tryCall = async <T = unknown>(
    interaction: string,
    input?: unknown,
  ): Promise<DesktopTryOutcome<T>> => {
    try {
      const value = await client.callRaw(interaction, input);
      return { kind: "ok", value: value as T };
    } catch (error) {
      return classifyDesktopError(error);
    }
  };
  return {
    ...client,
    inspect: () => run(() => client.inspect()),
    callRaw: (interaction: string, input?: unknown) => run(() => client.callRaw(interaction, input)),
    tryCall,
  };
}

export async function parseDesktopInput(value?: string): Promise<unknown> {
  if (value === undefined) return {};
  const text = value.trim();
  if (text.startsWith("{") || text.startsWith("[")) return JSON.parse(text);
  return JSON.parse(await readFile(text.startsWith("@") ? text.slice(1) : text, "utf8"));
}
