//! Shared public types for `@foxworth/superimg/runtime`.
//!
//! Platform binders provide `init()`, `setup()`, `doctor()`, and the media-first
//! operations from `bindRuntimeApi`.

/** A complete browser-ready module closure prepared by the calling host. */
export interface NativeSurfacePreparationOptions {
  readonly entry: string;
  readonly files: Readonly<Record<string, string | Uint8Array>>;
}

export interface NativeSurfacePreparation {
  readonly module: Readonly<{ identity: string; moduleUrl: string; bridgeUrl: string }>;
  readonly nativeModuleSets: readonly import("@superimg/types").PreparedNativeModuleSet[];
}

export {
  PRORES_MASTER_ENCODING,
  PRORES_MASTER_ALPHA_ENCODING,
  SuperImgError,
  isSuperImgError,
  RuntimeInfrastructureError,
  RuntimeDisposedError,
  CapabilityUnavailableError,
  RuntimeCancelledError,
  MediaPreflightError,
  ExportBundleDisposedError,
} from "@superimg/types";

export type {
  MediaValue,
  ExportableMedia,
  InitOptions,
  Runtime,
  MediaRuntimeCapabilities as RuntimeCapabilities,
  RuntimeMediaCoordinates,
  RuntimeRenditionCoordinates as RenditionCoordinates,
  RuntimeFinding,
  RuntimeTechnicalCoverage,
  CheckOptions,
  CheckReport,
  InspectOptions,
  InspectReport,
  MediaRenderOptions as RenderOptions,
  MediaRenderResult as RenderResult,
  ExportOptions,
  ExportTarget,
  ExportRenditionRequest,
  ExportManifest,
  ExportManifestArtifact,
  ExportArtifact,
  ExportBundle,
  PublicationReceipt,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  SuperImgErrorCode,
  DoctorReport,
  SetupOptions,
} from "@superimg/types";

export type {
  EncodingQuality,
  MediaInput,
  MediaInspection,
  MediaTrackInspection,
  MediaInspectOptions,
  MediaTrim,
  ConversionTrackSelection,
  ConversionVideoSelection,
  ConversionCopyOptions,
  ConversionTrackPlan,
  ConversionSource,
  ConversionRequest,
  ConversionArtifact,
  PausableJob,
  JobState,
  JobEvent,
} from "@superimg/types";
