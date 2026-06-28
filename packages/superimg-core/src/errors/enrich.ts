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
import { hasRollupMetadata, isNodeSystemError, type RollupError } from "./guards.js";
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
 * If `err` looks like a RollupError, extract location + code frame.
 * Returns null for non-rollup errors.
 */
function locateFromRolldown(
  err: Error,
  ctx?: EnrichContext,
): { location?: SourceLocation; codeFrame?: string } | null {
  const rollupErr = err as RollupError;
  const loc = rollupErr.loc;
  // If no location, it might just be a generic rollup error.
  if (!loc && !rollupErr.frame && !rollupErr.id) return null;

  const file = loc?.file || rollupErr.id || "";
  const line = loc?.line;
  const column = loc?.column;

  // Prefer the user's source from the cache (richer multi-line frame) over
  // rolldown's frame when we have it.
  let codeFrame: string | undefined = rollupErr.frame;
  const cached = ctx?.sourceCache?.get(file);
  if (cached && line !== undefined && column !== undefined) {
    codeFrame = getCodeFrame(cached, line, column) || codeFrame;
  }

  return {
    location: {
      file,
      line: line ?? 1,
      column: column ?? 0,
    },
    ...(codeFrame !== undefined ? { codeFrame } : {}),
  };
}

/** Build a SourceLocation + optional code frame from an enrichment context. */
function locateFromError(
  err: Error,
  ctx?: EnrichContext,
): { location?: SourceLocation; codeFrame?: string } {
  // Rolldown failures arrive before any sourcemap can be produced; pull the
  // location straight from `err.loc` instead of the stack.
  const fromRolldown = locateFromRolldown(err, ctx);
  if (fromRolldown?.location) return fromRolldown;

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
    ...(codeFrame !== undefined ? { codeFrame } : {}),
  };
}

/**
 * Heuristic: classify a non-typed error so we wrap it in the most useful
 * SuperImgError subclass.
 */
function classifyUntypedError(err: Error): "compilation" | "runtime" | "io" | "generic" {
  const msg = err.message;
  // Rolldown errors usually carry `loc` and `frame`, or contain "Transform failed"
  if (hasRollupMetadata(err) || /^Build failed/i.test(msg) || /^Transform failed/i.test(msg) || /^Unexpected token/i.test(msg)) {
    return "compilation";
  }
  // Common Node fs errors
  if (
    isNodeSystemError(err) &&
    (err.code === "ENOENT" || err.code === "EACCES" || err.code === "EISDIR")
  ) {
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
    // Prefer rolldown's specific message over the generic ones
    const rollupErr = e as RollupError;
    const specificText = rollupErr.message || e.message;
    const file = located.location?.file ?? ctx?.sourceFile;
    wrapped = new TemplateCompilationError({
      syntaxError: specificText,
      ...(file !== undefined ? { file } : {}),
      ...(located.location?.line !== undefined ? { line: located.location.line } : {}),
      ...(located.location?.column !== undefined ? { column: located.location.column } : {}),
    });
  } else if (kind === "io") {
    const sysErr = isNodeSystemError(e) ? e : undefined;
    const path = sysErr?.path ?? "";
    const op = sysErr?.code === "ENOENT" ? "read" : "read";
    wrapped = new IOError({
      operation: op,
      path,
      originalError: e.message,
    });
  } else {
    // Default: wrap as runtime error with frame=0 (callers with frame context
    // should call TemplateRuntimeError directly via `enrichError(new TRE(...))`).
    const file = located.location?.file ?? ctx?.sourceFile;
    wrapped = new TemplateRuntimeError({
      frame: 0,
      originalError: e.message,
      ...(file !== undefined ? { file } : {}),
      ...(located.location?.line !== undefined ? { line: located.location.line } : {}),
      ...(located.location?.column !== undefined ? { column: located.location.column } : {}),
    });
  }

  if (located.codeFrame) wrapped.codeFrame = located.codeFrame;
  // Preserve original stack for debugger / log inspection
  if (e.stack) wrapped.stack = e.stack;
  return wrapped;
}
