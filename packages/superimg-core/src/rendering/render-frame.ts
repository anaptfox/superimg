import { resolveSceneTree } from "@superimg/stdlib/tree";
//! Single-frame template render — shared by edge HTML export and still capture.

import {
  inferTemplateAnimated,
  isMediaElement,
  type AnyTemplateModule,
  type BackgroundValue,
  type MediaElement,
  type RenderContext,
  type WatermarkValue,
  type AssetMeta,
  type RetainedComposition,
} from "@superimg/types";
import type { BrowserReason } from "@superimg/stdlib/tree";
import type { TextMeasurer } from "@superimg/stdlib/svg";
import { buildCompositeHtml } from "../html/composite.js";
import { createRenderContext } from "./create-render-context.js";
import { lowerRenderOutput } from "./lower-output.js";
import type { MetricFontSource } from "./text-measurer.js";
import { stillLaneKit } from "./still-lane-kit.js";
import { parseDuration } from "../shared/utils.js";
import { resolveFrameIndex } from "../shared/frame-clock.js";
export { resolveFrameIndex } from "../shared/frame-clock.js";
import type { PreparedStdlib } from "../shared/stdlib-capabilities.js";
export interface RenderTemplateFrameOptions {
  template: AnyTemplateModule;
  frame?: number;
  /** Time offset in seconds (alternative to `frame` / `progress`). */
  seconds?: number;
  progress?: number;
  fps?: number;
  durationSeconds?: number;
  /** Resolved integer clock; avoids reconstructing frames from binary seconds. */
  totalFrames?: number;
  width?: number;
  height?: number;
  data?: Record<string, unknown>;
  background?: BackgroundValue;
  watermark?: WatermarkValue;
  assets?: Record<string, AssetMeta>;
  assetResolver?: (filename: string) => string;
  composite?: boolean;
  /** Internal prepared capability set for an isolated browser session. */
  preparedStdlib?: PreparedStdlib;
  /** Already resolved faces for this render. Parsed once per byte hash. */
  fonts?: readonly MetricFontSource[];
  /** Measurer for this render. Wins over `fonts`. */
  measurer?: TextMeasurer;
  /** Internal passive timing seam; absent calls do not read the performance clock. */
  onTiming?: (stage: "context" | "render" | "lower" | "composite", milliseconds: number) => void;
  /** Internal browser policy seam, derived from actual emitted markup. */
  onSerializationComplete?: (escaped: boolean) => void;
}

export interface RenderTemplateFrameResult {
  html: string;
  compositeHtml: string;
  ctx: RenderContext;
  frame: number;
  tree?: MediaElement;
  /** Rasterizer for this frame. Stills that `lowerSvg` can paint are `"svg"`. */
  lane: "svg" | "html";
  /** Why a still stayed on the browser. Empty when `lane` is `"svg"` or the frame is video. */
  browserReasons: BrowserReason[];
  /** Real SVG document when `lane` is `"svg"` and this frame is a still. */
  svg?: string;
}

export interface FrameLaneDecision {
  lane: "svg" | "html";
  browserReasons: BrowserReason[];
  svg?: string;
}

/**
 * Choose the raster lane for one rendered frame.
 * Video keeps today's medium split. A still of medium html or svg whose tree
 * `needsBrowser` rejects is painted with `lowerSvg`.
 */
export function decideFrameLane(
  template: Pick<AnyTemplateModule, "animated" | "medium" | "config">,
  output: unknown,
  canvas: { width: number; height: number; measurer?: TextMeasurer },
  paint: { background?: BackgroundValue; watermark?: WatermarkValue } = {},
): FrameLaneDecision {
  const medium = template.medium === "svg" ? "svg" : "html";
  if (inferTemplateAnimated(template)) {
    return { lane: medium === "svg" ? "svg" : "html", browserReasons: [] };
  }
  if (!isMediaElement(output)) {
    return { lane: "html", browserReasons: [{ reason: "raw" }] };
  }

  const resolvedOutput = resolveSceneTree(output);
  const kit = stillLaneKit();
  if (kit === undefined) {
    return { lane: "html", browserReasons: [{ reason: "stillLaneNotInstalled" }] };
  }
  const config = template.config;
  const reasons: BrowserReason[] = [];
  let backgroundColor: string | undefined;
  if (typeof paint.background === "string") backgroundColor = paint.background;
  else if (paint.background) reasons.push({ reason: "background" });

  const verdict = kit.needsBrowser(resolvedOutput, {
    ...(config?.tailwind !== undefined ? { tailwind: config.tailwind } : {}),
    ...(config?.stylesheets !== undefined ? { stylesheets: config.stylesheets } : {}),
    ...(config?.inlineCss !== undefined ? { inlineCss: config.inlineCss } : {}),
    ...(backgroundColor !== undefined ? { background: backgroundColor } : {}),
  });
  reasons.push(...verdict.reasons);

  const watermark = watermarkSvg(paint.watermark, canvas.width, canvas.height);
  if (watermark.browser) reasons.push({ reason: watermark.reason });
  if (reasons.length > 0) return { lane: "html", browserReasons: reasons };

  const svg = kit.lowerSvg(resolvedOutput, {
    width: canvas.width,
    height: canvas.height,
    ...(canvas.measurer !== undefined ? { measurer: canvas.measurer } : {}),
    ...(backgroundColor !== undefined ? { background: backgroundColor } : {}),
  });
  return {
    lane: "svg",
    browserReasons: [],
    svg: !watermark.browser && watermark.markup ? svg.replace(/<\/svg>$/, `${watermark.markup}</svg>`) : svg,
  };
}

export function renderTemplateFrame(
  options: RenderTemplateFrameOptions,
): RenderTemplateFrameResult {
  const { template } = options;
  const config = template.config;
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
  const composition = "composition" in template ? template.composition as RetainedComposition | undefined : undefined;
  const retained = composition?.schedule;
  const totalFrames = options.totalFrames ?? retained?.totalFrames ?? Math.max(1, Math.ceil(resolvedDuration * fps));
  if (retained && (fps !== retained.fps || totalFrames !== retained.totalFrames ||
    Math.abs(resolvedDuration * fps - retained.totalFrames) > 1e-7)) {
    throw new TypeError("composition: frame rendering must use the retained clock");
  }
  const secondsFrame =
    options.frame === undefined && options.seconds !== undefined && Number.isFinite(options.seconds)
      ? Math.max(0, Math.min(totalFrames - 1, Math.round(options.seconds * fps)))
      : undefined;
  const frame = resolveFrameIndex({
    ...(options.frame !== undefined ? { frame: options.frame } : secondsFrame !== undefined ? { frame: secondsFrame } : {}),
    ...(options.progress !== undefined ? { progress: options.progress } : {}),
    fps,
    durationSeconds: resolvedDuration,
    totalFrames,
  });

  const mergedData = {
    ...(template.sample ?? {}),
    ...(options.data ?? {}),
  };

  const assets = options.assets ?? {};
  const assetResolver = options.assetResolver;

  let timingStart = options.onTiming ? performance.now() : 0;
  const ctx = createRenderContext(
    frame,
    fps,
    totalFrames,
    width,
    height,
    mergedData,
    assets,
    assetResolver,
    template.config?.width,
    undefined,
    undefined,
    options.preparedStdlib,
  );
  if (options.onTiming) {
    options.onTiming("context", performance.now() - timingStart);
    timingStart = performance.now();
  }
  const output = resolveSceneTree(template.render(ctx));
  if (options.onTiming) {
    options.onTiming("render", performance.now() - timingStart);
    timingStart = performance.now();
  }
  const measurer = options.measurer ?? (options.fonts !== undefined ? stillLaneKit()?.textMeasurerFromFaces(options.fonts) : undefined);
  const html = lowerRenderOutput(output, template.medium, {
    width,
    height,
    ...(measurer !== undefined ? { measurer } : {}),
    ...(options.onSerializationComplete ? { onSerializationComplete: options.onSerializationComplete } : {}),
  });
  if (options.onTiming) {
    options.onTiming("lower", performance.now() - timingStart);
    timingStart = performance.now();
  }
  const isSvg = template.medium === "svg";

  const background = options.background ?? config?.background;
  const watermark = options.watermark ?? config?.watermark;
  const decision = decideFrameLane(
    template,
    output,
    { width, height, ...(measurer !== undefined ? { measurer } : {}) },
    {
      ...(background !== undefined ? { background } : {}),
      ...(watermark !== undefined ? { watermark } : {}),
    },
  );
  const composite =
    options.composite !== false && !isSvg
      ? buildCompositeHtml(html, background, watermark, width, height)
      : html;

  if (options.onTiming) options.onTiming("composite", performance.now() - timingStart);

  return {
    html,
    compositeHtml: composite,
    ctx,
    frame,
    lane: decision.lane,
    browserReasons: decision.browserReasons,
    ...(decision.svg !== undefined ? { svg: decision.svg } : {}),
    ...(isMediaElement(output) ? { tree: output } : {}),
  };
}

function watermarkSvg(
  watermark: WatermarkValue | undefined,
  width: number,
  height: number,
): { browser: false; markup?: string } | { browser: true; reason: string } {
  if (watermark === undefined) return { browser: false };
  const options = typeof watermark === "string"
    ? { content: watermark, type: "image" as const, opacity: 0.8, position: "bottom-right" as const, style: undefined, className: undefined }
    : {
        ...watermark,
        opacity: watermark.opacity ?? 0.8,
        position: watermark.position ?? "bottom-right" as const,
      };
  let type = options.type;
  if (!type) {
    if (options.content.startsWith("<")) type = "html";
    else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(options.content) || options.content.startsWith("data:image")) type = "image";
    else type = "text";
  }
  if (type !== "text") return { browser: true, reason: `watermark:${type}` };
  if (options.className) return { browser: true, reason: "watermark:className" };
  const style = options.style ?? {};
  const extra = Object.keys(style).filter((key) => key !== "color");
  if (extra.length > 0) return { browser: true, reason: "watermark:style" };
  const color = style.color;
  if (color !== undefined && !plainColor(color)) return { browser: true, reason: "watermark:color" };
  const fill = color !== undefined ? color.trim() : "#111827";
  const pad = 20;
  const place = options.position ?? "bottom-right";
  const anchor = place.endsWith("left") ? "start" : place === "center" ? "middle" : "end";
  const baseline = place.startsWith("top") ? "hanging" : place === "center" ? "middle" : "auto";
  const x = place.endsWith("left") ? pad : place === "center" ? width / 2 : width - pad;
  const y = place.startsWith("top") ? pad : place === "center" ? height / 2 : height - pad;
  const markup = `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" dominant-baseline="${baseline}" fill="${escapeAttr(fill)}" opacity="${fmt(options.opacity ?? 0.8)}" font-family="Inter" font-size="16">${escapeText(options.content)}</text>`;
  return { browser: false, markup };
}

function plainColor(value: string): boolean {
  const color = value.trim();
  if (!color || /gradient\s*\(|url\s*\(/i.test(color)) return false;
  if (/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return true;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[\d.%,\s/]+\)$/i.test(color)) return true;
  return /^(?:transparent|black|white|currentcolor|red|blue|green|gray|grey|silver|navy|teal|olive|maroon|purple|fuchsia|aqua|lime|yellow|orange)$/i.test(color);
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;");
}
