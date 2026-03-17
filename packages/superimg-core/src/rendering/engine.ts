//! Engine orchestration - create render plans and execute them with pluggable adapters

import type {
  RenderPlan,
  RenderProgress,
  RenderJob,
  FrameRenderer,
  VideoEncoder,
  RenderContext,
  TemplateModule,
} from "@superimg/types";
import { resolveConfigAssets } from "../shared/assets.js";
import { TemplateRuntimeError } from "@superimg/types";
import { compileTemplate } from "./compiler.js";
import { createRenderContext } from "./wasm.js";
import { buildCompositeHtml } from "../html/html.js";
import { parseDuration } from "../shared/utils.js";

/**
 * Truncate large data objects for error messages.
 * Prevents massive objects from overwhelming error output.
 */
function truncateForError(data: unknown, maxDepth = 2): unknown {
  if (data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.length > 5
      ? [...data.slice(0, 3).map((d) => truncateForError(d, maxDepth - 1)), `... ${data.length - 3} more`]
      : data.map((d) => truncateForError(d, maxDepth - 1));
  }
  if (maxDepth <= 0) return "{...}";
  const result: Record<string, unknown> = {};
  const keys = Object.keys(data);
  for (const key of keys.slice(0, 10)) {
    result[key] = truncateForError((data as Record<string, unknown>)[key], maxDepth - 1);
  }
  if (keys.length > 10) result["..."] = `${keys.length - 10} more keys`;
  return result;
}

/**
 * Safely render a template, wrapping errors with frame/time context.
 */
function safeRender(
  template: TemplateModule,
  ctx: RenderContext,
  templateName?: string
): string {
  try {
    return template.render(ctx);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    throw new TemplateRuntimeError({
      templateName,
      frame: ctx.globalFrame,
      originalError: err.message,
      timeContext: {
        sceneFrame: ctx.sceneFrame,
        sceneTimeSeconds: ctx.sceneTimeSeconds,
        sceneProgress: ctx.sceneProgress,
        globalTimeSeconds: ctx.globalTimeSeconds,
        globalProgress: ctx.globalProgress,
      },
      dataSnapshot: truncateForError(ctx.data),
    });
  }
}

export interface ExecuteRenderPlanCallbacks {
  onProgress?: (progress: RenderProgress) => void;
  onFrameRendered?: (frame: number, html: string, compositeHtml: string) => void;
}

/**
 * Create a render plan from a render job.
 * Pure computation: compile template, collect fonts, calculate total frames.
 */
export function createRenderPlan(job: RenderJob): RenderPlan {
  const {
    templateCode,
    duration,
    width,
    height,
    fps,
    fonts: globalFonts,
    inlineCss: globalInlineCss,
    stylesheets: globalStylesheets,
    tailwind: globalTailwind,
    audio,
    outputName = "default",
    encoding,
    data,
    background,
    watermark,
  } = job;

  // Compile template
  const result = compileTemplate(templateCode);
  if (result.error || !result.template) {
    throw new Error(`Template compilation failed: ${result.error?.message || "Unknown error"}`);
  }
  const template = result.template;

  // Collect fonts
  const fontSet = new Set<string>(globalFonts ?? []);
  if (template.config?.fonts) {
    for (const f of template.config.fonts) fontSet.add(f);
  }
  const fonts = Array.from(fontSet);

  // Collect CSS (merge global + template, preserve order: global first, then template)
  const inlineCss = [...(globalInlineCss ?? []), ...(template.config?.inlineCss ?? [])];
  const stylesheets = [...(globalStylesheets ?? []), ...(template.config?.stylesheets ?? [])];

  // Merge tailwind config (template takes precedence over global)
  const templateTailwind = template.config?.tailwind;
  const tailwind = templateTailwind ?? globalTailwind;

  // Resolve Duration → number (seconds)
  const durationSeconds = parseDuration(duration, "duration", fps);
  const totalFrames = Math.ceil(durationSeconds * fps);
  const resolvedAssets = resolveConfigAssets(template.config?.assets);

  let finalWatermark = watermark;
  if (!finalWatermark || finalWatermark === "extracted-by-bundler") {
    finalWatermark = template.config?.watermark;
  }

  let finalBackground = background;
  if (!finalBackground || finalBackground === "extracted-by-bundler") {
    finalBackground = template.config?.background;
  }

  return {
    template,
    durationSeconds,
    width,
    height,
    fps,
    totalFrames,
    fonts,
    inlineCss,
    stylesheets,
    tailwind,
    audio,
    outputName,
    encoding,
    data,
    background: finalBackground,
    watermark: finalWatermark,
    resolvedAssets,
  };
}

/**
 * Execute a render plan with the given renderer and encoder.
 * Simple frame loop: build context -> render -> capture -> encode.
 */
export async function executeRenderPlan<TFrame>(
  plan: RenderPlan,
  renderer: FrameRenderer<TFrame>,
  encoder: VideoEncoder<TFrame>,
  callbacks?: ExecuteRenderPlanCallbacks
): Promise<Uint8Array> {
  const {
    template,
    width,
    height,
    fps,
    totalFrames,
    fonts,
    inlineCss,
    stylesheets,
    tailwind,
    outputName,
    encoding,
    data,
    background,
    watermark,
    resolvedAssets,
  } = plan;

  await renderer.init({ width, height, fonts, inlineCss, stylesheets, tailwind });

  let assetsMap: Record<string, import("@superimg/types").AssetMeta> = {};
  if (resolvedAssets.length > 0 && renderer.preloadAssets) {
    assetsMap = await renderer.preloadAssets(resolvedAssets);
  }
  await encoder.init({
    width,
    height,
    fps,
    encoding,
    audio: plan.audio,
  });

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      const mergedData = { ...(template.defaults ?? {}), ...(data ?? {}) };
      const ctx = createRenderContext(
        frame,
        fps,
        totalFrames,
        width,
        height,
        mergedData,
        outputName,
        assetsMap
      );

      const html = safeRender(template, ctx, outputName);
      const compositeHtml = buildCompositeHtml(html, background, watermark, width, height);

      callbacks?.onFrameRendered?.(frame, html, compositeHtml);

      const capturedFrame = await renderer.captureFrame(compositeHtml, {
        alpha: encoding?.video?.alpha === "keep",
      });

      const timestamp = frame / fps;
      await encoder.addFrame(capturedFrame, timestamp);

      callbacks?.onProgress?.({ frame, totalFrames, fps });
    }

    const result = await encoder.finalize();
    return result;
  } finally {
    await renderer.dispose();
    await encoder.dispose();
  }
}
