//! Engine orchestration - create render plans and execute them with pluggable adapters

import type {
  RenderPlan,
  RenderProgress,
  RenderJob,
  FrameRenderer,
  VideoEncoder,
  RenderContext,
  TemplateModule,
  TemplateBundle,
} from "@superimg/types";
import type { ResolvedAssetDeclaration } from "../shared/assets.js";
import { TemplateRuntimeError, RenderError } from "@superimg/types";
import { enrichError } from "../errors/enrich.js";
import { resolve, isAbsolute } from "node:path";
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
 * Safely render a template, wrapping errors with frame/time context plus
 * sourcemap-mapped source location and code frame when a bundle is available.
 */
function safeRender(
  template: TemplateModule,
  ctx: RenderContext,
  templateName?: string,
  bundle?: TemplateBundle
): string {
  try {
    return template.render(ctx);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const tre = new TemplateRuntimeError({
      templateName,
      frame: ctx.globalFrame,
      originalError: err.message,
      timeContext: {
        sceneFrame: ctx.sceneFrame,
        sceneTimeSeconds: ctx.sceneTimeSeconds,
        sceneProgress: ctx.sceneProgress,
        globalTimeSeconds: ctx.globalTimeSeconds,
      },
      dataSnapshot: truncateForError(ctx.data),
    });
    // Carry the original stack so enrichError can map it via sourcemap.
    if (err.stack) tre.stack = err.stack;
    throw enrichError(tre, bundle);
  }
}

export function resolveAssetUrls(
  declarations: ResolvedAssetDeclaration[],
  baseUrl: string
): ResolvedAssetDeclaration[] {
  return declarations.map((decl) => {
    if (decl.src.startsWith("http") || decl.src.startsWith("data:")) return decl;

    const absolutePath = isAbsolute(decl.src)
      ? decl.src
      : resolve(decl.sourceDir, decl.src);

    return {
      ...decl,
      src: `${baseUrl}/assets?path=${encodeURIComponent(absolutePath)}`,
    };
  });
}

export interface ExecuteRenderPlanCallbacks {
  onProgress?: (progress: RenderProgress) => void;
  onFrameRendered?: (frame: number, html: string, compositeHtml: string) => void;
}

/**
 * Create a render plan from a render job.
 * Pure computation: compile template, collect fonts, calculate total frames.
 */
export function createRenderPlan(
  job: RenderJob,
  options?: {
    assetBaseUrl?: string;
    resolvedAssets?: ResolvedAssetDeclaration[];
    templateDir?: string;
  }
): RenderPlan {
  const {
    templateBundle,
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
  const result = compileTemplate(templateBundle.code);
  if (result.error || !result.template) {
    // Re-throw the typed error if compileTemplate produced one; otherwise wrap.
    if (result.error) throw enrichError(result.error, templateBundle);
    throw enrichError(new Error("Template compilation failed: unknown error"), templateBundle);
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

  const resolvedAssets = options?.resolvedAssets ?? [];

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
    bundle: templateBundle,
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
    assetBaseUrl: options?.assetBaseUrl,
    templateDir: options?.templateDir,
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

  const assetResolver = plan.assetBaseUrl && plan.templateDir
    ? (filename: string) => {
        const abs = resolve(plan.templateDir!, 'assets', filename);
        return `${plan.assetBaseUrl}/assets?path=${encodeURIComponent(abs)}`;
      }
    : undefined;

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
      const mergedData = { ...(template.data ?? {}), ...(data ?? {}) };
      const ctx = createRenderContext(
        frame,
        fps,
        totalFrames,
        width,
        height,
        mergedData,
        outputName,
        assetsMap,
        assetResolver,
        template.config?.width
      );

      // template.render() — throws TemplateRuntimeError (mapped via sourcemap)
      const html = safeRender(template, ctx, outputName, plan.bundle);

      // buildCompositeHtml — pure HTML manipulation; failures here are
      // template-output problems (e.g., invalid HTML chunk).
      let compositeHtml: string;
      try {
        compositeHtml = buildCompositeHtml(html, background, watermark, width, height);
      } catch (e) {
        const err = e as Error;
        throw new RenderError({
          frame,
          htmlError: err.message,
        });
      }

      callbacks?.onFrameRendered?.(frame, html, compositeHtml);

      // renderer.captureFrame — Playwright/canvas/Blitz layer.
      let capturedFrame: TFrame;
      try {
        capturedFrame = await renderer.captureFrame(compositeHtml, {
          alpha: encoding?.video?.alpha === "keep",
        });
      } catch (e) {
        const err = e as Error;
        throw new RenderError({
          frame,
          browserError: err.message,
        });
      }

      // encoder.addFrame — ffmpeg/WebCodecs layer.
      const timestamp = frame / fps;
      try {
        await encoder.addFrame(capturedFrame, timestamp);
      } catch (e) {
        const err = e as Error;
        throw new RenderError({
          frame,
          encoderError: err.message,
        });
      }

      callbacks?.onProgress?.({ frame, totalFrames, fps });
    }

    // encoder.finalize — last write of muxed output. Final-frame is irrelevant
    // here, so report the last frame index we produced.
    try {
      const result = await encoder.finalize();
      return result;
    } catch (e) {
      const err = e as Error;
      throw new RenderError({
        frame: totalFrames - 1,
        encoderError: err.message,
      });
    }
  } finally {
    await renderer.dispose();
    await encoder.dispose();
  }
}
