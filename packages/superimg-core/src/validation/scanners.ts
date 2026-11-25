//! Pure source/HTML scanners for AI template validation and `superimg check`.

import type { ValidationIssue } from "@superimg/types";

/** Extract context around a needle in HTML/source. */
export function extractProblemContext(text: string, needle: string): string {
  const idx = text.indexOf(needle);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + needle.length + 30);
  return "..." + text.slice(start, end) + "...";
}

// Only numeric-bearing markup participates in the math check. In particular,
// text, scripts, labels and resource URLs may legitimately contain "NaN".
const NUMERIC_ATTRIBUTES = new Set([
  "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "d", "points", "viewbox", "transform", "opacity",
  "stroke-width", "stroke-dasharray", "stroke-dashoffset", "font-size",
  "offset", "pathlength", "rotate", "dx", "dy",
]);

function invalidNumericMarkup(html: string): string | undefined {
  const markup = html.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");
  // Quoted values may contain >, including inline SVG/data URLs.
  const tags = markup.match(/<[a-z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>/gi) ?? [];
  const invalid = /(?:^|[^a-zA-Z0-9_])(?:NaN|[+-]?Infinity)(?=$|[^a-zA-Z0-9_]|(?:px|em|rem|vh|vw|deg|rad|s|ms)\b)/;
  const check = (value: string) => {
    // CSS URLs and string literals carry opaque resource/content values.
    const numeric = value.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\)/gi, "")
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
    return invalid.test(numeric);
  };
  for (const tag of tags) {
    const attrs = tag.slice(tag.search(/\s|>/)).matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g);
    for (const attr of attrs) {
      const name = attr[1]!.toLowerCase();
      if (name !== "style" && !NUMERIC_ATTRIBUTES.has(name)) continue;
      const value = attr[2] ?? attr[3] ?? attr[4] ?? "";
      if (check(name === "d" ? value.replace(/[MmLlHhVvCcSsQqTtAaZz](?=NaN|[+-]?Infinity)/g, " ") : value)) return `${name}=${value}`;
    }
  }
  for (const style of markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    if (check(style[1]!)) return style[1];
  }
  return undefined;
}

/**
 * Scan rendered HTML for NaN / undefined / null issues.
 */
export function scanHtmlIssues(
  html: string,
  frame?: number,
  progress?: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const loc = {
    ...(frame !== undefined ? { frame } : {}),
    ...(progress !== undefined ? { progress } : {}),
  };

  const invalidNumber = invalidNumericMarkup(html);
  if (invalidNumber !== undefined) {
    issues.push({
      severity: "error",
      code: "ANIMATION_PRODUCES_NAN",
      message: "Numeric render output contains NaN or Infinity",
      ...loc,
      context: invalidNumber.slice(0, 240),
      suggestion: "Check for division by zero or invalid math operations",
    });
  }

  if (/style="[^"]*undefined[^"]*"/i.test(html)) {
    issues.push({
      severity: "error",
      code: "UNDEFINED_IN_OUTPUT",
      message: 'Style attribute contains "undefined"',
      ...loc,
      context: extractProblemContext(html, "undefined"),
      suggestion: "Check that all data properties exist and have values",
    });
  } else if (html.includes("undefined")) {
    issues.push({
      severity: "warning",
      code: "UNDEFINED_IN_OUTPUT",
      message: 'Render output contains "undefined"',
      ...loc,
      context: extractProblemContext(html, "undefined"),
      suggestion: "Check that all interpolated values are defined",
    });
  }

  if (/style="[^"]*null[^"]*"/i.test(html) || html.includes(">null<")) {
    issues.push({
      severity: "warning",
      code: "NULL_IN_OUTPUT",
      message: 'Render output contains "null"',
      ...loc,
      context: extractProblemContext(html, "null"),
      suggestion: "Check that all data properties have non-null values",
    });
  }

  return issues;
}

export interface SourceFootgunOptions {
  /** Default export is compose() — globalFrame is legitimate. */
  isComposed?: boolean;
  /** Explicit medium when known (from metadata). */
  medium?: "html" | "svg";
  /**
   * When true, template is temporal (fps+duration, resolve, or compose).
   * When omitted, inferred from source heuristics.
   */
  isAnimated?: boolean;
}

/** Infer whether source looks like an animated (video/gif) template. */
export function inferIsAnimated(source: string): boolean {
  // video() supplies its default fps; authors only need a duration.
  if (/\bvideo(?:\s*<[^;]*?>)?\s*\(/.test(source)) return true;
  if (/\bcompose\s*\(/.test(source)) return true;
  if (/\bresolve\s*[(:]/.test(source)) return true;
  // fps + duration both present in source (typical define config)
  const hasFps = /\bfps\s*:/.test(source);
  const hasDuration = /\bduration\s*:/.test(source);
  return hasFps && hasDuration;
}

/** Infer compose() multi-scene export. */
export function inferIsComposed(source: string): boolean {
  return /\bexport\s+default\s+compose\s*\(/.test(source) ||
    /\bcompose\s*\(/.test(source);
}

/**
 * Static footgun scans on template source (unitless times, static misuse, etc.).
 */
export function scanSourceFootguns(
  source: string,
  options: SourceFootgunOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isComposed = options.isComposed ?? inferIsComposed(source);
  const isAnimated = options.isAnimated ?? inferIsAnimated(source);
  const medium = options.medium;

  // `for` is a motion-window key. `from` is only a time key on director
  // clip options; elsewhere it commonly describes a numeric value range
  // (for example std.oscillate(..., { from: 0.55, to: 1 })).
  // Avoid matching already-quoted strings by requiring a bare number then , or }.
  const unitlessForRe =
    /\b(for)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?=,|}|\/\*|\n)/g;
  for (const match of source.matchAll(unitlessForRe)) {
    issues.push(unitlessMotionTimeIssue(match));
  }

  const unitlessFromRe =
    /\b(from)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?=,|}|\/\*|\n)/g;
  for (const match of source.matchAll(unitlessFromRe)) {
    if (!isDirectorClipOption(source, match.index)) continue;
    issues.push(unitlessMotionTimeIssue(match));
  }

  function unitlessMotionTimeIssue(match: RegExpMatchArray): ValidationIssue {
    const key = match[1]!;
    const value = match[2]!;
    return {
      severity: "error",
      code: "UNITLESS_MOTION_TIME",
      message: `Unitless motion time ${key}: ${value} — must include a unit (e.g. "${value}s" or "${value}%")`,
      suggestion:
        'Use explicit units in motion options: at: "0.2s", for: "30%", from: "10%"',
      context: match[0].trim(),
    };
  }

  if (!isAnimated) {
    const temporalPatterns: Array<{ re: RegExp; label: string }> = [
      { re: /\bctx\.director\s*\(/, label: "ctx.director()" },
      { re: /\btimeline\./, label: "timeline.*" },
      { re: /\bstd\.stack\s*\(/, label: "std.stack()" },
      { re: /\bstd\.carousel\s*\(/, label: "std.carousel()" },
    ];
    for (const { re, label } of temporalPatterns) {
      if (re.test(source)) {
        issues.push({
          severity: "error",
          code: "TEMPORAL_API_ON_STATIC",
          message: `Temporal API ${label} used without fps+duration (static image/svg template)`,
          suggestion:
            "Add config.fps and config.duration for video/gif, or remove director/timeline/stack/carousel from still templates",
          context: label,
        });
        break;
      }
    }
  }

  if (
    !isComposed &&
    (/\bctx\.globalFrame\b/.test(source) || /\bctx\.globalTimeSeconds\b/.test(source))
  ) {
    issues.push({
      severity: "warning",
      code: "SCENE_LOCAL_USES_GLOBAL",
      message:
        "Uses globalFrame/globalTimeSeconds for scene-local animation (prefer timeline / director)",
      suggestion:
        "Use timeline.progress / timeline.seconds or ctx.director() for scene-local motion; reserve global* for multi-scene compose",
    });
  }

  if (/\bstd\.stack\s*\(/.test(source)) {
    const hasResolve = /\bresolve\s*[(:]/.test(source);
    const hasLayoutTimeline = /\blayoutTimeline\s*\(/.test(source);
    const hasFixedDuration =
      /\bduration\s*:\s*(?:\d+(?:\.\d+)?|['"`][^'"`]+['"`])/.test(source);
    if (hasFixedDuration && !hasResolve && !hasLayoutTimeline) {
      issues.push({
        severity: "warning",
        code: "FIXED_DURATION_STACK_GROWTH",
        message:
          "std.stack() with fixed config.duration and no resolve/layoutTimeline — item count growth may compress slots",
        suggestion:
          "Use resolve() + layoutTimeline({...}) (and optional stack weights) when list length is data-driven",
      });
    }
  }

  if (/Html\s*\(\s*\{[^]{0,2000}?<svg[\s>/]/i.test(source)) {
    issues.push({
      severity: "warning",
      code: "RAW_SVG_IN_HTML",
      message: "Html() contains raw <svg> markup. Prefer Vector(...) so the drawing is a typed layer.",
      suggestion: "Move the drawing into Vector(...) with vector.path or vector.group. Keep Html() for non-SVG markup.",
    });
  }

  if (medium === "svg" || /medium\s*:\s*['"]svg['"]/.test(source)) {
    // Soft: medium svg but no <svg in likely return (string literals only — heuristic)
    const hasSvgLiteral = /['"`]<svg[\s>]/.test(source) || /return\s+`[\s\S]*?<svg/i.test(source);
    const hasHtmlRoot =
      /return\s+`[\s\S]*?<div/i.test(source) || /return\s+['"][\s\S]*?<div/i.test(source);
    if (hasHtmlRoot && !hasSvgLiteral) {
      issues.push({
        severity: "warning",
        code: "MEDIUM_MISMATCH",
        message: 'medium: "svg" but render appears to return HTML (e.g. <div>) without <svg>',
        suggestion: 'Return real SVG markup for medium: "svg", or omit medium for HTML templates',
      });
    }
  }

  return issues;
}

/** True when a `from` property belongs to the object passed to director.clip(). */
function isDirectorClipOption(source: string, propertyIndex: number): boolean {
  const prefix = source.slice(Math.max(0, propertyIndex - 512), propertyIndex);
  return /(?:\b[\w$]+|\))\.clip\s*\(\s*\{[^{}]*$/s.test(prefix);
}

/**
 * If every sample HTML is empty (after trim), emit ALL_FRAMES_EMPTY error.
 * Call with the list of non-throw sample HTMLs (empty string counts as empty).
 */
export function scanAllFramesEmpty(
  sampleHtmls: readonly string[],
): ValidationIssue[] {
  if (sampleHtmls.length === 0) return [];
  if (sampleHtmls.every((h) => h.trim() === "")) {
    return [
      {
        severity: "error",
        code: "ALL_FRAMES_EMPTY",
        message: `render() returned empty string for all ${sampleHtmls.length} sample frames`,
        suggestion: "Ensure render() returns HTML/SVG content at every progress",
      },
    ];
  }
  return [];
}
