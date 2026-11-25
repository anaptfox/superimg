import { describe, expect, it, vi } from "vitest";
import { Buffer } from "node:buffer";
import { ExportBundleDisposedError, image } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { createExportBundle } from "./bundle.js";
import type { RuntimeAdapter, RuntimeArtifactBacking } from "./adapter.js";
import { createRuntime, exportMedia } from "./kernel.js";
import { sha256Hex } from "../ir/pure/sha256.js";
import { createPausableJob } from "./job.js";

const coordinates = { variantId: "default", editionId: "default" };
const media = image({ size: { width: 32, height: 32 }, render: () => Html({ width: "fill", height: "fill", html: "fixture" }) });
function fixture() {
  const bytes = new Uint8Array([2, 4, 6, 8]);
  const dispose = vi.fn(async () => {});
  const backing: RuntimeArtifactBacking = {
    byteLength: bytes.length, sha256: sha256Hex(bytes), dispose,
    open: vi.fn(() => new ReadableStream({ start(c) { c.enqueue(bytes.slice()); c.close(); } })),
  };
  const output = {
    coordinates: [coordinates],
    artifacts: [{ path: "test.mp4", mimeType: "video/mp4", coordinates: { ...coordinates, renditionId: "test" }, backing }],
  };
  return { bytes, backing, dispose, output };
}
function adapter(output: ReturnType<typeof fixture>["output"]): RuntimeAdapter {
  return {
    abi: "backing-test", capabilities: {
      schemaVersion: 0, check: true, inspect: true, documents: ["html"], rasters: ["png"], animated: ["mp4"],
      collections: { static: true, providers: false }, assets: { url: true, bytes: true }, fonts: { logical: true, frozenBytes: true },
    },
    async preflight() { return { findings: [], assets: [], fonts: [] }; },
    async render() { throw new Error("unused"); },
    async exportMedia() { return output; },
    async dispose() {},
  };
}

describe("in-memory export ownership", () => {
  it("owns Buffer views and keeps a prior stream independent after disposal", async () => {
    const caller = Buffer.from([99, 1, 2, 3, 98]);
    const expected = new Uint8Array([1, 2, 3]);
    const bundle = createExportBundle({ programDigest: "a".repeat(64), assets: [], fonts: [], output: {
      coordinates: [coordinates], artifacts: [{ path: "owned.bin", mimeType: "application/octet-stream",
        bytes: caller.subarray(1, 4), coordinates: { ...coordinates, renditionId: "owned" } }],
    } });
    const artifact = bundle.artifacts[0]!;
    caller[1] = 7;
    const stream = artifact.stream();
    const chunk = (await artifact.stream().getReader().read()).value!;
    chunk.fill(8);
    expect(await artifact.bytes()).toEqual(expected);
    expect(artifact.byteLength).toBe(3);
    expect(artifact.sha256).toBe(sha256Hex(expected));
    await bundle.dispose();
    expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(expected);
    expect([...caller]).toEqual([99, 7, 2, 3, 98]);
  });

  it("isolates adapter and read mutations, while an open stream survives disposal", async () => {
    const original = new Uint8Array([2, 4, 6, 8]);
    const expected = original.slice();
    const bundle = createExportBundle({ programDigest: "a".repeat(64), assets: [], fonts: [], output: {
      coordinates: [coordinates], artifacts: [{
        path: "owned.bin", mimeType: "application/octet-stream", bytes: original,
        coordinates: { ...coordinates, renditionId: "owned" },
      }],
    } });
    const artifact = bundle.artifacts[0]!;
    original.fill(99);
    const read = await artifact.bytes();
    read.fill(77);
    expect(await artifact.bytes()).toEqual(expected);
    expect(artifact.sha256).toBe(sha256Hex(expected));
    const open = artifact.stream();
    await Promise.all([bundle.dispose(), bundle.dispose()]);
    expect(new Uint8Array(await new Response(open).arrayBuffer())).toEqual(expected);
    expect(artifact.byteLength).toBe(4);
    expect(artifact.sha256).toBe(sha256Hex(expected));
    expect(() => artifact.stream()).toThrow(ExportBundleDisposedError);
    await expect(artifact.bytes()).rejects.toThrow(ExportBundleDisposedError);
    await expect(artifact.blob()).rejects.toThrow(ExportBundleDisposedError);
    await expect(artifact.text()).rejects.toThrow(ExportBundleDisposedError);
  });

  it("retains completed job metadata while disposing its bundle storage", async () => {
    const job = createPausableJob("retained-export", async () => createExportBundle({
      programDigest: "a".repeat(64), assets: [], fonts: [], output: {
        coordinates: [coordinates], artifacts: [{ path: "frame.txt", mimeType: "text/plain",
          coordinates: { ...coordinates, renditionId: "frame" }, bytes: new TextEncoder().encode("ready") }],
      },
    }));
    const bundle = await job.result;
    expect(await bundle.artifacts[0]!.text()).toBe("ready");
    await Promise.all([job.dispose(), job.dispose()]);
    expect(await job.result).toBe(bundle);
    expect(bundle.manifest.artifacts[0]!.byteLength).toBe(5);
    await expect(bundle.artifacts[0]!.bytes()).rejects.toThrow(ExportBundleDisposedError);
  });

  it("keeps rejected mixed output cleanup with the adapter owner", async () => {
    const f = fixture();
    const output = { coordinates: [coordinates], artifacts: [
      { path: "memory.bin", mimeType: "application/octet-stream", bytes: new Uint8Array([1]), coordinates: { ...coordinates, renditionId: "memory" } },
      ...f.output.artifacts,
      { path: "../invalid.bin", mimeType: "application/octet-stream", bytes: new Uint8Array([2]), coordinates: { ...coordinates, renditionId: "invalid" } },
    ] };
    expect(() => createExportBundle({ programDigest: "a".repeat(64), assets: [], fonts: [], output })).toThrow();
    expect(f.dispose).not.toHaveBeenCalled();
    const runtime = createRuntime({ ...adapter(f.output), exportMedia: async () => output });
    await expect(exportMedia(runtime, media, { for: ["32x32.png"] })).rejects.toThrow();
    expect(f.dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });
});

describe("sealed export backing", () => {
  it("adopts storage without reading it, supports independent reads, and disposes once", async () => {
    const f = fixture();
    const bundle = createExportBundle({ programDigest: "a".repeat(64), output: f.output, assets: [], fonts: [] });
    expect(f.backing.open).not.toHaveBeenCalled();
    const artifact = bundle.artifacts[0]!;
    const reads = await Promise.all([artifact.stream(), artifact.stream()].map(async (stream) =>
      new Uint8Array(await new Response(stream).arrayBuffer())));
    expect(reads).toEqual([f.bytes,f.bytes]);
    await Promise.all([bundle.dispose(), bundle.dispose()]);
    expect(f.dispose).toHaveBeenCalledTimes(1);
    expect(() => bundle.artifacts[0]!.stream()).toThrow(ExportBundleDisposedError);
  });

  it("disposes one shared backing once across multiple artifacts", async () => {
    const f = fixture();
    const bundle = createExportBundle({ programDigest: "a".repeat(64), assets: [], fonts: [], output: {
      coordinates: [coordinates], artifacts: [...f.output.artifacts, { ...f.output.artifacts[0]!, path: "second.mp4", coordinates: { ...coordinates, renditionId: "second" } }],
    } });
    await bundle.dispose();
    expect(f.dispose).toHaveBeenCalledOnce();
  });

  it("keeps adopted backing live after runtime disposal", async () => {
    const f = fixture();
    const runtime = createRuntime(adapter(f.output));
    const bundle = await exportMedia(runtime, media, { for: ["32x32.png"] });
    await runtime.dispose();
    expect(new Uint8Array(await new Response(bundle.artifacts[0]!.stream()).arrayBuffer())).toEqual(f.bytes);
    expect(f.dispose).not.toHaveBeenCalled();
    await bundle.dispose();
    expect(f.dispose).toHaveBeenCalledOnce();
  });

  it("releases all backing if bundle validation rejects output", async () => {
    const f = fixture();
    f.output.artifacts[0]!.path = "../escape.mp4";
    const runtime = createRuntime(adapter(f.output));
    await expect(exportMedia(runtime, media, { for: ["32x32.png"] })).rejects.toThrow(/normalized relative|parent/);
    expect(f.dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("releases completed adapter output if cancellation wins before adoption", async () => {
    const f = fixture();
    const signal = new AbortController();
    const impl = adapter(f.output);
    impl.exportMedia = async () => { signal.abort(); return f.output; };
    const runtime = createRuntime(impl);
    await expect(exportMedia(runtime, media, { for: ["32x32.png"], signal: signal.signal })).rejects.toThrow(/cancelled/);
    expect(f.dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("releases adopted storage if preflight disposal fails before returning", async () => {
    const f = fixture();
    const impl = adapter(f.output);
    impl.preflight = async () => ({ findings: [], assets: [], fonts: [], dispose: async () => { throw new Error("resource cleanup failed"); } });
    const runtime = createRuntime(impl);
    await expect(exportMedia(runtime, media, { for: ["32x32.png"] })).rejects.toThrow(/preflight disposal/);
    expect(f.dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it("does not transfer a bundle if cancellation arrives during preflight disposal", async () => {
    const f = fixture();
    const controller = new AbortController();
    const impl = adapter(f.output);
    impl.preflight = async () => ({ findings: [], assets: [], fonts: [], dispose: async () => { controller.abort(); } });
    const runtime = createRuntime(impl);
    await expect(exportMedia(runtime, media, { for: ["32x32.png"], signal: controller.signal })).rejects.toThrow(/cancelled/);
    expect(f.dispose).toHaveBeenCalledOnce();
    await runtime.dispose();
  });

  it.each([false, true])("attempts every cleanup even when a backing throws synchronously: %s", async (synchronous) => {
    const f = fixture();
    if (synchronous) f.dispose.mockImplementationOnce(() => { throw new Error("disk failed"); });
    else f.dispose.mockRejectedValueOnce(new Error("disk failed"));
    const other = fixture();
    const bundle = createExportBundle({ programDigest: "a".repeat(64), assets: [], fonts: [], output: {
      coordinates: [coordinates], artifacts: [...f.output.artifacts, { ...other.output.artifacts[0]!, path: "second.mp4", coordinates: { ...coordinates, renditionId: "second" } }],
    } });
    await expect(bundle.dispose()).rejects.toThrow(/dispose export backing/);
    expect(other.dispose).toHaveBeenCalledOnce();
    expect(() => bundle.artifacts[0]!.stream()).toThrow(ExportBundleDisposedError);
  });
});
