//! Vite-style code frame snippet around an error location.
//! Browser-safe: source content is passed in by the caller, never read from disk.

import { codeFrameColumns } from "@babel/code-frame";

export interface CodeFrameOptions {
  /** Number of context lines above the marker (default 2) */
  linesAbove?: number;
  /** Number of context lines below the marker (default 2) */
  linesBelow?: number;
  /** Use ANSI color codes (default false — caller decides per surface) */
  highlightCode?: boolean;
  /** Optional message to display next to the caret line */
  message?: string;
}

/**
 * Produce a Vite-style code frame.
 *
 *   40 |   const opacity = ctx.std.tween(0, 1, {
 *   41 |     duration: 1,
 * > 42 |     easing: 'badEasing',
 *      |             ^^^^^^^^^^
 *   43 |   });
 *
 * @param source   Full source text of the file
 * @param line     1-indexed line number where the marker sits
 * @param column   0-indexed column number (falsy → no caret)
 */
export function getCodeFrame(
  source: string,
  line: number,
  column?: number,
  opts: CodeFrameOptions = {},
): string {
  if (!source) return "";
  return codeFrameColumns(
    source,
    {
      // @babel/code-frame uses 1-indexed columns when present; we accept 0-indexed
      // (the convention in this module) and convert.
      start: { line, column: column != null ? column + 1 : undefined },
    },
    {
      highlightCode: opts.highlightCode ?? false,
      linesAbove: opts.linesAbove ?? 2,
      linesBelow: opts.linesBelow ?? 2,
      message: opts.message,
      forceColor: opts.highlightCode ?? false,
    },
  );
}
