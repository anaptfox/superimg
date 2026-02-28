//! HTML utilities - build composite HTML from template output and background

import type { BackgroundValue } from "@superimg/types";
import { resolveBackground } from "./assets.js";

/**
 * Build composite HTML from template output and background
 */
export function buildCompositeHtml(
  templateHtml: string,
  background: BackgroundValue | undefined,
  width: number,
  height: number
): string {
  const layers: string[] = [];

  // Background layer
  if (background) {
    const resolved = resolveBackground(background);
    if (resolved.type === "solid") {
      layers.push(
        `<div style="position:absolute;inset:0;background:${resolved.src};opacity:${resolved.opacity}"></div>`
      );
    } else if (resolved.type === "image") {
      const fit = resolved.fit === "cover" ? "cover" : resolved.fit === "contain" ? "contain" : "cover";
      layers.push(
        `<div style="position:absolute;inset:0;background:url('${resolved.src}') center/${fit} no-repeat;opacity:${resolved.opacity}"></div>`
      );
    }
  }

  // Template layer
  layers.push(
    `<div style="position:absolute;inset:0;overflow:hidden">${templateHtml}</div>`
  );

  return layers.join("\n");
}

export interface PageShellConfig {
  fonts?: string[];
  inlineCss?: string[];
  stylesheets?: string[];
}

/**
 * Build page shell HTML with font links, stylesheets, and inline CSS.
 * Injected once per render session, not per frame.
 */
export function buildPageShell(config: PageShellConfig | string[]): string {
  const fonts = Array.isArray(config) ? config : config.fonts ?? [];
  const inlineCss = Array.isArray(config) ? [] : config.inlineCss ?? [];
  const stylesheets = Array.isArray(config) ? [] : config.stylesheets ?? [];

  const fontLinks =
    fonts.length > 0
      ? fonts
          .map((f) => {
            const family = f.replace(/ /g, "+");
            return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${family}&display=swap">`;
          })
          .join("")
      : "";

  const stylesheetLinks =
    stylesheets.length > 0
      ? stylesheets.map((url) => `<link rel="stylesheet" href="${url}">`).join("")
      : "";

  const inlineStyleBlock =
    inlineCss.length > 0 ? `<style>${inlineCss.join("\n")}</style>` : "";

  const baseStyles =
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}</style>";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${fontLinks}${stylesheetLinks}${inlineStyleBlock}${baseStyles}</head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
}
