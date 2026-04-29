//! Sourcemap parsing and stack-frame mapping. Browser-safe (no node:fs / node:path).
//!
//! Critical: V8 does NOT pick up inline sourcemaps from `new Function()` scripts even
//! with --enable-source-maps. Stack frames remain `<anonymous>:line:col`. This module
//! preserves those frames and maps them manually via source-map-js against the
//! bundle's parsed sourcemap.

import { SourceMapConsumer } from "source-map-js";
import type { TemplateSourceMap } from "@superimg/types";

/**
 * A Source Map v3 object. Re-exported under the local name `RawSourceMap` for
 * historical reasons; the canonical type lives in @superimg/types as
 * TemplateSourceMap.
 */
export type RawSourceMap = TemplateSourceMap;

/** Classification of a stack frame for filtering decisions in the formatter. */
export type FrameKind =
  /** Mapped back to user code (a `.video.ts` file the user authored) */
  | "user"
  /** From `new Function()` / `eval at ...` — generated bundle, candidate for sourcemap mapping */
  | "eval"
  /** Inside a @superimg/* package */
  | "framework"
  /** Inside node_modules but not @superimg/* */
  | "node_modules"
  /** V8 internal (e.g. node:internal/...) */
  | "internal";

export interface StackFrame {
  /** File path, URL, `<anonymous>`, or `eval` */
  file: string;
  /** 1-indexed line number */
  line: number;
  /** 1-indexed column number (V8 uses 1-indexed in stack strings) */
  column: number;
  /** Function name as printed by V8 (best-effort; may be empty) */
  fnName: string;
  kind: FrameKind;
  /** True if this frame came from `eval at ...` or `<anonymous>` */
  isEval: boolean;
}

export interface MappedFrame {
  /** Original source file (from the sourcemap's `sources` array) */
  file: string;
  /** 1-indexed line in the original source */
  line: number;
  /** 0-indexed column in the original source */
  column: number;
  /** Symbol name from the sourcemap (when available) */
  name: string | null;
  /** Original source content (from `sourcesContent`, when present) */
  source: string | null;
}

const V8_FRAME_RE =
  // "    at fnName (file:line:col)"   OR   "    at file:line:col"
  // The "at" form may be wrapped in `eval at ... (file:line:col), <anonymous>:line:col`.
  /^\s*at\s+(?:(?<fn>.*?)\s+\()?(?<loc>.+?)\)?$/;

/**
 * Parse a V8 stack trace into structured frames.
 *
 * Preserves `<anonymous>` and `eval at ...` frames (kind: 'eval') so the caller
 * can map them via the bundle's sourcemap. The frame is classified as 'eval'
 * if its file is `<anonymous>` or the line contains `eval at`.
 */
export function parseStackTrace(err: Error): StackFrame[] {
  if (!err.stack) return [];
  const lines = err.stack.split("\n");
  const frames: StackFrame[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("at ")) continue;

    // Detect `at eval (eval at outer (file:1:1), <anonymous>:5:7)`
    // or       `at fn (eval at outer (file:1:1), <anonymous>:5:7)`
    // We want the INNER `<anonymous>:5:7` for sourcemap mapping — that's the
    // generated location where the error actually occurred.
    const evalMatch = line.match(
      /eval at .+?\([^)]+\),\s*<anonymous>:(\d+):(\d+)\)?/,
    );
    if (evalMatch) {
      const fnMatch = line.match(/^at\s+(.+?)\s+\(eval/);
      frames.push({
        file: "<anonymous>",
        line: parseInt(evalMatch[1]!, 10),
        column: parseInt(evalMatch[2]!, 10),
        fnName: fnMatch?.[1] ?? "",
        kind: "eval",
        isEval: true,
      });
      continue;
    }

    // Standard:  `at fn (file:line:col)`  or  `at file:line:col`
    const m = line.match(V8_FRAME_RE);
    if (!m?.groups?.loc) continue;

    const fnName = m.groups.fn?.trim() ?? "";
    const loc = m.groups.loc.trim();

    // Trailing `)` may have been consumed by the regex; strip if present.
    const cleanLoc = loc.endsWith(")") ? loc.slice(0, -1) : loc;

    // Split off `:line:col` from the right (file path can contain colons on Windows / URLs).
    const locMatch = cleanLoc.match(/^(.*):(\d+):(\d+)$/);
    if (!locMatch) continue;

    const file = locMatch[1]!;
    const lineNum = parseInt(locMatch[2]!, 10);
    const col = parseInt(locMatch[3]!, 10);

    const isAnon = file === "<anonymous>";

    frames.push({
      file,
      line: lineNum,
      column: col,
      fnName,
      kind: classifyFrame(file, isAnon),
      isEval: isAnon,
    });
  }

  return frames;
}

function classifyFrame(file: string, isAnon: boolean): FrameKind {
  if (isAnon) return "eval";
  // Browser: `new Function`/Blob URL imports show up as `blob:http://...` paths.
  // Treat them as eval-class so the formatter attempts sourcemap mapping.
  if (file.startsWith("blob:")) return "eval";
  // `data:` URLs (inline scripts, eval'd modules) — same story.
  if (file.startsWith("data:")) return "eval";
  if (file.startsWith("node:")) return "internal";
  // Match @superimg/<pkg>/ in the path (handles symlinks, pnpm layouts, etc.)
  if (/[/\\]@superimg[/\\]/.test(file) || /[/\\]superimg-[a-z]+[/\\]/.test(file)) {
    return "framework";
  }
  if (/[/\\]node_modules[/\\]/.test(file)) return "node_modules";
  return "user";
}

let _consumerCache: WeakMap<RawSourceMap, SourceMapConsumer> | null = null;

function getConsumer(map: RawSourceMap): SourceMapConsumer {
  if (!_consumerCache) _consumerCache = new WeakMap();
  let cached = _consumerCache.get(map);
  if (!cached) {
    // source-map-js accepts version 3 as either number or string at runtime;
    // cast through its declared type which expects string.
    cached = new SourceMapConsumer(map as unknown as import("source-map-js").RawSourceMap);
    _consumerCache.set(map, cached);
  }
  return cached;
}

/**
 * Map a generated stack frame back to its original source location via the
 * bundle's sourcemap.
 *
 * - `frame.line` is 1-indexed (V8); source-map-js expects 1-indexed line.
 * - `frame.column` is 1-indexed (V8); source-map-js expects 0-indexed column.
 *   We subtract 1.
 *
 * Returns null when the position has no mapping in the sourcemap.
 */
export function mapFrame(
  frame: StackFrame,
  map: RawSourceMap,
): MappedFrame | null {
  const consumer = getConsumer(map);
  const original = consumer.originalPositionFor({
    line: frame.line,
    column: Math.max(0, frame.column - 1),
  });
  if (!original.source || original.line == null) return null;

  // sourcesContent is index-aligned with sources[]
  let source: string | null = null;
  if (map.sourcesContent && map.sources) {
    const idx = map.sources.indexOf(original.source);
    if (idx >= 0) source = map.sourcesContent[idx] ?? null;
  }

  return {
    file: original.source,
    line: original.line,
    column: original.column ?? 0,
    name: original.name ?? null,
    source,
  };
}

/**
 * Find the topmost frame that successfully maps to user source via the sourcemap.
 *
 * Strategy:
 *   1. Walk frames top-to-bottom.
 *   2. For 'eval' frames, attempt sourcemap mapping — if it lands in user code,
 *      that's our answer.
 *   3. For 'user'-classified frames (rare; happens when V8 already has the path),
 *      return them directly without remapping.
 *   4. Skip 'framework' / 'node_modules' / 'internal' frames.
 */
export function findUserFrame(
  frames: StackFrame[],
  map?: RawSourceMap,
): { frame: StackFrame; mapped?: MappedFrame } | null {
  for (const frame of frames) {
    if (frame.kind === "user") {
      return { frame };
    }
    if (frame.kind === "eval" && map) {
      const mapped = mapFrame(frame, map);
      if (mapped) return { frame, mapped };
    }
    // framework / node_modules / internal: skip
  }
  return null;
}
