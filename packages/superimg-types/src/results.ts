//! Result types and structured errors

import type { JsonObject, JsonValue } from "./json.js";
//! Discriminated unions for async operations with actionable error messages

// =============================================================================
// RESULT TYPES - Discriminated unions for all async operations
// =============================================================================

/**
 * Result of loading a template into a player
 */
export type LoadResult =
  | {
      status: "success";
      totalFrames: number;
      durationSeconds: number;
      width: number;
      height: number;
      fps: number;
    }
  | {
      status: "error";
      errorType: "compilation" | "validation" | "network";
      message: string;
      suggestion: string;
      details?: JsonObject;
    };

/**
 * Result of rendering a template to file/buffer
 */
export type RenderResult =
  | {
      status: "success";
      outputPath: string;
      totalFrames: number;
      durationSeconds: number;
      fileSizeBytes: number;
      renderTimeMs: number;
    }
  | {
      status: "error";
      errorType: "template" | "encoding" | "io" | "validation";
      failedAtFrame: number;
      message: string;
      suggestion: string;
      details?: JsonObject;
    };

/**
 * Result of rendering to buffer (no file path)
 */
export type RenderBufferResult =
  | {
      status: "success";
      buffer: Uint8Array;
      totalFrames: number;
      durationSeconds: number;
      renderTimeMs: number;
    }
  | {
      status: "error";
      errorType: "template" | "encoding" | "validation";
      failedAtFrame: number;
      message: string;
      suggestion: string;
      details?: JsonObject;
    };

// =============================================================================
// ERROR CLASSES - Structured with recovery suggestions
// =============================================================================

/**
 * Source location mapped back to the user's template file (post-sourcemap).
 * Populated by enrichError() in the SuperImg core compiler.
 */
export interface SourceLocation {
  /** Absolute or project-relative path to the user's source file */
  file: string;
  /** 1-indexed line number in the source */
  line: number;
  /** 0-indexed column number in the source */
  column?: number;
}

/**
 * Serialized form of a SuperImgError. Stable shape suitable for transport
 * over WebSocket / API / process boundaries.
 */
/**
 * Known SuperImg error codes. `(string & {})` keeps autocomplete for these
 * literals while still accepting codes owned by other packages.
 */
export type SuperImgErrorCode =
  | "CHROMIUM_MISSING"
  | "CHROMIUM_LAUNCH_DENIED"
  | "CHROMIUM_INSTALL_FAILED"
  | "RUNTIME_INFRASTRUCTURE_ERROR"
  | "RUNTIME_DISPOSED"
  | "CAPABILITY_UNAVAILABLE"
  | "RUNTIME_CANCELLED"
  | "MEDIA_PREFLIGHT_FAILED"
  | "EXPORT_BUNDLE_DISPOSED"
  | "NOT_TEXT"
  | "TEMPLATE_MISSING_EXPORT"
  | "SVG_TEXT_NO_FONT"
  | "OUTPUT_SIZE_MISMATCH"
  | "NEEDS_BROWSER"
  | (string & {});

export interface SuperImgErrorJSON {
  name: string;
  code: SuperImgErrorCode;
  message: string;
  details: JsonObject;
  suggestion: string;
  docsUrl?: string;
  /** Mapped source location (when sourcemap available) */
  location?: SourceLocation;
  /** Vite-style code frame string (when source content available) */
  codeFrame?: string;
}

/**
 * Base error class for all SuperImg errors
 */
export class SuperImgError extends Error {
  /** Mapped source location (populated by enrichError when sourcemap available) */
  public location?: SourceLocation;
  /** Vite-style code frame string (populated by enrichError when source content available) */
  public codeFrame?: string;

  constructor(
    message: string,
    public readonly code: SuperImgErrorCode,
    public readonly details: JsonObject,
    public readonly suggestion: string,
    public readonly docsUrl?: string,
    options?: { cause?: unknown },
  ) {
    super(message, options && "cause" in options ? { cause: options.cause } : undefined);
    this.name = "SuperImgError";
    // Maintains proper stack trace in V8 (Node / Chromium)
    const captureStackTrace = (
      Error as ErrorConstructor & {
        captureStackTrace?(target: object, ctor?: Function): void;
      }
    ).captureStackTrace;
    if (captureStackTrace) {
      captureStackTrace(this, this.constructor);
    }
  }

  /** Convert to a plain object for logging/serialization */
  toJSON(): SuperImgErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      suggestion: this.suggestion,
      ...(this.docsUrl !== undefined ? { docsUrl: this.docsUrl } : {}),
      ...(this.location !== undefined ? { location: this.location } : {}),
      ...(this.codeFrame !== undefined ? { codeFrame: this.codeFrame } : {}),
    };
  }
}

/**
 * True for a SuperImgError from this module copy or a duplicated one.
 * Cross-realm copies fail `instanceof`, so name, code, suggestion, and details
 * are accepted as the same shape.
 */
export function isSuperImgError(value: unknown, code?: SuperImgErrorCode): value is SuperImgError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    name?: unknown;
    code?: unknown;
    suggestion?: unknown;
    details?: unknown;
  };
  const shaped = typeof candidate.name === "string"
    && candidate.name.length > 0
    && typeof candidate.code === "string"
    && typeof candidate.suggestion === "string"
    && typeof candidate.details === "object"
    && candidate.details !== null;
  if (!shaped && !(value instanceof SuperImgError)) return false;
  if (code !== undefined && candidate.code !== code) return false;
  return value instanceof SuperImgError || shaped;
}

/**
 * Template compilation failed
 */
export class TemplateCompilationError extends SuperImgError {
  constructor(details: {
    templateName?: string;
    file?: string;
    line?: number;
    column?: number;
    syntaxError: string;
    /** Optional override for the default suggestion */
    suggestion?: string;
  }) {
    const location = details.line ? ` at line ${details.line}` : "";
    const defaultSuggestion = `Check the template syntax${location}. Ensure the render function returns a valid media tree.`;
    super(
      `Template compilation failed${location}: ${details.syntaxError}`,
      "TEMPLATE_COMPILATION_ERROR",
      details,
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/templates"
    );
    this.name = "TemplateCompilationError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        ...(details.column !== undefined ? { column: details.column } : {}),
      };
    }
  }
}

/**
 * Timeline context at the point of failure (for debugging)
 */
export interface TimeContext extends JsonObject {
  timelineFrame: number;
  timelineSeconds: number;
  timelineProgress: number;
  globalTimeSeconds: number;
}

/**
 * Template threw an error during render
 */
export class TemplateRuntimeError extends SuperImgError {
  constructor(details: {
    templateName?: string;
    frame: number;
    originalError: string;
    file?: string;
    line?: number;
    column?: number;
    /** Timeline context for debugging */
    timeContext?: TimeContext;
    /** Data snapshot (truncated for large objects) */
    dataSnapshot?: unknown;
    /** Optional override for the default suggestion */
    suggestion?: string;
  }) {
    const timeInfo = details.timeContext
      ? ` (${details.timeContext.timelineSeconds.toFixed(3)}s, ${(details.timeContext.timelineProgress * 100).toFixed(1)}% progress)`
      : "";
    const defaultSuggestion = `The render function threw an error. Check that all data properties exist and values aren't NaN/undefined at this point in the timeline.`;
    const { dataSnapshot, ...jsonDetails } = details;
    super(
      `Template error at frame ${details.frame}${timeInfo}: ${details.originalError}`,
      "TEMPLATE_RUNTIME_ERROR",
      {
        ...jsonDetails,
        ...(dataSnapshot !== undefined
          ? { dataSnapshot: toDiagnosticJson(dataSnapshot) }
          : {}),
      },
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/templates#debugging"
    );
    this.name = "TemplateRuntimeError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        ...(details.column !== undefined ? { column: details.column } : {}),
      };
    }
  }
}

/**
 * Data validation failed
 */
export class ValidationError extends SuperImgError {
  constructor(details: {
    field: string;
    expectedType: string;
    receivedValue: unknown;
    file?: string;
    line?: number;
    column?: number;
    /** Optional override for the default suggestion */
    suggestion?: string;
  }) {
    const defaultSuggestion =
      `Expected ${details.expectedType} but received ${typeof details.receivedValue}. ` +
      `Check your data object.`;
    super(
      `Validation failed for field "${details.field}"`,
      "VALIDATION_ERROR",
      { ...details, receivedValue: toDiagnosticJson(details.receivedValue) },
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/templates"
    );
    this.name = "ValidationError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        ...(details.column !== undefined ? { column: details.column } : {}),
      };
    }
  }
}

function toDiagnosticJson(value: unknown): JsonValue {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return String(value);
  }
}

/**
 * Render failed (encoding, browser, etc.)
 */
export class RenderError extends SuperImgError {
  constructor(details: {
    frame: number;
    sceneIndex?: number;
    htmlError?: string;
    encoderError?: string;
    browserError?: string;
    file?: string;
    line?: number;
    column?: number;
    /** Optional override for the default suggestion */
    suggestion?: string;
  }) {
    const defaultSuggestion = details.htmlError
      ? `The template returned invalid HTML. Check your render function output.`
      : details.encoderError
        ? `Encoder error. Try reducing resolution or changing codec.`
        : `Browser error. Check for browser compatibility issues.`;
    super(
      `Render failed at frame ${details.frame}`,
      "RENDER_ERROR",
      details,
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/troubleshooting"
    );
    this.name = "RenderError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        ...(details.column !== undefined ? { column: details.column } : {}),
      };
    }
  }
}

/**
 * File I/O error
 */
export class IOError extends SuperImgError {
  constructor(details: {
    operation: "read" | "write";
    path: string;
    originalError: string;
  }) {
    super(
      `Failed to ${details.operation} file: ${details.path}`,
      "IO_ERROR",
      details,
      details.operation === "write"
        ? `Check that the directory exists and you have write permissions.`
        : `Check that the file exists and you have read permissions.`,
      "https://superimg.dev/docs/troubleshooting#io"
    );
    this.name = "IOError";
  }
}

/**
 * Player not ready error
 */
export class PlayerNotReadyError extends SuperImgError {
  constructor(operation: string) {
    super(
      `Player not ready for operation: ${operation}`,
      "PLAYER_NOT_READY",
      { operation },
      `Call load() and wait for it to complete before calling ${operation}().`,
      "https://superimg.dev/docs/player"
    );
    this.name = "PlayerNotReadyError";
  }
}
