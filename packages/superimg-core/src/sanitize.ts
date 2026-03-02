//! Sanitization utilities to prevent HTML/CSS injection

/**
 * Escape a string for safe use in an HTML attribute value (e.g. href="...").
 * Prevents breaking out of the attribute and injecting script.
 */
export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape a string for safe use inside a <style> block.
 * Prevents breaking out via </style> and injecting script.
 */
export function escapeCssInStyle(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

/**
 * Validate that a URL is safe for use as a stylesheet href.
 * Allows https:, http: (for local dev), data:, and relative paths.
 */
export function isSafeStylesheetUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("http://")) return true;
  if (trimmed.startsWith("data:")) return true;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../"))
    return true;
  return false;
}

/**
 * Escape a string for safe use inside CSS url('...').
 * Prevents breaking out of the url() and injecting arbitrary CSS/HTML.
 */
export function escapeCssUrl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\)/g, "\\)");
}
