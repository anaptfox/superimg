//! Portable result construction and ownership.

import {
  ExportBundleDisposedError,
  SuperImgError,
  type ExportArtifact,
  type ExportBundle,
  type ExportManifest,
  type FrozenAssetMetadata,
  type FrozenFontMetadata,
  type JsonObject,
  type MediaRenderResult,
  type RenderFormat,
  type RuntimeMediaCoordinates,
} from "@superimg/types";
import type {
  RuntimeAdapterArtifactData,
  RuntimeAdapterExportOutput,
  RuntimeAdapterRenderOutput,
  RuntimeArtifactBacking,
} from "./adapter.js";
import {
  assertMimeType,
  assertPortableArtifactPath,
  readByteStream,
  streamOwnedBytes,
  verifyAndOwnBytes,
} from "./bytes.js";

export function createMediaRenderResult(
  output: RuntimeAdapterRenderOutput,
): MediaRenderResult {
  return createMemoryRenderResult(output);
}

/** In-memory render result, including animated formats produced through export. */
export function createMemoryRenderResult(input: {
  readonly as: RenderFormat;
  readonly mimeType: string;
  readonly coordinates: RuntimeMediaCoordinates;
  readonly bytes: Uint8Array;
  readonly byteLength?: number;
  readonly sha256?: string;
}): MediaRenderResult {
  const mimeType = assertMimeType(input.mimeType);
  const owned = verifyAndOwnBytes(input.bytes, {
    ...(input.byteLength !== undefined ? { byteLength: input.byteLength } : {}),
    ...(input.sha256 !== undefined ? { sha256: input.sha256 } : {}),
  });
  return Object.freeze({
    as: input.as,
    mimeType,
    byteLength: owned.byteLength,
    sha256: owned.sha256,
    coordinates: freezeCoordinates(input.coordinates),
    stream: () => streamOwnedBytes(owned.bytes),
    bytes: async () => owned.bytes.slice(),
    blob: async () => new Blob([blobBytes(owned.bytes)], { type: mimeType }),
    text: async () => decodeText(mimeType, owned.bytes),
  });
}

export interface CreateExportBundleInput {
  readonly programDigest: string;
  /** Exact semantic plan the adapter result must cover. */
  readonly expectedCoordinates?: readonly RuntimeMediaCoordinates[];
  readonly output: RuntimeAdapterExportOutput;
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly metadata?: Readonly<JsonObject>;
}

interface OwnedArtifact {
  readonly coordinates: RuntimeAdapterArtifactData["coordinates"];
  readonly memoryOwned: boolean;
  readonly path: string;
  readonly mimeType: string;
  readonly owned: RuntimeArtifactBacking;
}

export function createExportBundle(input: CreateExportBundleInput): ExportBundle {
  if (input.output.artifacts.length === 0) {
    throw new TypeError("A successful export must contain at least one artifact");
  }

  const plannedCoordinates = validateCoordinateCoverage(
    input.output,
    input.expectedCoordinates,
  );

  const ownedArtifacts: OwnedArtifact[] = [];
  const paths = new Map<string, string>();
  const backings = new Map<RuntimeArtifactBacking, RuntimeArtifactBacking>();
  try {
    for (const artifact of input.output.artifacts) {
      const path = assertPortableArtifactPath(artifact.path);
      const portablePath = canonicalPortablePath(path);
      const collidingPath = paths.get(portablePath);
      if (collidingPath !== undefined) {
        throw new TypeError(
          `Export artifact paths collide portably: ${JSON.stringify(collidingPath)} and ${JSON.stringify(path)}`,
        );
      }
      paths.set(portablePath, path);
      const mimeType = assertMimeType(artifact.mimeType);
      const owned = ownArtifact(artifact, backings);
      ownedArtifacts.push({
        coordinates: freezeRenditionCoordinates(artifact.coordinates),
        memoryOwned: artifact.backing === undefined,
        path, mimeType, owned,
      });
    }
  } catch (error) {
    // Ownership of adapter backing transfers only on success. The caller
    // disposes rejected adapter output, including entries not yet validated.
    for (const artifact of ownedArtifacts) {
      if (artifact.memoryOwned) void artifact.owned.dispose();
    }
    throw error;
  }

  let disposed = false;
  const publicArtifacts: ExportArtifact[] = ownedArtifacts.map((artifact) => Object.freeze({
    path: artifact.path,
    mimeType: artifact.mimeType,
    byteLength: artifact.owned.byteLength,
    sha256: artifact.owned.sha256,
    coordinates: artifact.coordinates,
    stream: () => {
      if (disposed) throw new ExportBundleDisposedError(artifact.path);
      return artifact.owned.open();
    },
    bytes: async () => {
      if (disposed) throw new ExportBundleDisposedError(artifact.path);
      return readByteStream(artifact.owned.open());
    },
    blob: async () => {
      if (disposed) throw new ExportBundleDisposedError(artifact.path);
      const bytes = await readByteStream(artifact.owned.open());
      return new Blob([blobBytes(bytes)], { type: artifact.mimeType });
    },
    text: async () => {
      if (disposed) throw new ExportBundleDisposedError(artifact.path);
      const bytes = await readByteStream(artifact.owned.open());
      return decodeText(artifact.mimeType, bytes);
    },
  }));

  const manifest: ExportManifest = Object.freeze({
    kind: "@foxworth/superimg/export-bundle",
    schemaVersion: 0,
    programDigest: input.programDigest,
    coordinates: plannedCoordinates,
    artifacts: Object.freeze(publicArtifacts.map((artifact) => Object.freeze({
      path: artifact.path,
      mimeType: artifact.mimeType,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
      coordinates: artifact.coordinates,
    }))),
    assets: Object.freeze(input.assets.map((asset) => Object.freeze({ ...asset }))),
    fonts: Object.freeze(input.fonts.map((font) => Object.freeze({ ...font }))),
    ...(input.metadata !== undefined ? { metadata: freezeJsonObject(input.metadata) } : {}),
  });

  let disposePromise: Promise<void> | undefined;
  const dispose = (): Promise<void> => {
    if (disposePromise !== undefined) return disposePromise;
    disposed = true;
    disposePromise = disposeBackings(ownedArtifacts.map((artifact) => artifact.owned));
    return disposePromise;
  };

  return Object.freeze({
    manifest,
    artifacts: Object.freeze(publicArtifacts),
    dispose,
    [Symbol.asyncDispose]: dispose,
  });
}

function blobBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function isTextMime(mimeType: string): boolean {
  const essence = mimeType.split(";", 1)[0]!.trim().toLowerCase();
  return essence.startsWith("text/")
    || essence === "image/svg+xml"
    || essence === "application/xml"
    || essence === "application/xhtml+xml"
    || essence === "application/json";
}

function decodeText(mimeType: string, bytes: Uint8Array): string {
  if (!isTextMime(mimeType)) {
    throw new SuperImgError(
      `text() is unavailable for ${mimeType}`,
      "NOT_TEXT",
      { mimeType },
      "Use bytes(), blob(), or stream() for binary results.",
    );
  }
  return new TextDecoder().decode(bytes);
}

function ownArtifact(artifact: RuntimeAdapterArtifactData, backings: Map<RuntimeArtifactBacking, RuntimeArtifactBacking>): RuntimeArtifactBacking {
  if (artifact.backing !== undefined) {
    const backing = artifact.backing;
    if (artifact.bytes !== undefined || !Number.isSafeInteger(backing.byteLength) || backing.byteLength < 0
      || !/^[a-f0-9]{64}$/.test(backing.sha256)
      || typeof backing.open !== "function" || typeof backing.dispose !== "function") {
      throw new TypeError("Invalid sealed artifact backing");
    }
    const existing = backings.get(backing);
    if (existing) return existing;
    const owned = Object.freeze({
      byteLength: backing.byteLength,
      sha256: backing.sha256,
      open: backing.open.bind(backing),
      dispose: backing.dispose.bind(backing),
    });
    backings.set(backing, owned);
    return owned;
  }
  const owned = verifyAndOwnBytes(artifact.bytes, {
    ...(artifact.byteLength !== undefined ? { byteLength: artifact.byteLength } : {}),
    ...(artifact.sha256 !== undefined ? { sha256: artifact.sha256 } : {}),
  });
  return memoryBacking(owned.bytes, owned.byteLength, owned.sha256);
}

// Keep only a clearable cell in these closures, never the verified input object.
function memoryBacking(bytes: Uint8Array | undefined, byteLength: number, sha256: string): RuntimeArtifactBacking {
  return {
    byteLength,
    sha256,
    open: () => {
      if (bytes === undefined) throw new ExportBundleDisposedError();
      return streamOwnedBytes(bytes);
    },
    async dispose() {
      bytes?.fill(0);
      bytes = undefined;
    },
  };
}

async function disposeBackings(backings: readonly RuntimeArtifactBacking[]): Promise<void> {
  const results = await Promise.allSettled([...new Set(backings)].map(async (backing) => { await backing.dispose(); }));
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) throw new AggregateError(failures.map((result) => result.reason), "Could not dispose export backing");
}

/** Release output that failed validation or was cancelled before adoption. */
export async function disposeAdapterExport(output: RuntimeAdapterExportOutput): Promise<void> {
  await disposeBackings(output.artifacts.flatMap((artifact) => artifact.backing === undefined ? [] : [artifact.backing]));
}

function validateCoordinateCoverage(
  output: RuntimeAdapterExportOutput,
  expectedCoordinates: readonly RuntimeMediaCoordinates[] | undefined,
): readonly RuntimeMediaCoordinates[] {
  const planned = new Map<string, RuntimeMediaCoordinates>();
  for (const coordinates of output.coordinates) {
    assertMediaCoordinates(coordinates);
    const key = mediaCoordinateKey(coordinates);
    if (planned.has(key)) {
      throw new TypeError(`Export coordinates are duplicated: ${JSON.stringify(coordinates)}`);
    }
    planned.set(key, freezeCoordinates(coordinates));
  }

  const covered = new Set<string>();
  const renditions = new Set<string>();
  for (const artifact of output.artifacts) {
    assertMediaCoordinates(artifact.coordinates);
    assertCoordinateId("renditionId", artifact.coordinates.renditionId);
    const mediaKey = mediaCoordinateKey(artifact.coordinates);
    if (!planned.has(mediaKey)) {
      throw new TypeError(
        `Export artifact ${JSON.stringify(artifact.path)} references unplanned coordinates`,
      );
    }
    covered.add(mediaKey);
    const renditionKey = `${mediaKey}\0${artifact.coordinates.renditionId}`;
    if (renditions.has(renditionKey)) {
      throw new TypeError(
        `Export rendition coordinates are duplicated: ${JSON.stringify(artifact.coordinates)}`,
      );
    }
    renditions.add(renditionKey);
  }

  for (const [key, coordinates] of planned) {
    if (!covered.has(key)) {
      throw new TypeError(`Export coordinates have no artifact coverage: ${JSON.stringify(coordinates)}`);
    }
  }
  if (expectedCoordinates !== undefined) {
    const expected = new Map<string, RuntimeMediaCoordinates>();
    for (const coordinates of expectedCoordinates) {
      assertMediaCoordinates(coordinates);
      const key = mediaCoordinateKey(coordinates);
      if (expected.has(key)) {
        throw new TypeError(`Expected export coordinates are duplicated: ${JSON.stringify(coordinates)}`);
      }
      expected.set(key, coordinates);
    }
    for (const [key, coordinates] of expected) {
      if (!planned.has(key)) {
        throw new TypeError(`Export result is missing planned coordinates: ${JSON.stringify(coordinates)}`);
      }
    }
    for (const [key, coordinates] of planned) {
      if (!expected.has(key)) {
        throw new TypeError(`Export result returned unplanned coordinates: ${JSON.stringify(coordinates)}`);
      }
    }
  }
  return Object.freeze([...planned.values()]);
}

function assertMediaCoordinates(value: RuntimeMediaCoordinates): void {
  if (value.entryId !== undefined) assertCoordinateId("entryId", value.entryId);
  assertCoordinateId("variantId", value.variantId);
  assertCoordinateId("editionId", value.editionId);
}

function assertCoordinateId(field: string, value: string): void {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`Export ${field} must be a non-empty normalized identifier`);
  }
}

function mediaCoordinateKey(value: RuntimeMediaCoordinates): string {
  return JSON.stringify([
    value.entryId ?? null,
    value.variantId,
    value.editionId,
  ]);
}

function canonicalPortablePath(path: string): string {
  return path.normalize("NFC").toLowerCase();
}

export function freezeJsonObject(value: Readonly<JsonObject>): Readonly<JsonObject> {
  return freezeJsonValue(value) as Readonly<JsonObject>;
}

function freezeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map(freezeJsonValue));
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) out[key] = freezeJsonValue(child);
    return Object.freeze(out);
  }
  return value;
}

function freezeCoordinates(value: RuntimeMediaCoordinates): RuntimeMediaCoordinates {
  return Object.freeze({
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  });
}

function freezeRenditionCoordinates(
  value: RuntimeAdapterArtifactData["coordinates"],
): RuntimeAdapterArtifactData["coordinates"] {
  return Object.freeze({
    ...freezeCoordinates(value),
    renditionId: value.renditionId,
  });
}
