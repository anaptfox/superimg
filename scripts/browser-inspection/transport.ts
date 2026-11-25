import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
export interface CliEnvelope { success: boolean; data?: Record<string, any>; error?: unknown; code?: string; }
export interface CommandRecord {
  args: readonly string[];
  startedAt: string;
  elapsedMs: number;
  stdout: string;
  stderr: string;
  exitCode: string | number | null;
  signal?: string | null;
  response?: CliEnvelope;
  parseError?: string;
}
export interface ConnectionOptions {
  session: string;
  executable: string;
  cwd: string;
  globalArgs?: readonly string[];
  environment?: NodeJS.ProcessEnv;
}

/** One invocation per operation; 0.39.1 does not replay mutations after a request was sent. */
export class BrowserConnection {
  readonly transcript: CommandRecord[] = [];
  constructor(readonly options: ConnectionOptions) {}
  get session(): string { return this.options.session; }
  get executable(): string { return this.options.executable; }

  async version(): Promise<string> {
    return (await execFile(this.executable, ["--version"], { cwd: this.options.cwd, timeout: 15_000 })).stdout.trim();
  }

  async command(args: readonly string[], requireSuccess = true): Promise<CliEnvelope> {
    const started = performance.now();
    const record: CommandRecord = { args, startedAt: new Date().toISOString(), elapsedMs: 0, stdout: "", stderr: "", exitCode: null };
    this.transcript.push(record);
    try {
      const result = await execFile(this.executable, [...(this.options.globalArgs ?? []), "--session", this.session, "--json", ...args], {
        cwd: this.options.cwd, env: this.options.environment, timeout: 45_000, maxBuffer: 8 * 1024 * 1024,
      });
      Object.assign(record, result, { exitCode: 0 });
    } catch (error) {
      const failure = error as { stdout?: string; stderr?: string; message?: string; code?: string | number; signal?: string };
      record.stdout = failure.stdout ?? "";
      record.stderr = failure.stderr ?? failure.message ?? String(error);
      record.exitCode = failure.code ?? null;
      record.signal = failure.signal ?? null;
    }
    record.elapsedMs = Math.round(performance.now() - started);
    try {
      record.response = JSON.parse(record.stdout.trim()) as CliEnvelope;
      if (typeof record.response?.success !== "boolean") throw new Error("Missing CLI success field");
    } catch (error) {
      record.parseError = String(error);
      throw Object.assign(new Error(`agent-browser ${args[0]} returned no valid JSON; outcome is unknown. See the command transcript.`), { code: "COMMAND_UNCERTAIN" });
    }
    // Diagnostic callers may inspect known failures, but uncertainty must always
    // stop the sequence before another input or a successful capture is assumed.
    if (record.response.code === "outcome_unknown") {
      throw Object.assign(new Error(`agent-browser ${args[0]} outcome is unknown; inspect the command transcript before another input. ${JSON.stringify(record.response.error ?? record.stderr)}`), {
        code: "COMMAND_UNCERTAIN", upstreamCode: record.response.code,
      });
    }
    if (requireSuccess && (record.response.success !== true || record.exitCode !== 0)) {
      throw Object.assign(new Error(`agent-browser ${args[0]} failed: ${JSON.stringify(record.response.error ?? record.stderr)}`), { code: "COMMAND_FAILED" });
    }
    const lifecycle = record.response.data?.lifecycle;
    if (lifecycle?.restartedBackground || lifecycle?.relaunchedBrowser) {
      throw Object.assign(new Error("Browser identity changed during the command. Inspect the transcript before continuing."), { code: "SESSION_RESTARTED" });
    }
    return record.response;
  }

  async evaluate<T>(script: string): Promise<T> {
    return (await this.command(["eval", script])).data?.result as T;
  }

  async identity(): Promise<BrowserIdentity> {
    const tabs = (await this.command(["tab", "list"])).data?.tabs as Array<{ id?: string; targetId?: string; active?: boolean }>;
    const target = tabs?.find(tab => tab.active);
    if (!target || !(target.id ?? target.targetId)) throw new Error("No active browser target");
    const page = await this.evaluate<Omit<BrowserIdentity, "targetId">>(`({url:location.href,browserVersion:navigator.userAgent,documentTimeOrigin:performance.timeOrigin,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,x:scrollX,y:scrollY}})`);
    return { targetId: (target.id ?? target.targetId)!, ...page };
  }
}

export interface BrowserIdentity {
  targetId: string;
  browserVersion?: string;
  url: string;
  documentTimeOrigin: number;
  viewport: { width: number; height: number; dpr: number; x: number; y: number };
}
