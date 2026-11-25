//! CSS utilities - no external dependencies, browsers handle CSS natively

import { isGoogleFontDeclaration, type FontInput, type TailwindConfig } from "@superimg/types";
import { escapeHtmlAttr, isSafeStylesheetUrl, escapeCssInStyle } from "./sanitize.js";

export const CSS_RESET = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}`;
export const CSS_BASE = `html,body{background:transparent;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;font-optical-sizing:auto;text-rendering:optimizeLegibility}`;

// Tailwind v4 Play CDN
export const TAILWIND_CDN_URL = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

export interface CssConfig {
  fonts?: readonly (string | FontInput)[];
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

export function buildFontLinks(fonts: readonly (string | FontInput)[]): string {
  const specs = fonts.flatMap((font) => {
    if (typeof font === "string") return font.trim().length > 0 ? [font.trim()] : [];
    if (isGoogleFontDeclaration(font)) return font.spec.trim().length > 0 ? [font.spec.trim()] : [];
    return [];
  });
  if (specs.length === 0) return "";
  return specs
    .map((spec) => {
      const family = encodeURIComponent(spec);
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

export function buildHeadStyles(config: CssConfig, extraStyles = ""): string {
  return (
    extraStyles +
    buildTailwindScript(config.tailwind) +
    buildFontLinks(config.fonts ?? []) +
    buildStylesheetLinks(config.stylesheets ?? []) +
    buildInlineStyles(config.inlineCss ?? [])
  );
}

export { isSafeStylesheetUrl } from "./sanitize.js";
