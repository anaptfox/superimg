//! High-level API: render template to video in one call

import { dirname, resolve } from "node:path";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan, resolveFrameIndex } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate } from "./cli/utils/template-config.js";
import type { EncodingOptions, RenderEngine } from "@superimg/types";
import { mergeEncoding } from "./cli/utils/merge-encoding.js";
import { discoverTemplateAssets } from "./cli/utils/asset-discovery.js";
import { buildRenderJob } from "./utils/build-render-job.js";
import { writeFileRecursive } from "./utils/fs.js";

export interface RenderVideoOptions {
  /** Output file path (writes to disk when provided) */
  output?: string;
  /** Override width */
  width?: number;
  /** Override height */
  height?: number;
  /** Override fps */
  fps?: number;
  /** Override duration in seconds */
  duration?: number;
  /** Capture a single frame (uses still encoder with png/webp/jpeg) */
  frame?: number;
  /** Scene progress 0–1 — alternative to frame */
  progress?: number;
  /** Template data (merged with defaults) */
  data?: Record<string, unknown>;
  /** Encoding options */
  encoding?: EncodingOptions;
  /** Progress callback */
  onProgress?: (frame: number, totalFrames: number) => void;
  /** Called with the raw scene HTML and final composite HTML for each frame */
  onFrameRendered?: (frame: number, html: string, compositeHtml: string) => void;
  /** Pre-initialized engine to reuse (skips init/dispose). Caller owns lifecycle. */
  engine?: RenderEngine;
}

/**
 * Bundle, compile, and render a template to video.
 * Returns the video as Uint8Array. Optionally writes to disk when `output` is set.
 */
export async function renderVideo(
  templatePath: string,
  options: RenderVideoOptions = {}
): Promise<Uint8Array> {
  const resolvedPath = resolve(templatePath);
  const templateData = await parseTemplate(resolvedPath);
  const templateBundle = await bundleTemplateWithMap(resolvedPath);

  const ownsEngine = !options.engine;
  const engine = options.engine ?? new PlaywrightEngine();
  try {
    if (ownsEngine) await engine.init();
    const encoding = mergeEncoding(
      templateData.templateConfig?.encoding,
      options.encoding
    );
    const assetBaseUrl = engine.getBaseUrl();
    const templateDir = dirname(resolvedPath);

    const { job, resolvedAssets } = buildRenderJob({
      parsed: templateData,
      templateBundle,
      templateDir,
      assetBaseUrl,
      autoDiscovered: discoverTemplateAssets(templateDir),
      overrides: {
        ...options,
        data: options.data,
        encoding,
      },
    });

    const { renderer, encoder } = engine.createAdapters({ encoding: job.encoding, audio: job.audio });

    const planOpts: {
      assetBaseUrl?: string;
      resolvedAssets: typeof resolvedAssets;
      templateDir: string;
      startFrame?: number;
      endFrame?: number;
    } = { assetBaseUrl, resolvedAssets, templateDir };

    if (options.frame !== undefined || options.progress !== undefined) {
      const probe = createRenderPlan(job, planOpts);
      const startFrame = resolveFrameIndex({
        frame: options.frame,
        progress: options.progress,
        fps: probe.fps,
        durationSeconds: probe.durationSeconds,
      });
      planOpts.startFrame = startFrame;
      planOpts.endFrame = startFrame + 1;
    }

    const plan = createRenderPlan(job, planOpts);
    const result = await executeRenderPlan(plan, renderer, encoder, {
      onProgress: options.onProgress
        ? (p) => options.onProgress!(p.frame, p.totalFrames)
        : undefined,
      onFrameRendered: options.onFrameRendered,
    });

    if (options.output) {
      writeFileRecursive(resolve(options.output), result);
    }

    return result;
  } finally {
    if (ownsEngine) await engine.dispose();
  }
}
