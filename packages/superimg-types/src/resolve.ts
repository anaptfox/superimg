//! Pre-render resolve hook — data-driven duration / geometry / markers
//!
//! Runs once per job (not per frame). Order of config authority:
//!   template.config → resolve() → explicit job/CLI overrides

import type { JsonObject } from "./json.js";
import type { AssetMeta, Duration, TemplateConfig } from "./types.js";

/**
 * Phase layout for timeline UI / director — same shape as director PhaseConfig.
 * Values use human units: `"15%"`, `"0.6s"`, `"600ms"`.
 */
export type ResolvePhaseConfig = Record<string, string>;

/** Marker declared by resolve (seconds or duration string). */
export interface ResolveMarker {
  id: string;
  /** Absolute time: number (seconds) or `"1.2s"` / `"500ms"`. */
  at: number | string;
  label?: string;
}

export interface ResolveInput<TData = JsonObject> {
  /** Effective data for this job (sample merged with external data). */
  data: TData;
  /** Config after cascade/static merge, before resolve. */
  config: TemplateConfig;
  signal?: AbortSignal;
  /** Co-located asset URL resolver (same contract as render). */
  asset: (filename: string) => string;
  assets: Record<string, AssetMeta>;
}

/**
 * Partial overrides returned from `define({ resolve })`.
 * Applied onto config/data before any frame is rendered.
 */
export interface ResolveResult {
  duration?: Duration;
  width?: number;
  height?: number;
  fps?: number;
  /** Merged into ctx.data for all frames. */
  data?: JsonObject;
  markers?: ResolveMarker[];
  /** Optional phase layout for TimelineModel / scrubber (does not replace director calls). */
  phases?: ResolvePhaseConfig;
  meta?: Record<string, unknown>;
}

export type ResolveFn<TData = JsonObject> = (
  input: ResolveInput<TData>,
) => ResolveResult | Promise<ResolveResult>;
