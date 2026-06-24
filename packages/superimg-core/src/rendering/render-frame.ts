//! Single-frame template render — shared by edge HTML export and still capture.

import type {
  AnyTemplateModule,
  BackgroundValue,
  RenderContext,
  WatermarkValue,
  AssetMeta,
  ComposedTemplate,
} from "@superimg/types";
import { buildCompositeHtml } from "../html/html.js";
import { createRenderContext } from "./wasm.js";
import { parseDuration } from "../shared/utils.js";
export interface RenderTemplateFrameOptions {
  template: AnyTemplateModule | ComposedTemplate;
  frame?: number;
  progress?: number;
  fps?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  outputName?: string;
  composite?: boolean;
}

export interface RenderTemplateFrameResult {
  html: string;
  compositeHtml: string;
  ctx: RenderContext;
  frame: number;
}

function isComposed(
  template: AnyTemplateModule | ComposedTemplate,
): template is ComposedTemplate {
  return (template as ComposedTemplate).type === "composed";
}

export function resolveFrameIndex(
  opts: Pick<RenderTemplateFrameOptions, "frame" | "progress" | "fps" | "durationSeconds">,
): number {
  const fps = opts.fps ?? 30;
  const durationSeconds = opts.durationSeconds ?? 5;
  const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));

  if (opts.frame !== undefined) {
    return Math.max(0, Math.min(opts.frame, totalFrames - 1));
  }
  if (opts.progress !== undefined) {
    const p = Math.max(0, Math.min(opts.progress, 1));
    if (totalFrames <= 1) return 0;
    return Math.min(totalFrames - 1, Math.round(p * (totalFrames - 1)));
  }
  return 0;
}

export function renderTemplateFrame(
  options: RenderTemplateFrameOptions,
): RenderTemplateFrameResult {
  const { template } = options;
  const config = isComposed(template) ? template.config : template.config;
  const fps = options.fps ?? config?.fps ?? 30;
  const durationSeconds =
    options.durationSeconds ??
    (typeof config?.duration === "number"
      ? config.duration
      : config?.duration
        ? undefined
        : 5);

  let resolvedDuration = durationSeconds;
  if (resolvedDuration === undefined && config?.duration) {
    resolvedDuration = parseDuration(config.duration, "duration", fps);
  }
  resolvedDuration = resolvedDuration ?? 5;

  const width = options.width ?? config?.width ?? 1920;
  const height = options.height ?? config?.height ?? 1080;
  const totalFrames = Math.max(1, Math.ceil(resolvedDuration * fps));
  const frame = resolveFrameIndex({
    frame: options.frame,
    progress: options.progress,
    fps,
    durationSeconds: resolvedDuration,
  });

  const mergedData = {
    ...(isComposed(template) ? {} : (template.sample ?? {})),
    ...(options.data ?? {}),
  };

  const outputName = options.outputName ?? "default";
  const assets = options.assets ?? {};
  const assetResolver = options.assetResolver;

  let html: string;
  let ctx: RenderContext;

  if (isComposed(template)) {
    ctx = createRenderContext(
      frame,
      fps,
      template.totalFrames,
      width,
      height,
      mergedData,
      outputName,
      assets,
      assetResolver,
      config?.width,
    );
    html = template.render(ctx);
  } else {
    ctx = createRenderContext(
      frame,
      fps,
      totalFrames,
      width,
      height,
      mergedData,
      outputName,
      assets,
      assetResolver,
      template.config?.width,
    );
    html = template.render(ctx);
  }

  const background = options.background ?? config?.background;
  const watermark = options.watermark ?? config?.watermark;
  const composite =
    options.composite !== false
      ? buildCompositeHtml(html, background, watermark, width, height)
      : html;

  return { html, compositeHtml: composite, ctx, frame };
}