//! High-level API: load template once, render multiple times

import { dirname, resolve } from "node:path";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import { compileTemplate } from "@superimg/core";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { enrichError } from "@superimg/core/errors";
import { PlaywrightEngine } from "@superimg/node/internal";
import { parseTemplate } from "./cli/utils/template-config.js";
import type {
  Duration,
  EncodingOptions,
  RenderExecutionOptions,
  RenderLimits,
  TemplateModule,
} from "@superimg/types";
import {
  RenderExecutionError,
  raceWithExecution,
  throwIfExecutionCancelled,
} from "@superimg/types";
import { discoverTemplateAssets } from "./cli/utils/asset-discovery.js";
import { buildRenderJob } from "./utils/build-render-job.js";
import { writeFileAtomic } from "./utils/fs.js";

export interface LoadedTemplateRenderOptions extends RenderExecutionOptions {
  width?: number;
  height?: number;
  fps?: number;
  duration?: Duration;
  data?: Record<string, unknown>;
  encoding?: EncodingOptions;
  onProgress?: (frame: number, totalFrames: number) => void;
  limits?: RenderLimits;
}

export interface LoadedTemplate {
  /** Template data (from define) */
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
  const templateBundle = await bundleTemplateWithMap(resolvedPath);

  const compileResult = compileTemplate(templateBundle.code);
  if (compileResult.error || !compileResult.template) {
    if (compileResult.error) throw enrichError(compileResult.error, templateBundle);
    throw enrichError(new Error("Template compilation failed: unknown error"), templateBundle);
  }
  const template: TemplateModule = compileResult.template;

  let engine: PlaywrightEngine | null = null;
  let enginePromise: Promise<PlaywrightEngine> | null = null;
  let renderTail: Promise<void> = Promise.resolve();
  let disposed = false;

  // Discover assets at load time (not per-render) to avoid repeated filesystem scans
  const templateDir = dirname(resolvedPath);
  const autoDiscovered = discoverTemplateAssets(templateDir);

  async function ensureEngine(): Promise<PlaywrightEngine> {
    if (disposed) throw new RenderExecutionError("aborted", "Loaded template has been disposed");
    if (engine) return engine;
    enginePromise ??= (async () => {
      const next = new PlaywrightEngine();
      await next.init();
      if (disposed) {
        await next.dispose();
        throw new RenderExecutionError("aborted", "Loaded template has been disposed");
      }
      engine = next;
      return next;
    })();
    try {
      return await enginePromise;
    } finally {
      enginePromise = null;
    }
  }

  async function renderNow(options: LoadedTemplateRenderOptions = {}): Promise<Uint8Array> {
    throwIfExecutionCancelled(options);
    const pw = await raceWithExecution(ensureEngine(), options);
    const assetUrlResolver = (filePath: string) => pw.registerAsset(filePath);

    const { job, resolvedAssets, explicitOverrides } = buildRenderJob({
      parsed: templateData,
      templateBundle,
      templateDir,
      assetUrlResolver,
      autoDiscovered,
      overrides: options,
    });

    const { renderer, encoder } = pw.createAdapters({
      ...(job.encoding !== undefined ? { encoding: job.encoding } : {}),
      ...(job.audio !== undefined ? { audio: job.audio } : {}),
    });
    const plan = await createRenderPlan(job, {
      assetUrlResolver,
      resolvedAssets,
      templateDir,
      ...(explicitOverrides !== undefined ? { explicitOverrides } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
      ...(options.limits !== undefined ? { limits: options.limits } : {}),
    });
    return executeRenderPlan(plan, renderer, encoder, {
      ...(options.onProgress
        ? { onProgress: (p) => options.onProgress!(p.frame, p.totalFrames) }
        : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.deadlineMs !== undefined ? { deadlineMs: options.deadlineMs } : {}),
      ...(options.cleanupTimeoutMs !== undefined ? { cleanupTimeoutMs: options.cleanupTimeoutMs } : {}),
    });
  }

  // A LoadedTemplate owns one shared Playwright page, so renders are serialized.
  async function render(options: LoadedTemplateRenderOptions = {}): Promise<Uint8Array> {
    if (disposed) throw new RenderExecutionError("aborted", "Loaded template has been disposed");
    const previous = renderTail;
    let release!: () => void;
    renderTail = new Promise<void>((resolveTail) => { release = resolveTail; });
    try {
      await raceWithExecution(previous, options);
      return await renderNow(options);
    } finally {
      release();
    }
  }

  return {
    get data() {
      return template.sample;
    },
    get config() {
      return template.config;
    },
    render,
    async renderToFile(outputPath: string, options?: LoadedTemplateRenderOptions): Promise<Uint8Array> {
      const result = await render(options);
      throwIfExecutionCancelled(options);
      writeFileAtomic(resolve(outputPath), result);
      return result;
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      await renderTail;
      if (engine) {
        await engine.dispose();
        engine = null;
      }
    },
  };
}
