//! Programmatic batch render API.
//!
//! Render the same template once per data entry. Boots Playwright + bundles
//! the template **once**, reusing both across every entry — meaningful for
//! catalog-sized batches where individual `renderVideo()` calls would be
//! dominated by setup overhead.
//!
//! Composes with the template's `config.outputs` via `presets: true`, so a
//! 10-entry dataset on a template with 2 presets produces 20 MP4s in one run.

import type { EncodingOptions, RenderProgress } from "@superimg/types";
import { resolveRenderTargets, type RenderOptions, type RenderTarget } from "./cli/commands/render-targets.js";
import { executeRenderTargets } from "./cli/commands/render-execute.js";

export interface RenderBatchOptions {
  /**
   * Array of data entries. Each entry produces one render per target preset.
   * Each entry's fields are passed to the template as `data`.
   */
  dataset: Record<string, unknown>[];

  /** Render every preset declared in the template's `config.outputs`. */
  presets?: boolean;
  /** Render only this single named preset from `config.outputs`. */
  preset?: string;

  /** Output path: a directory (each render lands inside it) or omitted to use
   *  the template's default output rules (next-to-template `output/`). */
  output?: string;

  /** Width / height / fps / duration overrides applied to every entry. */
  width?: number;
  height?: number;
  fps?: number;

  /** Encoding overrides applied to every entry. */
  encoding?: EncodingOptions;

  /** Save raw HTML for each frame next to the output. */
  debugHtml?: boolean;

  /** Per-target progress callback. */
  onProgress?: (info: BatchProgressEvent) => void;
}

export interface BatchProgressEvent {
  /** 0-based index of the entry currently being rendered. */
  entryIndex: number;
  /** Total number of entries in the batch. */
  entryTotal: number;
  /** The target (preset) currently being rendered for this entry. */
  target: RenderTarget;
  /** Frame-level progress. */
  progress: RenderProgress;
}

export interface RenderBatchResultEntry {
  /** The original entry data. */
  entry: Record<string, unknown>;
  /** 0-based index in the input dataset. */
  entryIndex: number;
  /** One result per preset/target rendered for this entry. */
  outputs: Array<{
    /** Preset name (e.g. "youtube") or "default". */
    name: string;
    /** Absolute path the MP4 was written to. */
    outputPath: string;
    /** The rendered bytes. */
    result: Uint8Array;
  }>;
}

/**
 * Render the same template once per data entry, optionally across every
 * declared output preset. Files are written to disk; bytes are also returned
 * so callers don't need to re-read from disk.
 */
export async function renderBatch(
  templatePath: string,
  options: RenderBatchOptions,
): Promise<RenderBatchResultEntry[]> {
  if (!Array.isArray(options.dataset) || options.dataset.length === 0) {
    throw new Error("renderBatch: `dataset` must be a non-empty array of objects.");
  }

  // Build internal RenderOptions. The dataset round-trips through JSON so
  // resolveRenderTargets can reuse its existing --data parsing path.
  const internalOptions: RenderOptions = {
    output: options.output,
    width: options.width != null ? String(options.width) : undefined,
    height: options.height != null ? String(options.height) : undefined,
    fps: options.fps != null ? String(options.fps) : undefined,
    preset: options.preset,
    presets: options.presets,
    debugHtml: options.debugHtml,
    data: JSON.stringify(options.dataset),
  };

  const outputFormat = options.encoding?.format;
  const resolved = await resolveRenderTargets(templatePath, internalOptions, outputFormat);

  // Group results by entryIndex. We use the entryLabel (slug) and the order
  // of targets as produced by resolveRenderTargets — entries are the outer
  // loop, presets the inner, so chunks of `presetCount` targets share an
  // entry.
  const presetCount = resolved.targets.length / options.dataset.length;
  const results: RenderBatchResultEntry[] = options.dataset.map((entry, entryIndex) => ({
    entry,
    entryIndex,
    outputs: [],
  }));

  await executeRenderTargets({
    resolved,
    options: internalOptions,
    onProgress: options.onProgress
      ? (target, progress) => {
          const idx = resolved.targets.indexOf(target);
          options.onProgress!({
            entryIndex: Math.floor(idx / presetCount),
            entryTotal: options.dataset.length,
            target,
            progress,
          });
        }
      : undefined,
    onTargetComplete: (target, result) => {
      const idx = resolved.targets.indexOf(target);
      const entryIndex = Math.floor(idx / presetCount);
      results[entryIndex].outputs.push({
        name: target.name,
        outputPath: target.outputPath,
        result,
      });
    },
  });

  return results;
}
