import type { AgentBrowser } from "./agent-browser.js";

/** Read native WebMCP events on this test's browser; invocation still uses the real CLI. */
export async function traceWebMcp(browser: AgentBrowser, origin: string): Promise<{ events: unknown[]; close(): void }> {
  const url = (await browser.command(["get", "cdp-url"])).data?.cdpUrl;
  if (typeof url !== "string") throw new Error("Owned browser CDP URL unavailable");
  const socket = new WebSocket(url);
  const events: unknown[] = [];
  const pending = new Map<number, { resolve(value: Record<string, unknown>): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  let nextId = 0;
  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP observation timed out: ${method}`)); }, 5000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  socket.addEventListener("message", (message) => {
    const event = JSON.parse(String(message.data)) as { id?: number; method?: string; params?: Record<string, unknown>; sessionId?: string; result?: Record<string, unknown>; error?: unknown };
    if (event.id !== undefined) {
      const request = pending.get(event.id);
      if (request) { clearTimeout(request.timer); pending.delete(event.id); event.error ? request.reject(new Error(JSON.stringify(event.error))) : request.resolve(event.result ?? {}); }
      return;
    }
    if (event.method?.startsWith("WebMCP.") || event.method?.startsWith("Page.frame") || event.method === "Target.attachedToTarget") events.push({ observedAt: Date.now(), ...event });
    if (event.method === "Target.attachedToTarget" && typeof event.params?.sessionId === "string") {
      const sessionId = event.params.sessionId;
      void send("WebMCP.enable", {}, sessionId).catch((error) => events.push({ sessionId, observationError: String(error) }));
      void send("Page.enable", {}, sessionId).catch((error) => events.push({ sessionId, observationError: String(error) }));
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Owned CDP observer connection timed out")), 5000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Owned CDP observer connection failed")); }, { once: true });
    });
    const targets = (await send("Target.getTargets")).targetInfos as Array<{ targetId: string; type: string; url: string }>;
    events.push({ browserVersion: await send("Browser.getVersion") });
    const target = targets.find((candidate) => candidate.type === "page" && candidate.url.startsWith(origin));
    if (!target) throw new Error("Owned fixture page target unavailable");
    const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    if (typeof sessionId !== "string") throw new Error("Owned fixture CDP session unavailable");
    await send("Page.enable", {}, sessionId);
    await send("WebMCP.enable", {}, sessionId);
    await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sessionId);
    events.push({ observerSessionId: sessionId, targetId: target.targetId, frameTree: await send("Page.getFrameTree", {}, sessionId) });
    return { events, close() { socket.close(); for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error("Observer closed")); } pending.clear(); } };
  } catch (error) { socket.close(); throw error; }
}
