//! Pure render execution for the render command.
//!
//! Given pre-resolved targets, bundles the template once, initializes
//! Playwright, then renders each target sequentially and writes the MP4 to
//! disk. Throws on any failure — never calls process.exit. The CLI surface
//! catches throws at one centralized boundary.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan, executeRenderPlanParallel } from "@superimg/core/engine";
import {
  compileTemplate,
  ensureInit,
  rasterizeSvgSync,
  resolveFontBuffers,
  ResvgRasterizer,
} from "@superimg/core";
import { renderTemplateFrame } from "@superimg/core/engine";
import { FfmpegGifEncoder, NodeVideoEncoder, PlaywrightEngine } from "@superimg/node/internal";
import type { VideoEncoder } from "@superimg/types";
import type { RenderProgress, TemplateBundle } from "@superimg/types";
import { discoverTemplateAssets } from "../utils/asset-discovery.js";
import { mergeEncoding } from "../utils/merge-encoding.js";
import { buildRenderJob } from "../../utils/build-render-job.js";
import { renderDistributed } from "../../render-distributed.js";
import { buildEncodingOptions } from "./render-encoding.js";
import type {
  RenderOptions,
  RenderTarget,
  ResolvedTargets,
} from "./render-targets.js";

export interface ExecuteRenderOptions {
  resolved: ResolvedTargets;
  options: RenderOptions;
  /** Called once per target, before rendering begins. */
  onTargetStart?: (target: RenderTarget, index: number, total: number) => void;
  /** Called on each frame's progress for the current target. */
  onProgress?: (target: RenderTarget, p: RenderProgress) => void;
  /** Called once per target, after the MP4 is written. Receives the bytes
   *  too, so programmatic callers (renderBatch, etc.) don't have to re-read
   *  from disk. */
  onTargetComplete?: (target: RenderTarget, result: Uint8Array) => void;
  /** Optional cancellation signal, polled between targets. */
  isCancelled?: () => boolean;
}

/** Validate that a string is SVG markup. Returns null if valid, warning string if not. */
function validateSvgMarkup(content: string, targetName: string): string | null {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("<svg") || trimmed.startsWith("<?xml")) return null;
  return `Warning: ${targetName} — render() did not return SVG markup (got ${JSON.stringify(trimmed.slice(0, 60))}...). Output may be invalid.`;
}

/** Write an HTML frame next to the output, for --debug-html. */
export function writeDebugHtmlFrame(target: RenderTarget, frame: number, compositeHtml: string) {
  if (!existsSync(target.debugHtmlDir)) {
    mkdirSync(target.debugHtmlDir, { recursive: true });
  }
  const frameStr = String(frame).padStart(5, "0");
  writeFileSync(join(target.debugHtmlDir, `frame_${frameStr}.html`), compositeHtml);
}

/** Still raster formats the resvg lane can produce for an SVG-medium template. */
const RESVG_STILL_FORMATS = new Set(["png", "webp", "jpeg"]);

/** Animated video formats rendered browser-free via resvg-wasm + Node encoder. */
const RESVG_VIDEO_FORMATS = new Set(["mp4", "webm", "gif"]);

/**
 * Render an SVG-medium template to a raster still via resvg-wasm — no browser.
 * Renders the SVG markup (frame 0), rasterizes to PNG with resvg, and (for
 * webp/jpeg) transcodes via sharp. Byte-identical to the edge resvg path.
 */
async function renderSvgRasterTarget(
  target: RenderTarget,
  template: Parameters<typeof renderTemplateFrame>[0]["template"],
  assetResolver: (filename: string) => string,
  fontBuffers: Uint8Array[],
  onTargetComplete?: (target: RenderTarget, result: Uint8Array) => void,
): Promise<void> {
  const { html } = renderTemplateFrame({
    template,
    frame: target.frame ?? 0,
    fps: target.fps,
    width: target.width,
    height: target.height,
    assetResolver,
    outputName: target.name,
    composite: false,
    ...(target.duration !== undefined ? { durationSeconds: target.duration } : {}),
    ...(target.data !== undefined ? { data: target.data } : {}),
  });
  const warn = validateSvgMarkup(html, target.name);
  if (warn) console.warn(warn);

  await ensureInit();
  const png = rasterizeSvgSync(html, {
    width: target.width,
    height: target.height,
    fontBuffers,
  });

  let bytes: Uint8Array = png;
  if (target.format === "webp" || target.format === "jpeg") {
    const sharpMod = await import("sharp");
    const sharp = (sharpMod.default ?? sharpMod) as unknown as (
      input: Buffer
    ) => import("sharp").Sharp;
    const img = sharp(Buffer.from(png));
    bytes =
      target.format === "webp"
        ? await img.webp().toBuffer()
        : await img.jpeg({ quality: 95 }).toBuffer();
  }

  mkdirSync(dirname(target.outputPath), { recursive: true });
  writeFileSync(target.outputPath, bytes);
  onTargetComplete?.(target, bytes);
}

/**
 * Render a single SVG/HTML bypass target: call render(), validate, write to disk,
 * then notify the caller. Shared between the all-bypass and mixed-target paths.
 */
function renderBypassTarget(
  target: RenderTarget,
  template: Parameters<typeof renderTemplateFrame>[0]["template"],
  assetResolver: (filename: string) => string,
  templateConfig?: { background?: unknown; watermark?: unknown },
  onTargetComplete?: (target: RenderTarget, result: Uint8Array) => void
): void {
  const { html, compositeHtml } = renderTemplateFrame({
    template,
    fps: target.fps,
    width: target.width,
    height: target.height,
    assetResolver,
    outputName: target.name,
    composite: target.format === "html",
    ...(templateConfig?.background !== undefined
      ? {
          background: templateConfig.background as NonNullable<
            Parameters<typeof renderTemplateFrame>[0]["background"]
          >,
        }
      : {}),
    ...(templateConfig?.watermark !== undefined
      ? {
          watermark: templateConfig.watermark as NonNullable<
            Parameters<typeof renderTemplateFrame>[0]["watermark"]
          >,
        }
      : {}),
    ...(target.frame !== undefined ? { frame: target.frame } : {}),
    ...(target.duration !== undefined ? { durationSeconds: target.duration } : {}),
    ...(target.data !== undefined ? { data: target.data } : {}),
  });
  const output = target.format === "html" ? compositeHtml : html;
  if (target.format === "svg") {
    const warn = validateSvgMarkup(output, target.name);
    if (warn) console.warn(warn);
  }
  mkdirSync(dirname(target.outputPath), { recursive: true });
  writeFileSync(target.outputPath, output, "utf-8");
  const bytes = Buffer.from(output, "utf-8");
  onTargetComplete?.(target, bytes);
}

/**
 * Execute pre-resolved render targets. Bundles the template once, initializes
 * Playwright, renders each target, writes outputs to disk.
 *
 * Throws on bundling, render, or write failure. Always disposes the Playwright
 * engine via `finally`.
 */
export async function executeRenderTargets(opts: ExecuteRenderOptions): Promise<void> {
  const { resolved, options, onTargetStart, onProgress, onTargetComplete, isCancelled } = opts;
  const { resolvedTemplate, templateData, targets } = resolved;
  const templateDir = dirname(resolvedTemplate);

  let templateBundle: TemplateBundle | undefined;
  if (templateData.templateCode) {
    templateBundle = await bundleTemplateCodeWithMap(templateData.templateCode, {
      resolveDir: templateDir,
      sourcefile: resolvedTemplate,
    });
  }
  if (!templateBundle) {
    throw new Error("Template bundle missing — parseTemplate did not produce templateCode.");
  }

  const autoDiscovered = discoverTemplateAssets(templateDir);

  // Simple file-path asset resolver for bypass (no browser server).
  const bypassAssetResolver = (filename: string) => join(templateDir, "assets", filename);

  // Classify each target into a render lane:
  //  - "verbatim":    svg/html sink — write the markup string as-is.
  //  - "resvg":       svg-medium template → raster still (png/webp/jpeg) via resvg-wasm.
  //  - "resvg-video": animated svg-medium → MP4/WebM/GIF via resvg-wasm (no Playwright).
  //  - "playwright":  everything else (Chromium screenshot → encoder).
  const isSvgTemplate = resolved.medium === "svg";
  const isAnimatedSvg = isSvgTemplate && resolved.animated;
  const laneOf = (t: RenderTarget): "verbatim" | "resvg" | "resvg-video" | "playwright" => {
    if (t.format === "svg" || t.format === "html") return "verbatim";
    if (isSvgTemplate && RESVG_STILL_FORMATS.has(t.format ?? "")) return "resvg";
    if (isAnimatedSvg && RESVG_VIDEO_FORMATS.has(t.format ?? "mp4")) return "resvg-video";
    return "playwright";
  };

  const needsPlaywright = targets.some((t) => laneOf(t) === "playwright");
  const hasBrowserFree = targets.some((t) => laneOf(t) !== "playwright");

  // Compile once if any browser-free (verbatim or resvg) target exists.
  let browserFreeTemplate: ReturnType<typeof compileTemplate>["template"] | null = null;
  if (hasBrowserFree) {
    const compiled = compileTemplate(templateBundle.code);
    if (compiled.error || !compiled.template) throw compiled.error ?? new Error("Template compilation failed");
    browserFreeTemplate = compiled.template;
  }

  // Resolve font buffers once if any resvg target needs them (resvg can't load
  // Google Fonts via <link> the way Chromium does).
  let fontBuffers: Uint8Array[] = [];
  const needsResvgFonts = targets.some((t) => {
    const lane = laneOf(t);
    return lane === "resvg" || lane === "resvg-video";
  });
  if (needsResvgFonts) {
    const specs = templateData.templateConfig?.fonts ?? [];
    fontBuffers = specs.length ? await resolveFontBuffers(specs) : [];
  }

  const renderResvgVideoTarget = async (target: RenderTarget): Promise<void> => {
    const targetFormatEncoding = target.format ? { format: target.format as string } : {};
    const templateEncoding = templateData.templateConfig?.encoding ?? {};
    const encoding = mergeEncoding(
      { ...templateEncoding, ...targetFormatEncoding } as typeof templateEncoding,
      buildEncodingOptions(options),
    );

    const { job, resolvedAssets } = buildRenderJob({
      parsed: templateData,
      templateBundle: templateBundle!,
      templateDir,
      assetBaseUrl: "",
      autoDiscovered,
      overrides: {
        width: target.width,
        height: target.height,
        fps: target.fps,
        outputName: target.outputName,
        ...(target.duration !== undefined ? { duration: target.duration } : {}),
        ...(encoding !== undefined ? { encoding } : {}),
        ...(target.data !== undefined ? { data: target.data as Record<string, unknown> } : {}),
      },
    });

    const plan = await createRenderPlan(job, {
      resolvedAssets,
      templateDir,
    });

    const rasterizer = new ResvgRasterizer();
    let encoder: VideoEncoder<Uint8Array>;
    if (encoding?.format === "gif") {
      encoder = new FfmpegGifEncoder() as VideoEncoder<Uint8Array>;
    } else {
      encoder = new NodeVideoEncoder() as VideoEncoder<Uint8Array>;
    }

    const result = await executeRenderPlan(plan, rasterizer, encoder, {
      onProgress: (p) => {
        if (isCancelled?.()) return;
        onProgress?.(target, p);
      },
      onFrameRendered: (frame, _html, compositeHtml) => {
        if (options.debugHtml) writeDebugHtmlFrame(target, frame, compositeHtml);
      },
    });

    mkdirSync(dirname(target.outputPath), { recursive: true });
    writeFileSync(target.outputPath, result);
    onTargetComplete?.(target, result);
  };

  const runBrowserFreeTarget = async (target: RenderTarget): Promise<void> => {
    if (laneOf(target) === "resvg-video") {
      await renderResvgVideoTarget(target);
      return;
    }
    if (!browserFreeTemplate) throw new Error("browser-free template not compiled");
    if (laneOf(target) === "resvg") {
      await renderSvgRasterTarget(target, browserFreeTemplate, bypassAssetResolver, fontBuffers, onTargetComplete);
    } else {
      renderBypassTarget(target, browserFreeTemplate, bypassAssetResolver, templateData.templateConfig, onTargetComplete);
    }
  };

  // No Playwright targets — render everything browser-free and return.
  if (!needsPlaywright) {
    for (let i = 0; i < targets.length; i++) {
      if (isCancelled?.()) return;
      const target = targets[i];
      if (!target) continue;
      onTargetStart?.(target, i, targets.length);
      await runBrowserFreeTarget(target);
    }
    return;
  }

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const assetBaseUrl = engine.getBaseUrl();

    for (let i = 0; i < targets.length; i++) {
      if (isCancelled?.()) return;
      const target = targets[i];
      if (!target) continue;

      // Browser-free targets (verbatim svg/html, resvg stills/video) mixed in
      // with Playwright targets — handle inline without the browser.
      if (laneOf(target) !== "playwright") {
        onTargetStart?.(target, i, targets.length);
        await runBrowserFreeTarget(target);
        continue;
      }

      onTargetStart?.(target, i, targets.length);

      // Merge target format into encoding so the right encoder is selected.
      const targetFormatEncoding = target.format ? { format: target.format as string } : {};
      const templateEncoding = templateData.templateConfig?.encoding ?? {};
      const encoding = mergeEncoding(
        { ...templateEncoding, ...targetFormatEncoding } as typeof templateEncoding,
        buildEncodingOptions(options),
      );
      if (encoding?.format === "gif" && templateData.templateConfig?.audio) {
        console.warn("Warning: GIF format does not support audio. Audio track will be ignored.");
      }

      const targetData = target.data;

      const { job, resolvedAssets } = buildRenderJob({
        parsed: templateData,
        templateBundle,
        templateDir,
        assetBaseUrl,
        autoDiscovered,
        overrides: {
          width: target.width,
          height: target.height,
          fps: target.fps,
          outputName: target.outputName,
          ...(target.duration !== undefined ? { duration: target.duration } : {}),
          ...(encoding !== undefined ? { encoding } : {}),
          ...(targetData !== undefined ? { data: targetData as Record<string, unknown> } : {}),
        },
      });
      // GIF doesn't support audio — strip even if the template declared it.
      if (encoding?.format === "gif") {
        delete job.audio;
      }

      // Distributed path: delegate chunk rendering to remote container endpoints.
      if (options.distributed) {
        const endpoints = options.distributed.split(",").map((e) => e.trim()).filter(Boolean);
        const templateName = basename(resolvedTemplate).replace(/\.video\.(ts|js|tsx|jsx)$/, "");
        mkdirSync(dirname(target.outputPath), { recursive: true });
        await renderDistributed({
          endpoints,
          templateName,
          outputPath: target.outputPath,
          ...(targetData !== undefined ? { data: targetData as Record<string, unknown> } : {}),
          ...(encoding !== undefined ? { encoding } : {}),
          ...(job.audio !== undefined ? { audio: job.audio } : {}),
          onProgress: (chunksComplete, totalChunks) => {
            onProgress?.(target, { frame: chunksComplete, totalFrames: totalChunks, fps: 0 });
          },
        });
        const bytes = readFileSync(target.outputPath);
        onTargetComplete?.(target, bytes);
        continue;
      }

      const planBase = { assetBaseUrl, resolvedAssets, templateDir };
      const plan =
        target.frame !== undefined
          ? await (async () => {
              const probe = await createRenderPlan(job, planBase);
              const start = Math.max(0, Math.min(target.frame!, probe.totalFrames - 1));
              return await createRenderPlan(job, {
                ...planBase,
                startFrame: start,
                endFrame: start + 1,
              });
            })()
          : await createRenderPlan(job, planBase);

      const parallelN = Math.max(1, parseInt(process.env.SUPERIMG_PARALLEL ?? "1", 10) || 1);
      let result: Uint8Array;

      if (parallelN > 1) {
        const { encoder } = engine.createAdapters({
          ...(job.encoding !== undefined ? { encoding: job.encoding } : {}),
          ...(job.audio !== undefined ? { audio: job.audio } : {}),
        });
        const renderers = await engine.createParallelRenderers(parallelN);
        result = await executeRenderPlanParallel(plan, renderers, encoder, {
          onProgress: (p) => {
            if (isCancelled?.()) return;
            onProgress?.(target, p);
          },
          onFrameRendered: (frame, _html, compositeHtml) => {
            if (options.debugHtml) writeDebugHtmlFrame(target, frame, compositeHtml);
          },
        });
      } else {
        const { renderer, encoder } = engine.createAdapters({
          ...(job.encoding !== undefined ? { encoding: job.encoding } : {}),
          ...(job.audio !== undefined ? { audio: job.audio } : {}),
        });
        result = await executeRenderPlan(plan, renderer, encoder, {
          onProgress: (p) => {
            if (isCancelled?.()) return;
            onProgress?.(target, p);
          },
          onFrameRendered: (frame, _html, compositeHtml) => {
            if (options.debugHtml) {
              writeDebugHtmlFrame(target, frame, compositeHtml);
            }
          },
        });
      }

      mkdirSync(dirname(target.outputPath), { recursive: true });
      writeFileSync(target.outputPath, result);
      onTargetComplete?.(target, result);
    }
  } finally {
    await engine.dispose();
  }
}
