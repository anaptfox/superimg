//! Pre-render resolve hook — data-driven duration / geometry / markers
//!
//! Runs once per job (not per frame). Order of config authority:
//!   template.config → resolve() → explicit job/CLI overrides

import type { AudioValue } from "./audio.js";
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

/**
 * Where one script block sits on the film's clock. The film owns these times;
 * the script never carries them. Times are seconds or `"1.2s"` / `"500ms"` / `"45f"`.
 */
export interface ResolveCue {
  /** Script block id (the `id=` on the block's fence line). */
  id: string;
  /** When the block starts. */
  start: number | string;
  /** When the block is gone. */
  end: number | string;
  /** The moment that best shows the block. Defaults to the middle of the cue. */
  still?: number | string;
}

/** A problem the film found with one script block, in the film's own words. */
export interface ResolveCueFinding {
  /** Script block id. */
  id: string;
  code?: string;
  message: string;
  severity?: "error" | "warning" | "info";
}

/** Subjects (cast and props) appearing in one shot of a film. */
export interface ResolveShotBreakdown {
  cast: string[];
  props: string[];
}

/** Per-shot subject breakdown keyed by shot id. */
export type ResolveBreakdown = Record<string, ResolveShotBreakdown>;

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
  /**
   * One cue per script block the film places. Each cue also becomes a marker
   * with the same id, so a player can seek to a block.
   */
  cues?: ResolveCue[];
  /** Problems with script blocks, keyed by block id. */
  cueFindings?: ResolveCueFinding[];
  /** Per-shot subject breakdown published by a film, keyed by shot id. */
  breakdown?: ResolveBreakdown;
  /** Optional audio timeline resolved from data or script timing. */
  audio?: AudioValue;
  /** Optional phase layout for a timeline / scrubber (does not replace director calls). */
  phases?: ResolvePhaseConfig;
  meta?: Record<string, unknown>;
}

export type ResolveFn<TData = JsonObject> = (
  input: ResolveInput<TData>,
) => ResolveResult | Promise<ResolveResult>;
