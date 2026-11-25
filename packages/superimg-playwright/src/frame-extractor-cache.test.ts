import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FrameExtractor, type FrameExtractorBackend } from "./frame-extractor.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("versioned frame cache and shared work", () => {
  let directory: string;
  let source: string;
  const extractors: FrameExtractor[] = [];
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "superimg-frame-cache-"));
    source = join(directory, "clip.mp4");
    await writeFile(source, "first");
  });
  afterEach(async () => {
    await Promise.all(extractors.splice(0).map((extractor) => extractor.dispose()));
    await rm(directory, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });
  function create(extract: FrameExtractorBackend["extract"], options?: ConstructorParameters<typeof FrameExtractor>[1]) {
    const backend = { extract: vi.fn(extract), dispose: vi.fn(async () => {}) };
    const extractor = new FrameExtractor(backend, options);
    extractors.push(extractor);
    return { extractor, backend };
  }

  it("separates colliding output frame numbers and shares identical media times across fps", async () => {
    const { extractor, backend } = create(async (_path, time) => Buffer.from(String(time)));
    expect((await extractor.extractFrame(source, 1, 30)).toString()).toBe("1");
    expect((await extractor.extractFrame(source, 0.5, 60)).toString()).toBe("0.5");
    await extractor.extractFrame(source, 1, 60);
    expect(backend.extract).toHaveBeenCalledTimes(2);
  });

  it("canonicalizes the decoder request itself without rounding to output fps", async () => {
    const { extractor, backend } = create(async (_path, time) => Buffer.from(String(time)));
    expect((await extractor.extractFrame(source, 0.0100001, 30)).toString()).toBe("0.01");
    await extractor.extractFrame(source, 0.0100002, 60);
    await extractor.extractFrame(source, 0.011, 30);
    expect(backend.extract).toHaveBeenCalledTimes(2);
  });

  it("invalidates same-size edits even when modification time is restored", async () => {
    const { extractor, backend } = create(async () => Buffer.from("png"));
    const before = await stat(source);
    await extractor.extractFrame(source, 0, 30);
    await writeFile(source, "other");
    await utimes(source, before.atime, before.mtime);
    await extractor.extractFrame(source, 0, 30);
    expect(backend.extract).toHaveBeenCalledTimes(2);
    expect(extractor.getStats().cacheEntries).toBe(1);
    expect(backend.extract.mock.calls[0]?.[3]?.sourceVersion).not.toBe(backend.extract.mock.calls[1]?.[3]?.sourceVersion);
  });

  it("rejects files changed during decoding instead of caching a stale frame", async () => {
    const { extractor } = create(async () => { await writeFile(source, "changed"); return Buffer.from("png"); });
    await expect(extractor.extractFrame(source, 0, 30)).rejects.toThrow("source changed");
    expect(extractor.getStats().cacheEntries).toBe(0);
  });

  it("evicts by bytes with LRU recency and bypasses oversized frames", async () => {
    const { extractor, backend } = create(async (_path, time) => Buffer.alloc(time === 9 ? 12 : 4), { maxCacheBytes: 8 });
    for (const time of [0, 1, 0, 2, 0, 1, 9, 9]) await extractor.extractFrame(source, time, 30);
    expect(backend.extract).toHaveBeenCalledTimes(6);
    expect(extractor.getStats()).toMatchObject({ cacheBytes: 8, cacheEntries: 2 });
  });

  it("can disable caching and validates bounds/timestamps", async () => {
    const { extractor, backend } = create(async () => Buffer.alloc(4), { maxCacheEntries: 0 });
    await extractor.extractFrame(source, 0, 30);
    await extractor.extractFrame(source, 0, 30);
    expect(backend.extract).toHaveBeenCalledTimes(2);
    expect(extractor.getStats().cacheBytes).toBe(0);
    for (const time of [NaN, Infinity, -1]) await expect(extractor.extractFrame(source, time, 30)).rejects.toThrow();
    await expect(extractor.extractFrame(source, 0, 0)).rejects.toThrow();
    expect(() => new FrameExtractor(backend, { maxCacheBytes: -1 })).toThrow();
    expect(() => new FrameExtractor(backend, { maxOpenSources: 0 })).toThrow();
  });

  it("does not let one consumer cancel a shared extraction needed by another", async () => {
    const pending = deferred<Buffer>();
    const started = deferred<void>();
    const { extractor, backend } = create(async () => { started.resolve(); return pending.promise; });
    const abort = new AbortController();
    const first = extractor.extractFrame(source, 1, 30, abort.signal);
    const failed = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    const second = extractor.extractFrame(source, 1, 60);
    await vi.waitFor(() => expect(extractor.getStats().hits).toBe(1));
    abort.abort();
    await failed;
    expect(backend.extract.mock.calls[0]?.[2]?.aborted).toBe(false);
    pending.resolve(Buffer.from("frame"));
    expect((await second).toString()).toBe("frame");
    expect(backend.extract).toHaveBeenCalledTimes(1);
  });

  it("cancels unneeded work, cleans inFlight, and prevents late cache insertion", async () => {
    const pending = deferred<Buffer>();
    const started = deferred<void>();
    const { extractor, backend } = create(async () => { started.resolve(); return pending.promise; });
    const abort = new AbortController();
    const first = extractor.extractFrame(source, 1, 30, abort.signal);
    const failed = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await started.promise;
    abort.abort();
    await failed;
    expect(backend.extract.mock.calls[0]?.[2]?.aborted).toBe(true);
    pending.resolve(Buffer.from("late"));
    await extractor.extractFrame(source, 1, 30);
    expect(backend.extract).toHaveBeenCalledTimes(2);
    expect(extractor.getStats().cacheEntries).toBe(1);
  });

  it("retries failed work and disposes pending work without late cache writes", async () => {
    const pending = deferred<Buffer>();
    const started = deferred<void>();
    const { extractor, backend } = create(async () => { started.resolve(); return pending.promise; });
    backend.extract.mockRejectedValueOnce(new Error("decode failed"));
    await expect(extractor.extractFrame(source, 1, 30)).rejects.toThrow("decode failed");
    const request = extractor.extractFrame(source, 1, 30);
    const failed = expect(request).rejects.toThrow();
    await started.promise;
    const disposal = extractor.dispose();
    pending.resolve(Buffer.from("late"));
    await failed;
    await disposal;
    expect(extractor.dispose()).toBe(disposal);
    expect(backend.dispose).toHaveBeenCalledTimes(1);
    expect(extractor.getStats().cacheEntries).toBe(0);
    await expect(extractor.extractFrame(source, 0, 30)).rejects.toThrow("disposed");
  });

  it("coalesces remote snapshots and retries failed downloads", async () => {
    const fetch = vi.fn(async () => new Response("video"));
    fetch.mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    const { extractor, backend } = create(async () => Buffer.from("png"));
    const url = "https://example.test/clip.mp4";
    await expect(extractor.extractFrame(url, 0, 30)).rejects.toThrow("offline");
    await Promise.all([extractor.extractFrame(url, 0, 30), extractor.extractFrame(url, 1, 30)]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(backend.extract).toHaveBeenCalledTimes(2);
    const downloaded = backend.extract.mock.calls[0]![0];
    await extractor.dispose();
    await expect(stat(downloaded)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
