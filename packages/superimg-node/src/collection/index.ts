import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { CollectionSourceDescriptor, SourceDescriptor } from "@superimg/core/source-analysis";
import type { MediaDiagnosticCode } from "@superimg/types";
import { COLLECTION_WORKER_SOURCE } from "./worker-source.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_IPC_BYTES = 32 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/** Env keys a collection worker may inherit. No secrets, no NODE_OPTIONS. */
const WORKER_ENV_KEYS = [
  "PATH",
  "PATHEXT",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "TEMPDIR",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "ProgramFiles",
  "ProgramW6432",
] as const;

function workerEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of WORKER_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

export interface LoadCollectionEntriesOptions {
  /** Provider deadline, including module loading. Defaults to ten seconds. */
  readonly timeoutMs?: number;
  /** Explicit working directory for the isolated process. Defaults beside the media source. */
  readonly cwd?: string;
  readonly signal?: AbortSignal;
  /** Bounded structured response size. Intended for hosts with a known snapshot limit. */
  readonly maxIpcBytes?: number;
}

export interface ResolvedEntry<TData extends object = Record<string, unknown>> {
  readonly id: string;
  readonly data: Readonly<TData>;
  readonly dataDigest: string;
}

export class CollectionExecutionError extends Error {
  readonly code: MediaDiagnosticCode;
  readonly filename: string | undefined;
  readonly entryId: string | undefined;

  constructor(
    code: MediaDiagnosticCode,
    message: string,
    details: { filename?: string; entryId?: string; cause?: unknown } = {},
  ) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.name = "CollectionExecutionError";
    this.code = code;
    this.filename = details.filename;
    this.entryId = details.entryId;
  }
}

interface WorkerSuccess {
  ok: true;
  entries: unknown[];
  ids?: unknown[];
}

interface WorkerFailure {
  ok: false;
  kind: "load" | "execution" | "identity";
  message: string;
}

type WorkerReply = WorkerSuccess | WorkerFailure;

/**
 * Resolve one complete collection snapshot in a disposable process.
 *
 * The provider is called exactly once. The returned entries are detached,
 * validated, digested, and deeply frozen before any rendition planning begins.
 */
export async function loadCollectionEntries<TData extends object = Record<string, unknown>>(
  descriptor: SourceDescriptor,
  options: LoadCollectionEntriesOptions = {},
): Promise<readonly ResolvedEntry<TData>[]> {
  const collection = assertCollectionDescriptor(descriptor);
  const timeoutMs = boundedPositiveInteger(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, "timeoutMs");
  const maxIpcBytes = boundedPositiveInteger(options.maxIpcBytes ?? DEFAULT_MAX_IPC_BYTES, "maxIpcBytes");
  const filename = resolve(collection.filename);
  const cwd = resolve(options.cwd ?? dirname(filename));

  if (options.signal?.aborted) {
    throw abortedError(filename, options.signal.reason);
  }

  const reply = await executeSnapshotWorker(
    {
      filename,
      entries: collection.entries,
      ...(collection.entryId === undefined ? {} : { entryId: collection.entryId }),
    },
    { cwd, timeoutMs, maxIpcBytes, ...(options.signal === undefined ? {} : { signal: options.signal }), filename },
  );

  if (reply.entries.length === 0) {
    throw new CollectionExecutionError("COLLECTION_EMPTY", "Collection providers must return at least one entry", {
      filename,
    });
  }
  if (reply.ids !== undefined && reply.ids.length !== reply.entries.length) {
    throw new CollectionExecutionError(
      "COLLECTION_ID_INVALID",
      "Collection id resolver returned an incomplete identity snapshot",
      { filename },
    );
  }

  const seen = new Map<string, string>();
  const resolved = reply.entries.map((raw, index) => {
    assertEntryObject(raw, filename, index);
    assertDeepJson(raw, filename);
    const selected = reply.ids?.[index] ?? selectPropertyId(collection, raw);
    const id = validateId(selected, filename);
    const folded = id.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = seen.get(folded);
    if (previous !== undefined) {
      const code = previous === id ? "COLLECTION_ID_DUPLICATE" : "COLLECTION_ID_CASE_COLLISION";
      throw new CollectionExecutionError(
        code,
        `Collection entry ids ${JSON.stringify(previous)} and ${JSON.stringify(id)} collide`,
        { filename, entryId: id },
      );
    }
    seen.set(folded, id);
    const data = deepFreeze(raw as TData);
    return Object.freeze({ id, data, dataDigest: digestData(data) });
  });

  return Object.freeze(resolved);
}

function assertCollectionDescriptor(descriptor: SourceDescriptor): CollectionSourceDescriptor {
  if (descriptor.kind === "collection") return descriptor;
  const rawKind = (descriptor as { kind?: unknown }).kind;
  const code = rawKind === "interactive" ? "COLLECTION_INTERACTIVE_UNSUPPORTED" : "COLLECTION_NESTED";
  throw new CollectionExecutionError(
    code,
    rawKind === "interactive"
      ? "Interactive media is singular and cannot be expanded as a collection"
      : "Collection entry loading requires one top-level deterministic collection descriptor",
    { filename: descriptor.filename },
  );
}

function selectPropertyId(descriptor: CollectionSourceDescriptor, entry: Record<string, unknown>): unknown {
  if (descriptor.entryId?.kind === "property") return entry[descriptor.entryId.property];
  if (descriptor.entryId === undefined) return entry.id;
  return undefined;
}

function validateId(value: unknown, filename: string): string {
  if (typeof value !== "string") {
    throw new CollectionExecutionError(
      "COLLECTION_ID_REQUIRED",
      "Every collection entry needs a string id or an explicit string-valued id resolver",
      { filename },
    );
  }
  const windowsStem = value.split(".", 1)[0]?.toLocaleUpperCase("en-US") ?? "";
  const windowsReserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem);
  if (
    value !== value.trim() ||
    !SAFE_ID.test(value) ||
    value === "." ||
    value === ".." ||
    windowsReserved
  ) {
    throw new CollectionExecutionError(
      "COLLECTION_ID_INVALID",
      `Collection entry id must be trimmed, non-empty, and path-safe: ${JSON.stringify(value)}`,
      { filename, entryId: value },
    );
  }
  return value;
}

function assertEntryObject(
  value: unknown,
  filename: string,
  index: number,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CollectionExecutionError(
      "COLLECTION_ENTRY_NOT_JSON",
      `Collection entry at index ${index} must be a JSON-compatible object`,
      { filename },
    );
  }
}

function assertDeepJson(value: unknown, filename: string, path = "$", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) entryJsonError(filename, `Non-finite number at ${path}`);
    return;
  }
  if (typeof value !== "object") entryJsonError(filename, `Unsupported ${typeof value} at ${path}`);
  if (ancestors.has(value)) entryJsonError(filename, `Cyclic value at ${path}`);
  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, index)) entryJsonError(filename, `Sparse array at ${path}[${index}]`);
      assertDeepJson(value[index], filename, `${path}[${index}]`, ancestors);
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) entryJsonError(filename, `Non-plain object at ${path}`);
    if (Object.getOwnPropertySymbols(value).length > 0) entryJsonError(filename, `Symbol-keyed property at ${path}`);
    for (const key of Object.keys(value)) assertDeepJson((value as Record<string, unknown>)[key], filename, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function entryJsonError(filename: string, message: string): never {
  throw new CollectionExecutionError("COLLECTION_ENTRY_NOT_JSON", message, { filename });
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return JSON.stringify(Object.is(value, -0) ? 0 : value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function digestData(value: object): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

interface WorkerOptions {
  cwd: string;
  timeoutMs: number;
  maxIpcBytes: number;
  signal?: AbortSignal;
  filename: string;
}

async function executeSnapshotWorker(request: object, options: WorkerOptions): Promise<WorkerSuccess> {
  return await new Promise<WorkerSuccess>((resolvePromise, rejectPromise) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let aborted = false;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", COLLECTION_WORKER_SOURCE], {
      cwd: options.cwd,
      env: workerEnv(),
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const finish = (error?: Error, value?: WorkerSuccess) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      if (error) rejectPromise(error);
      else resolvePromise(value!);
    };
    const stop = () => terminateProcessTree(child);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, options.timeoutMs);
    timer.unref();
    const onAbort = () => {
      aborted = true;
      stop();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();

    child.once("error", (cause) => {
      finish(new CollectionExecutionError("COLLECTION_PROVIDER_LOAD_FAILED", `Failed to start collection provider worker: ${cause.message}`, {
        filename: options.filename,
        cause,
      }));
    });
    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > options.maxIpcBytes) stop();
    });
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => {
      if (Buffer.byteLength(stderr) <= 64 * 1024) stderr += chunk;
    });
    child.once("close", (code, signal) => {
      if (aborted) {
        finish(abortedError(options.filename, options.signal?.reason));
        return;
      }
      if (timedOut) {
        finish(new CollectionExecutionError(
          "COLLECTION_PROVIDER_TIMEOUT",
          `Collection provider exceeded ${options.timeoutMs}ms and its process tree was terminated`,
          { filename: options.filename },
        ));
        return;
      }
      if (Buffer.byteLength(stdout) > options.maxIpcBytes) {
        finish(new CollectionExecutionError("COLLECTION_PROVIDER_EXECUTION_FAILED", "Collection provider response exceeded the IPC limit", {
          filename: options.filename,
        }));
        return;
      }
      if (code !== 0 || signal !== null) {
        finish(new CollectionExecutionError(
          "COLLECTION_PROVIDER_EXECUTION_FAILED",
          `Collection provider worker exited unsuccessfully${stderr ? `: ${stderr.trim()}` : ""}`,
          { filename: options.filename },
        ));
        return;
      }
      let parsed: WorkerReply;
      try {
        parsed = JSON.parse(stdout) as WorkerReply;
      } catch (cause) {
        finish(new CollectionExecutionError("COLLECTION_PROVIDER_EXECUTION_FAILED", "Collection provider returned invalid structured IPC", {
          filename: options.filename,
          cause,
        }));
        return;
      }
      if (!parsed.ok) {
        finish(new CollectionExecutionError(
          parsed.kind === "load"
            ? "COLLECTION_PROVIDER_LOAD_FAILED"
            : parsed.kind === "identity"
              ? "COLLECTION_ID_INVALID"
              : inferExecutionCode(parsed.message),
          parsed.message,
          { filename: options.filename },
        ));
        return;
      }
      finish(undefined, parsed);
    });

    child.stdin!.end(JSON.stringify(request));
  });
}

function inferExecutionCode(message: string): MediaDiagnosticCode {
  return /Cyclic|Non-finite|Unsupported|Sparse array|Non-plain object|Symbol-keyed/u.test(message)
    ? "COLLECTION_ENTRY_NOT_JSON"
    : "COLLECTION_PROVIDER_EXECUTION_FAILED";
}

function abortedError(filename: string, cause?: unknown): CollectionExecutionError {
  return new CollectionExecutionError("COLLECTION_PROVIDER_EXECUTION_FAILED", "Collection provider execution was cancelled", {
    filename,
    cause,
  });
}

function terminateProcessTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined || child.killed) return;
  try {
    if (process.platform === "win32") child.kill("SIGKILL");
    else process.kill(-pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // The process may have exited between the deadline and cancellation.
    }
  }
}

function boundedPositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive safe integer`);
  return value;
}
