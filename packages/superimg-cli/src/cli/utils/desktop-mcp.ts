import { Client, StreamableHTTPClientTransport, ProtocolError } from "@modelcontextprotocol/client";
import { Server } from "@modelcontextprotocol/server";
import { serveStdio, type ServeStdioOptions, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import type { DesktopConnection } from "./desktop-client.js";

/** Protocol-era translation only. Tool contracts and execution remain in the live desktop Binding. */
export async function createDesktopMcpRelay(connection: DesktopConnection, fetcher?: typeof fetch) {
  const remote = new Client({ name: "superimg-desktop-relay", version: "1" }, {
    versionNegotiation: { mode: { pin: "2026-07-28" } }, capabilities: {},
  });
  const transport = new StreamableHTTPClientTransport(new URL(`${connection.baseUrl}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${connection.token}` }, redirect: "error" },
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
    onInsufficientScope: "throw", ...(fetcher ? { fetch: fetcher } : {}),
  });
  let entry: StdioServerHandle | undefined;
  const forward = async <T>(invoke: () => Promise<T>): Promise<T> => {
    try { return await invoke(); }
    catch (error) {
      // Keep explicit remote protocol error data, including certainty. A broken connection
      // cannot establish whether the host dispatched; do not retry or turn it into failure.
      if (error instanceof ProtocolError) throw error;
      throw new ProtocolError(-32603, "Desktop transport ended. Execution may have started; inspect before repeating.", { certainty: "unknown" });
    }
  };
  const factory = () => {
    const server = new Server({ name: "superimg-desktop", version: "1" }, { capabilities: { tools: {} } });
    server.setRequestHandler("tools/list", request => forward(() => remote.listTools(request.params, { cacheMode: "refresh" })));
    server.setRequestHandler("tools/call", request => forward(() => remote.callTool(request.params)));
    return server;
  };
  try { await remote.connect(transport); }
  catch (error) { await remote.close(); throw error; }
  return {
    serve(options: ServeStdioOptions = {}) {
      if (entry) throw new Error("Desktop MCP relay already serving");
      // SDK owns discover/probe disposal and pins one fresh server to either
      // protocol era. Contracts and admission still come from the same host.
      entry = serveStdio(factory, { ...options, legacy: "serve" });
    },
    close: async () => { await entry?.close(); await remote.close(); },
  };
}

/** stdout is MCP only; a terminal agent can own its process independently of Desktop. */
export async function relayDesktopMcp(connection: DesktopConnection): Promise<void> {
  const relay = await createDesktopMcpRelay(connection);
  let closing = false;
  let finish: () => void = () => undefined;
  const done = new Promise<void>(resolve => { finish = resolve; });
  const close = async () => { if (closing) return; closing = true; await relay.close(); finish(); };
  const stop = () => { void close(); };

  process.once("SIGINT", stop); process.once("SIGTERM", stop); process.stdin.once("end", stop);
  try { relay.serve({ onerror: () => process.stderr.write("Desktop MCP relay error; no interaction was retried.\n") }); await done; }
  finally { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); process.stdin.removeListener("end", stop); await close(); }
}
