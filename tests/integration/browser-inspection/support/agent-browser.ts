import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { BrowserConnection, type ConnectionOptions } from "../../../../scripts/browser-inspection/transport.js";
import { repoRoot } from "./fixture-server.js";

export type { CliEnvelope } from "../../../../scripts/browser-inspection/transport.js";
export interface BoundaryOutcome { certainty: string; result: { kind: string; value?: unknown; error?: unknown; code?: string; details?: unknown }; [key: string]: unknown; }

export class AgentBrowser extends BrowserConnection {
  readonly toolFrames = new Map<string, string>();
  constructor(options: Partial<ConnectionOptions> = {}) {
    super({
      session: `superimg-inspection-${randomUUID().slice(0, 12)}`,
      executable: process.env.SUPERIMG_AGENT_BROWSER_EXECUTABLE ?? join(repoRoot, "tests/integration/node_modules/.bin/agent-browser"),
      cwd: repoRoot, ...options,
    });
  }

  async invoke(tool: string, input: Record<string, unknown>, frame?: string): Promise<BoundaryOutcome> {
    const targetFrame = frame ?? this.toolFrames.get(tool);
    const response = await this.command(["webmcp", "invoke", tool, "--params", JSON.stringify(input), "--timeout", "10000", ...(targetFrame ? ["--frame", targetFrame] : [])]);
    if (response.data?.status !== "completed" || response.data.outputTruncated) throw new Error(`Native invocation did not complete: ${JSON.stringify(response)}`);
    let output = response.data.output;
    // Chrome currently serializes execute() return values as a JSON string.
    // Preserve the recorded native envelope, and decode only that JSON seam.
    if (typeof output === "string") output = JSON.parse(output);
    if (!output || typeof output !== "object" || !("certainty" in output) || !("result" in output)) throw new Error(`Missing checked Boundary outcome: ${JSON.stringify(response)}`);
    return output as BoundaryOutcome;
  }

  async close(): Promise<void> { await this.command(["close"], false); }
}

export async function until<T>(read: () => Promise<T>, accepted: (value: T) => boolean, description: string, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (accepted(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${description} did not settle within ${timeoutMs}ms: ${JSON.stringify(last)}`);
}

/** Native CDP touch cancellation through the owned agent-browser input stream. */
export async function touchSession(browser: AgentBrowser): Promise<{ send(eventType: string, touchPoints: readonly { x: number; y: number }[]): void; close(): void }> {
  const response = await browser.command(["stream", "status"]);
  const port = response.data?.port;
  if (!response.data?.enabled || typeof port !== "number") throw new Error(`Owned agent-browser input stream unavailable: ${JSON.stringify(response)}`);
  const socket = new WebSocket(`ws://127.0.0.1:${port}/?maxFps=1`);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error("Input stream connection timed out")); }, 5000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Input stream connection failed")); }, { once: true });
  });
  return {
    send(eventType, touchPoints) { socket.send(JSON.stringify({ type: "input_touch", eventType, touchPoints })); },
    close() { socket.close(); },
  };
}
