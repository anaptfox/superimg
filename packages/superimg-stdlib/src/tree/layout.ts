import { resolveSceneTree } from "./scene.js";
//! Resolve primitive geometry onto `node.layout` before lowering.

import type { MediaChild, MediaElement, MediaLayout } from "./node-types.js";
import { measureText, wrapText, type TextMeasurer } from "../svg/measure.js";
import { getSafeBox, type SafeAreaPreset } from "../safe-area.js";
import { isMediaElement } from "./h.js";
import { VECTOR_NODE_TYPES } from "./vector.js";
import { rememberTypography, resolveTypography, type ResolvedTypography } from "./typography.js";

export const PRIMITIVE_TYPES = new Set([
  "Frame",
  "Stack",
  "Text",
  "Safe",
  "Code",
  "Spacer",
  "Fill",
  "Image",
  "Video",
  "Plate",
  "Html",
  ...VECTOR_NODE_TYPES,
]);

interface LayoutInfo { parentContent: MediaLayout; content: MediaLayout }
const layoutMetadata = new WeakMap<MediaElement, LayoutInfo>();
export function layoutInfo(node: MediaElement): LayoutInfo | undefined { return layoutMetadata.get(node); }
function rememberLayout(node: MediaElement, parentContent: MediaLayout, content: MediaLayout): MediaElement {
  layoutMetadata.set(node, { parentContent: { ...parentContent }, content: { ...content } });
  return node;
}

type Pad = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolvePad(pad: unknown): Pad {
  if (typeof pad === "number" && Number.isFinite(pad)) {
    return { top: pad, right: pad, bottom: pad, left: pad };
  }
  if (pad && typeof pad === "object") {
    const p = pad as Record<string, unknown>;
    const x = num(p.x) ?? 0;
    const y = num(p.y) ?? 0;
    return {
      top: num(p.top) ?? y,
      right: num(p.right) ?? x,
      bottom: num(p.bottom) ?? y,
      left: num(p.left) ?? x,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function inset(box: MediaLayout, pad: Pad): MediaLayout {
  return {
    x: box.x + pad.left,
    y: box.y + pad.top,
    width: Math.max(0, box.width - pad.left - pad.right),
    height: Math.max(0, box.height - pad.top - pad.bottom),
  };
}

function withLayout(
  el: MediaElement,
  layout: MediaLayout,
  children?: readonly MediaChild[],
): MediaElement {
  return {
    ...el,
    layout,
    children: children ?? el.children,
  };
}

function childText(el: MediaElement): string {
  const parts: string[] = [];
  const walk = (c: MediaChild): void => {
    if (typeof c === "string" || typeof c === "number") parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
    else if (isMediaElement(c)) c.children.forEach(walk);
  };
  el.children.forEach(walk);
  return parts.join("");
}

type IntrinsicSize = {
  width: number;
  height: number;
  /** Set for Text: how paint should wrap, decided while wrapText runs. */
  whiteSpace?: ResolvedTypography["whiteSpace"];
  lines?: string[];
  lineWidths?: number[];
  metricsExact?: boolean;
};

export interface LayoutOptions {
  width?: number;
  height?: number;
  /** Per-render measurer. Absent means the 0.55em heuristic. */
  measurer?: TextMeasurer;
}

/** Each evaluation owns its measurement memo; authored nodes may be reused safely. */
function createLayoutPass(canvasWidth: number, measurer?: TextMeasurer) {
  const wordWidths = new Map<string, number>();
  const intrinsicMemo = new WeakMap<MediaElement, Map<string, IntrinsicSize>>();

  function measureTextNode(
    el: MediaElement,
    parent: MediaLayout,
  ): MediaLayout & {
    whiteSpace: ResolvedTypography["whiteSpace"];
    lines: string[];
    lineWidths: number[];
    metricsExact: boolean;
  } {
    const { fontSize: size, fontFamily, fontWeight, letterSpacing, lineHeight } = resolveTypography(el, canvasWidth);
    const fontStyle = fontStyleOf(el);
    const explicitMax = num(el.props.maxWidth);
    const maxWidth = explicitMax ?? parent.width;
    const text = childText(el) || " ";
    const measureOpts = {
      fontSize: size,
      fontFamily,
      fontWeight,
      fontStyle,
      ...(letterSpacing !== undefined ? { letterSpacing } : {}),
      lineHeight,
      ...(measurer !== undefined ? { measurer } : {}),
      wordWidths,
    };
    const wrapped = wrapText(text, maxWidth, measureOpts);
    const measured = measureText(text, measureOpts);
    const rawW = Math.max(measured.width, ...wrapped.lines.map((line) => line.width));
    const lines = wrapped.lines.map((line) => line.text);
    const whiteSpace: ResolvedTypography["whiteSpace"] = lines.length > 1 ? "pre" : "nowrap";
    const metricsExact = measurer?.measure(text, {
      fontFamily,
      fontSize: size,
      fontWeight,
      fontStyle,
      ...(letterSpacing !== undefined ? { letterSpacing } : {}),
    }).exact ?? false;
    return {
      x: parent.x,
      y: parent.y,
      width: Math.min(maxWidth, rawW),
      height: wrapped.totalHeight || measured.height,
      whiteSpace,
      lines,
      lineWidths: wrapped.lines.map(line => line.width),
      metricsExact,
    };
  }

  function resolvedBox(el: MediaElement, parent: MediaLayout): MediaLayout {
    const intrinsic = intrinsicSize(el, parent);
    const width =
      el.props.width === "fill"
        ? parent.width
        : (num(el.props.width) ?? Math.max(0, intrinsic.width));
    const height =
      el.props.height === "fill"
        ? parent.height
        : (num(el.props.height) ?? Math.max(0, intrinsic.height));
    return {
      x: parent.x + (num(el.props.x) ?? 0),
      y: parent.y + (num(el.props.y) ?? 0),
      width,
      height,
    };
  }

  function ownBox(el: MediaElement, parent: MediaLayout): MediaLayout {
    return inset(resolvedBox(el, parent), resolvePad(el.props.pad));
  }

  function isFillWidth(el: MediaElement): boolean {
    if (el.type === "Spacer") {
      return el.props.width === "fill" || (el.props.width === undefined && el.props.height === undefined);
    }
    if (el.type === "Text") return false;
    return el.props.width === "fill";
  }

  function isFillHeight(el: MediaElement): boolean {
    if (el.type === "Spacer") {
      return el.props.height === "fill" || (el.props.width === undefined && el.props.height === undefined);
    }
    if (el.type === "Text") return false;
    return el.props.height === "fill";
  }

  function contentSize(el: MediaElement, parent: MediaLayout): { width: number; height: number } {
    const pad = resolvePad(el.props.pad);
    const kids = el.children.filter(isMediaElement);
    // Intrinsic children must see the same padded constraint they receive in
    // layout. Otherwise a hugging container can reserve one line while paint
    // wraps to two in the narrower inner box.
    const inner: MediaLayout = {
      x: parent.x + pad.left,
      y: parent.y + pad.top,
      width: Math.max(0, (num(el.props.width) ?? parent.width) - pad.left - pad.right),
      height: Math.max(0, (num(el.props.height) ?? parent.height) - pad.top - pad.bottom),
    };
    const sizes = kids.map((k) => intrinsicSize(k, inner));
    const gap = num(el.props.gap) ?? 0;
    const gapTotal = gap * Math.max(0, kids.length - 1);
    if (el.type === "Stack" && el.props.direction === "row") {
      return {
        width: sizes.reduce((sum, s) => sum + s.width, 0) + gapTotal + pad.left + pad.right,
        height: Math.max(0, ...sizes.map((s) => s.height)) + pad.top + pad.bottom,
      };
    }
    if (el.type === "Stack") {
      return {
        width: Math.max(0, ...sizes.map((s) => s.width)) + pad.left + pad.right,
        height: sizes.reduce((sum, s) => sum + s.height, 0) + gapTotal + pad.top + pad.bottom,
      };
    }
    return {
      width: Math.max(0, ...sizes.map((s) => s.width)) + pad.left + pad.right,
      height: Math.max(0, ...sizes.map((s) => s.height)) + pad.top + pad.bottom,
    };
  }

  function intrinsicSize(el: MediaElement, parent: MediaLayout): IntrinsicSize {
    let entries = intrinsicMemo.get(el);
    if (!entries) intrinsicMemo.set(el, entries = new Map());
    const key = el.type === "Text" ? String(num(el.props.maxWidth) ?? parent.width) : `${parent.width}:${parent.height}`;
    const cached = entries.get(key);
    if (cached) return cached;
    const size = measureIntrinsicSize(el, parent);
    entries.set(key, size);
    return size;
  }

  function measureIntrinsicSize(el: MediaElement, parent: MediaLayout): IntrinsicSize {
    if (el.type === "Text") {
      const m = measureTextNode(el, parent);
      return {
        width: m.width,
        height: m.height,
        whiteSpace: m.whiteSpace,
        lines: m.lines,
        lineWidths: m.lineWidths,
        metricsExact: m.metricsExact,
      };
    }
    if (el.type === "Spacer") {
      return { width: num(el.props.width) ?? 0, height: num(el.props.height) ?? 0 };
    }
    if (el.type === "Code") {
      const code = typeof el.props.code === "string" ? el.props.code : childText(el);
      const lines = Math.max(1, code.split("\n").length);
      const size = 14;
      return { width: num(el.props.width) ?? parent.width, height: lines * size * 1.45 + 24 };
    }
    const w = num(el.props.width);
    const h = num(el.props.height);
    if (w !== undefined && h !== undefined) return { width: w, height: h };
    const content = contentSize(el, parent);
    return {
      width: w ?? (isFillWidth(el) ? 0 : content.width),
      height: h ?? (isFillHeight(el) ? 0 : content.height),
    };
  }

  function layoutChildren(
    children: readonly MediaChild[],
    parent: MediaLayout,
  ): MediaChild[] {
    return children.map((child) => {
      if (!isMediaElement(child)) return child;
      return layoutElement(child, parent);
    });
  }

  function layoutFrame(el: MediaElement, parent: MediaLayout): MediaElement {
    const outer = resolvedBox(el, parent);
    const inner = inset(outer, resolvePad(el.props.pad));
    return rememberLayout(withLayout(el, outer, layoutChildren(el.children, inner)), parent, inner);
  }

  function layoutStack(el: MediaElement, parent: MediaLayout): MediaElement {
    if (el.props.x !== undefined || el.props.y !== undefined) {
      throw new Error("Stack cannot take x/y — wrap in a Frame to position or slide");
    }
    const pad = resolvePad(el.props.pad);
    const frame = resolvedBox(el, parent);
    const inner = inset(frame, pad);
    const direction = el.props.direction === "row" ? "row" : "column";
    const gap = num(el.props.gap) ?? 0;
    const nodes = el.children.filter(isMediaElement);
    const others = el.children.filter((c) => !isMediaElement(c));
    if (nodes.length === 0) {
      return rememberLayout(withLayout(el, frame, others), parent, inner);
    }

    const mainMax = direction === "row" ? inner.width : inner.height;
    const crossMax = direction === "row" ? inner.height : inner.width;
    const sizes = nodes.map((n) => intrinsicSize(n, inner));
    const fillFlags = nodes.map((n) =>
      direction === "row" ? isFillWidth(n) : isFillHeight(n),
    );
    const fixed = sizes.reduce(
      (sum, s, i) => sum + (fillFlags[i] ? 0 : direction === "row" ? s.width : s.height),
      0,
    );
    const fillCount = fillFlags.filter(Boolean).length;
    const gapTotal = gap * Math.max(0, nodes.length - 1);
    const leftover = Math.max(0, mainMax - fixed - gapTotal);
    const fillShare = fillCount > 0 ? leftover / fillCount : 0;

    const mains = nodes.map((n, i) => {
      if (fillFlags[i]) return fillShare;
      return direction === "row" ? sizes[i]!.width : sizes[i]!.height;
    });
    const used = mains.reduce((a, b) => a + b, 0) + gapTotal;
    const justify = typeof el.props.justify === "string" ? el.props.justify : "start";
    let cursor = 0;
    if (justify === "center") cursor = (mainMax - used) / 2;
    else if (justify === "end") cursor = mainMax - used;

    const align = typeof el.props.align === "string" ? el.props.align : "stretch";
    const laid: MediaElement[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const main = mains[i]!;
      const node = nodes[i]!;
      const stretchText =
        direction === "column" &&
        align === "center" &&
        node.type === "Text";
      const fillCross =
        direction === "row" ? isFillHeight(node) : isFillWidth(node);
      const crossIntrinsic = direction === "row" ? sizes[i]!.height : sizes[i]!.width;
      const cross = align === "stretch" || fillCross || stretchText ? crossMax : crossIntrinsic;
      let crossOff = 0;
      if (!fillCross && !stretchText && align === "center") crossOff = (crossMax - cross) / 2;
      else if (!fillCross && !stretchText && align === "end") crossOff = crossMax - cross;

      const childBox: MediaLayout =
        direction === "row"
          ? { x: inner.x + cursor, y: inner.y + crossOff, width: main, height: cross }
          : { x: inner.x + crossOff, y: inner.y + cursor, width: cross, height: main };

      const placed =
        stretchText && node.props.align === undefined
          ? { ...node, props: { ...node.props, align: "center" } }
          : node;
      if (placed !== node) {
        const measurements = intrinsicMemo.get(node);
        if (measurements) intrinsicMemo.set(placed, measurements);
      }
      laid.push(layoutElement(placed, childBox));
      cursor += main + gap;
      if (justify === "space-between" && fillCount === 0 && nodes.length > 1 && i < nodes.length - 1) {
        cursor += leftover / (nodes.length - 1);
      }
    }

    return rememberLayout(withLayout(el, frame, [...laid, ...others]), parent, inner);
  }

  function layoutText(el: MediaElement, parent: MediaLayout): MediaElement {
    const measured = intrinsicSize(el, parent);
    const typography = resolveTypography(el, canvasWidth);
    if (measured.whiteSpace) typography.whiteSpace = measured.whiteSpace;
    if (measured.lines) typography.lines = measured.lines;
    if (measured.lineWidths) typography.lineWidths = measured.lineWidths;
    typography.metricsExact = measured.metricsExact === true;
    const align = typeof el.props.align === "string" ? el.props.align : "left";
    const box = { width: measured.width, height: measured.height };
    if (align === "center") {
      return rememberTypography(rememberLayout(withLayout(el, {
        x: parent.x,
        y: parent.y,
        width: parent.width,
        height: measured.height,
      }), parent, parent), typography);
    }
    let x = parent.x;
    if (align === "right") x = parent.x + parent.width - box.width;
    return rememberTypography(rememberLayout(withLayout(el, { x, y: parent.y, ...box }), parent, parent), typography);
  }

  function layoutSafe(el: MediaElement, parent: MediaLayout): MediaElement {
    const preset = (typeof el.props.preset === "string" ? el.props.preset : "broadcast") as SafeAreaPreset;
    const box = getSafeBox(parent.width, parent.height, preset);
    const inner: MediaLayout = {
      x: parent.x + box.x,
      y: parent.y + box.y,
      width: box.width,
      height: box.height,
    };
    return withLayout(el, inner, layoutChildren(el.children, inner));
  }

  function layoutVectorDescendant(el: MediaElement, parent: MediaLayout): MediaElement {
    if (el.type === "Vector") return layoutVector(el, parent);
    const children = el.children.map((child) =>
      isMediaElement(child) ? layoutVectorDescendant(child, parent) : child,
    );
    return { ...el, children };
  }

  function layoutVector(el: MediaElement, parent: MediaLayout): MediaElement {
    const outer = resolvedBox(el, parent);
    const children = el.children.map((child) =>
      isMediaElement(child) ? layoutVectorDescendant(child, outer) : child,
    );
    return withLayout(el, outer, children);
  }

  function layoutGeneric(el: MediaElement, parent: MediaLayout): MediaElement {
    const box: MediaLayout = {
      x: parent.x + (num(el.props.x) ?? 0),
      y: parent.y + (num(el.props.y) ?? 0),
      width: num(el.props.width) ?? parent.width,
      height: num(el.props.height) ?? parent.height,
    };
    return withLayout(el, box, layoutChildren(el.children, box));
  }

  function layoutElement(el: MediaElement, parent: MediaLayout): MediaElement {
    switch (el.type) {
      case "Frame":
      case "Fill":
      case "Image":
      case "Video":
      case "Plate":
      case "Html":
        return layoutFrame(el, parent);
      case "Stack":
        return layoutStack(el, parent);
      case "Text":
        return layoutText(el, parent);
      case "Safe":
        return layoutSafe(el, parent);
      case "Code":
        return layoutFrame(el, parent);
      case "Vector":
        return layoutVector(el, parent);
      case "Spacer":
        return withLayout(el, {
          x: parent.x,
          y: parent.y,
          width: num(el.props.width) ?? parent.width,
          height: num(el.props.height) ?? parent.height,
        });
      default:
        return layoutGeneric(el, parent);
    }
  }

  return layoutElement;
}

function fontStyleOf(el: MediaElement): "normal" | "italic" {
  const value = el.props.fontStyle;
  return value === "italic" || value === "oblique" ? "italic" : "normal";
}

export function layoutElement(el: MediaElement, parent: MediaLayout, measurer?: TextMeasurer): MediaElement {
  return createLayoutPass(parent.width, measurer)(el, parent);
}

export function layoutTree(
  root: MediaElement,
  canvas?: LayoutOptions,
): MediaElement {
  root = resolveSceneTree(root);
  const width = num(root.props.width) ?? canvas?.width ?? root.layout?.width ?? 1920;
  const height = num(root.props.height) ?? canvas?.height ?? root.layout?.height ?? 1080;
  return createLayoutPass(width, canvas?.measurer)(root, { x: 0, y: 0, width, height });
}
