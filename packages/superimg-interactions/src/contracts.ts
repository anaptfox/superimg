import type { JsonObject, JsonValue } from "@foxworth/boundary/program";
import type { CheckReport, InspectReport } from "@superimg/types";
import type { MediaInteractionProgressReporter } from "./progress.js";
import type { SpeechVoicesInput, SpeechSynthesizeInput, NarrationPrepareInput, NarrationReviewInput, NarrationInteractionResult } from "./narration-contracts.js";

export type MediaJsonPrimitive = string | number | boolean | null;
export type MediaJsonValue = JsonValue;
export type MediaJsonObject = JsonObject;
export type MediaJsonArray = readonly MediaJsonValue[];

export const MEDIA_INTERACTION_IDS = Object.freeze({
  discover: "media.project.discover",
  describe: "media.source.describe",
  check: "media.source.check",
  inspect: "media.source.inspect",
  snapshot: "media.collection.snapshot",
  compile: "media.artifact.compile",
  thumbnail: "media.artifact.thumbnail",
  arrange: "media.arrange.still",
  speechVoices: "media.speech.voices",
  speechSynthesize: "media.speech.synthesize",
  narrationPrepare: "media.narration.prepare",
  narrationReview: "media.narration.review",
  export: "media.export",
} as const);

export type MediaInteractionId =
  (typeof MEDIA_INTERACTION_IDS)[keyof typeof MEDIA_INTERACTION_IDS];
export type ControlledMediaInteractionId =
  | typeof MEDIA_INTERACTION_IDS.snapshot
  | typeof MEDIA_INTERACTION_IDS.compile
  | typeof MEDIA_INTERACTION_IDS.export;

export type MediaProjectDiscoverInteractionInput = Readonly<Record<string, never>>;

export type MediaSourceDescribeInteractionInput = Readonly<{
  /** Project-relative path, source id, or unambiguous short name. */
  source: string;
}>;

export type MediaCollectionSnapshotInteractionInput = Readonly<{
  /** Project-relative path, source id, or unambiguous short name. */
  source: string;
}>;

export type MediaSourceSelectionInput = Readonly<{
  data?: MediaJsonObject;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  snapshot?: MediaCollectionSnapshot;
  at?: number | string;
  renderedLayout?: boolean;
}>;

export type MediaSourceCheckInteractionInput = Readonly<{
  /** Project-relative path, source id, or unambiguous short name. */
  source: string;
  craft?: boolean;
}> & MediaSourceSelectionInput;

export type MediaSourceInspectInteractionInput = Readonly<{
  /** Project-relative path, source id, or unambiguous short name. */
  source: string;
  includeIR?: boolean;
}> & MediaSourceSelectionInput;

export type MediaCollectionSnapshotEntry = Readonly<{
  id: string;
  data: MediaJsonObject;
  dataDigest: string;
}>;

export type MediaCollectionSnapshot = Readonly<{
  schemaVersion: 0;
  kind: "media-collection-snapshot";
  source: string;
  sourceId: string;
  providerHash: string;
  snapshotDigest: string;
  entries: readonly MediaCollectionSnapshotEntry[];
}>;

export type MediaExportInteractionInput = Readonly<{
  source: string;
  publication: MediaPublicationTarget;
  destinations: readonly string[];
  entryIds?: readonly string[];
  variantIds?: readonly string[];
  editionIds?: readonly string[];
  snapshot?: MediaCollectionSnapshot;
  stillFrame?:
    | Readonly<{ kind: "poster" }>
    | Readonly<{ kind: "at"; at: number | string }>;
  rasterizer?: "playwright" | "blitz";
  debugHtml?: boolean;
  /** Encoding remains portable host input; SuperImg runtime owns its semantics. */
  encoding?: MediaJsonObject;
}>;

export type MediaPublicationTarget = Readonly<{
  /** Host-defined logical publication namespace. */
  targetId: string;
  /** Portable, target-relative publication identity. */
  publicationId: string;
}>;

export type MediaArtifactTarget = Readonly<{
  /** Host-defined logical artifact namespace. */
  targetId: string;
  /** Portable, target-relative artifact identity. */
  artifactId: string;
}>;

export type MediaArtifactCompileInteractionInput = Readonly<{
  source: string;
  target: MediaArtifactTarget;
  data?: MediaJsonObject;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  snapshot?: MediaCollectionSnapshot;
  verify?: boolean;
  strict?: boolean;
  /** Opt in to the native-module artifact format; omitted means schema 0. */
  artifactSchemaVersion?: 0 | 1;
}>;

export type MediaProjectSourceReference = Readonly<{
  sourceId: string;
  relativePath: string;
  sourceKind: "media-module" | "collection";
}>;

export type MediaProjectDiscovery = Readonly<{
  schemaVersion: 0;
  kind: "media-project-discovery";
  sources: readonly MediaProjectSourceReference[];
}>;

export type MediaSourcePhase = Readonly<{
  name: string;
  start: number;
  end: number;
  startSeconds: number;
  endSeconds: number;
}>;

export type MediaSourceEdition = Readonly<{
  id: string;
  width: number;
  height: number;
}>;

export type MediaSourceDescription = Readonly<{
  schemaVersion: 0;
  kind: "media-source-description";
  sourceId: string;
  relativePath: string;
  sourceKind: "media" | "collection" | "interactive";
  programHash: string;
  media?: "video" | "image" | "svg";
  medium?: "html" | "svg";
  animated: boolean;
  canvas: Readonly<{ width: number; height: number }>;
  fps: number;
  duration: number;
  totalFrames: number;
  temporal: "static" | "once" | "loop" | "interactive";
  fonts: readonly string[];
  phases: readonly MediaSourcePhase[];
  editions: readonly MediaSourceEdition[];
  collectionEntries?: "static" | "provider";
  variantIds: readonly string[];
  editionIds: readonly string[];
}>;

export type MediaSourceCheckResult = Readonly<{
  schemaVersion: 0;
  kind: "media-source-check";
  sourceId: string;
  relativePath: string;
  programHash: string;
  report: CheckReport;
}>;

export type MediaSourceInspectResult = Readonly<{
  schemaVersion: 0;
  kind: "media-source-inspection";
  sourceId: string;
  relativePath: string;
  programHash: string;
  report: InspectReport;
}>;

export type MediaArtifactThumbnailInteractionInput = Readonly<{
  artifactId: string;
  maxWidth: number;
}>;

export type MediaArtifactThumbnail = Readonly<{
  bytes: string;
  width: number;
  height: number;
}>;

/**
 * A portable arrangement request in, one still rendition's bytes out. No
 * durable footprint: `reads: []`, `changes: []`. `request` is the wire shape
 * `parseArrangeRequest` (`@superimg/core/arrange`) validates; the pattern
 * registry, not this contract, owns which shapes exist.
 */
export type MediaArrangeStillInteractionInput = Readonly<{
  request: MediaJsonObject;
  width?: number;
  height?: number;
  format?: "png";
  /** Seconds on the encoded clock. Omission selects the pattern answer poster. */
  at?: number;
}>;

export type MediaArrangeStillOutput = Readonly<{
  mimeType: string;
  /** Base64. The caller decodes; SuperImg never assumes a durable sink. */
  bytes: string;
  width: number;
  height: number;
  sha256: string;
}>;

export type MediaArtifactCompileReceipt = Readonly<{
  schemaVersion: 0;
  kind: "media-artifact";
  targetId: string;
  artifactId: string;
  artifactHash: string;
  programHash: string;
  intentHash: string;
  markupHash: string;
  coordinates: MediaJsonObject;
  manifest: MediaJsonObject;
}>;

/** Durable host publication receipt. This is not Runtime ExportBundle. */
export type MediaExportReceipt = Readonly<{
  schemaVersion: 0;
  targetId: string;
  publicationId: string;
  manifestDigest: string;
  manifest: MediaJsonObject;
}>;

export interface MediaInteractionInputById {
  readonly "media.narration.review": NarrationReviewInput;
  readonly "media.speech.voices": SpeechVoicesInput;
  readonly "media.speech.synthesize": SpeechSynthesizeInput;
  readonly "media.narration.prepare": NarrationPrepareInput;
  readonly "media.project.discover": MediaProjectDiscoverInteractionInput;
  readonly "media.source.describe": MediaSourceDescribeInteractionInput;
  readonly "media.source.check": MediaSourceCheckInteractionInput;
  readonly "media.source.inspect": MediaSourceInspectInteractionInput;
  readonly "media.collection.snapshot": MediaCollectionSnapshotInteractionInput;
  readonly "media.artifact.compile": MediaArtifactCompileInteractionInput;
  readonly "media.artifact.thumbnail": MediaArtifactThumbnailInteractionInput;
  readonly "media.arrange.still": MediaArrangeStillInteractionInput;
  readonly "media.export": MediaExportInteractionInput;
}

export interface MediaInteractionOutputById {
  readonly "media.narration.review": NarrationInteractionResult;
  readonly "media.speech.voices": NarrationInteractionResult;
  readonly "media.speech.synthesize": NarrationInteractionResult;
  readonly "media.narration.prepare": NarrationInteractionResult;
  readonly "media.project.discover": MediaProjectDiscovery;
  readonly "media.source.describe": MediaSourceDescription;
  readonly "media.source.check": MediaSourceCheckResult;
  readonly "media.source.inspect": MediaSourceInspectResult;
  readonly "media.collection.snapshot": MediaCollectionSnapshot;
  readonly "media.artifact.compile": MediaArtifactCompileReceipt;
  readonly "media.artifact.thumbnail": MediaArtifactThumbnail;
  readonly "media.arrange.still": MediaArrangeStillOutput;
  readonly "media.export": MediaExportReceipt;
}

export type MediaInteractionRequestFor<Id extends MediaInteractionId> = Readonly<{
  interactionId: Id;
  input: MediaInteractionInputById[Id];
}>;

export type MediaInteractionRequest = {
  [Id in MediaInteractionId]: MediaInteractionRequestFor<Id>;
}[MediaInteractionId];

export type MediaInteractionHandlerArgs<Input, Context> = Readonly<{
  input: Input;
  context: Context;
  /** Host-local observation seam. Never part of a portable Program contract. */
  progress?: MediaInteractionProgressReporter;
}>;

export interface MediaInteractionHandlers<Context> {
  narrationReview?(args: MediaInteractionHandlerArgs<NarrationReviewInput, Context>): Promise<NarrationInteractionResult> | NarrationInteractionResult;
  speechVoices?(args: MediaInteractionHandlerArgs<SpeechVoicesInput, Context>): Promise<NarrationInteractionResult> | NarrationInteractionResult;
  speechSynthesize?(args: MediaInteractionHandlerArgs<SpeechSynthesizeInput, Context>): Promise<NarrationInteractionResult> | NarrationInteractionResult;
  narrationPrepare?(args: MediaInteractionHandlerArgs<NarrationPrepareInput, Context>): Promise<NarrationInteractionResult> | NarrationInteractionResult;
  discover(
    args: MediaInteractionHandlerArgs<MediaProjectDiscoverInteractionInput, Context>,
  ): Promise<MediaProjectDiscovery> | MediaProjectDiscovery;
  describe(
    args: MediaInteractionHandlerArgs<MediaSourceDescribeInteractionInput, Context>,
  ): Promise<MediaSourceDescription> | MediaSourceDescription;
  check(
    args: MediaInteractionHandlerArgs<MediaSourceCheckInteractionInput, Context>,
  ): Promise<MediaSourceCheckResult> | MediaSourceCheckResult;
  inspect(
    args: MediaInteractionHandlerArgs<MediaSourceInspectInteractionInput, Context>,
  ): Promise<MediaSourceInspectResult> | MediaSourceInspectResult;
  snapshot(
    args: MediaInteractionHandlerArgs<MediaCollectionSnapshotInteractionInput, Context>,
  ): Promise<MediaCollectionSnapshot> | MediaCollectionSnapshot;
  compile(
    args: MediaInteractionHandlerArgs<MediaArtifactCompileInteractionInput, Context>,
  ): Promise<MediaArtifactCompileReceipt> | MediaArtifactCompileReceipt;
  thumbnail(
    args: MediaInteractionHandlerArgs<MediaArtifactThumbnailInteractionInput, Context>,
  ): Promise<MediaArtifactThumbnail> | MediaArtifactThumbnail;
  arrange(
    args: MediaInteractionHandlerArgs<MediaArrangeStillInteractionInput, Context>,
  ): Promise<MediaArrangeStillOutput> | MediaArrangeStillOutput;
  export(
    args: MediaInteractionHandlerArgs<MediaExportInteractionInput, Context>,
  ): Promise<MediaExportReceipt> | MediaExportReceipt;
}

export type MediaInteractionErrorCode =
  | "UNKNOWN_INTERACTION"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "CONTROL_UNAVAILABLE"
  | "CONTROL_TARGET_MISMATCH"
  | "INVALID_CONTROL_CONFIGURATION";

export type MediaInteractionDeclaredErrorCode =
  | MediaInteractionErrorCode
  | "CANCELLED"
  | "INTERACTION_FAILED";

/** SuperImg-native failure evidence. Host declared errors use `{ code, details }`. */
export type MediaInteractionDeclaredError = MediaJsonObject & Readonly<{
  schemaVersion: 1;
  kind: "media-interaction-error";
  code: MediaInteractionDeclaredErrorCode;
  path: string;
  message: string;
}>;

export class MediaInteractionError extends Error {
  readonly code: MediaInteractionErrorCode;
  readonly path: string;
  readonly issues: readonly Readonly<{ path: string; message: string }>[] | undefined;

  constructor(
    code: MediaInteractionErrorCode,
    path: string,
    message: string,
    options: Readonly<{
      cause?: unknown;
      issues?: readonly Readonly<{ path: string; message: string }>[];
    }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MediaInteractionError";
    this.code = code;
    this.path = path;
    this.issues = options.issues;
  }
}
