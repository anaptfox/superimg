import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type {
  ExportBundleManifest,
  ExportBundleReceipt,
} from "@superimg/adapters/media-project";
import type { MediaExportPlan, PlannedRendition } from "@superimg/core/export";
import { serializeMediaIRPretty, validateMediaIR } from "@superimg/core/ir";
import type { MediaCoordinates, MediaIR } from "@superimg/types";

const MEDIA_IR_MIME_TYPE = "application/vnd.superimg.media-ir+json";

export type { ExportBundleManifest, ExportBundleReceipt } from "@superimg/adapters/media-project";

export interface PublishExportBundleOptions<TData extends object> {
  readonly finalPath: string;
  readonly plan: MediaExportPlan<TData>;
  readonly destinationRegistryDigest: string;
  readonly producerVersion: string;
  /** One compiler-produced MediaIR document for every planned media coordinate. */
  readonly media: readonly MediaIR[];
  /** Render every planned rendition beneath stagingRoot/media. */
  readonly render: (stagingRoot: string) => Promise<void>;
}

/**
 * Publish a complete export directory without exposing a partial bundle.
 * Preflight belongs before this function. The manifest is validated and
 * written last, then the sibling staging directory replaces the prior bundle.
 */
export async function publishExportBundle<TData extends object>(
  options: PublishExportBundleOptions<TData>,
): Promise<ExportBundleReceipt> {
  const finalPath = resolve(options.finalPath);
  const parent = dirname(finalPath);
  const token = randomUUID();
  const stagingPath = join(parent, `.${basename(finalPath)}.staging-${token}`);
  const backupPath = join(parent, `.${basename(finalPath)}.backup-${token}`);
  mkdirSync(parent, { recursive: true });
  mkdirSync(join(stagingPath, "media"), { recursive: true });

  try {
    await options.render(stagingPath);
    const media = writeMediaIr(options, stagingPath);
    const manifest = buildManifest(options, stagingPath, media);
    // Manifest-last: its presence means every referenced rendition was read,
    // bounded to the bundle, and hashed successfully.
    writeFileSync(join(stagingPath, "export.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    publishDirectory(stagingPath, finalPath, backupPath);
    return { schemaVersion: 0, path: finalPath, manifest };
  } catch (error) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

function buildManifest<TData extends object>(
  options: PublishExportBundleOptions<TData>,
  stagingPath: string,
  media: ExportBundleManifest["media"],
): ExportBundleManifest {
  const renditions = options.plan.renditions.map((planned) => {
    const relativePath = `media/${planned.relativePath}`;
    const absolutePath = confinedPath(stagingPath, relativePath);
    const link = lstatSync(absolutePath);
    if (link.isSymbolicLink()) throw new Error(`Export rendition cannot be a symlink: ${relativePath}`);
    const file = statSync(absolutePath);
    if (!file.isFile()) throw new Error(`Export rendition is not a file: ${relativePath}`);
    assertContainedAbsolute(realpathSync(stagingPath), realpathSync(absolutePath), relativePath);
    const bytes = readFileSync(absolutePath);
    return {
      coordinates: planned.coordinates,
      path: relativePath,
      mimeType: mimeType(planned.format),
      format: planned.format,
      width: planned.canvas.width,
      height: planned.canvas.height,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      encoder: encoderName(planned.format),
    };
  });

  const entries = new Map<string, string>();
  for (const planned of options.plan.renditions) {
    const id = planned.coordinates.entryId;
    if (id !== undefined && planned.entryDataDigest !== undefined) entries.set(id, planned.entryDataDigest);
  }
  return {
    schemaVersion: 0,
    kind: "media-export",
    sourceId: options.plan.sourceId,
    requestDigest: options.plan.requestDigest,
    destinationRegistryDigest: options.destinationRegistryDigest,
    producer: { name: "superimg", version: options.producerVersion },
    entries: [...entries]
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([id, dataDigest]) => ({ id, dataDigest })),
    media,
    posters: [],
    renditions,
  };
}

function writeMediaIr<TData extends object>(
  options: PublishExportBundleOptions<TData>,
  stagingPath: string,
): ExportBundleManifest["media"] {
  const expected = new Map(
    options.plan.coordinates.map((coordinates) => [coordinateIdentity(coordinates), coordinates]),
  );
  const supplied = new Map<string, MediaIR>();
  for (const candidate of options.media) {
    const ir = validateMediaIR(candidate);
    const key = coordinateIdentity(ir.identity);
    if (supplied.has(key)) {
      throw new Error(`Duplicate MediaIR for coordinate ${displayCoordinates(ir.identity)}`);
    }
    const coordinates = expected.get(key);
    if (coordinates === undefined) {
      throw new Error(`Unexpected MediaIR coordinate ${displayCoordinates(ir.identity)}`);
    }
    supplied.set(key, ir);
  }

  const paths = new Map<string, string>();
  const records = options.plan.coordinates.map((coordinates) => {
    const key = coordinateIdentity(coordinates);
    const ir = supplied.get(key);
    if (ir === undefined) {
      throw new Error(`Missing MediaIR for coordinate ${displayCoordinates(coordinates)}`);
    }
    const path = mediaIrPath(coordinates);
    const foldedPath = path.normalize("NFC").toLocaleLowerCase("en-US");
    const pathOwner = paths.get(foldedPath);
    if (pathOwner !== undefined) {
      throw new Error(
        `MediaIR paths for ${pathOwner} and ${displayCoordinates(coordinates)} collide at ${path}`,
      );
    }
    paths.set(foldedPath, displayCoordinates(coordinates));
    const absolutePath = confinedPath(stagingPath, path);
    assertNoSymlinkPath(stagingPath, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    const serialized = serializeMediaIRPretty(ir);
    writeFileSync(absolutePath, serialized, "utf8");
    assertContainedAbsolute(realpathSync(stagingPath), realpathSync(absolutePath), path);
    const bytes = Buffer.byteLength(serialized);
    return {
      schemaVersion: 0 as const,
      coordinates,
      path,
      mimeType: MEDIA_IR_MIME_TYPE as typeof MEDIA_IR_MIME_TYPE,
      bytes,
      sha256: createHash("sha256").update(serialized).digest("hex"),
      hashes: ir.hashes,
      extensions: ir.extensions,
    };
  });

  if (supplied.size !== expected.size) {
    throw new Error(`Expected ${expected.size} MediaIR documents, received ${supplied.size}`);
  }
  return records;
}

function assertNoSymlinkPath(root: string, relativePath: string): void {
  let candidate = resolve(root);
  for (const segment of relativePath.split("/")) {
    candidate = join(candidate, segment);
    if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink()) {
      throw new Error(`Export artifact path cannot contain a symlink: ${relativePath}`);
    }
  }
}

function mediaIrPath(coordinates: MediaCoordinates): string {
  return [
    "ir",
    ...(coordinates.entryId === undefined ? [] : [coordinates.entryId]),
    coordinates.variantId,
    `${coordinates.editionId}.media.json`,
  ].join("/");
}

function coordinateIdentity(coordinates: MediaCoordinates): string {
  return [
    coordinates.sourceId,
    coordinates.entryId ?? "",
    coordinates.variantId,
    coordinates.editionId,
  ].join("\u0000");
}

function displayCoordinates(coordinates: MediaCoordinates): string {
  return JSON.stringify({
    sourceId: coordinates.sourceId,
    ...(coordinates.entryId === undefined ? {} : { entryId: coordinates.entryId }),
    variantId: coordinates.variantId,
    editionId: coordinates.editionId,
  });
}

export function confinedPath(root: string, relativePath: string): string {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error(`Invalid export path: ${JSON.stringify(relativePath)}`);
  }
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, relativePath);
  const back = relative(absoluteRoot, absolutePath);
  if (!back || back === ".." || back.startsWith(`..${sep}`) || back.includes(`${sep}..${sep}`)) {
    throw new Error(`Export path escapes its bundle: ${JSON.stringify(relativePath)}`);
  }
  return absolutePath;
}

function assertContainedAbsolute(root: string, candidate: string, displayPath: string): void {
  const back = relative(root, candidate);
  if (!back || back === ".." || back.startsWith(`..${sep}`) || back.includes(`${sep}..${sep}`)) {
    throw new Error(`Export path escapes its bundle: ${JSON.stringify(displayPath)}`);
  }
}

function publishDirectory(stagingPath: string, finalPath: string, backupPath: string): void {
  let movedPrevious = false;
  try {
    if (existsSync(finalPath)) {
      renameSync(finalPath, backupPath);
      movedPrevious = true;
    }
    renameSync(stagingPath, finalPath);
    if (movedPrevious) {
      try {
        rmSync(backupPath, { recursive: true, force: true });
      } catch {
        // Publication already succeeded; a stale hidden backup is safer than
        // reporting failure after the new complete bundle became visible.
      }
    }
  } catch (error) {
    if (!existsSync(finalPath) && movedPrevious && existsSync(backupPath)) renameSync(backupPath, finalPath);
    throw error;
  }
}

function mimeType(format: PlannedRendition["format"]): string {
  return ({
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    gif: "image/gif",
    png: "image/png",
    webp: "image/webp",
    jpeg: "image/jpeg",
    svg: "image/svg+xml",
    html: "text/html; charset=utf-8",
  } as const)[format];
}

function encoderName(format: PlannedRendition["format"]): string {
  if (format === "mp4" || format === "webm" || format === "mov" || format === "mkv") return "mediabunny";
  if (format === "gif") return "ffmpeg";
  if (format === "svg" || format === "html") return "source";
  return "superimg-still";
}
