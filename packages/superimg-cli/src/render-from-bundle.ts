//! Render a pre-bundled template (from a deploy-time manifest) without any filesystem I/O.
//! Used by the container handler — templates are bundled at deploy time, rendered by name at runtime.

import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import type { EncodingOptions, RenderEngine, TemplateBundle } from "@superimg/types";
import type { ParsedTemplate } from "./cli/utils/template-config.js";
import { buildRenderJob } from "./utils/build-render-job.js";

/** A single entry from the deploy-time template manifest. */
export interface ManifestEntry {
  bundle: TemplateBundle;
  parsed: ParsedTemplate;
}

export interface RenderFromBundleOptions {
  /** Pre-initialized engine to reuse. Caller owns lifecycle. If omitted, a PlaywrightEngine is created and disposed per render. */
  engine?: RenderEngine;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  onProgress?: (frame: number, totalFrames: number) => void;
  /** First frame to render, inclusive. Default: 0. Used for distributed chunk rendering. */
  startFrame?: number;
  /** Last frame to render, exclusive. Default: totalFrames. Used for distributed chunk rendering. */
  endFrame?: number;
}

/**
 * Render a pre-bundled template to video bytes.
 * No esbuild, no path resolution, no companion data loading — all resolved at deploy time.
 */
export async function renderFromBundle(
  entry: ManifestEntry,
  options: RenderFromBundleOptions = {}
): Promise<Uint8Array> {
  const ownsEngine = !options.engine;
  const engine = options.engine ?? new PlaywrightEngine();

  try {
    if (ownsEngine) await engine.init();

    const assetBaseUrl = engine.getBaseUrl();

    const { job, resolvedAssets } = buildRenderJob({
      parsed: entry.parsed,
      templateBundle: entry.bundle,
      templateDir: "",
      assetBaseUrl,
      autoDiscovered: [],
      overrides: {
        ...(options.data !== undefined ? { data: options.data } : {}),
        ...(options.encoding !== undefined ? { encoding: options.encoding } : {}),
      },
    });

    const { renderer, encoder } = engine.createAdapters({
      ...(job.encoding !== undefined ? { encoding: job.encoding } : {}),
      ...(job.audio !== undefined ? { audio: job.audio } : {}),
    });

    const plan = await createRenderPlan(job, {
      assetBaseUrl,
      resolvedAssets,
      templateDir: "",
      ...(options.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
      ...(options.endFrame !== undefined ? { endFrame: options.endFrame } : {}),
    });

    return await executeRenderPlan(plan, renderer, encoder, {
      ...(options.onProgress
        ? { onProgress: (p) => options.onProgress!(p.frame, p.totalFrames) }
        : {}),
    });
  } finally {
    if (ownsEngine) await engine.dispose();
  }
}
