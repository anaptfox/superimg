//! Render a pre-bundled template (from a deploy-time manifest) without any filesystem I/O.
//! Used by the container handler — templates are bundled at deploy time, rendered by name at runtime.

import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/node/internal";
import type {
  EncodingOptions,
  RenderEngine,
  RenderExecutionOptions,
  RenderLimits,
  TemplateBundle,
} from "@superimg/types";
import { raceWithExecution, throwIfExecutionCancelled } from "@superimg/types";
import type { ParsedTemplate } from "./cli/utils/template-config.js";
import { buildRenderJob } from "./utils/build-render-job.js";

/** A single entry from the deploy-time template manifest. */
export interface ManifestEntry {
  bundle: TemplateBundle;
  parsed: ParsedTemplate;
}

export interface RenderFromBundleOptions extends RenderExecutionOptions {
  /** Pre-initialized engine to reuse. Caller owns lifecycle. If omitted, a PlaywrightEngine is created and disposed per render. */
  engine?: RenderEngine;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  onProgress?: (frame: number, totalFrames: number) => void;
  /** First frame to render, inclusive. Default: 0. Used for distributed chunk rendering. */
  startFrame?: number;
  /** Last frame to render, exclusive. Default: totalFrames. Used for distributed chunk rendering. */
  endFrame?: number;
  /** Limits applied after resolve and before renderer allocation. */
  limits?: RenderLimits;
}

/**
 * Render a pre-bundled template to video bytes.
 * No esbuild, no path resolution, no companion data loading — all resolved at deploy time.
 */
export async function renderFromBundle(
  entry: ManifestEntry,
  options: RenderFromBundleOptions = {}
): Promise<Uint8Array> {
  throwIfExecutionCancelled(options);
  const ownsEngine = !options.engine;
  const engine = options.engine ?? new PlaywrightEngine();

  try {
    if (ownsEngine) await raceWithExecution(engine.init(), options);

    const assetUrlResolver = (filePath: string) => engine.registerAsset(filePath);

    const { job, resolvedAssets, explicitOverrides } = buildRenderJob({
      parsed: entry.parsed,
      templateBundle: entry.bundle,
      templateDir: "",
      assetUrlResolver,
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
      assetUrlResolver,
      resolvedAssets,
      templateDir: "",
      ...(options.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
      ...(options.endFrame !== undefined ? { endFrame: options.endFrame } : {}),
      ...(explicitOverrides !== undefined ? { explicitOverrides } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
      ...(options.limits !== undefined ? { limits: options.limits } : {}),
    });

    return await executeRenderPlan(plan, renderer, encoder, {
      ...(options.onProgress
        ? { onProgress: (p) => options.onProgress!(p.frame, p.totalFrames) }
        : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
    });
  } finally {
    if (ownsEngine) await engine.dispose();
  }
}
