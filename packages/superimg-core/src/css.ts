//! CSS utilities - no external dependencies, browsers handle CSS natively

import type { TailwindConfig } from "@superimg/types";
import { escapeHtmlAttr, isSafeStylesheetUrl, escapeCssInStyle } from "./sanitize.js";

export const CSS_RESET = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}`;
export const CSS_BASE = `html,body{background:transparent}`;

// Tailwind v4 Play CDN
export const TAILWIND_CDN_URL = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

export interface CssConfig {
  fonts?: string[];
  stylesheets?: string[];
  inlineCss?: string[];
  tailwind?: boolean | TailwindConfig;
}

/**
 * Build Tailwind v4 Play CDN script tag and optional custom styles.
 * @see https://tailwindcss.com/docs/installation/play-cdn
 */
export function buildTailwindScript(tailwind: boolean | TailwindConfig | undefined): string {
  if (!tailwind) return "";

  const script = `<script src="${TAILWIND_CDN_URL}"></script>`;

  if (tailwind === true) return script;

  // Has custom CSS
  const customCss = tailwind.css?.trim();
  if (!customCss) return script;

  return `${script}<style type="text/tailwindcss">${customCss}</style>`;
}

export function buildFontLinks(fonts: string[]): string {
  if (fonts.length === 0) return "";
  return fonts
    .map((f) => {
      const family = encodeURIComponent(f.trim());
      const url = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
      return `<link rel="stylesheet" href="${escapeHtmlAttr(url)}">`;
    })
    .join("");
}

export function buildStylesheetLinks(urls: string[]): string {
  return urls
    .filter(isSafeStylesheetUrl)
    .map((url) => `<link rel="stylesheet" href="${escapeHtmlAttr(url.trim())}">`)
    .join("");
}

export function buildInlineStyles(userCss: string[]): string {
  const userBlock = userCss.length > 0 ? userCss.map(escapeCssInStyle).join("\n") : "";
  const layered = `@layer reset,base,user;@layer reset{${CSS_RESET}}@layer base{${CSS_BASE}}@layer user{${userBlock}}`;
  return `<style>${layered}</style>`;
}

export function buildHeadStyles(config: CssConfig): string {
  return (
    buildTailwindScript(config.tailwind) +
    buildFontLinks(config.fonts ?? []) +
    buildStylesheetLinks(config.stylesheets ?? []) +
    buildInlineStyles(config.inlineCss ?? [])
  );
}

export { isSafeStylesheetUrl } from "./sanitize.js";
