//! Private adapter contract consumed by the value-first runtime kernel.
//!
//! This is intentionally not a public custom-adapter API. Public platform
//! binders in `@foxworth/superimg/runtime` construct one of these from SuperImg-owned
//! Node, browser, or edge implementations.

import type {
  CheckOptions,
  ConversionRequest,
  ConversionTrackPlan,
  MediaInput,
  MediaInspection,
  ExactRenderFormat,
  ExportOptions,
  ExportableMedia,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  InspectOptions,
  JsonObject,
  MediaRenderOptions,
  MediaRuntimeCapabilities,
  MediaValue,
  RuntimeFinding,
  RuntimeMediaCoordinates,
  RuntimeRenditionCoordinates,
} from "@superimg/types";
import type { RuntimeInspectionContribution } from "./semantic.js";
import type { RuntimeCollectionEntry, RuntimeMediaSelection } from "./selection.js";

export type RuntimeArtifactOperation = "render" | "export";

export interface RuntimeAdapterInspectionRequest {
  readonly operation: "check" | "inspect";
  readonly media: MediaValue;
  readonly options: CheckOptions | InspectOptions;
  /** Invariant: inspection never delegates collection-provider execution. */
  readonly allowProviderExecution: false;
  /** Optional snapshot resolved exactly once by the kernel after explicit opt-in. */
  readonly entries?: readonly RuntimeCollectionEntry[];
  /**
   * Exact value selections resolved by semantic analysis. Browser-backed
   * inspection must use these rather than reselecting collection/default data.
   */
  readonly selections?: readonly RuntimeMediaSelection[];
}

export interface RuntimeAdapterCollectionRequest {
  readonly collection: Extract<ExportableMedia, { readonly kind: "collection" }>;
  readonly signal?: AbortSignal;
}

export interface RuntimeAdapterPreflightRequest {
  readonly operation: RuntimeArtifactOperation;
  readonly programDigest: string;
  readonly media: ExportableMedia;
  readonly options: MediaRenderOptions | ExportOptions;
  /** Exact render selection. Export adapters receive an entry snapshot below. */
  readonly selection?: RuntimeMediaSelection;
  /** Fulfilled export selections, shared with preflight and every rendition. */
  readonly selections?: readonly RuntimeMediaSelection[];
  /** Complete, once-resolved collection snapshot for export. */
  readonly entries?: readonly RuntimeCollectionEntry[];
}

export interface RuntimeAdapterPreflight {
  readonly findings: readonly RuntimeFinding[];
  readonly assets: readonly FrozenAssetMetadata[];
  readonly fonts: readonly FrozenFontMetadata[];
  readonly metadata?: Readonly<JsonObject>;
  /** Private adapter state returned verbatim to execution. */
  readonly prepared?: unknown;
  /** Release operation-local preparation. Called exactly once. */
  dispose?(): void | Promise<void>;
}

/** Still and document renders. Animated formats go through export. */
export type AdapterRenderOptions = Omit<MediaRenderOptions, "as" | "runtime"> & {
  readonly as: ExactRenderFormat;
};

export interface RuntimeAdapterRenderRequest extends RuntimeAdapterPreflightRequest {
  readonly operation: "render";
  readonly options: AdapterRenderOptions;
  readonly selection: RuntimeMediaSelection;
  readonly preflight: RuntimeAdapterPreflight;
}

export interface RuntimeAdapterRenderOutput {
  readonly as: ExactRenderFormat;
  readonly mimeType: string;
  readonly coordinates: RuntimeMediaCoordinates;
  readonly bytes: Uint8Array;
  readonly byteLength?: number;
  readonly sha256?: string;
}

export interface RuntimeAdapterExportRequest extends RuntimeAdapterPreflightRequest {
  readonly operation: "export";
  readonly options: ExportOptions;
  readonly preflight: RuntimeAdapterPreflight;
  readonly lifecycle?: {
    checkpoint(completed?: number, total?: number): Promise<void>;
    finalizing(): void;
  };
}

/**
 * Sealed adapter-owned storage transferred to a successful bundle or conversion artifact. The adapter
 * computes its digest before transfer and must keep the contents immutable and
 * independently readable until disposal, even after runtime disposal.
 */
export interface RuntimeArtifactBacking {
  readonly byteLength: number;
  readonly sha256: string;
  open(): ReadableStream<Uint8Array>;
  dispose(): Promise<void>;
}

interface RuntimeAdapterArtifactIdentity {
  readonly path: string;
  readonly mimeType: string;
  readonly coordinates: RuntimeRenditionCoordinates;
}

export type RuntimeAdapterArtifactData = RuntimeAdapterArtifactIdentity & (
  | { readonly bytes: Uint8Array; readonly byteLength?: number; readonly sha256?: string; readonly backing?: never }
  | { readonly backing: RuntimeArtifactBacking; readonly bytes?: never; readonly byteLength?: never; readonly sha256?: never }
);

export interface RuntimeAdapterExportOutput {
  readonly coordinates: readonly RuntimeMediaCoordinates[];
  readonly artifacts: readonly RuntimeAdapterArtifactData[];
  readonly metadata?: Readonly<JsonObject>;
}

export interface RuntimeAdapterConversionRequest {
  readonly request: ConversionRequest;
  readonly checkpoint: (completed?: number, total?: number) => Promise<void>;
  readonly preflight: (tracks: readonly import("@superimg/types").ConversionTrackPlan[]) => Promise<void>;
  /** Called immediately before output finalization. */
  readonly finalizing: () => void;
}

export type RuntimeAdapterConversionOutput = {
  readonly mimeType: string;
  readonly durationSeconds: number;
  readonly tracks: readonly ConversionTrackPlan[];
} & (
  | { readonly bytes: Uint8Array; readonly backing?: never }
  | { readonly backing: RuntimeArtifactBacking; readonly bytes?: never }
);

export interface RuntimeAdapter {
  readonly abi: string;
  readonly capabilities: MediaRuntimeCapabilities;
  inspect?(request: RuntimeAdapterInspectionRequest): Promise<RuntimeInspectionContribution>;
  inspectFile?(input: MediaInput, signal?: AbortSignal): Promise<MediaInspection>;
  convertMedia?(request: RuntimeAdapterConversionRequest): Promise<RuntimeAdapterConversionOutput>;
  resolveCollectionEntries?(
    request: RuntimeAdapterCollectionRequest,
  ): Promise<readonly unknown[]>;
  preflight(request: RuntimeAdapterPreflightRequest): Promise<RuntimeAdapterPreflight>;
  render(request: RuntimeAdapterRenderRequest): Promise<RuntimeAdapterRenderOutput>;
  exportMedia(request: RuntimeAdapterExportRequest): Promise<RuntimeAdapterExportOutput>;
  dispose(): void | Promise<void>;
}

/** Copy and bind the adapter set so it cannot change after runtime creation. */
export function freezeRuntimeAdapter(adapter: RuntimeAdapter): RuntimeAdapter {
  if (adapter.abi.trim().length === 0) throw new TypeError("Runtime adapter ABI must be non-empty");
  const capabilities = freezeCapabilities(adapter.capabilities);
  return Object.freeze({
    abi: adapter.abi,
    capabilities,
    ...(adapter.inspect !== undefined ? { inspect: adapter.inspect.bind(adapter) } : {}),
    ...(adapter.inspectFile !== undefined ? { inspectFile: adapter.inspectFile.bind(adapter) } : {}),
    ...(adapter.convertMedia !== undefined ? { convertMedia: adapter.convertMedia.bind(adapter) } : {}),
    ...(adapter.resolveCollectionEntries !== undefined
      ? { resolveCollectionEntries: adapter.resolveCollectionEntries.bind(adapter) }
      : {}),
    preflight: adapter.preflight.bind(adapter),
    render: adapter.render.bind(adapter),
    exportMedia: adapter.exportMedia.bind(adapter),
    dispose: adapter.dispose.bind(adapter),
  });
}

function freezeCapabilities(input: MediaRuntimeCapabilities): MediaRuntimeCapabilities {
  return Object.freeze({
    schemaVersion: 0,
    check: input.check,
    inspect: input.inspect,
    documents: Object.freeze([...input.documents]),
    rasters: Object.freeze([...input.rasters]),
    animated: Object.freeze([...input.animated]),
    collections: Object.freeze({ ...input.collections }),
    assets: Object.freeze({ ...input.assets }),
    fonts: Object.freeze({ ...input.fonts }),
  });
}
