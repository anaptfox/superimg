//! High-level API: load template once, render multiple times

import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { bundleTemplate } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate, resolveRenderConfig } from "./cli/utils/template-config.js";
import type { Duration, EncodingOptions, TemplateModule } from "@superimg/types";
import { discoverTemplateAssets } from "./cli/utils/asset-discovery.js";
import { prepareAssets, resolveAudioUrl } from "./utils/prepare-assets.js";

export interface LoadedTemplateRenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  onProgress?: (frame: number, totalFrames: number) => void;
}

export interface LoadedTemplate {
  /** Template data (from defineScene) */
  readonly data: Record<string, unknown> | undefined;
  /** Template config (width, height, fps, duration, etc.) */
  readonly config: { width?: number; height?: number; fps?: number; duration?: Duration; fonts?: string[]; inlineCss?: string[]; stylesheets?: string[] } | undefined;
  /** Render to Uint8Array. Playwright is lazy-initialized on first call. */
  render(options?: LoadedTemplateRenderOptions): Promise<Uint8Array>;
  /** Render and write to file. */
  renderToFile(outputPath: string, options?: LoadedTemplateRenderOptions): Promise<Uint8Array>;
  /** Release Playwright resources. Call when done to free memory. */
  dispose(): Promise<void>;
}

/**
 * Load a template from file. Returns a LoadedTemplate with .data, .config,
 * .render(), .renderToFile(), and .dispose(). Playwright is initialized lazily
 * on first .render() or .renderToFile() call.
 */
export async function loadTemplate(templatePath: string): Promise<LoadedTemplate> {
  const resolvedPath = resolve(templatePath);
  const templateData = await parseTemplate(resolvedPath);
  const bundledCode = await bundleTemplate(resolvedPath);

  const compileResult = compileTemplate(bundledCode);
  if (compileResult.error || !compileResult.template) {
    throw new Error(`Template compilation failed: ${compileResult.error?.message ?? "Unknown error"}`);
  }
  const template: TemplateModule = compileResult.template;

  let engine: PlaywrightEngine | null = null;

  // Discover assets at load time (not per-render) to avoid repeated filesystem scans
  const templateDir = dirname(resolvedPath);
  const autoDiscovered = discoverTemplateAssets(templateDir);
  const configAssets = templateData.resolvedAssets;

  async function ensureEngine(): Promise<PlaywrightEngine> {
    if (!engine) {
      engine = new PlaywrightEngine();
      await engine.init();
    }
    return engine;
  }

  async function render(options: LoadedTemplateRenderOptions = {}): Promise<Uint8Array> {
    const resolvedConfig = resolveRenderConfig({
      cli: {
        width: options.width != null ? String(options.width) : undefined,
        height: options.height != null ? String(options.height) : undefined,
        fps: options.fps != null ? String(options.fps) : undefined,
        duration: options.duration != null ? String(options.duration) : undefined,
      },
      templateConfig: templateData.templateConfig,
    });

    const pw = await ensureEngine();
    const { renderer, encoder } = pw.createAdapters();
    const assetBaseUrl = pw.getBaseUrl();
    const resolvedAssets = prepareAssets({
      autoDiscovered,
      configAssets,
      assetBaseUrl,
    });
    const resolvedAudio = resolveAudioUrl(
      templateData.templateConfig?.audio,
      templateDir,
      assetBaseUrl
    );

    const job = {
      templateCode: bundledCode,
      duration: options.duration ?? resolvedConfig.duration,
      width: options.width ?? resolvedConfig.width,
      height: options.height ?? resolvedConfig.height,
      fps: options.fps ?? resolvedConfig.fps,
      fonts: templateData.templateConfig?.fonts,
      inlineCss: templateData.templateConfig?.inlineCss,
      stylesheets: templateData.templateConfig?.stylesheets,
      outputName: "default",
      encoding: options.encoding,
      data: options.data,
      tailwind: templateData.templateConfig?.tailwind,
      watermark: templateData.templateConfig?.watermark,
      background: templateData.templateConfig?.background,
      audio: resolvedAudio,
    };

    const plan = createRenderPlan(job, { assetBaseUrl, resolvedAssets, templateDir });
    return executeRenderPlan(plan, renderer, encoder, {
      onProgress: options.onProgress
        ? (p) => options.onProgress!(p.frame, p.totalFrames)
        : undefined,
    });
  }

  return {
    get data() {
      return template.data;
    },
    get config() {
      return template.config;
    },
    render,
    async renderToFile(outputPath: string, options?: LoadedTemplateRenderOptions): Promise<Uint8Array> {
      const result = await render(options);
      writeFileSync(resolve(outputPath), result);
      return result;
    },
    async dispose(): Promise<void> {
      if (engine) {
        await engine.dispose();
        engine = null;
      }
    },
  };
}
