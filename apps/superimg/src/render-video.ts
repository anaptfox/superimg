//! High-level API: render template to video in one call

import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { bundleTemplate } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate, resolveRenderConfig } from "./cli/utils/template-config.js";
import type { EncodingOptions } from "@superimg/types";
import { mergeEncoding } from "./cli/utils/merge-encoding.js";
import { discoverTemplateAssets } from "./cli/utils/asset-discovery.js";
import { prepareAssets, resolveAudioUrl } from "./utils/prepare-assets.js";

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

  const resolvedConfig = resolveRenderConfig({
    cli: {
      width: options.width != null ? String(options.width) : undefined,
      height: options.height != null ? String(options.height) : undefined,
      fps: options.fps != null ? String(options.fps) : undefined,
      duration: options.duration != null ? String(options.duration) : undefined,
    },
    templateConfig: templateData.templateConfig,
  });

  const bundledCode = await bundleTemplate(resolvedPath);

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const { renderer, encoder } = engine.createAdapters();
    const assetBaseUrl = engine.getBaseUrl();
    const templateDir = dirname(resolvedPath);
    const resolvedAssets = prepareAssets({
      autoDiscovered: discoverTemplateAssets(templateDir),
      configAssets: templateData.resolvedAssets,
      assetBaseUrl,
    });
    const resolvedAudio = resolveAudioUrl(
      templateData.templateConfig?.audio,
      templateDir,
      assetBaseUrl
    );

    const job = {
      templateCode: bundledCode,
      duration: resolvedConfig.duration,
      width: options.width ?? resolvedConfig.width,
      height: options.height ?? resolvedConfig.height,
      fps: options.fps ?? resolvedConfig.fps,
      fonts: templateData.templateConfig?.fonts,
      inlineCss: templateData.templateConfig?.inlineCss,
      stylesheets: templateData.templateConfig?.stylesheets,
      tailwind: templateData.templateConfig?.tailwind,
      outputName: "default",
      encoding: mergeEncoding(templateData.templateConfig?.encoding, options.encoding),
      data: options.data,
      watermark: templateData.templateConfig?.watermark,
      background: templateData.templateConfig?.background,
      audio: resolvedAudio,
    };

    const plan = createRenderPlan(job, { assetBaseUrl, resolvedAssets, templateDir: dirname(resolvedPath) });
    const result = await executeRenderPlan(plan, renderer, encoder, {
      onProgress: options.onProgress
        ? (p) => options.onProgress!(p.frame, p.totalFrames)
        : undefined,
    });

    if (options.output) {
      writeFileSync(resolve(options.output), result);
    }

    return result;
  } finally {
    await engine.dispose();
  }
}
