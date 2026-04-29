//! Single conversion point: any error → enriched SuperImgError with source location + code frame.

import {
  SuperImgError,
  TemplateCompilationError,
  TemplateRuntimeError,
  ValidationError,
  RenderError,
  IOError,
  type SourceLocation,
} from "@superimg/types";
import { getCodeFrame } from "./code-frame.js";
import {
  parseStackTrace,
  findUserFrame,
  type RawSourceMap,
  type MappedFrame,
} from "./source-map.js";

export interface EnrichContext {
  /** Parsed sourcemap for the bundle that produced the error */
  sourceMap?: RawSourceMap;
  /** Logical path of the bundle's source file (used as fallback when mapping yields a relative path) */
  sourceFile?: string;
  /**
   * Caller-provided cache of file path → source content, used when a mapped
   * source isn't present in `sourcesContent`. Browser-safe: callers can pass
   * an empty cache and skip code-frame rendering, or populate from disk in
   * Node-only paths.
   */
  sourceCache?: Map<string, string>;
}

/**
 * Resolve the source content for a mapped frame.
 *
 * 1. Prefer `sourcesContent` from the sourcemap (already attached by mapFrame).
 * 2. Fall back to caller-provided `sourceCache`.
 * 3. Return null — caller skips code-frame rendering.
 */
function resolveSource(
  mapped: MappedFrame,
  ctx: EnrichContext | undefined,
): string | null {
  if (mapped.source) return mapped.source;
  if (ctx?.sourceCache?.has(mapped.file)) {
    return ctx.sourceCache.get(mapped.file) ?? null;
  }
  return null;
}

/** Heuristic: does this path look like a user template file? */
function isLikelyUserTemplate(file: string): boolean {
  return /\.video\.[tj]sx?$/i.test(file);
}

/**
 * Esbuild's BuildFailure shape — structurally typed so we don't import esbuild
 * here (this module is browser-safe and esbuild is server-only).
 */
interface EsbuildLocation {
  file: string;
  line: number; // 1-indexed
  column: number; // 0-indexed
  length?: number;
  lineText?: string;
}
interface EsbuildMessage {
  text: string;
  location: EsbuildLocation | null;
}

/**
 * Build a synthetic 1-line code frame from esbuild's `lineText` + column.
 * Esbuild only gives us the offending line; we render it Vite-style with a
 * caret beneath the column.
 */
function syntheticEsbuildCodeFrame(loc: EsbuildLocation): string | undefined {
  if (!loc.lineText) return undefined;
  const lineNum = String(loc.line);
  const gutter = " ".repeat(lineNum.length);
  const caretIndent = " ".repeat(loc.column);
  const caretLen = Math.max(1, loc.length ?? 1);
  const caret = "^".repeat(caretLen);
  return [
    `> ${lineNum} | ${loc.lineText}`,
    `  ${gutter} | ${caretIndent}${caret}`,
  ].join("\n");
}

/**
 * If `err` looks like an esbuild BuildFailure, extract location + code frame
 * from the first error message. Returns null for non-esbuild errors.
 */
function locateFromEsbuild(
  err: Error,
  ctx?: EnrichContext,
): { location?: SourceLocation; codeFrame?: string } | null {
  const errors = (err as Error & { errors?: EsbuildMessage[] }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0]!;
  const loc = first.location;
  if (!loc) return { location: undefined, codeFrame: undefined };

  // Prefer the user's source from the cache (richer multi-line frame) over
  // esbuild's single-line lineText when we have it.
  let codeFrame: string | undefined;
  const cached = ctx?.sourceCache?.get(loc.file);
  if (cached) {
    codeFrame = getCodeFrame(cached, loc.line, loc.column);
  } else {
    codeFrame = syntheticEsbuildCodeFrame(loc);
  }

  return {
    location: {
      file: loc.file,
      line: loc.line,
      column: loc.column,
    },
    codeFrame,
  };
}

/** Build a SourceLocation + optional code frame from an enrichment context. */
function locateFromError(
  err: Error,
  ctx?: EnrichContext,
): { location?: SourceLocation; codeFrame?: string } {
  // Esbuild failures arrive before any sourcemap can be produced; pull the
  // location straight from `err.errors[0].location` instead of the stack.
  const fromEsbuild = locateFromEsbuild(err, ctx);
  if (fromEsbuild?.location) return fromEsbuild;

  const frames = parseStackTrace(err);
  const found = findUserFrame(frames, ctx?.sourceMap);
  if (!found) return {};

  // If no mapping was needed (frame already pointed at user code), only report
  // it as a location when the file is a likely user template file. Otherwise
  // we'd point at our own bundled chunks for things like IO errors that have
  // no meaningful source location.
  if (!found.mapped) {
    if (!isLikelyUserTemplate(found.frame.file)) return {};
    return {
      location: {
        file: found.frame.file,
        line: found.frame.line,
        column: Math.max(0, found.frame.column - 1),
      },
    };
  }

  const mapped = found.mapped;
  const source = resolveSource(mapped, ctx);
  const codeFrame = source
    ? getCodeFrame(source, mapped.line, mapped.column)
    : undefined;

  return {
    location: {
      file: mapped.file,
      line: mapped.line,
      column: mapped.column,
    },
    codeFrame,
  };
}

/**
 * Heuristic: classify a non-typed error so we wrap it in the most useful
 * SuperImgError subclass.
 */
function classifyUntypedError(err: Error): "compilation" | "runtime" | "io" | "generic" {
  const msg = err.message;
  // esbuild errors carry `errors: BuildFailure[]` and message contains "ERROR:"
  if ((err as any).errors || /^Build failed/i.test(msg) || /^Transform failed/i.test(msg)) {
    return "compilation";
  }
  // Common Node fs errors
  if ((err as any).code === "ENOENT" || (err as any).code === "EACCES" || (err as any).code === "EISDIR") {
    return "io";
  }
  // Default: assume runtime (most thrown-from-render errors)
  return "generic";
}

/**
 * Enrich an arbitrary error into a SuperImgError subclass with mapped source
 * location and code frame populated when possible.
 *
 * - If `err` is already a SuperImgError, augment in place: populate `location`
 *   and `codeFrame` from the stack if not already set.
 * - Otherwise wrap in the closest matching subclass via heuristics.
 *
 * The original Error's stack is preserved on the returned SuperImgError when
 * we wrap (so debuggers / log inspectors still have the raw chain).
 */
export function enrichError(
  err: unknown,
  ctx?: EnrichContext,
): SuperImgError {
  // Normalize to Error
  const e: Error =
    err instanceof Error
      ? err
      : new Error(typeof err === "string" ? err : JSON.stringify(err));

  if (err instanceof SuperImgError) {
    if (!err.location || !err.codeFrame) {
      const located = locateFromError(err, ctx);
      if (!err.location && located.location) err.location = located.location;
      if (!err.codeFrame && located.codeFrame) err.codeFrame = located.codeFrame;
    }
    return err;
  }

  const located = locateFromError(e, ctx);
  const kind = classifyUntypedError(e);

  let wrapped: SuperImgError;
  if (kind === "compilation") {
    // Prefer esbuild's specific `errors[0].text` over the generic
    // "Build failed with N errors" parent message — it points at the actual
    // syntax problem, not the count.
    const esbuildErrors = (e as Error & { errors?: EsbuildMessage[] }).errors;
    const specificText =
      Array.isArray(esbuildErrors) && esbuildErrors[0]?.text
        ? esbuildErrors[0].text
        : e.message;
    wrapped = new TemplateCompilationError({
      file: located.location?.file ?? ctx?.sourceFile,
      line: located.location?.line,
      column: located.location?.column,
      syntaxError: specificText,
    });
  } else if (kind === "io") {
    const path = (e as any).path ?? "";
    const op = (e as any).code === "ENOENT" ? "read" : "read";
    wrapped = new IOError({
      operation: op,
      path,
      originalError: e.message,
    });
  } else {
    // Default: wrap as runtime error with frame=0 (callers with frame context
    // should call TemplateRuntimeError directly via `enrichError(new TRE(...))`).
    wrapped = new TemplateRuntimeError({
      frame: 0,
      originalError: e.message,
      file: located.location?.file ?? ctx?.sourceFile,
      line: located.location?.line,
      column: located.location?.column,
    });
  }

  if (located.codeFrame) wrapped.codeFrame = located.codeFrame;
  // Preserve original stack for debugger / log inspection
  if (e.stack) wrapped.stack = e.stack;
  return wrapped;
}
