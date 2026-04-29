/**
 * Shared helpers for HTTP-themed templates (http-trace, http-spotlight).
 * Method/status colors, JSON pretty-printing, and code-streaming primitives
 * live here so both templates stay visually consistent.
 */

import { highlight, type ThemeName, type LangName } from "superimg/stdlib/code";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface TypeResult {
  visible: string;
  typing: boolean;
  done: boolean;
  cursorVisible: boolean;
}
interface TypeOptions {
  by?: "char" | "word" | "line";
  variance?: number;
  time?: number;
  cursorRate?: number;
}
/** Minimal subset of ctx.std that streamCode needs (text.type). */
export interface StreamingStd {
  text: { type: (text: string, progress: number, options?: TypeOptions) => TypeResult };
}

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  DELETE: "#ef4444",
  PATCH: "#a855f7",
};

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "#22c55e";
  if (status >= 300 && status < 400) return "#3b82f6";
  if (status >= 400 && status < 500) return "#f59e0b";
  return "#ef4444";
}

/** Pretty-print a JSON string. Returns input unchanged if not valid JSON. */
export function prettyJson(str: string): string {
  if (!str) return str;
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

/** Parse a JSON-encoded headers map. Returns {} on failure. */
export function parseHeaders(headersStr: string): Record<string, string> {
  if (!headersStr) return {};
  try {
    return JSON.parse(headersStr);
  } catch {
    return {};
  }
}

/**
 * Wipe-reveal a pre-highlighted HTML block via clip-path. The HTML is rendered
 * in full (so syntax highlighting is stable) and a clip-path inset hides the
 * unrevealed portion. Useful when you want a single-frame "swipe" reveal.
 *
 * For LLM-style character-by-character streaming with a blinking cursor and
 * natural cadence, prefer `streamCode()` instead.
 */
export function clipReveal(
  highlightedHtml: string,
  progress: number,
  accentColor: string,
): string {
  const p = Math.max(0, Math.min(1, progress));
  const inset = (1 - p) * 100;
  const showCursor = p > 0 && p < 1;
  return `
    <div style="position:relative;overflow:hidden;">
      <div style="clip-path: inset(0 ${inset}% 0 0); -webkit-clip-path: inset(0 ${inset}% 0 0);">
        ${highlightedHtml}
      </div>
      ${
        showCursor
          ? `<div style="position:absolute;top:0;left:${p * 100}%;width:2px;height:100%;background:${accentColor};box-shadow:0 0 8px ${accentColor};"></div>`
          : ""
      }
    </div>
  `;
}

export interface StreamCodeOptions {
  /** Source language for syntax highlighting (e.g. "json", "typescript"). */
  lang: LangName;
  /** Shiki theme. Default: "dark-plus". */
  theme?: ThemeName;
  /**
   * Cadence variance (0..1). 0 = uniform typing, 0.6–0.8 = LLM-like
   * (slows at brackets, newlines, word boundaries). Default: 0.7.
   */
  variance?: number;
  /** Current scene time in seconds — drives cursor blink when idle. */
  time?: number;
  /** Cursor accent color. */
  accentColor: string;
}

/**
 * LLM-style streaming reveal of code/JSON.
 *
 * Couples `std.text.type` (with natural-cadence variance) to per-frame
 * `std.code.highlight` so syntax colors stay stable while characters appear.
 * Pads with blank lines so the panel height does not jump as the stream
 * grows, and renders a blinking accent cursor at the leading edge.
 *
 * @param std       The render context's `std` namespace (for `std.text.type`).
 *                  Pass `ctx.std` from inside `defineScene({ render })`.
 * @param fullText  The complete code/JSON that will eventually be revealed.
 * @param progress  0..1 — how much of `fullText` has streamed in.
 * @param options   Language, theme, cadence variance, time, accent color.
 * @returns         `{ html, done }` — drop `html` into your panel; check `done`
 *                  for end-of-stream side effects (e.g. firing a "settle" pulse).
 */
export function streamCode(
  std: StreamingStd,
  fullText: string,
  progress: number,
  options: StreamCodeOptions,
): { html: string; done: boolean } {
  const { lang, theme = "dark-plus", variance = 0.7, time, accentColor } = options;

  const result = std.text.type(fullText, progress, {
    variance,
    time,
    cursorRate: 2.5,
  });

  const fullLineCount = fullText.split("\n").length;
  const visibleLineCount = result.visible.split("\n").length;
  const blankLines = "\n".repeat(Math.max(0, fullLineCount - visibleLineCount));

  const highlighted = highlight(result.visible || " ", { lang, theme });

  const cursorHtml = !result.done && result.cursorVisible
    ? `<span style="display:inline-block;width:2px;height:1.05em;background:${accentColor};box-shadow:0 0 8px ${accentColor};vertical-align:text-bottom;margin-left:1px;border-radius:1px;"></span>`
    : "";

  // Inject cursor + height-preserving blank lines just before </code>.
  const html = highlighted.replace(
    "</code>",
    `${cursorHtml}${blankLines}</code>`,
  );

  return { html, done: result.done };
}
