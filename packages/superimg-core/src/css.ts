//! CSS utilities - no external dependencies, browsers handle CSS natively

import { escapeHtmlAttr, isSafeStylesheetUrl, escapeCssInStyle } from "./sanitize.js";

export const CSS_RESET = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}`;
export const CSS_BASE = `html,body{background:transparent}`;

export interface CssConfig {
  fonts?: string[];
  stylesheets?: string[];
  inlineCss?: string[];
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
    buildFontLinks(config.fonts ?? []) +
    buildStylesheetLinks(config.stylesheets ?? []) +
    buildInlineStyles(config.inlineCss ?? [])
  );
}

export { isSafeStylesheetUrl } from "./sanitize.js";
