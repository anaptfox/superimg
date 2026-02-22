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

/**
 * Build page shell HTML with font links
 */
export function buildPageShell(fonts: string[]): string {
  const fontLinks =
    fonts.length > 0
      ? fonts
          .map((f) => {
            const family = f.replace(/ /g, "+");
            return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${family}&display=swap">`;
          })
          .join("")
      : "";
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${fontLinks}<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}</style></head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
}
