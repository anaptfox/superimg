//! MediaIR — experimental draft intermediate representation between authoring and render.
//! Browser-safe contracts only (no DOM/Node types).

import type { JsonObject, JsonValue } from "./json.js";
import type { MediaCoordinates } from "./coordinates.js";

/** Zero-based half-open frame range [startFrame, endFrame). */
export interface MediaIRFrameRange {
  startFrame: number;
  endFrame: number;
}

export type MediaIRTemporalCapability = "canonical" | "sampled" | "opaque";
export type MediaIRMotionCapability = "declarative" | "sampled" | "none";
export type MediaIRVisualCapability = "opaque-html" | "opaque-svg" | "tree";
export type MediaIRPortability =
  | "self-contained"
  | "network-required"
  | "incomplete";
export type MediaIRDeterminism = "verified" | "unverified";

export interface MediaIRCapabilityIssue {
  code: string;
  message: string;
  sceneId?: string;
  id?: string;
  frame?: number;
}

export interface MediaIRCapabilities {
  temporal: MediaIRTemporalCapability;
  motion: MediaIRMotionCapability;
  visual: MediaIRVisualCapability;
  portability: MediaIRPortability;
  determinism: MediaIRDeterminism;
  issues: MediaIRCapabilityIssue[];
}

export interface MediaIRProvenance {
  /** Content hash of bundled program (SHA-256 hex). */
  programHash: string;
  /** Source identity (relative path or host-assigned logical id). */
  sourceId: string;
  /** Runtime that produced this IR. */
  compiler: "superimg";
  /** Compiler schema / pipeline version for diagnostics. */
  compilerVersion: 0;
}

export interface MediaIRPhase {
  name: string;
  /**
   * Normalized progress within the scene. `0 <= start <= end <= 1`.
   * Phases may overlap and stay in author order. The first listed phase
   * that contains a progress is the active one.
   */
  start: number;
  end: number;
}

export interface MediaIRMarker {
  id: string;
  label?: string;
  frame: number;
}

export interface MediaIRTransition {
  id: string;
  type: string;
  range: MediaIRFrameRange;
  fromSceneId: string;
  toSceneId: string;
}

export interface MediaIRScene {
  id: string;
  label?: string;
  index: number;
  range: MediaIRFrameRange;
  phases: MediaIRPhase[];
  markers: MediaIRMarker[];
  transitions: MediaIRTransition[];
  /**
   * When this scene is a compose() slot that traces to another template,
   * the stable template id / relative path for Studio "door" navigation.
   * Omitted or null = unresolved (not a navigable door).
   */
  sourceId?: string | null;
}

export type MediaIRTrackKind =
  | "audio"
  | "transcript"
  | "video-sync"
  | "markers"
  | "author-track";

export interface MediaIRTrack {
  id: string;
  kind: MediaIRTrackKind;
  sceneId: string;
  label?: string;
  range: MediaIRFrameRange;
  /** Role for audio tracks. */
  role?: string;
  /** Content-addressed asset id or URL. */
  src?: string;
  /** Stable fields for UI/query (words count, etc.). */
  meta?: JsonObject;
}

export type MediaIREasing =
  | { kind: "named"; name: string }
  | { kind: "spring"; stiffness: number; damping: number; mass?: number };

export interface MediaIRMotion {
  /** Scene-qualified id */
  id: string;
  localId: string;
  sceneId: string;
  target?: string;
  property?: string;
  kind: "motion" | "tween" | "value" | "sampled";
  enter: MediaIRFrameRange;
  exit?: MediaIRFrameRange;
  from?: JsonObject;
  to?: JsonObject;
  /** Exit pose endpoints (runtime exit targets). */
  exitTo?: JsonObject;
  easing?: MediaIREasing;
  /** Effective exit easing after runtime mirror (e.g. easeOutCubic → easeInCubic). */
  exitEasing?: MediaIREasing;
  /** Tween pattern when kind is tween (pattern motions are sampled unless linear). */
  pattern?: "linear" | "sine" | "pulse" | "bounce";
}

export interface MediaIRAsset {
  id: string;
  kind: "image" | "video" | "audio" | "font" | "other";
  /** Relative content-addressed path or remote URL. */
  src: string;
  remote: boolean;
  contentHash?: string;
}

/** Run-length compressed per-frame observation stream. */
export interface MediaIRHashRun {
  range: MediaIRFrameRange;
  hash: string;
}

export interface MediaIRObservations {
  markupRuns: MediaIRHashRun[];
  sceneRuns: MediaIRHashRun[];
}

export interface MediaIRHashes {
  intentHash: string;
  markupHash: string;
  programHash: string;
}

/** Render-affecting configuration that is not returned from render(). */
export interface MediaIRRenderConfig {
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind: JsonValue;
  background: JsonValue;
  watermark: JsonValue;
  readiness: JsonValue;
  mode: "frame" | "animation";
}

/** Opaque schema-0 extension envelope interpreted only by its owning package. */
export interface MediaIRExtensionEnvelope {
  schemaVersion: 0;
  payload: JsonObject;
}

export interface MediaIR {
  kind: "@foxworth/superimg/media-ir";
  schemaVersion: 0;
  identity: MediaCoordinates;
  medium: "html" | "svg";
  animated: boolean;
  canvas: { width: number; height: number };
  renderConfig: MediaIRRenderConfig;
  clock: {
    fps: number;
    durationSeconds: number;
    totalFrames: number;
  };
  capabilities: MediaIRCapabilities;
  provenance: MediaIRProvenance;
  scenes: MediaIRScene[];
  tracks: MediaIRTrack[];
  motions: MediaIRMotion[];
  assets: MediaIRAsset[];
  observations: MediaIRObservations;
  hashes: MediaIRHashes;
  extensions: Record<string, MediaIRExtensionEnvelope>;
}

// ---------------------------------------------------------------------------
// Stub factory (demos, fixtures, unit tests — not a compiler output)
// ---------------------------------------------------------------------------

/** Placeholder 64-char hex for stub hashes (not real content digests). */
export const MEDIA_IR_STUB_HASH = "a".repeat(64);

/**
 * Options for {@link createMediaIR}.
 * Prefer this over hand-rolling empty IR objects in examples and tests.
 */
export type CreateMediaIROptions = {
  sourceId?: string;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  /** Defaults to `Math.round(fps * durationSeconds)`. */
  totalFrames?: number;
  medium?: "html" | "svg";
  animated?: boolean;
  /** Single scene id (default `"default"`). */
  sceneId?: string;
  phases?: MediaIRPhase[];
  /** Shallow top-level overrides applied last (e.g. custom tracks). */
  override?: Partial<MediaIR>;
};

/**
 * Build a minimal valid {@link MediaIR} document for demos, fixtures, and tests.
 *
 * This is **not** a substitute for the compiler (`resolveMediaIR` / package IR).
 * Use it when you need a serializable timeline shell without running a template.
 *
 * @example
 * ```ts
 * const ir = createMediaIR({ sourceId: "hero", width: 1920, height: 1080 });
 * const payload = payloadFromMediaIR(ir, { data: { title: "Hello" } });
 * ```
 */
export function createMediaIR(options: CreateMediaIROptions = {}): MediaIR {
  const sourceId = options.sourceId ?? "demo";
  const width = options.width ?? 960;
  const height = options.height ?? 540;
  const fps = options.fps ?? 30;
  const durationSeconds = options.durationSeconds ?? 3;
  const totalFrames =
    options.totalFrames ?? Math.max(1, Math.round(fps * durationSeconds));
  const medium = options.medium ?? "html";
  const animated = options.animated ?? true;
  const sceneId = options.sceneId ?? "default";
  const phases = options.phases ?? [{ name: "main", start: 0, end: 1 }];
  const h = MEDIA_IR_STUB_HASH;

  const base: MediaIR = {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: {
      sourceId,
      ...(options.entryId !== undefined ? { entryId: options.entryId } : {}),
      variantId: options.variantId ?? "default",
      editionId: options.editionId ?? "default",
    },
    medium,
    animated,
    canvas: { width, height },
    renderConfig: {
      fonts: [],
      inlineCss: [],
      stylesheets: [],
      tailwind: null,
      background: null,
      watermark: null,
      readiness: null,
      mode: "frame",
    },
    clock: { fps, durationSeconds, totalFrames },
    capabilities: {
      temporal: "canonical",
      motion: "none",
      visual: medium === "svg" ? "opaque-svg" : "opaque-html",
      portability: "self-contained",
      determinism: "unverified",
      issues: [],
    },
    provenance: {
      programHash: h,
      sourceId,
      compiler: "superimg",
      compilerVersion: 0,
    },
    scenes: [
      {
        id: sceneId,
        index: 0,
        range: { startFrame: 0, endFrame: totalFrames },
        phases,
        markers: [],
        transitions: [],
      },
    ],
    tracks: [],
    motions: [],
    assets: [],
    observations: {
      markupRuns: [
        { range: { startFrame: 0, endFrame: totalFrames }, hash: h },
      ],
      sceneRuns: [
        { range: { startFrame: 0, endFrame: totalFrames }, hash: h },
      ],
    },
    hashes: {
      intentHash: h,
      markupHash: h,
      programHash: h,
    },
    extensions: {},
  };

  if (!options.override) return base;
  return { ...base, ...options.override };
}

// ---------------------------------------------------------------------------
// Diff / query / job / artifact
// ---------------------------------------------------------------------------

export type MediaIRDiffConfidence = "canonical" | "sampled" | "opaque";

export type MediaIRDiffCategory =
  | "canvas"
  | "render-config"
  | "intent"
  | "duration"
  | "fps"
  | "scene"
  | "phase"
  | "marker"
  | "audio"
  | "track"
  | "asset"
  | "motion"
  | "opaque-markup"
  | "program";

export interface MediaIRDiffChange {
  id: string;
  category: MediaIRDiffCategory;
  confidence: MediaIRDiffConfidence;
  message: string;
  before?: JsonValue;
  after?: JsonValue;
  affected: MediaIRFrameRange[];
  pixelVerificationRequired: boolean;
}

export interface MediaIRDiff {
  schemaVersion: 0;
  result: "unchanged" | "sourceOnly" | "mediaAffecting";
  sourceOnly: boolean;
  pixelVerificationRequired: boolean;
  changes: MediaIRDiffChange[];
  /** Union of all affected ranges after adjacent merge. */
  affectedFrames: MediaIRFrameRange[];
  identity: {
    added: string[];
    removed: string[];
    modified: string[];
  };
}

export interface MediaIRQuery {
  sceneId?: string;
  motionId?: string;
  trackId?: string;
  frame?: number;
  range?: MediaIRFrameRange;
}

export interface MediaIRQueryResult {
  scenes: MediaIRScene[];
  motions: MediaIRMotion[];
  tracks: MediaIRTrack[];
  frame?: number;
}

/**
 * Frozen resolved input for **replay artifact** execution (not part of media.json).
 * Distinct from a deployable {@link TemplatePackage}, which accepts per-job data.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface MediaJob {
  schemaVersion: 0;
  coordinates: MediaCoordinates;
  data: JsonObject;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  totalFrames: number;
  medium: "html" | "svg";
  animated: boolean;
  fonts: string[];
  inlineCss: string[];
  stylesheets: string[];
  tailwind: JsonValue;
  background: JsonValue;
  watermark: JsonValue;
  readiness: JsonValue;
  audio: JsonValue;
  /** Original runtime spelling → vendored relative artifact path. */
  assetMap: Record<string, string>;
  resolvedAssets: Array<{
    key: string;
    type: "image" | "video" | "audio";
    src: string;
  }>;
  mode: "frame" | "animation";
  preset?: string;
}

export interface MediaArtifactFileEntry {
  path: string;
  sha256: string;
  bytes: number;
}

export interface MediaArtifactManifest {
  kind: "@foxworth/superimg/artifact";
  schemaVersion: 0 | 1;
  artifactHash: string;
  files: MediaArtifactFileEntry[];
  runtime: {
    requiresNetwork: boolean;
    medium: "html" | "svg";
    animated: boolean;
  };
  identity: MediaCoordinates;
}

export interface CompiledMediaArtifact {
  path: string;
  media: MediaIR;
  job: MediaJob;
  manifest: MediaArtifactManifest;
}

/**
 * Frozen render/replay artifact (alias of CompiledMediaArtifact).
 * Distinct from deployable {@link TemplatePackage}.
 * @experimental Draft
 */
export type FrozenRenderArtifact = CompiledMediaArtifact;
