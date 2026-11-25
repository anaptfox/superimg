//! Which trees (and delivery config) cannot be painted by `lowerSvg`.

import { isMediaElement } from "./h.js";
import type { MediaChild, MediaElement, MediaNode } from "./node-types.js";
import {
  hasPresentFilter,
  isPlainColor,
  motionHasBlur,
  resolvePaint,
} from "./svg-paint.js";

export interface BrowserReason {
  nodeId?: string;
  reason: string;
}

export interface NeedsBrowserConfig {
  tailwind?: boolean | object | null;
  stylesheets?: readonly unknown[] | null;
  inlineCss?: readonly unknown[] | null;
  /** Same string `lowerSvg` would paint as the root rect. Non-colors need the browser. */
  background?: string;
}

export interface NeedsBrowserResult {
  browser: boolean;
  reasons: BrowserReason[];
}

function nodeId(el: MediaElement): string | undefined {
  return typeof el.props.id === "string" && el.props.id.length > 0 ? el.props.id : undefined;
}

function reason(el: MediaElement, code: string): BrowserReason {
  const id = nodeId(el);
  return id ? { nodeId: id, reason: code } : { reason: code };
}

function isBlurFilter(filter: string): boolean {
  return /^blur\([^)]*\)$/i.test(filter.trim());
}

function nonBlank(values: readonly unknown[] | null | undefined): boolean {
  return !!values?.some((value) => typeof value === "string" && value.trim().length > 0);
}

function walk(el: MediaElement, reasons: BrowserReason[]): void {
  if (el.type === "foreignObject") reasons.push(reason(el, "foreignObject"));
  if (el.type === "Html" || el.type === "Video" || el.type === "Plate") {
    reasons.push(reason(el, el.type));
  }
  const className = [el.props.class, el.props.className].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  if (className.length) reasons.push(reason(el, "className"));

  const paint = resolvePaint(el);
  if (paint.rawStyle) reasons.push(reason(el, "style"));
  for (const key of paint.unsupportedStyle) reasons.push(reason(el, `style:${key}`));
  if (paint.opacityInvalid) reasons.push(reason(el, "style:opacity"));
  if (paint.gradientInvalid) reasons.push(reason(el, "gradient"));
  if (paint.borderInvalid) reasons.push(reason(el, "border"));
  if (paint.radiusInvalid) reasons.push(reason(el, "radius"));
  if (el.props.kenBurns != null && el.props.kenBurns !== false) reasons.push(reason(el, "kenBurns"));
  if (motionHasBlur(paint.motion)) reasons.push(reason(el, "blur"));
  if (paint.motion && hasPresentFilter(paint.motion.filter) && !isBlurFilter(paint.motion.filter)) {
    reasons.push(reason(el, "filter"));
  }

  for (const child of el.children) visit(child, reasons);
}

function visit(child: MediaChild, reasons: BrowserReason[]): void {
  if (Array.isArray(child)) {
    child.forEach((entry) => visit(entry, reasons));
    return;
  }
  if (isMediaElement(child)) walk(child, reasons);
}

export function needsBrowser(tree: MediaNode, config?: NeedsBrowserConfig): NeedsBrowserResult {
  const reasons: BrowserReason[] = [];
  if (config?.tailwind) reasons.push({ reason: "tailwind" });
  if (nonBlank(config?.stylesheets)) reasons.push({ reason: "stylesheets" });
  if (nonBlank(config?.inlineCss)) reasons.push({ reason: "inlineCss" });
  if (typeof config?.background === "string" && config.background.trim() && !isPlainColor(config.background)) {
    reasons.push({ reason: "background" });
  }
  walk(tree, reasons);
  return { browser: reasons.length > 0, reasons };
}
