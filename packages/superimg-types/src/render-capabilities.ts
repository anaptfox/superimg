//! Experimental draft — render requirements, runtime capabilities, and path negotiation.
//! schemaVersion 0: fields may change before the first release.

import type { OutputFormat } from "./encoding-types.js";
import type { Medium } from "./engine.js";

/** Compiler-owned hints used to prepare optional browser runtime packs. */
export type MediaCapabilityName =
  | "math"
  | "color"
  | "date"
  | "text"
  | "layout"
  | "svg"
  | "viz"
  | "subtitle"
  | "backgrounds"
  | "montage"
  | "path"
  | "reveal"
  | "responsive"
  | "carousel"
  | "stack"
  | "spring"
  | "stagger"
  | "timing"
  | "phases"
  | "motion"
  | "safe-area"
  | "oscillate"
  | "ready"
  | "layout-timeline"
  | "interpolate"
  | "code"
  | "rough"
  | "katex"
  | "lottie"
  | "mermaid"
  | "three"
  | "scripts"
  | "canvas"
  | "webgl"
  | "interactive"
  | "css-animation"
  | "fonts"
  | "tailwind";

export interface MediaCapabilities {
  readonly version: 0;
  readonly names: ReadonlyArray<
    MediaCapabilityName | { readonly name: MediaCapabilityName; readonly [key: string]: unknown }
  >;
}

/** Output formats a template/job may request. */
export type RenderOutputFormat = OutputFormat | "svg" | "png" | "html";

/**
 * What a Media IR / template package needs from a runtime to render correctly.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface RenderRequirements {
  schemaVersion: 0;
  medium: Medium;
  outputs: RenderOutputFormat[];
  animated: boolean;
  features: {
    scripts: boolean;
    audio: boolean;
    embeddedVideo: boolean;
    gif: boolean;
    distributedStitching: boolean;
  };
}

export type RasterizerKind = "dom" | "playwright" | "resvg" | "blitz";
export type EncoderKind = "mediabunny-browser" | "mediabunny-node" | "ffmpeg";
export type MediaDecoderKind = "browser" | "ffmpeg";
export type StitcherKind = "mediabunny-node" | "ffmpeg";
export type FilesystemCapability = "none" | "temporary" | "persistent";

/** Named deployment/runtime profiles. */
export type RuntimeProfileName = "browser" | "edge" | "node" | "node-media";

/**
 * What a runtime environment can actually provide.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface RuntimeCapabilities {
  schemaVersion: 0;
  profile: RuntimeProfileName;
  rasterizers: RasterizerKind[];
  encoders: EncoderKind[];
  decoders: MediaDecoderKind[];
  stitchers: StitcherKind[];
  processExecution: boolean;
  filesystem: FilesystemCapability;
  /** Optional diagnostic versions (e.g. ffmpeg binary version or null if absent). */
  versions?: {
    ffmpeg?: string | null;
    playwright?: string | null;
    resvg?: string | null;
  };
}

/**
 * Negotiated render path when requirements are satisfied.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface RenderPath {
  schemaVersion: 0;
  profile: RuntimeProfileName;
  rasterizer: RasterizerKind;
  encoder?: EncoderKind;
  decoder?: MediaDecoderKind;
  stitcher?: StitcherKind;
  /** Human-readable summary for logs. */
  description: string;
  /**
   * Set for an html still. The rasterizer is chosen from the rendered tree,
   * so planning allows the still and the runtime decides.
   */
  lane?: "content-dependent";
}

/**
 * One unsupported requirement discovered during negotiation.
 * @experimental Draft contract (schemaVersion 0).
 */
export interface UnsupportedRequirement {
  code:
    | "unsupported_medium"
    | "unsupported_output"
    | "missing_rasterizer"
    | "missing_encoder"
    | "missing_decoder"
    | "missing_stitcher"
    | "remote_assets_denied"
    | "scripts_unsupported"
    | "audio_unsupported"
    | "ffmpeg_required"
    | "process_execution_required"
    | "profile_mismatch";
  message: string;
  detail?: string;
}

export type NegotiateRenderPathResult =
  | { ok: true; path: RenderPath }
  | { ok: false; unsupported: UnsupportedRequirement[] };
