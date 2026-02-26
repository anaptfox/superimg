//! High-level API: render template to video in one call

import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { bundleTemplate } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate, resolveRenderConfig } from "./cli/utils/template-config.js";
import type { EncodingOptions } from "@superimg/types";

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
  durationSeconds?: number;
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
  const templateData = parseTemplate(resolvedPath);

  const resolvedConfig = resolveRenderConfig({
    cli: {
      width: options.width != null ? String(options.width) : undefined,
      height: options.height != null ? String(options.height) : undefined,
      fps: options.fps != null ? String(options.fps) : undefined,
      durationSeconds: options.durationSeconds != null ? String(options.durationSeconds) : undefined,
    },
    templateConfig: templateData.templateConfig,
  });

  const bundledCode = await bundleTemplate(resolvedPath);

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const { renderer, encoder } = engine.createAdapters();

    const job = {
      templateCode: bundledCode,
      durationSeconds: resolvedConfig.durationSeconds,
      width: options.width ?? resolvedConfig.width,
      height: options.height ?? resolvedConfig.height,
      fps: options.fps ?? resolvedConfig.fps,
      fonts: templateData.templateConfig?.fonts,
      outputName: "default",
      encoding: options.encoding,
      data: options.data,
    };

    const plan = createRenderPlan(job);
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
