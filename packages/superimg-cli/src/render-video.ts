//! High-level API: render template to video in one call

import { dirname, resolve } from "node:path";
import { bundleTemplateWithMap } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan, resolveFrameIndex, renderTemplateFrame } from "@superimg/core/engine";
import { compileTemplate, ensureInit, rasterizeSvgSync, resolveFontBuffers } from "@superimg/core";
import { PlaywrightEngine } from "@superimg/node/internal";
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

  // SVG medium renders browser-free (resvg-wasm) — no Playwright. Same renderer
  // at build time and at the edge.
  if (templateData.medium === "svg") {
    return renderSvgVideo(resolvedPath, templateData, templateBundle, options);
  }

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

    const { job, resolvedAssets, explicitOverrides } = buildRenderJob({
      parsed: templateData,
      templateBundle,
      templateDir,
      assetBaseUrl,
      autoDiscovered: discoverTemplateAssets(templateDir),
      overrides: {
        ...(options.width !== undefined ? { width: options.width } : {}),
        ...(options.height !== undefined ? { height: options.height } : {}),
        ...(options.fps !== undefined ? { fps: options.fps } : {}),
        ...(options.duration !== undefined ? { duration: options.duration } : {}),
        ...(options.output !== undefined ? { output: options.output } : {}),
        ...(options.data !== undefined ? { data: options.data } : {}),
        ...(encoding !== undefined ? { encoding } : {}),
      },
    });

    const { renderer, encoder } = engine.createAdapters({
      ...(job.encoding !== undefined ? { encoding: job.encoding } : {}),
      ...(job.audio !== undefined ? { audio: job.audio } : {}),
    });

    const planOpts: {
      assetBaseUrl?: string;
      resolvedAssets: typeof resolvedAssets;
      templateDir: string;
      startFrame?: number;
      endFrame?: number;
      explicitOverrides?: typeof explicitOverrides;
    } = {
      assetBaseUrl,
      resolvedAssets,
      templateDir,
      ...(explicitOverrides !== undefined ? { explicitOverrides } : {}),
    };

    if (options.frame !== undefined || options.progress !== undefined) {
      const probe = await createRenderPlan(job, planOpts);
      const startFrame = resolveFrameIndex({
        fps: probe.fps,
        durationSeconds: probe.durationSeconds,
        ...(options.frame !== undefined ? { frame: options.frame } : {}),
        ...(options.progress !== undefined ? { progress: options.progress } : {}),
      });
      planOpts.startFrame = startFrame;
      planOpts.endFrame = startFrame + 1;
    }

    const plan = await createRenderPlan(job, planOpts);
    const result = await executeRenderPlan(plan, renderer, encoder, {
      ...(options.onProgress
        ? { onProgress: (p) => options.onProgress!(p.frame, p.totalFrames) }
        : {}),
      ...(options.onFrameRendered !== undefined ? { onFrameRendered: options.onFrameRendered } : {}),
    });

    if (options.output) {
      writeFileRecursive(resolve(options.output), result);
    }

    return result;
  } finally {
    if (ownsEngine) await engine.dispose();
  }
}

/** Browser-free render path for SVG-medium templates (resvg-wasm). */
async function renderSvgVideo(
  resolvedPath: string,
  templateData: Awaited<ReturnType<typeof parseTemplate>>,
  templateBundle: Awaited<ReturnType<typeof bundleTemplateWithMap>>,
  options: RenderVideoOptions,
): Promise<Uint8Array> {
  const compiled = compileTemplate(templateBundle.code);
  if (compiled.error || !compiled.template) {
    throw compiled.error ?? new Error("Template compilation failed");
  }
  const config = templateData.templateConfig;
  const width = options.width ?? config?.width ?? 1920;
  const height = options.height ?? config?.height ?? 1080;
  const format = options.encoding?.format ?? "svg";
  const templateDir = dirname(resolvedPath);
  const assetResolver = (filename: string) => resolve(templateDir, "assets", filename);

  const { html } = renderTemplateFrame({
    template: compiled.template,
    frame: options.frame ?? 0,
    width,
    height,
    assetResolver,
    composite: false,
    ...(options.data !== undefined ? { data: options.data } : {}),
  });

  let bytes: Uint8Array;
  if (format === "svg" || format === "html") {
    bytes = Buffer.from(html, "utf-8");
  } else {
    const specs = config?.fonts ?? [];
    const fontBuffers = specs.length ? await resolveFontBuffers(specs) : [];
    await ensureInit();
    const png = rasterizeSvgSync(html, { width, height, fontBuffers });
    if (format === "webp" || format === "jpeg") {
      const sharpMod = await import("sharp");
      const sharp = (sharpMod.default ?? sharpMod) as unknown as (
        input: Buffer
      ) => import("sharp").Sharp;
      const img = sharp(Buffer.from(png));
      bytes = format === "webp" ? await img.webp().toBuffer() : await img.jpeg({ quality: 95 }).toBuffer();
    } else {
      bytes = png;
    }
  }

  options.onProgress?.(0, 1);
  if (options.output) writeFileRecursive(resolve(options.output), bytes);
  return bytes;
}
