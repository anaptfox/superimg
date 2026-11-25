//! Versioned, byte-bounded clip frames with shared cancellation-safe extraction.

import { createWriteStream } from "node:fs";
import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { resolveLocalAssetPath } from "./resolve-local-asset-path.js";

const DEFAULT_CACHE_ENTRIES = 128;
const DEFAULT_CACHE_BYTES = 64 * 1024 * 1024;

export interface FrameExtractionContext {
  /** Canonical path plus filesystem identity/version of the source being read. */
  sourceVersion: string;
}

export interface FrameExtractorBackend {
  extract(absPath: string, t: number, signal?: AbortSignal, context?: FrameExtractionContext): Promise<Buffer>;
  dispose(): Promise<void>;
}

export interface FrameExtractorOptions {
  maxCacheEntries?: number;
  maxCacheBytes?: number;
  maxOpenSources?: number;
}

export interface FrameExtractStats {
  extractMs: number;
  hits: number;
  misses: number;
  cacheBytes: number;
  cacheEntries: number;
}

class LazyNativeBackend implements FrameExtractorBackend {
  private backend: Promise<FrameExtractorBackend> | undefined;
  constructor(private readonly maxOpenSources: number) {}
  private load(): Promise<FrameExtractorBackend> {
    return this.backend ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "./persistent-frame-decoder.js")
      .then(({ PersistentFrameDecoder }) => new PersistentFrameDecoder(this.maxOpenSources));
  }
  async extract(path: string, time: number, signal?: AbortSignal, context?: FrameExtractionContext): Promise<Buffer> {
    signal?.throwIfAborted();
    return (await this.load()).extract(path, time, signal, context);
  }
  async dispose(): Promise<void> {
    if (this.backend) await (await this.backend).dispose();
  }
}

type SharedWork<T> = {
  controller: AbortController;
  consumers: number;
  settled: boolean;
  promise: Promise<T>;
};

export class FrameExtractor {
  private readonly cache = new Map<string, { path: string; bytes: Buffer }>();
  private readonly inFlight = new Map<string, SharedWork<Buffer>>();
  private readonly downloading = new Map<string, SharedWork<string>>();
  private readonly activeWork = new Set<Promise<unknown>>();
  private readonly tempDownloads = new Map<string, string>();
  private readonly versions = new Map<string, string>();
  private readonly backend: FrameExtractorBackend;
  private readonly maxCacheEntries: number;
  private readonly maxCacheBytes: number;
  private disposed = false;
  private disposal: Promise<void> | undefined;
  private stats = { extractMs: 0, hits: 0, misses: 0, cacheBytes: 0 };

  constructor(
    backend?: FrameExtractorBackend,
    options: number | FrameExtractorOptions = {},
    private readonly registeredAssetResolver?: (src: string) => string | undefined,
  ) {
    const opts = typeof options === "number" ? { maxCacheEntries: options } : options;
    this.maxCacheEntries = nonnegativeInteger(opts.maxCacheEntries ?? DEFAULT_CACHE_ENTRIES, "maxCacheEntries");
    this.maxCacheBytes = nonnegativeInteger(opts.maxCacheBytes ?? DEFAULT_CACHE_BYTES, "maxCacheBytes");
    const maxOpenSources = nonnegativeInteger(opts.maxOpenSources ?? 4, "maxOpenSources");
    if (maxOpenSources === 0) throw new TypeError("maxOpenSources must be positive");
    this.backend = backend ?? new LazyNativeBackend(maxOpenSources);
  }

  getStats(): FrameExtractStats {
    return { ...this.stats, cacheEntries: this.cache.size };
  }

  async extractFrame(src: string, t: number, fps: number, signal?: AbortSignal): Promise<Buffer> {
    this.assertActive(signal);
    if (!Number.isFinite(t) || t < 0) throw new TypeError("Clip time must be finite and nonnegative");
    if (!Number.isFinite(fps) || fps <= 0) throw new TypeError("Clip fps must be finite and positive");
    // Mediabunny/WebCodecs use microsecond timestamps. Normalize both identity and
    // the decoder request, never quantize media time to the output rendition's fps.
    const ticks = Math.round(t * 1_000_000);
    if (!Number.isSafeInteger(ticks)) throw new RangeError("Clip timestamp is out of range");
    const time = ticks / 1_000_000;
    const path = await this.resolveSrc(src, signal);
    this.assertActive(signal);
    const sourceVersion = await versionOf(path);
    this.assertActive(signal);
    if (this.versions.get(path) !== sourceVersion) {
      for (const [key, item] of this.cache) if (item.path === path) this.deleteCached(key);
      this.versions.set(path, sourceVersion);
    }
    const key = JSON.stringify([sourceVersion, ticks]);
    const cached = this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.bytes;
    }
    if (this.inFlight.has(key)) this.stats.hits++;
    return this.share(this.inFlight, key, async (workSignal) => {
      const started = performance.now();
      this.stats.misses++;
      try {
        const bytes = await this.backend.extract(path, time, workSignal, { sourceVersion });
        workSignal.throwIfAborted();
        this.assertActive();
        // A file changed during decoding must not produce a successful stale frame.
        if (await versionOf(path) !== sourceVersion) throw new Error(`Clip source changed during extraction: ${path}`);
        workSignal.throwIfAborted();
        this.assertActive();
        this.setCached(key, path, bytes);
        return bytes;
      } finally {
        this.stats.extractMs += performance.now() - started;
      }
    }, signal);
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    for (const entry of [...this.inFlight.values(), ...this.downloading.values()]) entry.controller.abort();
    this.inFlight.clear();
    this.downloading.clear();
    this.cache.clear();
    this.versions.clear();
    this.stats.cacheBytes = 0;
    this.disposal = (async () => {
      // Native disposal interrupts reads; wait for work before deleting its files.
      const disposal = this.backend.dispose();
      await Promise.allSettled([...this.activeWork, disposal]);
      await Promise.all([...this.tempDownloads.values()].map((dir) => rm(dir, { recursive: true, force: true })));
      this.tempDownloads.clear();
    })();
    return this.disposal;
  }

  private share<T>(map: Map<string, SharedWork<T>>, key: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    this.assertActive(signal);
    let entry = map.get(key);
    if (!entry) {
      const controller = new AbortController();
      const created: SharedWork<T> = { controller, consumers: 0, settled: false, promise: undefined! };
      created.promise = Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return work(controller.signal);
      }).finally(() => {
        created.settled = true;
        if (map.get(key) === created) map.delete(key);
        this.activeWork.delete(created.promise);
      });
      map.set(key, created);
      this.activeWork.add(created.promise);
      entry = created;
    }
    const shared = entry;
    shared.consumers++;
    return new Promise<T>((resolve, reject) => {
      let done = false;
      const finish = (callback: () => void) => {
        if (done) return;
        done = true;
        signal?.removeEventListener("abort", abort);
        shared.consumers--;
        if (!shared.settled && shared.consumers === 0) {
          if (map.get(key) === shared) map.delete(key);
          shared.controller.abort();
        }
        callback();
      };
      const abort = () => finish(() => reject(signal?.reason ?? new DOMException("Aborted", "AbortError")));
      signal?.addEventListener("abort", abort, { once: true });
      shared.promise.then((value) => finish(() => resolve(value)), (error: unknown) => finish(() => reject(error)));
      if (signal?.aborted) abort();
    });
  }

  private assertActive(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.disposed) throw new Error("Frame extractor is disposed");
  }

  private deleteCached(key: string): void {
    const item = this.cache.get(key);
    if (!item) return;
    this.stats.cacheBytes -= item.bytes.byteLength;
    this.cache.delete(key);
  }

  private setCached(key: string, path: string, bytes: Buffer): void {
    if (this.maxCacheEntries === 0 || bytes.byteLength > this.maxCacheBytes) return;
    this.deleteCached(key);
    this.cache.set(key, { path, bytes });
    this.stats.cacheBytes += bytes.byteLength;
    while (this.cache.size > this.maxCacheEntries || this.stats.cacheBytes > this.maxCacheBytes) {
      this.deleteCached(this.cache.keys().next().value!);
    }
  }

  private async resolveSrc(src: string, signal?: AbortSignal): Promise<string> {
    const local = this.registeredAssetResolver?.(src) ?? resolveLocalAssetPath(src);
    if (local) return realpath(local);
    // Remote sources are downloaded once per extractor lifetime: one immutable
    // export snapshot. Local/registered sources are versioned on every request.
    const cached = this.tempDownloads.get(src);
    if (cached) return join(cached, "source" + this.guessExt(src));
    return this.share(this.downloading, src, async (workSignal) => {
      const dir = await mkdtemp(join(tmpdir(), "superimg-clip-"));
      const dest = join(dir, "source" + this.guessExt(src));
      try {
        workSignal.throwIfAborted();
        const res = await fetch(src, { signal: workSignal });
        if (!res.ok || !res.body) throw new Error(`Failed to download clip source ${src}: HTTP ${res.status}`);
        const configuredMaximum = Number(process.env.SUPERIMG_MAX_REMOTE_ASSET_BYTES ?? 536_870_912);
        const maximumBytes = Number.isFinite(configuredMaximum) && configuredMaximum > 0 ? configuredMaximum : 536_870_912;
        if (Number(res.headers.get("content-length") ?? 0) > maximumBytes) {
          await res.body.cancel();
          throw new Error(`Clip source exceeds ${maximumBytes} bytes`);
        }
        let downloadedBytes = 0;
        const limiter = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            downloadedBytes += chunk.byteLength;
            if (downloadedBytes > maximumBytes) controller.error(new Error(`Clip source exceeds ${maximumBytes} bytes`));
            else controller.enqueue(chunk);
          },
        });
        await pipeline(
          Readable.fromWeb(res.body.pipeThrough(limiter) as import("node:stream/web").ReadableStream),
          createWriteStream(dest),
          { signal: workSignal },
        );
        workSignal.throwIfAborted();
        this.assertActive();
        this.tempDownloads.set(src, dir);
        return dest;
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
    }, signal);
  }

  private guessExt(src: string): string {
    try { return extname(new URL(src).pathname) || ".mp4"; }
    catch { return ".mp4"; }
  }
}

async function versionOf(path: string): Promise<string> {
  const s = await stat(path, { bigint: true });
  if (!s.isFile()) throw new Error(`Clip source is not a file: ${path}`);
  return JSON.stringify([path, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String));
}

function nonnegativeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a nonnegative safe integer`);
  return value;
}
