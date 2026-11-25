import { createServer, type Server, type ServerResponse } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RenderExecutionError, type FrameCaptureOptions, type JsonObject } from "@superimg/types";
import { PlaywrightEngine } from "./playwright-engine.js";

let engine: PlaywrightEngine;
let server: Server;
let origin: string;
let directory: string;
let onHangingScript: (() => void) | undefined;
let onHangingStylesheet: (() => void) | undefined;
let onOverlapRequest: ((url: string, response: ServerResponse) => void) | undefined;
let cancelledStreams = 0;
const config = { width: 160, height: 90, format: "png" as const, readiness: { timeoutMs: 5_000 } };

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "superimg-inspection-diagnostics-"));
  server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (request.url === "/stream") {
      response.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      response.write("first chunk");
      response.on("close", () => cancelledStreams++);
      return; // The authored fetch cancels this unfinished response.
    }
    if (request.url?.startsWith("/hanging.js")) {
      onHangingScript?.();
      return; // The caller aborts an actual pending browser request.
    }
    if (request.url === "/hanging.css") {
      onHangingStylesheet?.();
      return;
    }
    if (request.url?.startsWith("/overlap?") && onOverlapRequest) {
      onOverlapRequest(request.url, response);
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("fixture missing");
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture HTTP server has no port");
  origin = `http://127.0.0.1:${address.port}`;
  engine = new PlaywrightEngine({ perRenderContext: true });
  await engine.init();
}, 30_000);

afterAll(async () => {
  await engine?.dispose();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

// Validate the actual ZIP directory, decompression, lengths and CRCs using Node
// built-ins. A filename or PK prefix alone does not prove a readable trace.
async function traceEntries(path: string): Promise<Map<string, Buffer>> {
  const zip = await readFile(path);
  expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThan(0);
  expect(end + 22 + zip.readUInt16LE(end + 20)).toBe(zip.length);
  const count = zip.readUInt16LE(end + 10), entries = new Map<string, Buffer>();
  let cursor = zip.readUInt32LE(end + 16);
  for (let index = 0; index < count; index++) {
    expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
    const method = zip.readUInt16LE(cursor + 10), compressed = zip.readUInt32LE(cursor + 20);
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const local = zip.readUInt32LE(cursor + 42);
    expect(zip.readUInt32LE(local)).toBe(0x04034b50);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const stored = zip.subarray(start, start + compressed);
    expect([0, 8]).toContain(method);
    const bytes = method === 8 ? inflateRawSync(stored) : stored;
    expect(bytes.length).toBe(zip.readUInt32LE(cursor + 24));
    expect(crc32(bytes)).toBe(zip.readUInt32LE(cursor + 16));
    entries.set(name, bytes);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  expect(entries.size).toBeGreaterThan(0);
  expect(cursor).toBe(end);
  return entries;
}

function diagnosticItems(value: JsonObject, key: string): JsonObject[] {
  expect(Array.isArray(value[key])).toBe(true);
  return value[key] as JsonObject[];
}

describe("PlaywrightEngine inspection evidence", () => {
  it("keeps overlapping inspection contexts, diagnostics and readable trace ZIPs independent", async () => {
    const operations = ["INSPECTION_OVERLAP_ALPHA", "INSPECTION_OVERLAP_BETA"].map(marker => ({
      marker, tracePath: join(directory, `${marker}.zip`), callbacks: [] as JsonObject[],
    }));
    const arrivals: string[] = [];
    const pending = new Map<string, ServerResponse>();
    onOverlapRequest = (url, response) => {
      const marker = new URL(url, origin).searchParams.get("operation") ?? "";
      arrivals.push(marker);
      pending.set(marker, response);
      // Neither browser operation can pass readiness until both are active.
      // A serialized implementation therefore cannot satisfy this barrier.
      if (pending.size === operations.length) {
        for (const [owner, reply] of pending) {
          reply.writeHead(200, { "Content-Type": "text/plain" });
          reply.end(`released:${owner}`);
        }
      }
    };
    const runs = operations.map(operation => engine.inspectFrame(`
      <div data-si-node="${operation.marker}" data-superimg-wait="overlap">${operation.marker}</div>
      <script>
        window.__inspectionOverlapMarker = ${JSON.stringify(operation.marker)};
        console.warn(${JSON.stringify(operation.marker + ":started")});
        setTimeout(() => { throw new Error(${JSON.stringify(operation.marker + ":page-error")}); }, 0);
        (async () => {
          const response = await fetch(${JSON.stringify(origin + "/overlap?operation=" + operation.marker)});
          if (await response.text() !== ${JSON.stringify("released:" + operation.marker)}) throw new Error('Wrong overlap response');
          if (window.__inspectionOverlapMarker !== ${JSON.stringify(operation.marker)}) throw new Error('Inspection page was shared');
          console.log(${JSON.stringify(operation.marker + ":released")});
          requestAnimationFrame(() => requestAnimationFrame(() => window.__superimgReady.done('overlap')));
        })().catch(error => window.__superimgReady.fail('overlap', error.message));
      </script>`, config, { onDiagnostics: value => operation.callbacks.push(value) }, { tracePath: operation.tracePath }));
    let results: Awaited<typeof runs[number]>[];
    try { results = await Promise.all(runs); }
    finally {
      onOverlapRequest = undefined;
      for (const response of pending.values()) if (!response.writableEnded) response.end("fixture cleanup");
      await Promise.allSettled(runs);
    }
    expect(arrivals.sort()).toEqual(operations.map(operation => operation.marker).sort());
    expect(new Set(operations.map(operation => operation.tracePath)).size).toBe(2);
    for (const [index, result] of results.entries()) {
      const operation = operations[index]!, other = operations[(index + 1) % operations.length]!;
      expect(result.nodes).toContainEqual(expect.objectContaining({ id: operation.marker, text: operation.marker }));
      expect(diagnosticItems(result.diagnostics, "console")).toContainEqual(expect.objectContaining({ text: operation.marker + ":started" }));
      expect(diagnosticItems(result.diagnostics, "console")).toContainEqual(expect.objectContaining({ text: operation.marker + ":released" }));
      expect(diagnosticItems(result.diagnostics, "errors")).toContainEqual(expect.objectContaining({ message: operation.marker + ":page-error" }));
      expect(diagnosticItems(result.diagnostics, "requests")).toContainEqual(expect.objectContaining({ url: origin + "/overlap?operation=" + operation.marker, status: 200 }));
      expect(JSON.stringify(result.diagnostics)).not.toContain(other.marker);
      expect(operation.callbacks).toHaveLength(1);
      expect(JSON.stringify(operation.callbacks[0])).toContain(operation.marker);
      expect(JSON.stringify(operation.callbacks[0])).not.toContain(other.marker);
      expect(result.trace).toEqual({ kind: "playwright-trace-zip", path: operation.tracePath, error: null });
      const entries = await traceEntries(operation.tracePath);
      const recorded = [...entries].filter(([name]) => name.endsWith(".trace") || name.endsWith(".network")).map(([, bytes]) => bytes.toString("utf8")).join("\n");
      expect(recorded).toContain(operation.marker);
      expect(recorded).not.toContain(other.marker);
    }
  }, 20_000);

  it("records bounded real browser events and a readable trace, then excludes them from the next operation", async () => {
    const tracePath = join(directory, "observed.zip");
    const callbacks: JsonObject[] = [];
    const timings: Parameters<NonNullable<FrameCaptureOptions["onTiming"]>>[0][] = [];
    const observed = await engine.inspectFrame(`
      <div data-si-node="caption" data-superimg-wait="fixture">Trace fixture</div>
      <script>
        console.warn('FIRST_OPERATION:' + 'x'.repeat(5000));
        for (let index = 0; index < 150; index++) console.log('FIRST_OPERATION:' + index);
        setTimeout(() => { throw new Error('FIRST_OPERATION_PAGE_ERROR'); }, 0);
        (async () => {
          await fetch(${JSON.stringify(origin + "/missing")});
          const controller = new AbortController();
          const response = await fetch(${JSON.stringify(origin + "/stream")}, { signal: controller.signal });
          await response.body.getReader().read();
          controller.abort();
          requestAnimationFrame(() => requestAnimationFrame(() => window.__superimgReady.done('fixture')));
        })().catch(error => window.__superimgReady.fail('fixture', error.message));
      </script>`, config, { onDiagnostics: value => callbacks.push(value), onTiming: event => timings.push(event) }, { tracePath });
    expect(observed.nodes).toContainEqual(expect.objectContaining({ id: "caption", text: "Trace fixture" }));
    expect(observed.diagnostics).toMatchObject({ scope: "operation-window", maxEntries: 100, maxTextLength: 2000, truncated: true });
    const messages = diagnosticItems(observed.diagnostics, "console");
    expect(messages).toHaveLength(100);
    expect(messages[0]?.text).toHaveLength(2000);
    expect(messages.every(message => String(message.text).length <= 2000)).toBe(true);
    expect((observed.diagnostics.dropped as JsonObject).console).toBeGreaterThan(0);
    expect(diagnosticItems(observed.diagnostics, "errors")).toContainEqual(expect.objectContaining({ message: "FIRST_OPERATION_PAGE_ERROR" }));
    const requests = diagnosticItems(observed.diagnostics, "requests");
    expect(requests).toContainEqual(expect.objectContaining({ url: origin + "/missing", status: 404, failure: null }));
    expect(requests).toContainEqual(expect.objectContaining({ url: origin + "/stream", failure: expect.stringMatching(/abort|cancel/i) }));
    await expect.poll(() => cancelledStreams).toBeGreaterThan(0);
    expect(callbacks).toHaveLength(1);
    expect(diagnosticItems(callbacks[0]!, "errors")).toContainEqual(expect.objectContaining({ message: "FIRST_OPERATION_PAGE_ERROR" }));
    expect(timings).toContainEqual(expect.objectContaining({ stage: "rendered layout", status: "completed", clock: "local-monotonic" }));
    expect(timings.every(event => Number.isFinite(event.durationMs) && event.durationMs >= 0)).toBe(true);
    expect(observed.trace).toEqual({ kind: "playwright-trace-zip", path: tracePath, error: null });
    const entries = await traceEntries(tracePath);
    const events = [...entries].filter(([name]) => name.endsWith(".trace")).flatMap(([, bytes]) => bytes.toString("utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { type: string }));
    expect(events.some(event => event.type === "frame-snapshot")).toBe(true);
    expect(events.some(event => event.type === "screencast-frame")).toBe(true);

    const filesBefore = await readdir(directory);
    const quiet = await engine.inspectFrame('<div data-si-node="quiet">Second operation</div>', config);
    expect(quiet.nodes).toContainEqual(expect.objectContaining({ id: "quiet" }));
    expect(quiet.diagnostics).toMatchObject({ console: [], errors: [], requests: [], truncated: false });
    expect(quiet.trace).toBeUndefined();
    expect(await readdir(directory)).toEqual(filesBefore); // Recording is opt-in.
  }, 20_000);

  it.each([false, true])("preserves caller cancellation and cleans up tracing when trace save fails=%s", async (saveFails) => {
    const controller = new AbortController();
    const reason = new RenderExecutionError("aborted", "fixture cancellation");
    const tracePath = join(directory, saveFails ? "trace-is-a-directory" : "aborted.zip");
    if (saveFails) await mkdir(tracePath);
    onHangingScript = () => controller.abort(reason);
    let failure: unknown;
    try {
      await engine.inspectFrame(`<script>console.warn('ABORT_OPERATION');</script><script src="${origin}/hanging.js?case=${saveFails}"></script>`, config, { signal: controller.signal }, { tracePath });
    } catch (error) { failure = error; }
    finally { onHangingScript = undefined; }
    expect(failure).toBe(reason);
    const details = failure as RenderExecutionError & { inspectionDiagnostics: JsonObject; inspectionTrace: { kind: string; path: string; error: string | null } };
    expect(details.inspectionDiagnostics.scope).toBe("operation-window");
    expect(diagnosticItems(details.inspectionDiagnostics, "console")).toContainEqual(expect.objectContaining({ text: "ABORT_OPERATION" }));
    // Closing a page can omit its final requestfailed event. The unfinished
    // request remains observed; the earlier fetch test proves actual failures.
    expect(diagnosticItems(details.inspectionDiagnostics, "requests")).toContainEqual(expect.objectContaining({ url: `${origin}/hanging.js?case=${saveFails}`, status: null }));
    expect(details.inspectionTrace).toMatchObject({ kind: "playwright-trace-zip", path: tracePath });
    if (saveFails) expect(details.inspectionTrace.error).toEqual(expect.any(String));
    else { expect(details.inspectionTrace.error).toBeNull(); await traceEntries(tracePath); }

    // Another traced operation must work after both cancellation and save failure.
    const recoveredPath = join(directory, `recovered-${saveFails}.zip`);
    const recovered = await engine.inspectFrame('<div data-si-node="recovered">Recovered</div>', config, undefined, { tracePath: recoveredPath });
    expect(recovered.trace?.error).toBeNull();
    expect(recovered.diagnostics).toMatchObject({ console: [], errors: [], requests: [] });
    await traceEntries(recoveredPath);
  }, 20_000);

  it("aborts initial stylesheet loading with the original reason and finalizes its trace", async () => {
    const controller = new AbortController();
    const reason = new RenderExecutionError("aborted", "cancel initial stylesheet load");
    const timings: Parameters<NonNullable<FrameCaptureOptions["onTiming"]>>[0][] = [];
    const tracePath = join(directory, "initial-stylesheet-abort.zip");
    let requested = false;
    let failure: unknown;
    onHangingStylesheet = () => { requested = true; controller.abort(reason); };
    try {
      await engine.inspectFrame('<div>Never accepted</div>', { ...config, stylesheets: [origin + "/hanging.css"] }, { signal: controller.signal, onTiming: event => timings.push(event) }, { tracePath });
    } catch (error) { failure = error; }
    finally { onHangingStylesheet = undefined; }
    expect(requested).toBe(true);
    expect(failure).toBe(reason);
    const details = failure as RenderExecutionError & { inspectionDiagnostics: JsonObject; inspectionTrace: { error: string | null } };
    expect(details.inspectionDiagnostics.scope).toBe("operation-window");
    expect(diagnosticItems(details.inspectionDiagnostics, "requests")).toContainEqual(expect.objectContaining({ url: origin + "/hanging.css" }));
    expect(timings).toContainEqual(expect.objectContaining({ stage: "page stylesheets", status: "failed" }));
    expect(details.inspectionTrace.error).toBeNull();
    await traceEntries(tracePath);
    const recovered = await engine.inspectFrame('<div data-si-node="after-init-abort">Recovered</div>', config);
    expect(recovered.nodes).toContainEqual(expect.objectContaining({ id: "after-init-abort" }));
    expect(recovered.diagnostics).toMatchObject({ errors: [], requests: [] });
  }, 20_000);
});
