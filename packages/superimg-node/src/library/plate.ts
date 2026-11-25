import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
import sharp from "sharp";
import { assertPlateBudget, atlasGrid, PLATE_COLUMNS, PLATE_MAX_WIDTH, PLATE_SCHEMA, type PlateManifest } from "./plate-manifest.js";
export type { PlateManifest } from "./plate-manifest.js";
export { assertPlateBudget, atlasGrid, PLATE_COLUMNS, PLATE_MAX_WIDTH, PLATE_SCHEMA, PLATE_MAX_FRAMES, PLATE_MAX_SECONDS } from "./plate-manifest.js";

/** Prepare in memory; the caller owns publication of atlas and manifest bytes. Temporary frames are always removed. */
export async function preparePlate(input: string, options: { signal?: AbortSignal } = {}): Promise<{ manifest: PlateManifest; atlas: Buffer }> {
  options.signal?.throwIfAborted();
  const source = resolve(input);
  const name = sanitize(basename(source, extname(source)));
  const probe = await probeVideo(source, options.signal);
  assertPlateBudget(probe.totalFrames, probe.durationSeconds);


  const work = await mkdtemp(join(tmpdir(), "superimg-plate-"));
  try {
    const width = Math.min(probe.width, PLATE_MAX_WIDTH);
    const height = Math.max(1, Math.round(probe.height * (width / probe.width)));
    await run("ffmpeg", [
      "-y",
      "-i", source,
      "-vf", `scale=${width}:${height}`,
      join(work, "%06d.png"),
    ], { signal: options.signal });
    const files = (await readdir(work)).filter((f) => f.endsWith(".png")).sort();
    if (files.length === 0) {
      throw new Error(`PLATE_NO_SUBJECT: ffmpeg extracted no frames from ${source}`);
    }
    assertPlateBudget(files.length, files.length / Math.max(probe.fps, 1));

    options.signal?.throwIfAborted();
    const first = sharp(join(work, files[0]!));
    const meta = await first.metadata();
    const tileWidth = meta.width ?? width;
    const tileHeight = meta.height ?? height;
    const { columns, rows } = atlasGrid(files.length, PLATE_COLUMNS);

    const composites = await Promise.all(files.map(async (file, i) => ({
      input: await sharp(join(work, file)).ensureAlpha().toBuffer(),
      left: (i % columns) * tileWidth,
      top: Math.floor(i / columns) * tileHeight,
    })));
    const atlas = await sharp({
      create: {
        width: columns * tileWidth,
        height: rows * tileHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .webp({ quality: 88, alphaQuality: 90 })
      .toBuffer();

    options.signal?.throwIfAborted();
    const manifest: PlateManifest = {
      schemaVersion: PLATE_SCHEMA,
      name,
      strategy: "atlas",
      source: {
        width: probe.width,
        height: probe.height,
        fps: probe.fps,
        durationSeconds: probe.durationSeconds,
        totalFrames: probe.totalFrames,
      },
      compiled: {
        fps: probe.fps,
        totalFrames: files.length,
        width: tileWidth,
        height: tileHeight,
      },
      atlas: {
        tileWidth,
        tileHeight,
        columns,
        rows,
        sheets: [{ file: "frames/sheet-000.webp", startFrame: 0, frameCount: files.length }],
      },
      compiledAt: new Date().toISOString(),
      toolVersion: "0.1.0",
    };
    return { manifest, atlas };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
async function probeVideo(file: string, signal?: AbortSignal): Promise<{
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
}> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-count_frames",
      "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames:format=duration",
      "-print_format", "json",
      file,
    ], { signal });
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number; r_frame_rate?: string; nb_read_frames?: string }>;
    };
    const stream = parsed.streams?.[0];
    const duration = Number(parsed.format?.duration ?? 0);
    const fps = parseRate(stream?.r_frame_rate ?? "30/1") ?? 30;
    const frames = Number(stream?.nb_read_frames ?? Math.round(duration * fps));
    return {
      width: stream?.width ?? 0,
      height: stream?.height ?? 0,
      fps,
      durationSeconds: Number.isFinite(duration) ? duration : frames / fps,
      totalFrames: Number.isFinite(frames) ? frames : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ffprobe") || message.includes("ENOENT")) {
      throw new Error("ffmpeg/ffprobe not found. Install ffmpeg, then: superimg plate <file>");
    }
    throw error;
  }
}

function parseRate(value: string): number | undefined {
  const [a, b] = value.split("/").map(Number);
  if (!a || !Number.isFinite(a)) return undefined;
  if (!b || !Number.isFinite(b)) return a;
  return Number((a / b).toFixed(3));
}

function sanitize(value: string): string {
  const next = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!next) throw new Error("Plate name cannot be empty");
  return next;
}
