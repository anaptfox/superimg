//! Node-side ffmpeg frame extraction for embedded video clips.

import { execa } from "execa";
import { createWriteStream, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { resolveLocalAssetPath } from "./resolve-local-asset-path.js";

const DEFAULT_CACHE_SIZE = 128;
const FFMPEG_TIMEOUT_MS = 30_000;

export interface FrameExtractorBackend {
  extract(absPath: string, t: number): Promise<Buffer>;
  dispose(): Promise<void>;
}

export interface FrameExtractStats {
  extractMs: number;
  hits: number;
  misses: number;
}

class FfmpegCliBackend implements FrameExtractorBackend {
  async extract(absPath: string, t: number): Promise<Buffer> {
    const result = await execa(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(t),
        "-accurate_seek",
        "-i",
        absPath,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-",
      ],
      { timeout: FFMPEG_TIMEOUT_MS, encoding: "buffer", reject: true },
    );
    const buf = result.stdout;
    if (!buf || buf.length === 0) {
      throw new Error(`ffmpeg produced empty output for ${absPath} at t=${t}s`);
    }
    return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  }

  async dispose(): Promise<void> {
    // Stateless CLI backend — nothing to tear down.
  }
}

export async function ensureFfmpegAvailable(): Promise<void> {
  try {
    await execa("ffmpeg", ["-version"]);
  } catch {
    throw new Error(
      "ffmpeg is required for embedded video clips but was not found on PATH.\n" +
        "Install it: https://ffmpeg.org/download.html\n" +
        "  macOS:   brew install ffmpeg\n" +
        "  Ubuntu:  sudo apt install ffmpeg\n" +
        "  Windows: winget install ffmpeg",
    );
  }
}

export class FrameExtractor {
  private readonly cache = new Map<string, Buffer>();
  private readonly inFlight = new Map<string, Promise<Buffer>>();
  private readonly tempDownloads = new Map<string, string>();
  private readonly backend: FrameExtractorBackend;
  private stats: FrameExtractStats = { extractMs: 0, hits: 0, misses: 0 };

  constructor(
    backend: FrameExtractorBackend = new FfmpegCliBackend(),
    private readonly maxCacheSize = DEFAULT_CACHE_SIZE,
  ) {
    this.backend = backend;
  }

  getStats(): FrameExtractStats {
    return { ...this.stats };
  }

  async extractFrame(src: string, t: number, fps: number): Promise<Buffer> {
    const absPath = await this.resolveSrc(src);
    const frameIndex = Math.round(t * fps);
    const key = `${absPath}:${frameIndex}`;

    const cached = this.cache.get(key);
    if (cached) {
      this.stats.hits++;
      this.touchCache(key, cached);
      return cached;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      this.stats.hits++;
      return pending;
    }

    const promise = this.extractAndCache(absPath, t, key);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  async dispose(): Promise<void> {
    this.cache.clear();
    this.inFlight.clear();
    for (const dir of this.tempDownloads.values()) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup.
      }
    }
    this.tempDownloads.clear();
    await this.backend.dispose();
  }

  private async extractAndCache(absPath: string, t: number, key: string): Promise<Buffer> {
    const t0 = performance.now();
    this.stats.misses++;
    try {
      const png = await this.backend.extract(absPath, t);
      this.setCache(key, png);
      return png;
    } finally {
      this.stats.extractMs += performance.now() - t0;
    }
  }

  private touchCache(key: string, value: Buffer): void {
    this.cache.delete(key);
    this.cache.set(key, value);
  }

  private setCache(key: string, value: Buffer): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    while (this.cache.size > this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private async resolveSrc(src: string): Promise<string> {
    const local = resolveLocalAssetPath(src);
    if (local) {
      if (!existsSync(local)) {
        throw new Error(`Clip source not found: ${local}`);
      }
      return local;
    }

    const cached = this.tempDownloads.get(src);
    if (cached) return join(cached, "source" + this.guessExt(src));

    const dir = mkdtempSync(join(tmpdir(), "superimg-clip-"));
    const dest = join(dir, "source" + this.guessExt(src));
    const res = await fetch(src);
    if (!res.ok) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`Failed to download clip source ${src}: HTTP ${res.status}`);
    }
    if (!res.body) {
      rmSync(dir, { recursive: true, force: true });
      throw new Error(`Failed to download clip source ${src}: empty body`);
    }
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(dest));
    this.tempDownloads.set(src, dir);
    return dest;
  }

  private guessExt(src: string): string {
    try {
      const pathname = new URL(src).pathname;
      const ext = extname(pathname);
      return ext || ".mp4";
    } catch {
      return ".mp4";
    }
  }
}