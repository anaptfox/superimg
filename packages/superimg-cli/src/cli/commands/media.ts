import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createRuntime, inspectFile, readByteStream, startConversion } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node";
import { normalizeTrim, selectMediaTrack, type ConversionRequest, type MediaInspection } from "@superimg/types";
import { buildEncodingOptions } from "./render-encoding.js";
import { attachMediaJobControls } from "../utils/media-job-controls.js";

interface ProbeOptions {
  json?: boolean;
}

interface ImportOptions {
  name?: string;
  start?: string;
  duration?: string;
  json?: boolean;
}

interface ConvertOptions {
  plan?: string;
  format?: "mp4" | "webm" | "mov" | "mkv";
  output?: string;
  videoTrack?: string;
  audioTrack?: string[];
  preset?: string;
  quality?: string;
  alpha?: string;
  videoQuantizer?: string;
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  bitrateMode?: string;
  audioBitrateMode?: string;
  json?: boolean;
}

export async function mediaProbeCommand(input: string, options: ProbeOptions = {}): Promise<void> {
  assertLocalMediaInput(input);
  const file = resolve(input);
  const runtime = createRuntime(createNodeRuntimeAdapter());
  let result: MediaInspection;
  try {
    result = await inspectFile(runtime, await fileInput(file));
  } finally {
    await runtime.dispose();
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\nMedia inspection: ${file}`);
  console.log(`  mime: ${result.mimeType}`);
  console.log(`  size: ${result.byteLength} bytes`);
  if (result.durationSeconds !== undefined) console.log(`  duration: ${result.durationSeconds}s`);
  for (const track of result.tracks) console.log(`  ${track.kind} ${track.id}: ${[track.codec, track.width && track.height ? `${track.width}x${track.height}` : "", track.fps ? `${track.fps}fps` : "", track.channels ? `${track.channels}ch` : ""].filter(Boolean).join(" ")}`);
  console.log("");
}

export async function mediaConvertCommand(input: string | undefined, options: ConvertOptions = {}): Promise<void> {
  if (options.plan) return mediaConvertPlanCommand(options.plan, options);
  if (!input) throw new Error("media convert requires a file or --plan");
  assertLocalMediaInput(input);
  const file = resolve(input);
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    const media = await fileInput(file);
    const inspection = await inspectFile(runtime, media);
    const video = options.videoTrack === undefined
      ? inspection.tracks.find((track) => track.kind === "video")
      : selectMediaTrack(inspection, options.videoTrack, "video");
    if (!video || video.kind !== "video") throw new Error("Conversion requires a video track; use media probe to select --video-track.");
    const requestedAudio = options.audioTrack ?? inspection.tracks.filter((track) => track.kind === "audio").map((track) => track.id);
    const audio = requestedAudio.map((trackId, index) => {
      const track = selectMediaTrack(inspection, trackId, "audio");
      if (!track) throw new Error(`Unknown audio track: ${trackId}`);
      return { id: `audio-${index + 1}`, sourceId: "input", trackId };
    });
    const encoding = buildEncodingOptions(options);
    const format = options.format ?? (encoding?.format === "mov" ? "mov" : "mp4");
    const { format: _ignored, ...conversionEncoding } = encoding ?? {};
    const job = startConversion(runtime, {
      sources: [{ id: "input", input: media }], video: { sourceId: "input", trackId: video.id }, audio, format,
      ...(Object.keys(conversionEncoding).length ? { encoding: conversionEncoding } : {}),
    });
    const detachControls = attachMediaJobControls(job);
    try {
      const artifact = await job.result;
      try {
      const output = resolve(options.output ?? join(dirname(file), `${basename(file, extname(file))}.${format}`));
      if (output === file) throw new Error("Conversion output must not overwrite its input");
      const temporary = join(dirname(output), `.${basename(output)}.${process.pid}.tmp`);
      try {
        await writeFile(temporary, await readByteStream(artifact.open()));
        await rename(temporary, output);
      } catch (error) {
        await rm(temporary, { force: true });
        throw error;
      }
      const receipt = { output, mimeType: artifact.mimeType, byteLength: artifact.byteLength, sha256: artifact.sha256, durationSeconds: artifact.durationSeconds, tracks: artifact.tracks };
      if (options.json) console.log(JSON.stringify(receipt, null, 2)); else console.log(`Converted media: ${output}`);
      } finally { await artifact.dispose(); }
    } finally { detachControls(); await job.dispose(); }
  } finally { await runtime.dispose(); }
}

async function mediaConvertPlanCommand(planPath: string, options: ConvertOptions): Promise<void> {
  const absolutePlan = resolve(planPath);
  const plan = JSON.parse(await readFile(absolutePlan, "utf8")) as Omit<ConversionRequest, "sources"> & { sources: Array<{ id: string; path: string }> };
  if (!Array.isArray(plan.sources) || plan.sources.length === 0 || !plan.video || !plan.format) throw new Error("Conversion plan requires sources, video, and format");
  const ids = new Set<string>();
  const sourceFiles = await Promise.all(plan.sources.map(async (source) => {
    if (!source.id || !source.path || ids.has(source.id)) throw new Error(`Invalid or duplicate plan source id: ${source.id}`);
    ids.add(source.id); const path = resolve(dirname(absolutePlan), source.path); assertLocalMediaInput(path);
    return { id: source.id, path, input: await fileInput(path) };
  }));
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    const inspections = new Map(await Promise.all(sourceFiles.map(async (source) => [source.id, await inspectFile(runtime, source.input)] as const)));
    validateSelection(plan.video, "video", inspections);
    for (const audio of plan.audio ?? []) validateSelection(audio, "audio", inspections);
    const request: ConversionRequest = { ...plan, audio: plan.audio ?? [], sources: sourceFiles.map(({ id, input }) => ({ id, input })) };
    const job = startConversion(runtime, request);
    const detachControls = attachMediaJobControls(job);
    try {
      const artifact = await job.result;
      try {
      const output = resolve(options.output ?? join(dirname(absolutePlan), `${basename(absolutePlan, extname(absolutePlan))}.${plan.format}`));
      if (sourceFiles.some((source) => source.path === output)) throw new Error("Conversion output must not overwrite a plan source");
      const temporary = join(dirname(output), `.${basename(output)}.${process.pid}.tmp`);
      try { await writeFile(temporary, await readByteStream(artifact.open())); await rename(temporary, output); } catch (error) { await rm(temporary, { force: true }); throw error; }
      const receipt = { output, mimeType: artifact.mimeType, byteLength: artifact.byteLength, sha256: artifact.sha256, durationSeconds: artifact.durationSeconds, tracks: artifact.tracks };
      if (options.json) console.log(JSON.stringify(receipt, null, 2)); else console.log(`Converted media: ${output}`);
      } finally { await artifact.dispose(); }
    } finally { detachControls(); await job.dispose(); }
  } finally { await runtime.dispose(); }
}

export function validateSelection(selection: { sourceId: string; trackId: string; trim?: { startSeconds?: number; endSeconds?: number } }, kind: "video" | "audio", inspections: ReadonlyMap<string, MediaInspection>) {
  const inspection = inspections.get(selection.sourceId);
  const track = inspection && selectMediaTrack(inspection, selection.trackId, kind);
  if (!track) throw new Error(`Unknown ${kind} track ${selection.sourceId}:${selection.trackId}`);
  if (selection.trim) normalizeTrim(selection.trim, track.durationSeconds ?? inspection!.durationSeconds ?? 0);
}

async function fileInput(file: string) { return { kind: "bytes" as const, bytes: new Uint8Array(await readFile(file)), mimeType: mimeType(file) }; }
function mimeType(file: string) { const ext = extname(file).toLowerCase(); return ext === ".mov" ? "video/quicktime" : ext === ".mkv" ? "video/x-matroska" : ext === ".webm" ? "video/webm" : "video/mp4"; }

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

function sanitizeName(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!sanitized) throw new Error("Media import name cannot be empty");
  return sanitized;
}
