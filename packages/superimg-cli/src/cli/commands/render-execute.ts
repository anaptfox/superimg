//! Pure render execution for the render command.
//!
//! Given pre-resolved targets, bundles the template once, initializes
//! Playwright, then renders each target sequentially and writes the MP4 to
//! disk. Throws on any failure — never calls process.exit. The CLI surface
//! catches throws at one centralized boundary.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import { createRenderPlan, executeRenderPlan } from "@superimg/core/engine";
import { PlaywrightEngine } from "@superimg/playwright";
import type { RenderProgress, TemplateBundle } from "@superimg/types";
import { discoverTemplateAssets } from "../utils/asset-discovery.js";
import { loadCompanionData } from "../utils/load-companion-data.js";
import { mergeEncoding } from "../utils/merge-encoding.js";
import { buildRenderJob } from "../../utils/build-render-job.js";
import {
  buildEncodingOptions,
  type RenderOptions,
  type RenderTarget,
  type ResolvedTargets,
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

/** Write an HTML frame next to the output, for --debug-html. */
export function writeDebugHtmlFrame(target: RenderTarget, frame: number, compositeHtml: string) {
  if (!existsSync(target.debugHtmlDir)) {
    mkdirSync(target.debugHtmlDir, { recursive: true });
  }
  const frameStr = String(frame).padStart(5, "0");
  writeFileSync(join(target.debugHtmlDir, `frame_${frameStr}.html`), compositeHtml);
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

  const companionData = await loadCompanionData(resolvedTemplate);
  const autoDiscovered = discoverTemplateAssets(templateDir);

  const engine = new PlaywrightEngine();
  try {
    await engine.init();
    const assetBaseUrl = engine.getBaseUrl();

    for (let i = 0; i < targets.length; i++) {
      if (isCancelled?.()) return;
      const target = targets[i];
      onTargetStart?.(target, i, targets.length);

      const encoding = mergeEncoding(
        templateData.templateConfig?.encoding,
        buildEncodingOptions(options),
      );
      if (encoding?.format === "gif" && templateData.templateConfig?.audio) {
        console.warn("Warning: GIF format does not support audio. Audio track will be ignored.");
      }

      // Per-target data (from --data) takes precedence over the template's
      // companion data. Companion data still applies when --data is absent.
      const targetData = target.data ?? companionData;

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
          encoding,
          data: targetData,
          outputName: target.outputName,
        },
      });
      // GIF doesn't support audio — strip even if the template declared it.
      if (encoding?.format === "gif") {
        job.audio = undefined;
      }

      const plan = createRenderPlan(job, {
        assetBaseUrl,
        resolvedAssets,
        templateDir,
      });

      const { renderer, encoder } = engine.createAdapters({ encoding: job.encoding });
      const result = await executeRenderPlan(plan, renderer, encoder, {
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

      mkdirSync(dirname(target.outputPath), { recursive: true });
      writeFileSync(target.outputPath, result);
      onTargetComplete?.(target, result);
    }
  } finally {
    await engine.dispose();
  }
}
