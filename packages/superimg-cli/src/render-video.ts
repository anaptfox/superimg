//! High-level API: render template to video in one call

import { dirname, resolve } from "node:path";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate } from "./cli/utils/template-config.js";
import type { EncodingOptions } from "@superimg/types";
import { mergeEncoding } from "./cli/utils/merge-encoding.js";
import { loadCompanionData } from "./cli/utils/load-companion-data.js";
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
  /** Template data (merged with defaults) */
  data?: Record<string, unknown>;
  /** Encoding options */
  encoding?: EncodingOptions;
  /** Progress callback */
  onProgress?: (frame: number, totalFrames: number) => void;
  /** Called with the raw scene HTML and final composite HTML for each frame */
  onFrameRendered?: (frame: number, html: string, compositeHtml: string) => void;
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

  // Load companion .data.{ts,js,json} file, merge with explicit options.data
  const companionData = await loadCompanionData(resolvedPath);
  const mergedData =
    companionData || options.data
      ? { ...companionData, ...options.data }
      : undefined;

  const templateBundle = await bundleTemplateWithMap(resolvedPath);

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const encoding = mergeEncoding(
      templateData.templateConfig?.encoding,
      options.encoding
    );
    const { renderer, encoder } = engine.createAdapters({ encoding });
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
        data: mergedData,
        encoding,
      },
    });

    const plan = createRenderPlan(job, {
      assetBaseUrl,
      resolvedAssets,
      templateDir,
    });
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
    await engine.dispose();
  }
}
