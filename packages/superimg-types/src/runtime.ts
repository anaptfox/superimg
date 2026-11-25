/// <reference lib="esnext.disposable" />

//! Public, value-first runtime contracts.
//!
//! These types deliberately contain no source paths, host identities, URLs,
//! filesystem handles, Buffer, or Blob. Hosts may associate an authored value
//! with their own identity before or after invoking the runtime.

import type { CollectionDefinition } from "./collection.js";
import type {
  DeterministicMediaDefinition,
  DeterministicMediaKind,
} from "./define.js";
import type { EncodingOptions, OutputFormat } from "./encoding-types.js";
import type { FontDeclaration } from "./fonts.js";
import type { JsonObject, JsonValue } from "./json.js";
import { SuperImgError } from "./results.js";

/** Structural view of the value owned by `@foxworth/superimg/interactive`. */
export interface OpaqueInteractiveMediaValue {
  readonly kind: "interactive";
  readonly guide: unknown;
  readonly size?: { readonly width: number; readonly height: number };
  readonly sample?: unknown;
  readonly render: (...args: never[]) => unknown;
}

/**
 * Runtime values erase their authored data parameter without constraining it.
 * `any` is intentional here: the public runtime accepts every concrete author
 * data type, including types that are invariant through render callbacks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErasedAuthorData = any;

/** Any deterministic authored value accepted by the runtime. */
export type DeterministicMediaValue<D = ErasedAuthorData> =
  DeterministicMediaDefinition<D>;

/** Any deterministic collection accepted by the runtime. */
export type CollectionMediaValue<D extends object = ErasedAuthorData> = CollectionDefinition<
  D,
  DeterministicMediaDefinition<D>
>;

/** Values that can be checked or inspected without a source path. */
export type MediaValue<D = ErasedAuthorData> =
  | DeterministicMediaValue<D>
  | CollectionMediaValue<D & object>
  | OpaqueInteractiveMediaValue;

/** Values that can produce deterministic artifacts. */
export type ExportableMedia<D = ErasedAuthorData> =
  | DeterministicMediaValue<D>
  | CollectionMediaValue<D & object>;

export type RuntimeDocumentFormat = "html" | "svg";
export type RuntimeRasterFormat = "png" | "jpeg" | "webp";
export type RuntimeAnimatedFormat = "mp4" | "webm" | "mov" | "mkv" | "gif";
export type RuntimeOutputFormat =
  | RuntimeDocumentFormat
  | RuntimeRasterFormat
  | RuntimeAnimatedFormat;

/** Semantic work available from one initialized runtime. */
export interface MediaRuntimeCapabilities {
  readonly schemaVersion: 0;
  readonly check: boolean;
  readonly inspect: boolean;
  readonly documents: readonly RuntimeDocumentFormat[];
  readonly rasters: readonly RuntimeRasterFormat[];
  readonly animated: readonly RuntimeAnimatedFormat[];
  readonly collections: Readonly<{
    static: boolean;
    providers: boolean;
  }>;
  readonly assets: Readonly<{
    url: boolean;
    bytes: boolean;
  }>;
  readonly fonts: Readonly<{
    logical: boolean;
    frozenBytes: boolean;
  }>;
}

export interface InitOptions {
  /** Abort initialization before a usable runtime is returned. */
  readonly signal?: AbortSignal;
  /** Maximum semantic jobs evaluated concurrently by this runtime. */
  readonly concurrency?: number;
  /**
   * Node stills: reuse Chromium pages of the same size×dpr.
   * Off by default. Long-lived hosts (Habitat) should set this.
   */
  readonly poolStillPages?: boolean;
  /**
   * Faces used as the default family when the host can supply bytes.
   * An array replaces bundled Inter. `false` disables the default.
   * Omit it to load bundled Inter, which is skipped with a warning when this
   * runtime cannot read the package files.
   */
  readonly defaultFonts?: readonly FontDeclaration[] | false;
}

/** An initialized, immutable adapter set. Disposal is idempotent. */
export interface Runtime extends AsyncDisposable {
  readonly abi: string;
  readonly capabilities: MediaRuntimeCapabilities;
  dispose(): Promise<void>;
}

/** Coordinates intrinsic to authored media. Host source identity is separate. */
export interface RuntimeMediaCoordinates {
  readonly entryId?: string;
  readonly variantId: string;
  readonly editionId: string;
}

/** Coordinates for one requested delivery rendition. */
export interface RuntimeRenditionCoordinates extends RuntimeMediaCoordinates {
  readonly renditionId: string;
}

export type RuntimeMediaKind = DeterministicMediaKind | "collection" | "interactive";
export type RuntimeFindingSeverity = "error" | "warning" | "info";
export type RuntimeFindingCategory =
  | "authoring"
  | "asset"
  | "font"
  | "collection"
  | "interactive"
  | "capability"
  | "render";

/** One stable, authored or semantic finding. */
export interface RuntimeFinding {
  readonly severity: RuntimeFindingSeverity;
  readonly category: RuntimeFindingCategory;
  readonly code: string;
  readonly message: string;
  readonly suggestion?: string;
  readonly coordinates?: RuntimeMediaCoordinates;
  readonly details?: Readonly<JsonObject>;
}

/** Evidence coverage, independent from a human visual review. */
export interface RuntimeTechnicalCoverage {
  readonly samples: readonly { readonly frame: number; readonly progress: number; readonly coordinates?: RuntimeMediaCoordinates }[];
  readonly checks: readonly { readonly id: string; readonly scope: "frame" | "sequence"; readonly frames: readonly number[] }[];
  readonly geometry: { readonly sourceEstimatedNodes: number; readonly fontMeasuredNodes: number; readonly browserMeasuredNodes: number; readonly opaqueRegions: number; readonly browserOpaqueRegions?: number };
  readonly unsupported: readonly string[];
  readonly visual: "unreviewed";
}

export type ProviderResolution = "skip" | "resolve";

export interface RuntimeSelectionOptions<D = JsonObject> {
  readonly data?: Partial<D>;
  /** Use this runtime instead of the shared default. */
  readonly runtime?: Runtime;
  readonly entryId?: string;
  readonly variantId?: string;
  readonly editionId?: string;
  /** Provider functions are never executed unless explicitly requested. */
  readonly providers?: ProviderResolution;
  readonly signal?: AbortSignal;
}

export interface CheckOptions<D = JsonObject> extends RuntimeSelectionOptions<D> {
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  readonly craft?: boolean;
  /**
   * Opt in to browser-backed layout inspection at the resolved selection and
   * time. Hosts that do not provide a layout inspector report semantic checks.
   */
  readonly renderedLayout?: boolean;
}

export interface CheckReport {
  readonly schemaVersion: 0;
  readonly ok: boolean;
  /** Digest of the executable media program, not a host source id. */
  readonly programDigest: string;
  readonly kind: RuntimeMediaKind;
  readonly coordinates: readonly RuntimeMediaCoordinates[];
  readonly findings: readonly RuntimeFinding[];
  readonly coverage?: RuntimeTechnicalCoverage;
}

export interface InspectOptions<D = JsonObject> extends RuntimeSelectionOptions<D> {
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  /** Include host-neutral schema-0 summaries under metadata.semanticIR. */
  readonly includeIR?: boolean;
  /** Opt in to browser-backed layout inspection at the resolved selection and time. */
  readonly renderedLayout?: boolean;
}

export interface RuntimeMediaConfig {
  readonly medium: "html" | "svg";
  readonly animated: boolean;
  readonly width: number;
  readonly height: number;
  readonly fps?: number;
  readonly durationSeconds?: number;
  readonly totalFrames?: number;
}

export interface FrozenAssetMetadata {
  readonly name: string;
  readonly kind: "image" | "video" | "audio" | "other";
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface FrozenFontMetadata {
  readonly request: string;
  readonly family: string;
  readonly weight?: number;
  readonly style?: "normal" | "italic";
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface CollectionInspection {
  readonly source: "static" | "provider";
  readonly resolved: boolean;
  readonly entryCount?: number;
  readonly entryIds?: readonly string[];
}

export interface InspectReport {
  readonly schemaVersion: 0;
  readonly programDigest: string;
  readonly kind: RuntimeMediaKind;
  readonly config?: RuntimeMediaConfig;
  readonly coordinates: readonly RuntimeMediaCoordinates[];
  readonly findings: readonly RuntimeFinding[];
  readonly coverage?: RuntimeTechnicalCoverage;
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly collection?: CollectionInspection;
  /** Optional schema-0 Media IR or host-neutral semantic metadata. */
  readonly metadata?: Readonly<JsonObject>;
}

export type ExactRenderFormat = RuntimeDocumentFormat | RuntimeRasterFormat;

/** One exact document, still, or in-memory animated rendition. */
export type RenderFormat =
  | ExactRenderFormat
  | "mp4"
  | "webm"
  | "mov"
  | "gif";

/** Options for one exact document, still, or animated result. */
export interface MediaRenderOptions<D = JsonObject> extends RuntimeSelectionOptions<D> {
  readonly as: RenderFormat;
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  readonly size?: Readonly<{ width: number; height: number }>;
  readonly encoding?: Omit<EncodingOptions, "format">;
}

/** One exact result held in memory. Reads are repeatable and contain no platform value. */
export interface MediaRenderResult {
  readonly as: RenderFormat;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly coordinates: RuntimeMediaCoordinates;
  stream(): ReadableStream<Uint8Array>;
  bytes(): Promise<Uint8Array>;
  /** `Blob` whose type is `mimeType`. */
  blob(): Promise<Blob>;
  /** Decode a text result. Rejects with `NOT_TEXT` for any other MIME type. */
  text(): Promise<string>;
}

export interface ExportRenditionRequest {
  readonly id: string;
  readonly format: OutputFormat;
  readonly width: number;
  readonly height: number;
  readonly encoding?: Omit<EncodingOptions, "format">;
}

export type ExportTarget = string | ExportRenditionRequest;

/** One exact rendition observed while the host runtime executes an export. */
export interface ExportProgressItem {
  /** Deterministic identity derived from the rendition path and full coordinates. */
  readonly itemId: string;
  readonly kind: "rendition";
  readonly entryId?: string;
  readonly variantId: string;
  readonly editionId: string;
  readonly renditionId: string;
}

/** Monotonic work observed for an export stage or one rendition. */
export interface ExportProgressWork {
  readonly unit: "renditions" | "frames";
  readonly completed: number;
  /** Omitted when the runtime cannot know the total yet. */
  readonly total?: number;
}

type ExportProgressEventBase = Readonly<{
  readonly schemaVersion: 0;
  readonly kind: "@foxworth/superimg/export-progress";
  readonly stageId: "runtime.render";
  readonly item?: ExportProgressItem;
  readonly work?: ExportProgressWork;
}>;

/** Portable, authority-free observation emitted while the host runtime exports media. */
export type ExportProgressEvent = ExportProgressEventBase &
  (
    | Readonly<{
        readonly state: "started" | "running" | "succeeded";
        readonly error?: never;
        readonly reason?: never;
      }>
    | Readonly<{
        readonly state: "failed";
        readonly error: Readonly<{
          readonly code?: string;
          readonly message: string;
        }>;
        readonly reason?: never;
      }>
    | Readonly<{
        readonly state: "cancelled";
        readonly error?: never;
        readonly reason?: string;
      }>
  );

export interface ExportOptions<D = JsonObject> {
  readonly for: readonly ExportTarget[];
  readonly data?: Partial<D>;
  /** Use this runtime instead of the shared default. */
  readonly runtime?: Runtime;
  readonly entryIds?: readonly string[];
  readonly variantIds?: readonly string[];
  readonly editionIds?: readonly string[];
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  /** Shared encoder/capture policy beneath exact per-rendition overrides. */
  readonly encoding?: Omit<EncodingOptions, "format">;
  /** Provider functions are never executed unless explicitly requested. */
  readonly providers?: ProviderResolution;
  readonly signal?: AbortSignal;
  /**
   * Observe host-runtime execution with portable values. This callback and its
   * events are never authored media identity, portable Program input, authority,
   * or proof of an export result. Observer failures are ignored by the runtime.
   */
  readonly onProgress?: (
    event: ExportProgressEvent,
  ) => void | Promise<void>;
}

export interface ExportManifestArtifact {
  readonly path: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly coordinates: RuntimeRenditionCoordinates;
}

/** Complete, deterministic coverage of one unpublished export bundle. */
export interface ExportManifest {
  readonly kind: "@foxworth/superimg/export-bundle";
  readonly schemaVersion: 0;
  readonly programDigest: string;
  readonly coordinates: readonly RuntimeMediaCoordinates[];
  readonly artifacts: readonly ExportManifestArtifact[];
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly metadata?: Readonly<JsonObject>;
}

export interface ExportArtifact {
  /** Normalized, relative, URL-free bundle path. */
  readonly path: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly coordinates: RuntimeRenditionCoordinates;
  /** A new readable stream on every call while the bundle is live. */
  stream(): ReadableStream<Uint8Array>;
  bytes(): Promise<Uint8Array>;
  /** `Blob` whose type is `mimeType`. */
  blob(): Promise<Blob>;
  /** Decode a text artifact. Rejects with `NOT_TEXT` for any other MIME type. */
  text(): Promise<string>;
}

/** Owns portable memory or temporary backing independently of the runtime. */
export interface ExportBundle extends AsyncDisposable {
  readonly manifest: ExportManifest;
  readonly artifacts: readonly ExportArtifact[];
  dispose(): Promise<void>;
}

/** Durable host publication receipt matching `MediaExportReceipt` schema 0. */
export interface PublicationReceipt {
  readonly schemaVersion: 0;
  readonly targetId: string;
  readonly publicationId: string;
  readonly manifestDigest: string;
  readonly manifest: ExportManifest | Readonly<JsonObject>;
}

/** Chromium plus local encoder probes from `doctor()` / `setup()`. */
export interface DoctorReport {
  readonly ok: boolean;
  readonly chromium: {
    readonly status: "ok" | "missing" | "launch-denied";
    readonly executablePath?: string;
    readonly browsersPath: string;
    readonly installCommand: string;
  };
  readonly encoders: {
    readonly mp4: boolean;
    readonly gif: boolean;
    readonly jpegWebp: boolean;
  };
}

/** Options for installing the Node Chromium runtime before a doctor report. */
export interface SetupOptions {
  /** Progress text from the Chromium install. */
  readonly onProgress?: (event: string) => void;
  readonly signal?: AbortSignal;
}

/** Stable infrastructure failure outside authored media semantics. */
export class RuntimeInfrastructureError extends SuperImgError {
  constructor(
    message: string,
    details: JsonObject = {},
    options?: { cause?: unknown },
  ) {
    super(
      message,
      "RUNTIME_INFRASTRUCTURE_ERROR",
      details,
      "Retry with a healthy SuperImg runtime or inspect its diagnostics.",
      undefined,
      options,
    );
    this.name = "RuntimeInfrastructureError";
  }
}

/** An operation was attempted after runtime disposal. */
export class RuntimeDisposedError extends SuperImgError {
  constructor() {
    super(
      "The SuperImg runtime has been disposed",
      "RUNTIME_DISPOSED",
      {},
      "Create a new runtime with init() before performing more work.",
    );
    this.name = "RuntimeDisposedError";
  }
}

/** A requested semantic operation is unavailable in this initialized runtime. */
export class CapabilityUnavailableError extends SuperImgError {
  constructor(capability: string, details: JsonObject = {}) {
    super(
      `The initialized runtime cannot provide ${capability}`,
      "CAPABILITY_UNAVAILABLE",
      { capability, ...details },
      "Choose a supported output or initialize a runtime with the required capability.",
    );
    this.name = "CapabilityUnavailableError";
  }
}

/** A runtime operation was cancelled through its AbortSignal. */
export class RuntimeCancelledError extends SuperImgError {
  constructor(details: JsonObject = {}) {
    super(
      "The SuperImg runtime operation was cancelled",
      "RUNTIME_CANCELLED",
      details,
      "Retry the operation with a live AbortSignal when appropriate.",
    );
    this.name = "RuntimeCancelledError";
  }
}

/** Complete preflight found authored conditions that block artifact creation. */
export class MediaPreflightError extends SuperImgError {
  readonly findings: readonly RuntimeFinding[];

  constructor(findings: readonly RuntimeFinding[]) {
    const serialized = findings.map((finding) => ({
      severity: finding.severity,
      category: finding.category,
      code: finding.code,
      message: finding.message,
      ...(finding.suggestion !== undefined ? { suggestion: finding.suggestion } : {}),
    })) as JsonValue[];
    super(
      "Media preflight found authored conditions that block this operation",
      "MEDIA_PREFLIGHT_FAILED",
      { findings: serialized },
      "Resolve the error findings, then retry without requiring a prior check() call.",
    );
    this.name = "MediaPreflightError";
    this.findings = findings;
  }
}

/** Artifact reads are invalid after their owning bundle is disposed. */
export class ExportBundleDisposedError extends SuperImgError {
  constructor(path?: string) {
    super(
      "The export bundle has been disposed",
      "EXPORT_BUNDLE_DISPOSED",
      path === undefined ? {} : { path },
      "Keep the bundle alive until every artifact stream has been consumed.",
    );
    this.name = "ExportBundleDisposedError";
  }
}
