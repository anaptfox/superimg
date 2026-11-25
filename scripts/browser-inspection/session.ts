import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir, userInfo } from "node:os";
import { BrowserConnection, type ConnectionOptions } from "./transport.js";

const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });

// agent-browser v0.39.1: cli/src/connection.rs:get_socket_dir and
// cli/src/validation.rs:sanitize_session_component. Empty overrides are ignored.
function sessionNamespace(value: string): string {
  let output = "", separator = false;
  for (const character of value) {
    if (/[\p{Alphabetic}\p{Number}]/u.test(character)) { output += character.toLowerCase(); separator = false; }
    else if (output && !separator) { output += character === "_" ? "_" : "-"; separator = true; }
  }
  return output.replace(/[-_]+$/, "");
}

async function physicalPath(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const parent = dirname(path);
    return parent === path ? path : join(await physicalPath(parent), basename(path));
  }
}

async function effectiveSocketPath(session: string, environment: NodeJS.ProcessEnv, cwd: string): Promise<string> {
  let home = environment.HOME;
  if (!home) { try { home = userInfo().homedir; } catch { /* Match the upstream temporary-directory fallback. */ } }
  const base = environment.AGENT_BROWSER_SOCKET_DIR || (environment.XDG_RUNTIME_DIR
    ? join(environment.XDG_RUNTIME_DIR, "agent-browser")
    : home ? join(home, ".agent-browser") : join(environment.TMPDIR || tmpdir(), "agent-browser"));
  const namespace = sessionNamespace(environment.AGENT_BROWSER_NAMESPACE ?? "");
  return physicalPath(resolve(cwd, base, ...(namespace ? ["namespaces", namespace, "run"] : []), `${session}.sock`));
}

/** Named and session-file callers serialize against the same daemon namespace. */
export async function lockBrowserSession(session: string, environment: NodeJS.ProcessEnv = process.env, directory = join(tmpdir(), `superimg-browser-inspection-${process.getuid?.() ?? "user"}`), cwd = process.cwd()): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const socketPath = await effectiveSocketPath(session, environment, cwd);
  const lock = join(directory, `${hash(socketPath)}.lock`);
  await mkdir(lock, { mode: 0o700 }).catch(() => { throw new Error(`Session is busy: ${lock}. Inspect its owner before recovering an interrupted lock.`); });
  try { await writeJson(join(lock, "owner.json"), { pid: process.pid, session, startedAt: new Date().toISOString() }); }
  catch (error) { await rm(lock, { recursive: true }); throw error; }
  return () => rm(lock, { recursive: true });
}

export async function inspectionConnection(values: Record<string, string | boolean | undefined>, root: string): Promise<{ browser: BrowserConnection; state?: any; statePath?: string; release(): Promise<void> }> {
  if (typeof values["session-file"] === "string") {
    const statePath = resolve(values["session-file"]);
    const fileLock = `${statePath}.lock`;
    await mkdir(fileLock, { mode: 0o700 }).catch(() => { throw new Error(`Session is busy: ${fileLock}. Inspect its owner before recovering an interrupted lock.`); });
    let releaseDaemon: (() => Promise<void>) | undefined;
    const release = async () => { try { await releaseDaemon?.(); } finally { await rm(fileLock, { recursive: true }); } };
    try {
      await writeJson(join(fileLock, "owner.json"), { pid: process.pid, startedAt: new Date().toISOString() });
      const state = JSON.parse(await readFile(statePath, "utf8"));
      if (state.schema !== "agent-browser-workflow/1" || !state.session || !Array.isArray(state.globalArgs) || !Array.isArray(state.inputs)) throw new Error("Unsupported browser session record");
      for (const input of state.inputs) {
        const actual = await readFile(input.path).then(hash, error => { if (error.code === "ENOENT") return null; throw error; });
        if (actual !== input.sha256) throw new Error(`Session configuration changed: ${input.path}`);
      }
      const environment: NodeJS.ProcessEnv = { ...process.env };
      for (const key of Object.keys(environment)) {
        if (key.startsWith("AGENT_BROWSER_") || key === "HOME" || key === "XDG_RUNTIME_DIR") {
          if (environment[key] !== state.environment[key]) throw new Error(`Session environment changed: ${key}`);
          if (key.startsWith("AGENT_BROWSER_")) delete environment[key];
        }
      }
      Object.assign(environment, state.environment);
      releaseDaemon = await lockBrowserSession(state.session, environment, undefined, state.cwd);
      return { browser: new BrowserConnection({ session: state.session, executable: state.executable, cwd: state.cwd, globalArgs: state.globalArgs, environment }), state, statePath, release };
    } catch (error) { await release(); throw error; }
  }
  if (typeof values.session !== "string") throw new Error("Use --session-file PATH, or --session NAME with the original --config PATH when applicable.");
  const options: ConnectionOptions = { session: values.session, executable: typeof values.executable === "string" ? resolve(values.executable) : join(root, "tests/integration/node_modules/.bin/agent-browser"), cwd: root, globalArgs: typeof values.config === "string" ? ["--config", resolve(values.config)] : [] };
  const release = await lockBrowserSession(options.session, process.env, undefined, options.cwd);
  return { browser: new BrowserConnection(options), release };
}
