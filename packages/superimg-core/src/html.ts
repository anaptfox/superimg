//! HTML utilities - build composite HTML from template output and background

import type { BackgroundValue } from "@superimg/types";
import { resolveBackground } from "./assets.js";
import { escapeHtmlAttr, escapeCssUrl } from "./sanitize.js";
import { buildHeadStyles, type CssConfig } from "./css.js";

/**
 * Build composite HTML from template output and background
 */
/** Default background when none specified - industry standard black */
const DEFAULT_BACKGROUND = "#000000";

export function buildCompositeHtml(
  templateHtml: string,
  background: BackgroundValue | undefined,
  width: number,
  height: number
): string {
  const layers: string[] = [];

  // Background layer - always render (default to black if not specified)
  const resolved = resolveBackground(background ?? DEFAULT_BACKGROUND);
  if (resolved.type === "solid") {
    const safeSrc = escapeHtmlAttr(resolved.src);
    layers.push(
      `<div style="position:absolute;inset:0;background:${safeSrc};opacity:${resolved.opacity}"></div>`
    );
  } else if (resolved.type === "image") {
    const fit = resolved.fit === "cover" ? "cover" : resolved.fit === "contain" ? "contain" : "cover";
    const safeSrc = escapeCssUrl(resolved.src);
    layers.push(
      `<div style="position:absolute;inset:0;background:url('${safeSrc}') center/${fit} no-repeat;opacity:${resolved.opacity}"></div>`
    );
  }

  // Template layer
  layers.push(
    `<div style="position:absolute;inset:0;overflow:hidden">${templateHtml}</div>`
  );

  return layers.join("\n");
}

export interface PageShellConfig extends CssConfig {}

/**
 * Build page shell HTML with font links, stylesheets, and inline CSS.
 * Injected once per render session, not per frame.
 */
export function buildPageShell(config: PageShellConfig): string {
  const headStyles = buildHeadStyles(config);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${headStyles}</head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
}
