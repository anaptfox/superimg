//! Engine orchestration - create render plans and execute them with pluggable adapters

import type {
  RenderPlan,
  RenderProgress,
  RenderJob,
  FrameRenderer,
  VideoEncoder,
  RenderContext,
  TemplateModule,
  ComposedTemplate,
  TemplateBundle,
  Rasterizer,
} from "@superimg/types";
import type { ResolvedAssetDeclaration } from "../shared/assets.js";
import { TemplateRuntimeError, RenderError } from "@superimg/types";
import { enrichError } from "../errors/enrich.js";
import { resolve, isAbsolute } from "node:path";
import { compileTemplate } from "./compiler.js";
import { createRenderContext } from "./create-render-context.js";
import { buildCompositeHtml } from "../html/html.js";
import { parseDuration } from "../shared/utils.js";
import { fonts as fontsRegistry } from "./fonts.js";
import {
  resolveAudioTimeline,
  sceneBoundariesFromResolved,
} from "../shared/assets.js";
import type { ResolvedAudioTimeline } from "@superimg/types";
import { applyTemplateResolve } from "./resolve-template.js";

function resolveAudioSrcToLocal(src: string, templateDir: string): string {
  try {
    const url = new URL(src);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      const localPath = url.searchParams.get("path");
      if (localPath) return localPath;
    }
    return src;
  } catch {
    if (src.startsWith("http") || src.startsWith("data:")) return src;
    return isAbsolute(src) ? src : resolve(templateDir, src);
  }
}

function resolveResolvedAudioPaths(
  timeline: ResolvedAudioTimeline,
  templateDir: string,
): ResolvedAudioTimeline {
  return {
    ...timeline,
    clips: timeline.clips.map((clip) => ({
      ...clip,
      src: resolveAudioSrcToLocal(clip.src, templateDir),
    })),
  };
}

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
      ...(templateName !== undefined ? { templateName } : {}),
      frame: ctx.globalFrame,
      originalError: err.message,
      timeContext: {
        timelineFrame: ctx.timeline.frame,
        timelineSeconds: ctx.timeline.seconds,
        timelineProgress: ctx.timeline.progress,
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
export async function createRenderPlan(
  job: RenderJob,
  options?: {
    assetBaseUrl?: string;
    resolvedAssets?: ResolvedAssetDeclaration[];
    templateDir?: string;
    startFrame?: number;
    endFrame?: number;
    /**
     * Explicit operator overrides (CLI flags / API). Applied after resolve.
     * Soft job defaults must NOT be passed here — only user-explicit values.
     */
    explicitOverrides?: Partial<
      Pick<import("@superimg/types").TemplateConfig, "duration" | "width" | "height" | "fps">
    >;
    signal?: AbortSignal;
  }
): Promise<RenderPlan> {
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

  // Pre-render resolve: template.config → resolve() → explicitOverrides (CLI/API).
  // Soft job defaults (width/duration filled from config) only fill gaps below —
  // they must not overwrite resolve results.
  const applied = await applyTemplateResolve(result.template, {
    ...(data !== undefined ? { data: data as Record<string, unknown> } : {}),
    ...(options?.explicitOverrides !== undefined
      ? { overrides: options.explicitOverrides }
      : {}),
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  });
  const template = applied.template;
  const resolveResult = applied.resolved;
  const planData = applied.data;

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

  // Geometry: resolve/template first, then job (CLI/build defaults).
  const planFps = template.config?.fps ?? fps;
  const planWidth = template.config?.width ?? width;
  const planHeight = template.config?.height ?? height;

  // Prefer compiled/resolved template duration (compose computes scene sums at runtime).
  const durationSeconds = parseDuration(
    template.config?.duration ?? duration,
    "duration",
    planFps,
  );
  const totalFrames = Math.ceil(durationSeconds * planFps);

  const resolvedAssets = options?.resolvedAssets ?? [];

  let finalWatermark = watermark;
  if (!finalWatermark || finalWatermark === "extracted-by-bundler") {
    finalWatermark = template.config?.watermark;
  }

  let finalBackground = background;
  if (!finalBackground || finalBackground === "extracted-by-bundler") {
    finalBackground = template.config?.background;
  }

  // medium + animated live on the module (set by define()), not in config.
  const medium = template.medium ?? "html";
  const animated = template.animated ?? (!!template.config?.fps && template.config?.duration != null);
  let fontBuffers: Uint8Array[] | undefined = undefined;
  if (medium === "svg" && fonts.length > 0) {
    const resolved = await fontsRegistry.resolve(fonts);
    fontBuffers = resolved.map((f) => f.data);
  }

  const audioValue = audio ?? template.config?.audio;
  const scenes =
    "type" in template && (template as ComposedTemplate).type === "composed"
      ? sceneBoundariesFromResolved((template as ComposedTemplate).scenes, planFps)
      : undefined;
  let resolvedAudio = resolveAudioTimeline(audioValue, {
    fps: planFps,
    videoDurationSeconds: durationSeconds,
    ...(scenes ? { scenes } : {}),
  });
  if (resolvedAudio && options?.templateDir) {
    resolvedAudio = resolveResolvedAudioPaths(resolvedAudio, options.templateDir);
  }

  return {
    template,
    bundle: templateBundle,
    durationSeconds,
    width: planWidth,
    height: planHeight,
    fps: planFps,
    totalFrames,
    medium,
    animated,
    ...(fontBuffers !== undefined ? { fontBuffers } : {}),
    fonts,
    inlineCss,
    stylesheets,
    ...(tailwind !== undefined ? { tailwind } : {}),
    ...(audioValue !== undefined ? { audio: audioValue } : {}),
    ...(resolvedAudio ? { resolvedAudio } : {}),
    outputName,
    ...(encoding !== undefined ? { encoding } : {}),
    data: planData as import("@superimg/types").JsonObject,
    ...(finalBackground !== undefined ? { background: finalBackground } : {}),
    ...(finalWatermark !== undefined ? { watermark: finalWatermark } : {}),
    ...(options?.assetBaseUrl !== undefined ? { assetBaseUrl: options.assetBaseUrl } : {}),
    ...(options?.templateDir !== undefined ? { templateDir: options.templateDir } : {}),
    resolveResult,
    ...(template.config?.readiness !== undefined
      ? { readiness: template.config.readiness }
      : {}),
    resolvedAssets,
    mode: template.config?.mode ?? 'frame',
    ...(options?.startFrame !== undefined ? { startFrame: options.startFrame } : {}),
    ...(options?.endFrame !== undefined ? { endFrame: options.endFrame } : {}),
  };
}

// Profiling support: set SUPERIMG_PROFILE=1 to print per-stage timing at end of render.
interface ProfileStats {
  renderMs: number;
  captureMs: number;
  encodeMs: number;
  frames: number;
  skippedFrames: number;
}

function printProfile(stats: ProfileStats, totalMs: number): void {
  const { renderMs, captureMs, encodeMs, frames, skippedFrames } = stats;
  const captured = frames - skippedFrames;
  const pct = (n: number) => ((n / totalMs) * 100).toFixed(1).padStart(5);
  const ms = (n: number) => n.toFixed(0).padStart(7);
  const mspf = (n: number, count: number) => (count > 0 ? n / count : 0).toFixed(1).padStart(6);
  console.error(`\n[SUPERIMG_PROFILE] ${frames} frames (${skippedFrames} deduped, ${captured} captured)  total ${totalMs.toFixed(0)}ms`);
  console.error(`  stage        total ms   % wall   ms/frame`);
  console.error(`  template   ${ms(renderMs)}   ${pct(renderMs)}%  ${mspf(renderMs, frames)}`);
  console.error(`  capture    ${ms(captureMs)}   ${pct(captureMs)}%  ${mspf(captureMs, captured)}`);
  console.error(`  encode     ${ms(encodeMs)}   ${pct(encodeMs)}%  ${mspf(encodeMs, frames)}`);
  console.error(`  (capture+encode overlap reduces wall time when pipelined)\n`);
}

// Fast djb2-style hash — good enough for frame dedup, not cryptographic.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Execute a render plan with the given renderer and encoder.
 * Frame loop: build context -> render -> capture -> encode.
 * capture and encode are pipelined: encode of frame N overlaps capture of frame N+1.
 */
export async function executeRenderPlan<TFrame>(
  plan: RenderPlan,
  renderer: FrameRenderer<TFrame> | Rasterizer<TFrame>,
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
    mode,
  } = plan;

  const frameStart = plan.startFrame ?? 0;
  const frameEnd = plan.endFrame ?? totalFrames;
  const profile = process.env.SUPERIMG_PROFILE ? { renderMs: 0, captureMs: 0, encodeMs: 0, frames: frameEnd - frameStart, skippedFrames: 0 } as ProfileStats : null;
  const t0 = profile ? performance.now() : 0;

  const assetResolver = plan.assetBaseUrl && plan.templateDir
    ? (filename: string) => {
        const abs = resolve(plan.templateDir!, 'assets', filename);
        return `${plan.assetBaseUrl}/assets?path=${encodeURIComponent(abs)}`;
      }
    : undefined;

  await renderer.init({
    width,
    height,
    fps,
    fonts,
    inlineCss,
    stylesheets,
    ...(tailwind !== undefined ? { tailwind } : {}),
    mode,
    ...(plan.fontBuffers !== undefined ? { fontBuffers: plan.fontBuffers } : {}),
    ...(plan.readiness !== undefined ? { readiness: plan.readiness } : {}),
  });

  let assetsMap: Record<string, import("@superimg/types").AssetMeta> = {};
  if (resolvedAssets.length > 0 && renderer.preloadAssets) {
    assetsMap = await renderer.preloadAssets(resolvedAssets);
  }

  await encoder.init({
    width,
    height,
    fps,
    ...(encoding !== undefined ? { encoding } : {}),
    ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
    ...(plan.resolvedAudio !== undefined ? { resolvedAudio: plan.resolvedAudio } : {}),
  });

  // Depth-1 pipeline: encode of frame N runs concurrently with capture of frame N+1.
  // At most one encode Promise is in-flight at any time, bounding memory to ~2 frame buffers.
  let pendingEncode: { frameIdx: number; promise: Promise<void> } | null = null;

  const flushPending = async () => {
    if (!pendingEncode) return;
    const { frameIdx, promise } = pendingEncode;
    pendingEncode = null;
    try {
      await promise;
    } catch (e) {
      throw new RenderError({ frame: frameIdx, encoderError: (e as Error).message });
    }
  };

  // Static frame dedup: skip captureFrame when HTML is identical to the previous frame.
  // Only active in frame mode — animation mode advances a clock so captures must always run.
  let prevHtmlHash: number | null = null;
  let prevCapturedFrame: TFrame | null = null;

  try {
    for (let frame = frameStart; frame < frameEnd; frame++) {
      const mergedData = { ...(template.sample ?? {}), ...(data ?? {}) };
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
      const t1 = profile ? performance.now() : 0;
      const html = safeRender(template, ctx, outputName, plan.bundle);

      // SVG medium: rasterize the markup string directly (no HTML shell).
      // HTML medium: wrap with background/watermark for Chromium capture.
      let compositeHtml: string;
      if (plan.medium === "svg") {
        compositeHtml = html;
      } else {
        try {
          compositeHtml = buildCompositeHtml(html, background, watermark, width, height);
        } catch (e) {
          const err = e as Error;
          throw new RenderError({ frame, htmlError: err.message });
        }
      }
      if (profile) profile.renderMs += performance.now() - t1;

      callbacks?.onFrameRendered?.(frame, html, compositeHtml);

      // In animation mode, advance fake clock one frame interval before capture
      // so CSS transitions/animations progress deterministically.
      if (mode === 'animation') {
        await renderer.advanceClock?.(Math.round(1000 / fps));
      }

      // Flush previous encode before starting the next capture (backpressure + ordering).
      await flushPending();

      // Static frame dedup: if HTML hash matches last frame and we have a cached buffer, reuse it.
      const htmlHash = mode === 'frame' ? hashString(compositeHtml) : null;
      const isDuplicate = mode === 'frame' && htmlHash === prevHtmlHash && prevCapturedFrame !== null;

      // renderer.captureFrame — Playwright/canvas/Blitz layer.
      let capturedFrame: TFrame;
      if (isDuplicate) {
        capturedFrame = prevCapturedFrame!;
        if (profile) profile.skippedFrames++;
      } else {
        const t2 = profile ? performance.now() : 0;
        try {
          const captureOpts = { alpha: encoding?.video?.alpha === "keep" };
          const captureInput = plan.medium === "svg" ? html : compositeHtml;
          capturedFrame = 'rasterize' in renderer
            ? await (renderer as Rasterizer<TFrame>).rasterize(captureInput, captureOpts)
            : await (renderer as FrameRenderer<TFrame>).captureFrame(captureInput, captureOpts);
        } catch (e) {
          const err = e as Error;
          throw new RenderError({ frame, browserError: err.message });
        }
        if (profile) profile.captureMs += performance.now() - t2;
        prevHtmlHash = htmlHash;
        prevCapturedFrame = capturedFrame;
      }

      // encoder.addFrame — fire and don't await; next iteration will flush before next capture.
      const timestamp = frame / fps;
      const t3 = profile ? performance.now() : 0;
      const encodePromise = encoder.addFrame(capturedFrame, timestamp).then(() => {
        if (profile) profile.encodeMs += performance.now() - t3;
      });
      pendingEncode = { frameIdx: frame, promise: encodePromise };

      callbacks?.onProgress?.({ frame, totalFrames, fps });
    }

    // Drain the last pending encode before finalization.
    await flushPending();

    // encoder.finalize — last write of muxed output.
    try {
      const result = await encoder.finalize();
      if (profile) printProfile(profile, performance.now() - t0);
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

/**
 * Execute a render plan across N renderers in parallel.
 * Frames are distributed round-robin across renderers; each renderer captures
 * its assigned frames sequentially (preserving its own per-renderer dedup state).
 * After all captures complete, frames are encoded in order with the depth-1 pipeline.
 */
export async function executeRenderPlanParallel<TFrame>(
  plan: RenderPlan,
  renderers: (FrameRenderer<TFrame> | Rasterizer<TFrame>)[],
  encoder: VideoEncoder<TFrame>,
  callbacks?: ExecuteRenderPlanCallbacks
): Promise<Uint8Array> {
  if (renderers.length === 0) throw new Error("executeRenderPlanParallel: renderers array is empty");
  if (renderers.length === 1) return executeRenderPlan(plan, renderers[0]!, encoder, callbacks);

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
    mode,
  } = plan;

  const N = renderers.length;
  const pFrameStart = plan.startFrame ?? 0;
  const pFrameEnd = plan.endFrame ?? totalFrames;
  const profile = process.env.SUPERIMG_PROFILE
    ? { renderMs: 0, captureMs: 0, encodeMs: 0, frames: pFrameEnd - pFrameStart, skippedFrames: 0 } as ProfileStats
    : null;
  const t0 = profile ? performance.now() : 0;

  const assetResolver = plan.assetBaseUrl && plan.templateDir
    ? (filename: string) => {
        const abs = resolve(plan.templateDir!, 'assets', filename);
        return `${plan.assetBaseUrl}/assets?path=${encodeURIComponent(abs)}`;
      }
    : undefined;

  // Initialize all renderers and the encoder in parallel.
  await Promise.all(
    renderers.map((r) =>
      r.init({
        width,
        height,
        fps,
        fonts,
        inlineCss,
        stylesheets,
        ...(tailwind !== undefined ? { tailwind } : {}),
        mode,
        ...(plan.fontBuffers !== undefined ? { fontBuffers: plan.fontBuffers } : {}),
      }),
    ),
  );

  let assetsMap: Record<string, import("@superimg/types").AssetMeta> = {};
  const primaryRenderer = renderers[0]!;
  if (resolvedAssets.length > 0 && primaryRenderer.preloadAssets) {
    assetsMap = await primaryRenderer.preloadAssets(resolvedAssets);
  }

  await encoder.init({
    width,
    height,
    fps,
    ...(encoding !== undefined ? { encoding } : {}),
    ...(plan.audio !== undefined ? { audio: plan.audio } : {}),
    ...(plan.resolvedAudio !== undefined ? { resolvedAudio: plan.resolvedAudio } : {}),
  });

  try {
    const capturedFrames = new Map<number, TFrame>();
    let captureError: unknown = null;
    let activeRenderers = renderers.length;
    let notifyReady: (() => void) | null = null;
    const notify = () => {
      const resolve = notifyReady;
      notifyReady = null;
      resolve?.();
    };
    const waitForReadyFrame = () =>
      new Promise<void>((resolve) => {
        notifyReady = resolve;
      });

    // Each renderer captures its assigned frames (round-robin) in frame order.
    const captureAll = Promise.all(
      renderers.map(async (renderer, rendererIdx) => {
        let prevHtmlHash: number | null = null;
        let prevCapturedFrame: TFrame | null = null;

        try {
          for (let frame = pFrameStart + rendererIdx; frame < pFrameEnd; frame += N) {
            const mergedData = { ...(template.sample ?? {}), ...(data ?? {}) };
            const ctx = createRenderContext(
              frame, fps, totalFrames, width, height, mergedData, outputName, assetsMap, assetResolver, template.config?.width
            );

            const t1 = profile ? performance.now() : 0;
            const html = safeRender(template, ctx, outputName, plan.bundle);
            let compositeHtml: string;
            try {
              compositeHtml = buildCompositeHtml(html, background, watermark, width, height);
            } catch (e) {
              throw new RenderError({ frame, htmlError: (e as Error).message });
            }
            if (profile) profile.renderMs += performance.now() - t1;

            callbacks?.onFrameRendered?.(frame, html, compositeHtml);

            if (mode === 'animation') {
              await renderer.advanceClock?.(Math.round(1000 / fps));
            }

            const htmlHash = mode === 'frame' ? hashString(compositeHtml) : null;
            const isDuplicate = mode === 'frame' && htmlHash === prevHtmlHash && prevCapturedFrame !== null;

            if (isDuplicate) {
              capturedFrames.set(frame, prevCapturedFrame!);
              if (profile) profile.skippedFrames++;
              notify();
            } else {
              const t2 = profile ? performance.now() : 0;
              try {
                const captureOpts = { alpha: encoding?.video?.alpha === "keep" };
                const capturedFrame = 'rasterize' in renderer
                  ? await (renderer as Rasterizer<TFrame>).rasterize(compositeHtml, captureOpts)
                  : await (renderer as FrameRenderer<TFrame>).captureFrame(compositeHtml, captureOpts);
                capturedFrames.set(frame, capturedFrame);
                prevCapturedFrame = capturedFrame;
                notify();
              } catch (e) {
                throw new RenderError({ frame, browserError: (e as Error).message });
              }
              if (profile) profile.captureMs += performance.now() - t2;
              prevHtmlHash = htmlHash;
            }
          }
        } finally {
          activeRenderers--;
          notify();
        }
      })
    );
    captureAll.catch((error) => {
      captureError = error;
      notify();
    });

    // Encode in order with depth-1 pipeline (same as single-renderer path).
    let pendingEncode: { frameIdx: number; promise: Promise<void> } | null = null;
    const flushPending = async () => {
      if (!pendingEncode) return;
      const { frameIdx, promise } = pendingEncode;
      pendingEncode = null;
      try { await promise; } catch (e) {
        throw new RenderError({ frame: frameIdx, encoderError: (e as Error).message });
      }
    };

    for (let frame = pFrameStart; frame < pFrameEnd; frame++) {
      while (!capturedFrames.has(frame)) {
        if (captureError) throw captureError;
        if (activeRenderers === 0) {
          throw new RenderError({ frame, browserError: "Parallel renderer did not produce frame" });
        }
        await waitForReadyFrame();
      }
      await flushPending();
      const capturedFrame = capturedFrames.get(frame)!;
      capturedFrames.delete(frame);
      const timestamp = frame / fps;
      const t3 = profile ? performance.now() : 0;
      const encodePromise = encoder.addFrame(capturedFrame, timestamp).then(() => {
        if (profile) profile.encodeMs += performance.now() - t3;
      });
      pendingEncode = { frameIdx: frame, promise: encodePromise };
      callbacks?.onProgress?.({ frame, totalFrames, fps });
    }
    await flushPending();
    await captureAll;

    const result = await encoder.finalize();
    if (profile) printProfile(profile, performance.now() - t0);
    return result;
  } finally {
    await Promise.all(renderers.map((r) => r.dispose()));
    await encoder.dispose();
  }
}
