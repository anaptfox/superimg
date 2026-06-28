/**
 * Layer stack primitive for within-scene composition.
 *
 * Authors declare layers bottom-to-top; z-index follows declaration order.
 */

import { css, fill } from "./css.js";
import type { KenBurnsResult } from "./backgrounds.js";
import type { MontageResult } from "./montage.js";
import type { MotionResult } from "./director.js";
import type { InsetPadding } from "./layout.js";

/** CSS inset values — pixels or percentage strings. */
export interface LayerInsetPadding {
  x?: number | string;
  y?: number | string;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
}
import { getSafeArea, type SafeAreaPreset } from "./safe-area.js";
import type { RevealResult } from "./reveal.js";

export type LayerMode = "opaque" | "transparent" | "split";

export type CustomLayerAnchor = {
  x: number | string;
  y: number | string;
  /** When "center", applies translate(-50%, -50%) for point anchoring */
  origin?: "center" | "top-left";
};

export type LayerAnchor =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | CustomLayerAnchor;

export interface LayerStackOptions {
  width: number;
  height: number;
  overflow?: "hidden" | "visible";
  mode?: LayerMode;
  /** Split pane ratio 0–1 (first pane). Default 0.5 */
  ratio?: number;
  /** Split direction. Default "row" */
  direction?: "row" | "column";
}

export interface LayerOffset {
  x?: number;
  y?: number;
}

export interface LayerOptions {
  motion?: MotionResult;
  opacity?: number;
  visible?: boolean | (() => boolean);
  inset?: LayerInsetPadding;
  safe?: boolean | SafeAreaPreset;
  z?: number;
  /** Split mode: 0 = first pane, 1 = second pane */
  pane?: 0 | 1;
}

export type LayerKind = "bg" | "tint" | "media" | "content" | "overlay" | "fx" | "slot";

export interface LayerDescriptor {
  kind: LayerKind;
  html: string;
  options?: LayerOptions;
  name?: string;
  tintColor?: string;
}

export interface HandoffOptions {
  /** Layers below the transition (background, scrims) */
  shared?: LayerDescriptor[];
  /** Split/crossfade result — content panels only, not full shots */
  transition: RevealResult | { html: string };
  /** Layers above the transition (pinned hero, phone mockup) */
  pinned?: LayerDescriptor[];
}

export interface LayerStack {
  readonly width: number;
  readonly height: number;
  bg: (html: string | KenBurnsResult) => LayerDescriptor;
  tint: (color: string) => LayerDescriptor;
  media: (montage: MontageResult) => LayerDescriptor;
  content: (html: string, options?: LayerOptions) => LayerDescriptor;
  overlay: (
    html: string,
    options?: LayerOptions & { anchor?: LayerAnchor; offset?: LayerOffset },
  ) => LayerDescriptor;
  fx: (html: string, options?: LayerOptions) => LayerDescriptor;
  slot: (name: string, html: string, options?: LayerOptions) => LayerDescriptor;
  /** Shared bg + transition FX + pinned overlays (content-only handoff pattern) */
  handoff: (options: HandoffOptions) => string;
  render: (...layers: LayerDescriptor[]) => string;
}

function isLayerVisible(options?: LayerOptions): boolean {
  const v = options?.visible;
  if (v === undefined) return true;
  return typeof v === "function" ? v() : v;
}

function resolveSafeInset(
  width: number,
  height: number,
  safe: boolean | SafeAreaPreset | undefined,
): InsetPadding | undefined {
  if (!safe) return undefined;
  const preset: SafeAreaPreset = safe === true ? "broadcast" : safe;
  const insets = getSafeArea(width, height, preset);
  return { top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left };
}

function insetToCss(pad: LayerInsetPadding): Record<string, string | number> {
  const style: Record<string, string | number> = { position: "absolute" };
  if (pad.top !== undefined) style.top = pad.top;
  if (pad.right !== undefined) style.right = pad.right;
  if (pad.bottom !== undefined) style.bottom = pad.bottom;
  if (pad.left !== undefined) style.left = pad.left;
  if (pad.x !== undefined) {
    style.left = pad.x;
    style.right = pad.x;
  }
  if (pad.y !== undefined) {
    style.top = pad.y;
    style.bottom = pad.y;
  }
  return style;
}

function anchorToCss(
  anchor: LayerAnchor,
  offset: LayerOffset,
  safeInset?: InsetPadding,
): Record<string, string | number> {
  const ox = offset.x ?? 0;
  const oy = offset.y ?? 0;
  const bottom = (safeInset?.bottom ?? 0) + oy;
  const top = (safeInset?.top ?? 0) + oy;
  const left = (safeInset?.left ?? 0) + ox;
  const right = (safeInset?.right ?? 0) + ox;

  if (typeof anchor === "object") {
    const style: Record<string, string | number> = {
      position: "absolute",
      left: anchor.x,
      top: anchor.y,
    };
    if (anchor.origin === "center") {
      style.transform = "translate(-50%, -50%)";
    }
    return style;
  }

  const base: Record<string, string | number> = { position: "absolute" };

  switch (anchor) {
    case "bottom-left":
      return { ...base, bottom, left };
    case "bottom-center":
      return { ...base, bottom, left: "50%", transform: "translateX(-50%)" };
    case "bottom-right":
      return { ...base, bottom, right };
    case "top-left":
      return { ...base, top, left };
    case "top-center":
      return { ...base, top, left: "50%", transform: "translateX(-50%)" };
    case "top-right":
      return { ...base, top, right };
    case "center":
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    default:
      return base;
  }
}

function buildLayerWrapperStyle(
  kind: LayerKind,
  z: number,
  stack: LayerStackOptions,
  options?: LayerOptions & { anchor?: LayerAnchor; offset?: LayerOffset },
): string {
  const opacity = options?.opacity;
  const zIndex = options?.z ?? z;
  const parts: Record<string, unknown> = { zIndex };

  if (opacity !== undefined) parts.opacity = opacity;

  const safeInset = resolveSafeInset(stack.width, stack.height, options?.safe);

  if (kind === "bg" || kind === "tint" || kind === "media" || kind === "fx") {
    return css({ ...parts, position: "absolute", inset: 0, pointerEvents: "none" });
  }

  if (kind === "overlay") {
    const anchor = options?.anchor ?? "bottom-left";
    const offset = options?.offset ?? {};
    const anchorStyle = anchorToCss(anchor, offset, safeInset);
    return css({ ...parts, ...anchorStyle });
  }

  if (kind === "content" || kind === "slot") {
    if (stack.mode === "split" && options?.pane !== undefined) {
      const ratio = stack.ratio ?? 0.5;
      const isFirst = options.pane === 0;
      if (stack.direction === "column") {
        return css({
          ...parts,
          position: "absolute",
          left: 0,
          right: 0,
          top: isFirst ? 0 : `${ratio * 100}%`,
          height: isFirst ? `${ratio * 100}%` : `${(1 - ratio) * 100}%`,
          overflow: "hidden",
        });
      }
      return css({
        ...parts,
        position: "absolute",
        top: 0,
        bottom: 0,
        left: isFirst ? 0 : `${ratio * 100}%`,
        width: isFirst ? `${ratio * 100}%` : `${(1 - ratio) * 100}%`,
        overflow: "hidden",
      });
    }

    const customInset = options?.inset;
    if (customInset || safeInset) {
      const merged: LayerInsetPadding = {
        ...(customInset?.top !== undefined ? { top: customInset.top }
          : customInset?.y !== undefined ? { top: customInset.y }
          : safeInset?.top !== undefined ? { top: safeInset.top } : {}),
        ...(customInset?.right !== undefined ? { right: customInset.right }
          : customInset?.x !== undefined ? { right: customInset.x }
          : safeInset?.right !== undefined ? { right: safeInset.right } : {}),
        ...(customInset?.bottom !== undefined ? { bottom: customInset.bottom }
          : customInset?.y !== undefined ? { bottom: customInset.y }
          : safeInset?.bottom !== undefined ? { bottom: safeInset.bottom } : {}),
        ...(customInset?.left !== undefined ? { left: customInset.left }
          : customInset?.x !== undefined ? { left: customInset.x }
          : safeInset?.left !== undefined ? { left: safeInset.left } : {}),
      };
      return css({ ...parts, ...insetToCss(merged), overflow: "hidden" });
    }

    return css({ ...parts, position: "relative", width: "100%", height: "100%" });
  }

  return css({ ...parts, position: "absolute", inset: 0 });
}

function resolveBgHtml(input: string | KenBurnsResult): string {
  if (typeof input === "string") {
    return `<div style="${css(fill(), { width: "100%", height: "100%" })}">${input}</div>`;
  }
  return input.html;
}

const CENTER_TRANSFORM = /transform:translate\(-50%,\s*-50%\)/;

function mergeMotionWithAnchor(baseStyle: string, motionStyle: string): string {
  if (!motionStyle) return baseStyle;
  if (!CENTER_TRANSFORM.test(baseStyle)) {
    return [baseStyle, motionStyle].filter(Boolean).join(";");
  }
  const motionTransform = motionStyle.match(/transform:([^;]+)/)?.[1]?.trim();
  if (!motionTransform) return baseStyle;
  const merged = baseStyle.replace(
    CENTER_TRANSFORM,
    `transform:translate(-50%, -50%) ${motionTransform}`,
  );
  const rest = motionStyle.replace(/transform:[^;]+;?/, "").trim();
  return rest ? `${merged};${rest}` : merged;
}

function buildRenderOutput(stackOpts: LayerStackOptions, visible: LayerDescriptor[]): string {
  let z = 1;
  const parts: string[] = [];

  for (const layer of visible) {
    const currentZ = layer.kind === "fx" ? 1000 + z : z;
    z += 1;

    const wrapperStyle = buildLayerWrapperStyle(
      layer.kind,
      currentZ,
      stackOpts,
      layer.options as LayerOptions & { anchor?: LayerAnchor; offset?: LayerOffset },
    );

    const tintStyle = layer.kind === "tint" && layer.tintColor ? `background:${layer.tintColor}` : "";
    const motionStyle = layer.options?.motion?.style ?? "";
    const combined = mergeMotionWithAnchor(
      [wrapperStyle, tintStyle].filter(Boolean).join(";"),
      motionStyle,
    );
    parts.push(`<div style="${combined}">${layer.html}</div>`);
  }

  const rootStyle = css({
    width: stackOpts.width,
    height: stackOpts.height,
    position: "relative",
    overflow: stackOpts.overflow,
    background: stackOpts.mode === "transparent" ? "transparent" : undefined,
  });

  return `<div style="${rootStyle}">${parts.join("")}</div>`;
}

/** Create a layer stack for the scene canvas. */
export function layers(options: LayerStackOptions): LayerStack {
  const stackOpts: LayerStackOptions = {
    overflow: "hidden",
    mode: "opaque",
    ratio: 0.5,
    direction: "row",
    ...options,
  };

  const make = (
    kind: LayerKind,
    html: string,
    opts?: LayerOptions,
    extra?: { tintColor?: string; name?: string },
  ): LayerDescriptor => ({
    kind,
    html,
    ...(opts !== undefined ? { options: opts } : {}),
    ...(extra?.name !== undefined ? { name: extra.name } : {}),
    ...(extra?.tintColor !== undefined ? { tintColor: extra.tintColor } : {}),
  });

  return {
    width: stackOpts.width,
    height: stackOpts.height,

    bg(input) {
      return make("bg", resolveBgHtml(input));
    },

    tint(color) {
      return make("tint", "", undefined, { tintColor: color });
    },

    media(montage) {
      return make("media", montage.html);
    },

    content(html, opts) {
      return make("content", html, opts);
    },

    overlay(html, opts) {
      return make("overlay", html, opts);
    },

    fx(html, opts) {
      return make("fx", html, opts);
    },

    slot(name, html, opts) {
      return make("slot", html, opts, { name });
    },

    handoff(options) {
      const fxLayer = make("fx", options.transition.html);
      return this.render(...(options.shared ?? []), fxLayer, ...(options.pinned ?? []));
    },

    render(...layerList) {
      const visible = layerList.filter((l) => isLayerVisible(l.options));
      return buildRenderOutput(stackOpts, visible);
    },
  };
}