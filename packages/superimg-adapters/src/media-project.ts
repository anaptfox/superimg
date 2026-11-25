//! Schema-0 host catalog and export-receipt contracts.
//!
//! Discovery, provider snapshot, rendering, and publication live in
//! `@foxworth/superimg-interactions` (`media.project.discover` vs `media.collection.snapshot`).
//! This module does not execute providers and does not invent a second interaction.

import type {
  DeterministicMediaKind,
  MediaCoordinates,
  MediaIR,
  Medium,
  OutputFormat,
  RenditionCoordinates,
} from "@superimg/types";

export type MediaProjectSourceKind = "media" | "collection" | "interactive";

export interface MediaProjectEntryIdentity {
  readonly id: string;
  readonly dataDigest: string;
  /** Optional. Hosts that already hold a snapshot payload may attach it. Discovery never populates this. */
  readonly data?: Record<string, unknown>;
}

export interface MediaProjectCanvas {
  readonly width: number;
  readonly height: number;
}

/** A source summary that is safe to persist in a framework-owned catalog. */
export interface MediaProjectSource {
  readonly sourceId: string;
  /** Project-relative `*.media.ts` or `*.media.js` path. */
  readonly relativePath: string;
  readonly kind: MediaProjectSourceKind;
  /** Underlying deterministic kind. Interactive sources omit this field. */
  readonly media?: DeterministicMediaKind;
  readonly medium?: Medium;
  readonly animated?: boolean;
  readonly canvas?: MediaProjectCanvas;
  readonly variantIds: readonly string[];
  readonly editionIds: readonly string[];
  /** Snapshot identities a host already holds. `media.project.discover` never includes these. */
  readonly entries?: readonly MediaProjectEntryIdentity[];
}

export interface MediaDiscovery {
  readonly schemaVersion: 0;
  readonly kind: "media-discovery";
  readonly sources: readonly MediaProjectSource[];
}

/** Content-addressed, URL-free reference to one complete schema-0 MediaIR file. */
export interface ExportedMediaIr {
  readonly schemaVersion: 0;
  readonly coordinates: MediaCoordinates;
  /** Always relative to the export bundle root. */
  readonly path: string;
  readonly mimeType: "application/vnd.superimg.media-ir+json";
  readonly bytes: number;
  readonly sha256: string;
  readonly hashes: MediaIR["hashes"];
  readonly extensions: MediaIR["extensions"];
}

export interface ExportBundleFile {
  /** Always relative to the export bundle root. */
  readonly path: string;
  readonly mimeType: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly encoder: string;
}

export interface ExportBundlePoster extends ExportBundleFile {
  readonly coordinates: MediaCoordinates;
}

export interface ExportBundleRendition extends ExportBundleFile {
  readonly coordinates: RenditionCoordinates;
  readonly format: OutputFormat;
}

export interface ExportBundleManifest {
  readonly schemaVersion: 0;
  readonly kind: "media-export";
  readonly sourceId: string;
  readonly requestDigest: string;
  readonly destinationRegistryDigest: string;
  readonly producer: {
    readonly name: "superimg";
    readonly version: string;
  };
  readonly entries: readonly MediaProjectEntryIdentity[];
  readonly media: readonly ExportedMediaIr[];
  readonly posters: readonly ExportBundlePoster[];
  readonly renditions: readonly ExportBundleRendition[];
}

export interface ExportBundleReceipt {
  readonly schemaVersion: 0;
  /** Absolute local path to the atomically published URL-free bundle. */
  readonly path: string;
  readonly manifest: ExportBundleManifest;
}

/**
 * Fail closed if a host tries to ingest a different schema or a URL-bearing
 * artifact. This is intentionally the sole reader: schema 0 has one shape.
 */
export function assertExportBundleReceipt(value: unknown): asserts value is ExportBundleReceipt {
  if (!isRecord(value) || value.schemaVersion !== 0 || typeof value.path !== "string") {
    throw new TypeError("Expected a schema-0 SuperImg export bundle receipt");
  }
  assertExactKeys(value, ["schemaVersion", "path", "manifest"], "export receipt");
  const manifest = value.manifest;
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 0 ||
    manifest.kind !== "media-export" ||
    !Array.isArray(manifest.entries) ||
    !Array.isArray(manifest.media) ||
    !Array.isArray(manifest.posters) ||
    !Array.isArray(manifest.renditions)
  ) {
    throw new TypeError("Expected the canonical schema-0 SuperImg export manifest");
  }
  assertExactKeys(manifest, [
    "schemaVersion",
    "kind",
    "sourceId",
    "requestDigest",
    "destinationRegistryDigest",
    "producer",
    "entries",
    "media",
    "posters",
    "renditions",
  ], "export manifest");
  assertNonEmptyString(manifest.sourceId, "manifest.sourceId");
  assertSha256(manifest.requestDigest, "manifest.requestDigest");
  assertSha256(manifest.destinationRegistryDigest, "manifest.destinationRegistryDigest");
  assertProducer(manifest.producer);
  for (const entry of manifest.entries) assertEntryIdentity(entry);
  for (const media of manifest.media) assertMediaIr(media);
  for (const poster of manifest.posters) assertArtifact(poster, "poster", false);
  for (const rendition of manifest.renditions) assertArtifact(rendition, "rendition", true);
  assertManifestRelationships(manifest);
  assertUrlFree(value);
}

function assertManifestRelationships(manifest: Record<string, unknown>): void {
  const sourceId = manifest.sourceId as string;
  const media = manifest.media as Record<string, unknown>[];
  const entries = manifest.entries as Record<string, unknown>[];
  const posters = manifest.posters as Record<string, unknown>[];
  const renditions = manifest.renditions as Record<string, unknown>[];
  const entryIds = new Set(entries.map((entry) => entry.id as string));
  const mediaCoordinates = new Set<string>();
  const artifactPaths = new Set<string>();

  for (const item of media) {
    const coordinates = item.coordinates as Record<string, unknown>;
    if (coordinates.sourceId !== sourceId) {
      throw new TypeError("Media IR source does not match export manifest sourceId");
    }
    const entryId = coordinates.entryId;
    if (entryId !== undefined && !entryIds.has(entryId as string)) {
      throw new TypeError("Media IR references an undeclared collection entry");
    }
    const key = coordinateKey(coordinates);
    if (mediaCoordinates.has(key)) throw new TypeError("Duplicate Media IR coordinates");
    mediaCoordinates.add(key);
    assertUniqueArtifactPath(artifactPaths, item.path as string);
  }

  for (const poster of posters) {
    const coordinates = poster.coordinates as Record<string, unknown>;
    if (coordinates.sourceId !== sourceId) {
      throw new TypeError("Poster source does not match export manifest sourceId");
    }
    if (!mediaCoordinates.has(coordinateKey(coordinates))) {
      throw new TypeError("Poster does not reference a published Media IR coordinate");
    }
    assertUniqueArtifactPath(artifactPaths, poster.path as string);
  }

  for (const rendition of renditions) {
    const coordinates = rendition.coordinates as Record<string, unknown>;
    if (coordinates.sourceId !== sourceId) {
      throw new TypeError("Rendition source does not match export manifest sourceId");
    }
    if (!mediaCoordinates.has(coordinateKey(coordinates))) {
      throw new TypeError("Rendition does not reference a published Media IR coordinate");
    }
    assertUniqueArtifactPath(artifactPaths, rendition.path as string);
  }
}

function coordinateKey(coordinates: Record<string, unknown>): string {
  return [
    coordinates.sourceId,
    coordinates.entryId ?? "",
    coordinates.variantId,
    coordinates.editionId,
  ].join("\u0000");
}

function assertUniqueArtifactPath(paths: Set<string>, path: string): void {
  const folded = path.normalize("NFC").toLocaleLowerCase("en-US");
  if (paths.has(folded)) throw new TypeError(`Duplicate export artifact path ${JSON.stringify(path)}`);
  paths.add(folded);
}

function assertProducer(value: unknown): void {
  if (!isRecord(value) || value.name !== "superimg" || typeof value.version !== "string" || !value.version) {
    throw new TypeError("Invalid export producer identity");
  }
  assertExactKeys(value, ["name", "version"], "producer identity");
}

function assertEntryIdentity(value: unknown): void {
  if (!isRecord(value)) throw new TypeError("Invalid collection entry identity");
  assertExactKeys(value, ["id", "dataDigest"], "collection entry identity");
  assertNonEmptyString(value.id, "entry.id");
  assertSha256(value.dataDigest, "entry.dataDigest");
}

function assertMediaIr(value: unknown): void {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 0 ||
    value.mimeType !== "application/vnd.superimg.media-ir+json" ||
    !isRecord(value.hashes) ||
    !isRecord(value.extensions)
  ) {
    throw new TypeError("Invalid schema-0 Media IR reference");
  }
  assertExactKeys(value, [
    "schemaVersion",
    "coordinates",
    "path",
    "mimeType",
    "bytes",
    "sha256",
    "hashes",
    "extensions",
  ], "Media IR reference");
  assertCoordinates(value.coordinates, false);
  if (typeof value.path !== "string" || !isRelativeBundlePath(value.path)) {
    throw new TypeError("Invalid Media IR path");
  }
  if (!value.path.startsWith("ir/") || !value.path.endsWith(".media.json")) {
    throw new TypeError("Media IR path must reference an ir/*.media.json artifact");
  }
  if (!Number.isSafeInteger(value.bytes) || (value.bytes as number) <= 0) {
    throw new TypeError("Invalid Media IR bytes");
  }
  assertSha256(value.sha256, "Media IR sha256");
  assertExactKeys(value.hashes, ["intentHash", "markupHash", "programHash"], "Media IR hashes");
  assertSha256(value.hashes.intentHash, "Media IR hashes.intentHash");
  assertSha256(value.hashes.markupHash, "Media IR hashes.markupHash");
  assertSha256(value.hashes.programHash, "Media IR hashes.programHash");
  for (const [name, extension] of Object.entries(value.extensions)) {
    if (!isRecord(extension) || extension.schemaVersion !== 0 || !isRecord(extension.payload)) {
      throw new TypeError(`Invalid Media IR extension ${JSON.stringify(name)}`);
    }
    assertExactKeys(extension, ["schemaVersion", "payload"], `Media IR extension ${JSON.stringify(name)}`);
    assertJsonCompatible(extension.payload, `Media IR extension ${JSON.stringify(name)} payload`);
  }
}

function assertArtifact(value: unknown, label: string, rendition: boolean): void {
  if (!isRecord(value)) throw new TypeError(`Invalid export ${label}`);
  const keys = [
    "coordinates", "path", "mimeType", "width", "height", "bytes", "sha256", "encoder",
    ...(rendition ? ["format"] : []),
  ];
  assertExactKeys(value, keys, `export ${label}`);
  assertCoordinates(value.coordinates, rendition);
  if (typeof value.path !== "string" || !isRelativeBundlePath(value.path)) {
    throw new TypeError(`Invalid export ${label} path`);
  }
  assertNonEmptyString(value.mimeType, `${label}.mimeType`);
  assertPositiveInteger(value.width, `${label}.width`);
  assertPositiveInteger(value.height, `${label}.height`);
  if (!Number.isSafeInteger(value.bytes) || (value.bytes as number) < 0) {
    throw new TypeError(`Invalid ${label}.bytes`);
  }
  assertSha256(value.sha256, `${label}.sha256`);
  assertNonEmptyString(value.encoder, `${label}.encoder`);
  if (rendition && !OUTPUT_FORMATS.has(value.format)) {
    throw new TypeError("Invalid rendition.format");
  }
}

function assertCoordinates(value: unknown, rendition: boolean): void {
  if (!isRecord(value)) throw new TypeError("Invalid media coordinates");
  const keys = ["sourceId", "entryId", "variantId", "editionId", ...(rendition ? ["renditionId"] : [])];
  assertExactKeys(value, keys, "media coordinates", ["entryId"]);
  assertNonEmptyString(value.sourceId, "coordinates.sourceId");
  if (value.entryId !== undefined) assertNonEmptyString(value.entryId, "coordinates.entryId");
  assertNonEmptyString(value.variantId, "coordinates.variantId");
  assertNonEmptyString(value.editionId, "coordinates.editionId");
  if (rendition) assertNonEmptyString(value.renditionId, "coordinates.renditionId");
}

const OUTPUT_FORMATS = new Set<unknown>(["mp4", "webm", "mov", "mkv", "gif", "png", "webp", "jpeg", "svg", "html"]);

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  optional: readonly string[] = [],
): void {
  const allowedSet = new Set(allowed);
  const optionalSet = new Set(optional);
  const unexpected = Object.keys(value).find((key) => !allowedSet.has(key));
  if (unexpected) throw new TypeError(`${label} contains unsupported field ${JSON.stringify(unexpected)}`);
  const missing = allowed.find((key) => !optionalSet.has(key) && !Object.hasOwn(value, key));
  if (missing) throw new TypeError(`${label} is missing ${JSON.stringify(missing)}`);
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value) throw new TypeError(`Invalid ${label}`);
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) throw new TypeError(`Invalid ${label}`);
}

function assertSha256(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError(`Invalid ${label}`);
}

function isRelativeBundlePath(path: string): boolean {
  return !!path && !path.startsWith("/") && !path.includes("\\") && path.split("/").every((part) => part && part !== "." && part !== "..");
}

function assertJsonCompatible(value: unknown, label: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError(`${label} contains a non-finite number`);
  }
  if (typeof value !== "object") throw new TypeError(`${label} is not JSON-compatible`);
  if (seen.has(value)) throw new TypeError(`${label} contains a cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    for (const nested of value) assertJsonCompatible(nested, label, seen);
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError(`${label} contains a non-plain object`);
    }
    for (const nested of Object.values(value as Record<string, unknown>)) {
      assertJsonCompatible(nested, label, seen);
    }
  }
  seen.delete(value);
}

function assertUrlFree(value: unknown): void {
  if (typeof value === "string" && /^[A-Za-z][A-Za-z\d+.-]*:/.test(value)) {
    throw new TypeError(`Export bundles cannot contain URL-valued strings (${value.slice(0, 32)})`);
  }
  if (Array.isArray(value)) {
    for (const nested of value) assertUrlFree(nested);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (/^(?:url|uri|deploymentUrl|publicUrl)$/i.test(key)) {
      throw new TypeError(`Export bundles cannot contain deployment URLs (${key})`);
    }
    assertUrlFree(nested);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
