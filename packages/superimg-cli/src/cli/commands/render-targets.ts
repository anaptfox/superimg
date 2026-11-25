//! Internal execution shapes shared by destination-first export and the
//! renderer. Delivery targets and collection data do not enter this layer.

import type { EncodingOptions, Medium, TemplateBundle } from "@superimg/types";
import type { OutputFormat } from "./render-encoding.js";
import type { loadCascadingConfig } from "../utils/config-loader.js";
import type { ParsedTemplate, resolveRenderConfig } from "../utils/template-config.js";

export interface RenderOptions {
  preset?: string;
  quality?: string;
  alpha?: string;
  videoQuantizer?: string;
  videoCodec?: string;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  keyframeInterval?: string;
  bitrateMode?: string;
  latencyMode?: string;
  hardwareAccel?: string;
  audioBitrateMode?: string;
  fastStart?: string;
  clusterDuration?: string;
  maxColors?: string;
  gifLoop?: string;
  gifDither?: string;
  dpr?: string;
  capture?: string;
  captureCache?: boolean;
  stillQuality?: string;
  lossless?: boolean;
  colorProfile?: string;
  deband?: string;
  debandStrength?: string;
  stillBitDepth?: string;
  debugHtml?: boolean;
  /** HTML rasterizer. Default playwright. `blitz` is browser-free wasm. */
  rasterizer?: "playwright" | "blitz";
  distributed?: string;
  timeout?: string;
  force?: boolean;
  noCache?: boolean;
  cacheVerify?: boolean;
  json?: boolean;
}

export interface RenderTarget {
  name: string;
  width: number;
  height: number;
  fps: number;
  duration?: number;
  outputPath: string;
  debugHtmlDir: string;
  format: OutputFormat;
  encoding?: Omit<EncodingOptions, "format">;
  data?: Record<string, unknown>;
  entryLabel?: string;
  frame?: number;
  /** Authored time selection resolved only after per-entry resolve({data}). */
  at?: number | string;
}

export interface ResolvedTargets {
  resolvedTemplate: string;
  templateData: ParsedTemplate;
  resolvedConfig: ReturnType<typeof resolveRenderConfig>;
  cascadingConfig: Awaited<ReturnType<typeof loadCascadingConfig>>;
  targets: RenderTarget[];
  medium: Medium;
  animated: boolean;
  /** Projection-aware prebuilt program. Collection source must use this path. */
  templateBundle: TemplateBundle;
}
