import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { execa } from "execa";
import { findProjectRoot } from "../utils/find-project-root.js";

interface ProbeOptions {
  json?: boolean;
}

interface ImportOptions {
  name?: string;
  start?: string;
  duration?: string;
  json?: boolean;
}

interface ProbeResult {
  path: string;
  sizeBytes: number;
  extension: string;
  ffprobe?: {
    durationSeconds?: number;
    video?: { codec?: string; width?: number; height?: number; fps?: number };
    audio?: { codec?: string };
  };
  note?: string;
}

export async function mediaProbeCommand(input: string, options: ProbeOptions = {}): Promise<void> {
  assertLocalMediaInput(input);
  const file = resolve(input);
  const result = await probeLocalMedia(file);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\nMedia probe: ${result.path}`);
  console.log(`  size: ${result.sizeBytes} bytes`);
  console.log(`  extension: ${result.extension || "(none)"}`);
  if (result.ffprobe) {
    if (result.ffprobe.durationSeconds !== undefined) {
      console.log(`  duration: ${result.ffprobe.durationSeconds}s`);
    }
    if (result.ffprobe.video) {
      const v = result.ffprobe.video;
      console.log(`  video: ${[v.codec, v.width && v.height ? `${v.width}x${v.height}` : "", v.fps ? `${v.fps}fps` : ""].filter(Boolean).join(" ")}`);
    }
    if (result.ffprobe.audio) {
      console.log(`  audio: ${result.ffprobe.audio.codec ?? "present"}`);
    }
  }
  if (result.note) console.log(`  note: ${result.note}`);
  console.log("");
}

export async function mediaImportCommand(input: string, options: ImportOptions = {}): Promise<void> {
  assertLocalMediaInput(input);
  const source = resolve(input);
  const sourceStat = await stat(source);
  if (!sourceStat.isFile()) throw new Error(`Media import source is not a file: ${source}`);

  const projectRoot = findProjectRoot();
  const mediaDir = join(projectRoot, ".superimg", "media");
  await mkdir(mediaDir, { recursive: true });

  const name = sanitizeName(options.name ?? basename(source, extname(source)));
  const extension = extname(source);
  const target = join(mediaDir, `${name}${extension}`);
  await copyFile(source, target);

  const manifest = {
    name,
    source,
    file: target,
    start: options.start ?? null,
    duration: options.duration ?? null,
    importedAt: new Date().toISOString(),
  };
  const manifestPath = join(mediaDir, `${name}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  if (options.json) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  console.log(`Imported media: ${target}`);
  console.log(`Manifest: ${manifestPath}`);
}

export async function mediaCacheCleanCommand(): Promise<void> {
  const projectRoot = findProjectRoot();
  const mediaDir = join(projectRoot, ".superimg", "media");
  await rm(mediaDir, { recursive: true, force: true });
  console.log(`Cleaned media cache: ${mediaDir}`);
}

export function isYoutubeInput(input: string): boolean {
  try {
    const url = new URL(input);
    return url.hostname === "youtu.be" || url.hostname.endsWith(".youtube.com") || url.hostname === "youtube.com";
  } catch {
    return false;
  }
}

function assertLocalMediaInput(input: string): void {
  if (isYoutubeInput(input)) {
    throw new Error(
      "YouTube is supported as an external embed, not a media import source. Use ctx.std.media.youtube() in templates."
    );
  }
  if (/^https?:\/\//i.test(input)) {
    throw new Error("Media import/probe supports local files only. Use an app-provided resolver for remote media.");
  }
}

async function probeLocalMedia(file: string): Promise<ProbeResult> {
  const fileStat = await stat(file);
  if (!fileStat.isFile()) throw new Error(`Media probe target is not a file: ${file}`);
  const result: ProbeResult = {
    path: file,
    sizeBytes: fileStat.size,
    extension: extname(file).replace(/^\./, ""),
  };

  try {
    const { stdout } = await execa("ffprobe", [
      "-v", "error",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      file,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<Record<string, unknown>>;
    };
    result.ffprobe = normalizeFfprobe(parsed);
  } catch {
    result.note = "ffprobe not available; showing filesystem metadata only";
  }

  return result;
}

function normalizeFfprobe(parsed: {
  format?: { duration?: string };
  streams?: Array<Record<string, unknown>>;
}): NonNullable<ProbeResult["ffprobe"]> {
  const video = parsed.streams?.find((stream) => stream.codec_type === "video");
  const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
  const result: NonNullable<ProbeResult["ffprobe"]> = {};
  const duration = parsed.format?.duration ? Number(parsed.format.duration) : NaN;
  if (Number.isFinite(duration)) result.durationSeconds = Number(duration.toFixed(3));
  if (video) {
    const videoResult: NonNullable<NonNullable<ProbeResult["ffprobe"]>["video"]> = {};
    if (typeof video.codec_name === "string") videoResult.codec = video.codec_name;
    if (typeof video.width === "number") videoResult.width = video.width;
    if (typeof video.height === "number") videoResult.height = video.height;
    if (typeof video.r_frame_rate === "string") {
      const fps = parseRate(video.r_frame_rate);
      if (fps !== undefined) videoResult.fps = fps;
    }
    result.video = videoResult;
  }
  if (audio) {
    const audioResult: NonNullable<NonNullable<ProbeResult["ffprobe"]>["audio"]> = {};
    if (typeof audio.codec_name === "string") audioResult.codec = audio.codec_name;
    result.audio = audioResult;
  }
  return result;
}

function parseRate(value: string): number | undefined {
  const [a, b] = value.split("/").map(Number);
  if (!a || !Number.isFinite(a)) return undefined;
  if (!b || !Number.isFinite(b)) return a;
  return Number((a / b).toFixed(3));
}

function sanitizeName(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized) throw new Error("Media import name cannot be empty");
  return sanitized;
}
