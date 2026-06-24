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
import { compileTemplate } from "@superimg/core";
import { renderTemplateFrame } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
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
    frame: target.frame,
    fps: target.fps,
    durationSeconds: target.duration,
    width: target.width,
    height: target.height,
    data: target.data,
    background: templateConfig?.background as Parameters<typeof renderTemplateFrame>[0]["background"],
    watermark: templateConfig?.watermark as Parameters<typeof renderTemplateFrame>[0]["watermark"],
    assetResolver,
    outputName: target.name,
    composite: target.format === "html",
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

  // Check if all targets are SVG/HTML (bypass Playwright entirely).
  const allBypass = targets.every((t) => t.format === "svg" || t.format === "html");

  if (allBypass) {
    const compiled = compileTemplate(templateBundle.code);
    if (compiled.error || !compiled.template) throw compiled.error ?? new Error("Template compilation failed");
    const template = compiled.template;

    for (let i = 0; i < targets.length; i++) {
      if (isCancelled?.()) return;
      const target = targets[i];
      onTargetStart?.(target, i, targets.length);
      renderBypassTarget(target, template, bypassAssetResolver, templateData.templateConfig, onTargetComplete);
    }
    return;
  }

  // Hoist compile for mixed paths that include svg/html targets (B5).
  let bypassTemplate: ReturnType<typeof compileTemplate>["template"] | null = null;
  const hasBypassTargets = targets.some((t) => t.format === "svg" || t.format === "html");
  if (hasBypassTargets) {
    const compiled = compileTemplate(templateBundle.code);
    if (compiled.error || !compiled.template) throw compiled.error ?? new Error("Template compilation failed");
    bypassTemplate = compiled.template;
  }

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const assetBaseUrl = engine.getBaseUrl();

    for (let i = 0; i < targets.length; i++) {
      if (isCancelled?.()) return;
      const target = targets[i];

      // SVG/HTML targets mixed in with Playwright targets — handle inline.
      if (target.format === "svg" || target.format === "html") {
        if (!bypassTemplate) throw new Error("bypass template not compiled");
        onTargetStart?.(target, i, targets.length);
        renderBypassTarget(target, bypassTemplate, bypassAssetResolver, templateData.templateConfig, onTargetComplete);
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
          duration: target.duration,
          encoding,
          data: targetData as Record<string, unknown> | undefined,
          outputName: target.outputName,
        },
      });
      // GIF doesn't support audio — strip even if the template declared it.
      if (encoding?.format === "gif") {
        job.audio = undefined;
      }

      // Distributed path: delegate chunk rendering to remote container endpoints.
      if (options.distributed) {
        const endpoints = options.distributed.split(",").map((e) => e.trim()).filter(Boolean);
        const templateName = basename(resolvedTemplate).replace(/\.video\.(ts|js|tsx|jsx)$/, "");
        mkdirSync(dirname(target.outputPath), { recursive: true });
        await renderDistributed({
          endpoints,
          templateName,
          data: targetData as Record<string, unknown> | undefined,
          encoding,
          audio: job.audio,
          outputPath: target.outputPath,
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
          ? (() => {
              const probe = createRenderPlan(job, planBase);
              const start = Math.max(0, Math.min(target.frame!, probe.totalFrames - 1));
              return createRenderPlan(job, {
                ...planBase,
                startFrame: start,
                endFrame: start + 1,
              });
            })()
          : createRenderPlan(job, planBase);

      const parallelN = Math.max(1, parseInt(process.env.SUPERIMG_PARALLEL ?? "1", 10) || 1);
      let result: Uint8Array;

      if (parallelN > 1) {
        const { encoder } = engine.createAdapters({ encoding: job.encoding, audio: job.audio });
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
        const { renderer, encoder } = engine.createAdapters({ encoding: job.encoding, audio: job.audio });
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
