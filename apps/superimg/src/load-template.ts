//! High-level API: load template once, render multiple times

import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { bundleTemplate } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import { parseTemplate, resolveRenderConfig } from "./cli/utils/template-config.js";
import type { EncodingOptions, TemplateModule } from "@superimg/types";

export interface LoadedTemplateRenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  durationSeconds?: number;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  onProgress?: (frame: number, totalFrames: number) => void;
}

export interface LoadedTemplate {
  /** Template defaults (from defineTemplate) */
  readonly defaults: Record<string, unknown> | undefined;
  /** Template config (width, height, fps, durationSeconds, etc.) */
  readonly config: { width?: number; height?: number; fps?: number; durationSeconds?: number; fonts?: string[] } | undefined;
  /** Render to Uint8Array. Playwright is lazy-initialized on first call. */
  render(options?: LoadedTemplateRenderOptions): Promise<Uint8Array>;
  /** Render and write to file. */
  renderToFile(outputPath: string, options?: LoadedTemplateRenderOptions): Promise<Uint8Array>;
  /** Release Playwright resources. Call when done to free memory. */
  dispose(): Promise<void>;
}

/**
 * Load a template from file. Returns a LoadedTemplate with .defaults, .config,
 * .render(), .renderToFile(), and .dispose(). Playwright is initialized lazily
 * on first .render() or .renderToFile() call.
 */
export async function loadTemplate(templatePath: string): Promise<LoadedTemplate> {
  const resolvedPath = resolve(templatePath);
  const templateData = parseTemplate(resolvedPath);
  const bundledCode = await bundleTemplate(resolvedPath);

  const compileResult = compileTemplate(bundledCode);
  if (compileResult.error || !compileResult.template) {
    throw new Error(`Template compilation failed: ${compileResult.error?.message ?? "Unknown error"}`);
  }
  const template: TemplateModule = compileResult.template;

  let engine: PlaywrightEngine | null = null;

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
        durationSeconds: options.durationSeconds != null ? String(options.durationSeconds) : undefined,
      },
      templateConfig: templateData.templateConfig,
    });

    const pw = await ensureEngine();
    const { renderer, encoder } = pw.createAdapters();

    const job = {
      templateCode: bundledCode,
      durationSeconds: options.durationSeconds ?? resolvedConfig.durationSeconds,
      width: options.width ?? resolvedConfig.width,
      height: options.height ?? resolvedConfig.height,
      fps: options.fps ?? resolvedConfig.fps,
      fonts: templateData.templateConfig?.fonts,
      outputName: "default",
      encoding: options.encoding,
      data: options.data,
    };

    const plan = createRenderPlan(job);
    return executeRenderPlan(plan, renderer, encoder, {
      onProgress: options.onProgress
        ? (p) => options.onProgress!(p.frame, p.totalFrames)
        : undefined,
    });
  }

  return {
    get defaults() {
      return template.defaults;
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
