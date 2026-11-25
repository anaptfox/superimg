//! Pure schema-0 export planning for deterministic media.
//!
//! This module owns coordinates and output intent only. It never executes a
//! collection provider, bundles a program, renders a frame, or writes a file.

import type {
  CollectionDefinition,
  DeterministicMediaDefinition,
  EncodingOptions,
  MediaCoordinates,
  OutputFormat,
  RenditionCoordinates,
} from "@superimg/types";
import {
  resolveDestinationTarget,
  type DestinationDefinition,
  type DestinationTarget,
} from "../destinations/index.js";
import { canonicalizeToJson } from "../ir/pure/canonicalize.js";
import { sha256Hex } from "../ir/pure/sha256.js";

const DEFAULT_VARIANT_ID = "default";
const DEFAULT_EDITION_ID = "default";
const SAFE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;
const RESERVED_VARIANT_FIELDS = new Set([
  "width",
  "height",
  "size",
  "fps",
  "duration",
  "temporal",
  "format",
  "codec",
  "path",
  "filename",
]);
const VIDEO_FORMATS = new Set<OutputFormat>(["mp4", "webm", "mov", "mkv", "gif"]);
const STILL_FORMATS = new Set<OutputFormat>(["png", "webp", "jpeg", "svg", "html"]);

export type ExportPlannerErrorCode =
  | "EXPORT_SOURCE_ID_INVALID"
  | "EXPORT_MEDIA_INVALID"
  | "EXPORT_COLLECTION_ENTRIES_REQUIRED"
  | "EXPORT_ENTRIES_ON_SINGULAR_MEDIA"
  | "EXPORT_ENTRY_INVALID"
  | "EXPORT_ENTRY_DUPLICATE"
  | "EXPORT_ENTRY_UNKNOWN"
  | "EXPORT_ENTRY_DIGEST_MISMATCH"
  | "EXPORT_DATA_INVALID"
  | "EXPORT_VARIANT_INVALID"
  | "EXPORT_VARIANT_DUPLICATE"
  | "EXPORT_VARIANT_UNKNOWN"
  | "EXPORT_VARIANT_DELIVERY_FIELD"
  | "EXPORT_EDITION_INVALID"
  | "EXPORT_EDITION_ASPECT_DUPLICATE"
  | "MISSING_EDITION"
  | "EXPORT_TARGET_REQUIRED"
  | "EXPORT_TARGET_DUPLICATE"
  | "EXPORT_TARGET_UNSUPPORTED_MEDIA"
  | "EXPORT_FORMAT_INCOMPATIBLE"
  | "EXPORT_STILL_FRAME_REQUIRED"
  | "EXPORT_STILL_FRAME_INVALID"
  | "EXPORT_STILL_FRAME_UNUSED"
  | "EXPORT_PATH_COLLISION";

export class ExportPlannerError extends Error {
  readonly code: ExportPlannerErrorCode;

  constructor(code: ExportPlannerErrorCode, message: string) {
    super(message);
    this.name = "ExportPlannerError";
    this.code = code;
  }
}

export interface ResolvedCollectionEntry<TData extends object = Record<string, unknown>> {
  readonly id: string;
  readonly data: TData;
  /** SHA-256 of the canonical, deeply JSON-compatible entry data. */
  readonly dataDigest: string;
}

export type StillFrameSelection = { readonly kind: "at"; readonly at: number | string };

export interface ExportPlanSelector {
  readonly entryIds?: readonly string[];
  readonly variantIds?: readonly string[];
}

export interface ExportPlannerRequest<TData extends object = Record<string, unknown>> {
  readonly sourceId: string;
  readonly definition:
    | DeterministicMediaDefinition<TData>
    | CollectionDefinition<TData, DeterministicMediaDefinition<TData>>;
  /** Resolved once by the server executor. The pure planner never calls providers. */
  readonly entries?: readonly ResolvedCollectionEntry<TData>[];
  readonly targets: readonly (string | DestinationTarget)[];
  readonly selector?: ExportPlanSelector;
  /** Shared caller policy over destination defaults and beneath exact targets. */
  readonly encoding?: Omit<EncodingOptions, "format">;
  /** Required when an animated definition is requested in a still format. */
  readonly stillFrame?: StillFrameSelection;
}

export interface PlannedCanvas {
  readonly width: number;
  readonly height: number;
}

export interface PlannedRendition<TData extends object = Record<string, unknown>> {
  readonly coordinates: RenditionCoordinates;
  readonly data: TData;
  /** Digest of the unpatched collection entry; absent for singular media. */
  readonly entryDataDigest?: string;
  /** Digest of the final data after a variant shallow patch. */
  readonly dataDigest: string;
  readonly canvas: PlannedCanvas;
  readonly format: OutputFormat;
  readonly encoding?: Omit<EncodingOptions, "format">;
  readonly fps?: number;
  readonly relativePath: string;
  readonly target: {
    readonly kind: DestinationTarget["kind"];
    readonly id: string;
  };
  readonly stillFrame?: StillFrameSelection;
}

export interface MediaExportPlan<TData extends object = Record<string, unknown>> {
  readonly schemaVersion: 0;
  readonly sourceId: string;
  readonly requestDigest: string;
  readonly coordinates: readonly MediaCoordinates[];
  readonly renditions: readonly PlannedRendition<TData>[];
}

interface VariantChoice<TData extends object> {
  id: string;
  patch?: Partial<TData>;
}

interface EntryChoice<TData extends object> {
  id?: string;
  data: TData;
  dataDigest?: string;
}

interface NormalizedTarget {
  target: DestinationTarget;
  id: string;
  canvas: PlannedCanvas;
  format: OutputFormat;
  encoding?: Omit<EncodingOptions, "format">;
  fps?: number;
}

/** Build one deterministic matrix shared by video, image, SVG, and compose-lowered media. */
export function planMediaExport<TData extends object>(
  request: ExportPlannerRequest<TData>,
): MediaExportPlan<TData> {
  assertSourceId(request.sourceId);
  const collection = isCollection(request.definition);
  const media = collection ? request.definition.media : request.definition;
  assertDeterministicMedia(media);

  const entries = selectEntries(request, collection, media);
  const variants = selectVariants(media, request.selector?.variantIds);
  validateEditions(media);
  const targets = normalizeTargets(
    media,
    request.targets,
    request.stillFrame,
    request.encoding,
  );

  const renditions: PlannedRendition<TData>[] = [];
  const mediaCoordinates = new Map<string, MediaCoordinates>();
  const paths = new Map<string, string>();

  for (const entry of entries) {
    for (const variant of variants) {
      const data = applyVariant(entry.data, variant.patch);
      const dataDigest = digestData(data);
      for (const rendition of targets) {
        const editionId = selectEdition(media, rendition.canvas);
        const coordinates: RenditionCoordinates = {
          sourceId: request.sourceId,
          ...(entry.id !== undefined ? { entryId: entry.id } : {}),
          variantId: variant.id,
          editionId,
          renditionId: rendition.id,
        };
        const relativePath = renditionPath(entry.id, variant.id, rendition.id, rendition.format);
        assertUniquePath(paths, relativePath, coordinates);
        const coordinateKey = mediaCoordinateIdentity(coordinates);
        if (!mediaCoordinates.has(coordinateKey)) {
          const { renditionId: _renditionId, ...mediaCoordinate } = coordinates;
          mediaCoordinates.set(coordinateKey, mediaCoordinate);
        }
        renditions.push({
          coordinates,
          data,
          ...(entry.dataDigest !== undefined ? { entryDataDigest: entry.dataDigest } : {}),
          dataDigest,
          canvas: rendition.canvas,
          format: rendition.format,
          ...(rendition.encoding !== undefined ? { encoding: rendition.encoding } : {}),
          ...(rendition.fps !== undefined ? { fps: rendition.fps } : {}),
          relativePath,
          target: { kind: rendition.target.kind, id: rendition.id },
          ...(media.animated && STILL_FORMATS.has(rendition.format)
            ? { stillFrame: request.stillFrame! }
            : {}),
        });
      }
    }
  }

  const coordinates = [...mediaCoordinates.values()];
  const requestDigest = digestRequest(request.sourceId, renditions);
  return deepFreeze({
    schemaVersion: 0 as const,
    sourceId: request.sourceId,
    requestDigest,
    coordinates,
    renditions,
  });
}

function isCollection(value: unknown): value is CollectionDefinition<object, DeterministicMediaDefinition<object>> {
  return isRecord(value) && value.kind === "collection";
}

function assertDeterministicMedia(media: unknown): asserts media is DeterministicMediaDefinition<object> {
  if (!isRecord(media) || media.kind !== "media" || typeof media.render !== "function") {
    throw new ExportPlannerError(
      "EXPORT_MEDIA_INVALID",
      "Export planning requires one deterministic MediaDefinition; interactive and nested collections are not supported",
    );
  }
}

function assertSourceId(sourceId: string): void {
  if (!sourceId.trim() || sourceId !== sourceId.trim() || /[\u0000-\u001f\u007f]/.test(sourceId)) {
    throw new ExportPlannerError("EXPORT_SOURCE_ID_INVALID", "sourceId must be a non-empty stable identifier");
  }
}

function selectEntries<TData extends object>(
  request: ExportPlannerRequest<TData>,
  collection: boolean,
  media: DeterministicMediaDefinition<TData>,
): EntryChoice<TData>[] {
  if (!collection) {
    if (request.entries !== undefined || request.selector?.entryIds !== undefined) {
      throw new ExportPlannerError(
        "EXPORT_ENTRIES_ON_SINGULAR_MEDIA",
        "Entry selection is only valid for deterministic collections",
      );
    }
    return [{ data: cloneData((media.sample ?? {}) as TData) }];
  }
  if (!request.entries?.length) {
    throw new ExportPlannerError(
      "EXPORT_COLLECTION_ENTRIES_REQUIRED",
      "A collection must be planned from a non-empty server-resolved entry snapshot",
    );
  }

  const entries = request.entries.map((entry) => {
    assertSafeId("entry id", entry.id, "EXPORT_ENTRY_INVALID");
    const actualDigest = digestData(entry.data);
    if (entry.dataDigest !== actualDigest) {
      throw new ExportPlannerError(
        "EXPORT_ENTRY_DIGEST_MISMATCH",
        `Entry ${JSON.stringify(entry.id)} data digest does not match its canonical data`,
      );
    }
    return { id: entry.id, data: cloneData(entry.data), dataDigest: actualDigest };
  });
  assertUniqueIds(entries.map((entry) => entry.id!), "entry", "EXPORT_ENTRY_DUPLICATE");
  const selected = selectByIds(entries, request.selector?.entryIds, "entry");
  return selected.sort((a, b) => compareId(a.id!, b.id!));
}

function selectVariants<TData extends object>(
  media: DeterministicMediaDefinition<TData>,
  selectedIds: readonly string[] | undefined,
): VariantChoice<TData>[] {
  const declared = Object.entries(media.variants ?? {}).map(([id, patch]) => {
    assertSafeId("variant id", id, "EXPORT_VARIANT_INVALID");
    if (!isRecord(patch)) {
      throw new ExportPlannerError("EXPORT_VARIANT_INVALID", `Variant ${JSON.stringify(id)} must be an object patch`);
    }
    for (const field of Object.keys(patch)) {
      if (RESERVED_VARIANT_FIELDS.has(field)) {
        throw new ExportPlannerError(
          "EXPORT_VARIANT_DELIVERY_FIELD",
          `Variant ${JSON.stringify(id)} cannot own delivery or clock field ${JSON.stringify(field)}`,
        );
      }
    }
    return { id, patch: patch as Partial<TData> };
  });
  for (const variant of declared) {
    if (variant.id.normalize("NFC").toLocaleLowerCase("en-US") === DEFAULT_VARIANT_ID) {
      throw new ExportPlannerError(
        "EXPORT_VARIANT_INVALID",
        `Variant ${JSON.stringify(variant.id)} is reserved`,
      );
    }
  }
  assertUniqueIds(declared.map((variant) => variant.id), "variant", "EXPORT_VARIANT_DUPLICATE");

  const base: VariantChoice<TData> = { id: DEFAULT_VARIANT_ID };
  if (selectedIds === undefined) {
    return [base, ...declared].sort((left, right) =>
      left.id === DEFAULT_VARIANT_ID ? -1 : right.id === DEFAULT_VARIANT_ID ? 1 : compareId(left.id, right.id),
    );
  }
  return selectByIds([base, ...declared], selectedIds, "variant").sort((a, b) => compareId(a.id, b.id));
}

function selectByIds<T extends { id: string }>(
  choices: readonly T[],
  selectedIds: readonly string[] | undefined,
  kind: "entry" | "variant",
): T[] {
  if (selectedIds === undefined) return [...choices];
  assertUniqueIds(
    selectedIds.map((id) => {
      assertSafeId(`${kind} selector`, id, kind === "entry" ? "EXPORT_ENTRY_INVALID" : "EXPORT_VARIANT_INVALID");
      return id;
    }),
    `${kind} selector`,
    kind === "entry" ? "EXPORT_ENTRY_DUPLICATE" : "EXPORT_VARIANT_DUPLICATE",
  );
  const byId = new Map(choices.map((choice) => [choice.id, choice]));
  return selectedIds.map((id) => {
    const choice = byId.get(id);
    if (!choice) {
      throw new ExportPlannerError(
        kind === "entry" ? "EXPORT_ENTRY_UNKNOWN" : "EXPORT_VARIANT_UNKNOWN",
        `Unknown ${kind} ${JSON.stringify(id)}`,
      );
    }
    return choice;
  });
}

function validateEditions<TData extends object>(media: DeterministicMediaDefinition<TData>): void {
  const aspectOwners = new Map<string, string>();
  for (const [id, edition] of Object.entries(media.editions ?? {})) {
    assertSafeId("edition id", id, "EXPORT_EDITION_INVALID");
    assertCanvas(edition.size, `Edition ${JSON.stringify(id)}`, "EXPORT_EDITION_INVALID");
    const aspect = aspectKey(edition.size);
    const previous = aspectOwners.get(aspect);
    if (previous !== undefined) {
      throw new ExportPlannerError(
        "EXPORT_EDITION_ASPECT_DUPLICATE",
        `Editions ${JSON.stringify(previous)} and ${JSON.stringify(id)} both override aspect ratio ${aspect}`,
      );
    }
    aspectOwners.set(aspect, id);
  }
}

function selectEdition<TData extends object>(media: DeterministicMediaDefinition<TData>, canvas: PlannedCanvas): string {
  const authored = authoredCanvas(media);
  if (sameCanvas(canvas, authored)) return DEFAULT_EDITION_ID;
  for (const [id, edition] of Object.entries(media.editions ?? {})) {
    if (sameCanvas(canvas, edition.size)) return id;
  }

  // Integer targets can sit half a pixel off an exact ratio (700×368 vs 40:21).
  let best: { id: string; distance: number; root: boolean } | undefined;
  const consider = (id: string, size: PlannedCanvas, root: boolean) => {
    if (!aspectsMatch(size, canvas)) return;
    const distance = Math.abs(size.width * size.height - canvas.width * canvas.height);
    if (
      best === undefined ||
      distance < best.distance ||
      (distance === best.distance && root && !best.root)
    ) {
      best = { id, distance, root };
    }
  };
  consider(DEFAULT_EDITION_ID, authored, true);
  for (const [id, edition] of Object.entries(media.editions ?? {})) {
    consider(id, edition.size, false);
  }
  if (best !== undefined) return best.id;

  if (isSquare(canvas) && !isSquare(authored)) {
    throw new ExportPlannerError(
      "MISSING_EDITION",
      `Square destination ${canvas.width}×${canvas.height} needs an exact-aspect edition; authored canvas is ${authored.width}×${authored.height}. Add editions.square — do not letterbox landscape art.`,
    );
  }
  return DEFAULT_EDITION_ID;
}

function sameCanvas(left: PlannedCanvas, right: PlannedCanvas): boolean {
  return left.width === right.width && left.height === right.height;
}

function aspectsMatch(candidate: PlannedCanvas, target: PlannedCanvas): boolean {
  if (aspectKey(candidate) === aspectKey(target)) return true;
  const delta = Math.abs(target.width * candidate.height - target.height * candidate.width);
  return delta <= Math.max(candidate.width, candidate.height);
}

function authoredCanvas<TData extends object>(media: DeterministicMediaDefinition<TData>): PlannedCanvas {
  const width = media.config?.width;
  const height = media.config?.height;
  return {
    width: typeof width === "number" && Number.isSafeInteger(width) && width > 0 ? width : 1920,
    height: typeof height === "number" && Number.isSafeInteger(height) && height > 0 ? height : 1080,
  };
}

function isSquare(canvas: PlannedCanvas): boolean {
  return canvas.width === canvas.height;
}

function normalizeTargets<TData extends object>(
  media: DeterministicMediaDefinition<TData>,
  targets: readonly (string | DestinationTarget)[],
  stillFrame: StillFrameSelection | undefined,
  sharedEncoding: Omit<EncodingOptions, "format"> | undefined,
): NormalizedTarget[] {
  const normalized = targets.map((input) => {
    const target = typeof input === "string" ? resolveDestinationTarget(input) : input;
    assertSafeId("destination target id", target.id, "EXPORT_TARGET_DUPLICATE");
    const resolved = target.kind === "catalog"
      ? normalizeCatalogTarget(media, target, stillFrame)
      : normalizeCustomTarget(media, target, stillFrame);
    const encoding = target.kind === "custom"
      ? customTargetEncoding(mergeEncoding(sharedEncoding, target.encoding), media.medium)
      : mergeEncoding(resolved.encoding, sharedEncoding);
    return {
      ...resolved,
      ...(encoding === undefined ? {} : { encoding }),
    };
  });
  if (normalized.length === 0) {
    throw new ExportPlannerError("EXPORT_TARGET_REQUIRED", "Export planning requires at least one destination target");
  }
  validateStillFrame(stillFrame);
  if (stillFrame !== undefined && !normalized.some((target) => STILL_FORMATS.has(target.format))) {
    throw new ExportPlannerError(
      "EXPORT_STILL_FRAME_UNUSED",
      "A poster or --at selection is only valid when at least one still rendition is requested",
    );
  }
  assertUniqueIds(normalized.map((target) => target.id), "destination target", "EXPORT_TARGET_DUPLICATE");
  return normalized.sort((a, b) => compareId(a.id, b.id));
}

function normalizeCatalogTarget<TData extends object>(
  media: DeterministicMediaDefinition<TData>,
  target: Extract<DestinationTarget, { kind: "catalog" }>,
  stillFrame: StillFrameSelection | undefined,
): NormalizedTarget {
  const requestedMedium = media.animated ? "video" : "image";
  if (!target.destination.supportedMedia.some((claim) => claim.value === requestedMedium)) {
    throw unsupportedMedia(target.destination, requestedMedium);
  }
  const canvas = target.destination.recommendedCanvas.value;
  assertCanvas(canvas, `Destination ${JSON.stringify(target.id)}`, "EXPORT_EDITION_INVALID");
  if (requestedMedium === "video") {
    const defaults = target.destination.encoding.video!;
    return {
      target,
      id: target.id,
      canvas,
      format: defaults.format.value,
      encoding: {
        video: { codec: defaults.codec.value },
        audio: { codec: defaults.audioCodec.value },
      },
      fps: defaults.fps.value,
    };
  }
  const format = target.destination.encoding.image!.format.value;
  assertFormatCompatibility(media, format, stillFrame);
  return { target, id: target.id, canvas, format };
}

function normalizeCustomTarget<TData extends object>(
  media: DeterministicMediaDefinition<TData>,
  target: Extract<DestinationTarget, { kind: "custom" }>,
  stillFrame: StillFrameSelection | undefined,
): NormalizedTarget {
  const canvas = { width: target.width, height: target.height };
  assertCanvas(canvas, `Custom destination ${JSON.stringify(target.id)}`, "EXPORT_EDITION_INVALID");
  const format = target.format ?? defaultFormat(media);
  assertFormatCompatibility(media, format, stillFrame);
  return {
    target,
    id: target.id,
    canvas,
    format,
    ...(target.encoding === undefined ? {} : { encoding: target.encoding }),
  };
}

function customTargetEncoding(
  encoding: Omit<EncodingOptions, "format"> | undefined,
  medium: DeterministicMediaDefinition<object>["medium"],
): Omit<EncodingOptions, "format"> | undefined {
  // Native SVG rasterization rejects any capture block and already paints at width×height.
  if (medium === "svg") return encoding;
  if (encoding?.capture?.dpr !== undefined) return encoding;
  return {
    ...encoding,
    capture: { ...encoding?.capture, dpr: 1 },
  };
}

function mergeEncoding(
  base: Omit<EncodingOptions, "format"> | undefined,
  override: Omit<EncodingOptions, "format"> | undefined,
): Omit<EncodingOptions, "format"> | undefined {
  if (base === undefined) return override;
  if (override === undefined) return base;
  return {
    ...base,
    ...override,
    ...(base.video === undefined && override.video === undefined
      ? {}
      : { video: { ...base.video, ...override.video } }),
    ...(base.audio === undefined && override.audio === undefined
      ? {}
      : { audio: { ...base.audio, ...override.audio } }),
    ...(base.mp4 === undefined && override.mp4 === undefined
      ? {}
      : { mp4: { ...base.mp4, ...override.mp4 } }),
    ...(base.webm === undefined && override.webm === undefined
      ? {}
      : { webm: { ...base.webm, ...override.webm } }),
    ...(base.gif === undefined && override.gif === undefined
      ? {}
      : { gif: { ...base.gif, ...override.gif } }),
    ...(base.capture === undefined && override.capture === undefined
      ? {}
      : { capture: { ...base.capture, ...override.capture } }),
    ...(base.still === undefined && override.still === undefined
      ? {}
      : { still: { ...base.still, ...override.still } }),
  };
}

function assertFormatCompatibility<TData extends object>(
  media: DeterministicMediaDefinition<TData>,
  format: OutputFormat,
  stillFrame: StillFrameSelection | undefined,
): void {
  if (media.animated && STILL_FORMATS.has(format) && stillFrame === undefined) {
    throw new ExportPlannerError(
      "EXPORT_STILL_FRAME_REQUIRED",
      `Animated media exported as ${format} requires --poster or --at TIME in seconds (0, 0s, 1.5s). Inspect --at is progress 0–1, not this flag.`,
    );
  }
  if (!media.animated && VIDEO_FORMATS.has(format)) {
    throw new ExportPlannerError(
      "EXPORT_FORMAT_INCOMPATIBLE",
      `Static ${media.media} media cannot be exported as ${format}`,
    );
  }
  if (format === "svg" && media.media !== "svg") {
    throw new ExportPlannerError(
      "EXPORT_FORMAT_INCOMPATIBLE",
      "Only SVG definitions can be exported as SVG",
    );
  }
  if (format === "html" && media.medium !== "html") {
    throw new ExportPlannerError(
      "EXPORT_FORMAT_INCOMPATIBLE",
      "Only HTML definitions can be exported as HTML",
    );
  }
}

function defaultFormat<TData extends object>(media: DeterministicMediaDefinition<TData>): OutputFormat {
  if (media.animated) return "mp4";
  return media.media === "svg" ? "svg" : "png";
}

function unsupportedMedia(destination: DestinationDefinition, medium: "image" | "video"): ExportPlannerError {
  return new ExportPlannerError(
    "EXPORT_TARGET_UNSUPPORTED_MEDIA",
    `Destination ${JSON.stringify(destination.id)} does not support ${medium} media`,
  );
}

function applyVariant<TData extends object>(data: TData, patch: Partial<TData> | undefined): TData {
  if (patch === undefined) return cloneData(data);
  return cloneData({ ...data, ...patch } as TData);
}

function cloneData<TData extends object>(data: TData): TData {
  // Keep every author key (including names such as `createdAt`) while
  // detaching the plan from mutable provider/author objects.
  return JSON.parse(canonicalDataToJson(data)) as TData;
}

export function digestData(data: object): string {
  return sha256Hex(canonicalDataToJson(data));
}

function digestRequest<TData extends object>(
  sourceId: string,
  renditions: readonly PlannedRendition<TData>[],
): string {
  return sha256Hex(canonicalizeToJson({
    schemaVersion: 0,
    sourceId,
    renditions: renditions.map(({ data: _data, ...rendition }) => rendition),
  }));
}

function renditionPath(entryId: string | undefined, variantId: string, renditionId: string, format: OutputFormat): string {
  const filename = renditionId.toLocaleLowerCase("en-US").endsWith(`.${format}`)
    ? renditionId
    : `${renditionId}.${format}`;
  const segments = [
    ...(entryId !== undefined ? [entryId] : []),
    ...(variantId !== DEFAULT_VARIANT_ID ? [variantId] : []),
    filename,
  ];
  return segments.join("/");
}

function assertUniquePath(paths: Map<string, string>, relativePath: string, coordinates: RenditionCoordinates): void {
  const folded = relativePath.normalize("NFC").toLocaleLowerCase("en-US");
  const owner = paths.get(folded);
  if (owner !== undefined) {
    throw new ExportPlannerError(
      "EXPORT_PATH_COLLISION",
      `Renditions ${owner} and ${coordinateIdentity(coordinates)} collide at ${relativePath}`,
    );
  }
  paths.set(folded, coordinateIdentity(coordinates));
}

function coordinateIdentity(coordinates: RenditionCoordinates): string {
  return [
    coordinates.sourceId,
    coordinates.entryId ?? "",
    coordinates.variantId,
    coordinates.editionId,
    coordinates.renditionId,
  ].join("\u0000");
}

function mediaCoordinateIdentity(coordinates: MediaCoordinates): string {
  return [
    coordinates.sourceId,
    coordinates.entryId ?? "",
    coordinates.variantId,
    coordinates.editionId,
  ].join("\u0000");
}

function assertUniqueIds(ids: readonly string[], label: string, code: ExportPlannerErrorCode): void {
  const seen = new Map<string, string>();
  for (const id of ids) {
    const folded = id.normalize("NFC").toLocaleLowerCase("en-US");
    const previous = seen.get(folded);
    if (previous !== undefined) {
      throw new ExportPlannerError(code, `Duplicate ${label} ids ${JSON.stringify(previous)} and ${JSON.stringify(id)}`);
    }
    seen.set(folded, id);
  }
}

function assertSafeId(label: string, id: string, code: ExportPlannerErrorCode): void {
  const windowsStem = id.split(".", 1)[0]?.toLocaleUpperCase("en-US") ?? "";
  const windowsReserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsStem);
  if (!SAFE_ID.test(id) || id !== id.trim() || id === "." || id === ".." || windowsReserved) {
    throw new ExportPlannerError(code, `${label} must be a trimmed, path-safe stable id: ${JSON.stringify(id)}`);
  }
}

function validateStillFrame(selection: StillFrameSelection | undefined): void {
  if (selection === undefined) return;
  if (selection.kind !== "at") {
    throw new ExportPlannerError("EXPORT_STILL_FRAME_INVALID", "Unknown still-frame selection");
  }
  if (
    (typeof selection.at === "number" && !Number.isFinite(selection.at)) ||
    (typeof selection.at === "string" && selection.at.trim().length === 0)
  ) {
    throw new ExportPlannerError(
      "EXPORT_STILL_FRAME_INVALID",
      "An explicit --at selection must be a finite number or non-empty time expression",
    );
  }
}

function canonicalDataToJson(value: unknown): string {
  const ancestors = new Set<object>();
  const visit = (current: unknown, path: string): unknown => {
    if (current === null || typeof current === "string" || typeof current === "boolean") return current;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) {
        throw new ExportPlannerError("EXPORT_DATA_INVALID", `Collection data contains a non-finite number at ${path}`);
      }
      return Object.is(current, -0) ? 0 : current;
    }
    if (typeof current !== "object") {
      throw new ExportPlannerError("EXPORT_DATA_INVALID", `Collection data is not JSON-compatible at ${path}`);
    }
    if (ancestors.has(current)) {
      throw new ExportPlannerError("EXPORT_DATA_INVALID", `Collection data contains a cycle at ${path}`);
    }
    ancestors.add(current);
    try {
      if (Array.isArray(current)) return current.map((item, index) => visit(item, `${path}[${index}]`));
      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new ExportPlannerError("EXPORT_DATA_INVALID", `Collection data must use plain objects at ${path}`);
      }
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(current).sort(compareId)) {
        result[key] = visit((current as Record<string, unknown>)[key], `${path}.${key}`);
      }
      return result;
    } finally {
      ancestors.delete(current);
    }
  };
  return JSON.stringify(visit(value, "$"));
}

function assertCanvas(canvas: PlannedCanvas, label: string, code: ExportPlannerErrorCode): void {
  if (!Number.isSafeInteger(canvas.width) || canvas.width < 1 || !Number.isSafeInteger(canvas.height) || canvas.height < 1) {
    throw new ExportPlannerError(code, `${label} must use positive safe-integer dimensions`);
  }
}

function aspectKey(canvas: PlannedCanvas): string {
  const divisor = greatestCommonDivisor(canvas.width, canvas.height);
  return `${canvas.width / divisor}:${canvas.height / divisor}`;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = a;
  let right = b;
  while (right !== 0) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left;
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
