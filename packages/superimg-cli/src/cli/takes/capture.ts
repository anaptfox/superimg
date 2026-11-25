//! Turn one finished export into a take. The caller supplies the file list in tests.
// Poster capture is best-effort and never discards the source snapshot.

import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import type { CompiledNodeMediaSource } from "@foxworth/superimg-node/source";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  isScratchMedia,
  packagesFromFiles,
  recordTake,
  sourcesFromFiles,
  takeDirectory,
  type TakeRecord,
  type TakeRendition,
} from "./store.js";

export type ExportTakeDescription = {
  programHash?: string;
  canvas?: { width: number; height: number };
  fps?: number;
  duration?: number;
};

export type ExportTakeManifest = {
  renditions?: unknown;
  runtime?: unknown;
};

export type RememberedTake = {
  id: string;
  directory: string;
  record: TakeRecord;
};

let codecsReady: Promise<void> | undefined;

async function ensureCodecs(): Promise<void> {
  if (!codecsReady) {
    codecsReady = import("@mediabunny/server").then((server) => {
      const register = (server as { registerMediabunnyServer?: () => void }).registerMediabunnyServer;
      register?.();
    }).catch((error: unknown) => {
      codecsReady = undefined;
      throw error;
    });
  }
  await codecsReady;
}

function programDigestOf(manifest: ExportTakeManifest): string | undefined {
  const runtime = manifest.runtime;
  if (!runtime || typeof runtime !== "object") return undefined;
  const digest = (runtime as { programDigest?: unknown }).programDigest;
  return typeof digest === "string" && digest ? digest : undefined;
}

export function renditionsFromManifest(
  manifest: ExportTakeManifest,
  publicationPath: string,
  copyTo?: string,
): TakeRendition[] {
  if (!Array.isArray(manifest.renditions)) return [];
  const renditions: TakeRendition[] = [];
  for (const entry of manifest.renditions) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const sha256 = typeof record.sha256 === "string" ? record.sha256.toLowerCase() : "";
    if (!/^[a-f0-9]{64}$/.test(sha256)) continue;
    const relativePath = typeof record.path === "string" ? record.path : undefined;
    const path = relativePath
      ? (isAbsolute(relativePath) ? resolve(relativePath) : resolve(publicationPath, relativePath))
      : undefined;
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : undefined;
    const coordinates = record.coordinates;
    let label: string | undefined;
    if (coordinates && typeof coordinates === "object") {
      const names = coordinates as Record<string, unknown>;
      if (typeof names.renditionId === "string") label = names.renditionId;
      else if (typeof names.editionId === "string") label = names.editionId;
    }
    renditions.push({
      sha256,
      ...(path ? { path } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(label ? { label } : {}),
    });
  }
  if (copyTo && renditions.length > 0) {
    const hashes = new Set(renditions.map((rendition) => rendition.sha256));
    const path = resolve(copyTo);
    if (hashes.size === 1 && !renditions.some((rendition) => rendition.path === path)) {
      renditions.push({ ...renditions[0]!, path });
    }
  }
  return renditions;
}

function isImage(rendition: TakeRendition): boolean {
  return rendition.mimeType?.startsWith("image/") === true || /\.(png|jpe?g|webp|gif)$/i.test(rendition.path ?? "");
}

function isVideo(rendition: TakeRendition): boolean {
  return rendition.mimeType?.startsWith("video/") === true || /\.(mp4|webm|mov|mkv)$/i.test(rendition.path ?? "");
}

async function jpegFromImage(file: string): Promise<Uint8Array> {
  const sharp = (await import("sharp")).default;
  return new Uint8Array(await sharp(file).jpeg({ quality: 80 }).toBuffer());
}

async function firstFrameJpeg(file: string): Promise<Uint8Array | undefined> {
  await ensureCodecs();
  const media = await import("mediabunny");
  const movie = new media.Input({ source: new media.FilePathSource(file), formats: media.ALL_FORMATS });
  try {
    const track = await movie.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return undefined;
    const sharp = (await import("sharp")).default;
    for await (const sample of new media.VideoSampleSink(track).samples(0, 0.1)) {
      try {
        const width = sample.displayWidth;
        const height = sample.displayHeight;
        const layout = [{ offset: 0, stride: width * 4 }];
        const options = { format: "RGBA" as const, layout };
        const rgba = new Uint8Array(sample.allocationSize(options));
        await sample.copyTo(rgba, options);
        return new Uint8Array(await sharp(rgba, { raw: { width, height, channels: 4 } }).jpeg({ quality: 80 }).toBuffer());
      } finally {
        sample.close();
      }
    }
    return undefined;
  } finally {
    movie.dispose();
  }
}

async function tryPoster(renditions: readonly TakeRendition[]): Promise<Uint8Array | undefined> {
  for (const rendition of renditions) {
    if (!rendition.path || !existsSync(rendition.path)) continue;
    try {
      if (isImage(rendition)) return await jpegFromImage(rendition.path);
    } catch {
      // Another rendition may still produce a poster.
    }
  }
  for (const rendition of renditions) {
    if (!rendition.path || !existsSync(rendition.path) || !isVideo(rendition)) continue;
    try {
      const poster = await firstFrameJpeg(rendition.path);
      if (poster) return poster;
    } catch {
      // The source snapshot does not depend on a decoded frame.
    }
  }
  return undefined;
}

export async function listMediaTakeFiles(
  templatePath: string,
  options: { preparedSource?: CompiledNodeMediaSource } = {},
): Promise<readonly string[]> {
  const resolvedTemplate = resolve(templatePath);
  const mediaDir = dirname(resolvedTemplate);
  const projectRoot = findProjectRoot(mediaDir);
  const files = new Set<string>();
  try {
    const { compileNodeMediaSource, listNodeMediaLocalAssets } = await import("@foxworth/superimg-node/source");
    const loaded = options.preparedSource ?? await compileNodeMediaSource(projectRoot, resolvedTemplate);
    for (const file of loaded.bundle.dependencies ?? []) {
      files.add(resolve(mediaDir, file));
    }
    if (loaded.compiled.media) {
      const localAssets = await listNodeMediaLocalAssets(loaded.compiled.media, resolvedTemplate, projectRoot);
      for (const file of localAssets) {
        files.add(resolve(mediaDir, file));
      }
    }
    return [...files];
  } catch {
    const { bundleMediaProgram } = await import("@superimg/core/bundler");
    const bundle = await bundleMediaProgram(resolvedTemplate);
    return bundle.dependencies ?? [];
  }
}

export async function rememberExportTake(input: {
  templatePath: string;
  description: ExportTakeDescription;
  manifest: ExportTakeManifest;
  publicationPath: string;
  copyTo?: string;
  /** A name for this take, such as "cut 3". */
  label?: string;
  preparedSource?: CompiledNodeMediaSource;
  listFiles?: (templatePath: string) => Promise<readonly string[]>;
  readPoster?: (renditions: readonly TakeRendition[]) => Promise<Uint8Array | undefined>;
  now?: Date;
}): Promise<RememberedTake | undefined> {
  if (isScratchMedia(input.templatePath)) return undefined;
  const templatePath = resolve(input.templatePath);
  const mediaDir = dirname(templatePath);
  const listed = input.listFiles
    ? await input.listFiles(templatePath)
    : await listMediaTakeFiles(templatePath, input.preparedSource ? { preparedSource: input.preparedSource } : {});
  const paths = new Set(listed.map((file) => resolve(mediaDir, file)));
  paths.add(templatePath);
  const sources = sourcesFromFiles(mediaDir, [...paths]);
  const packages = packagesFromFiles(mediaDir, [...paths]);
  const renditions = renditionsFromManifest(input.manifest, input.publicationPath, input.copyTo);
  let poster: Uint8Array | undefined;
  try {
    poster = input.readPoster ? await input.readPoster(renditions) : await tryPoster(renditions);
  } catch {
    poster = undefined;
  }
  const canvas = input.description.canvas
    && Number.isFinite(input.description.canvas.width)
    && Number.isFinite(input.description.canvas.height)
    ? input.description.canvas
    : undefined;
  const programHash = input.description.programHash || programDigestOf(input.manifest);
  const record = recordTake({
    mediaDir,
    mediaFile: templatePath,
    sources,
    ...(programHash ? { programHash } : {}),
    ...(canvas ? { canvas } : {}),
    ...(input.description.fps !== undefined ? { fps: input.description.fps } : {}),
    ...(input.description.duration !== undefined ? { duration: input.description.duration } : {}),
    renditions,
    ...(poster ? { poster } : {}),
    ...(input.label ? { label: input.label } : {}),
    packages,
    ...(input.now ? { now: input.now } : {}),
  });
  return { id: record.id, directory: takeDirectory(mediaDir, record.id), record };
}
