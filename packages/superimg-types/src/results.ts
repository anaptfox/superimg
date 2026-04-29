//! Result types and structured errors
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
      details?: Record<string, unknown>;
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
      details?: Record<string, unknown>;
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
      details?: Record<string, unknown>;
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
 * over MCP / WebSocket / process boundaries.
 */
export interface SuperImgErrorJSON {
  name: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
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
    public readonly code: string,
    public readonly details: Record<string, unknown>,
    public readonly suggestion: string,
    public readonly docsUrl?: string
  ) {
    super(message);
    this.name = "SuperImgError";
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
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
      docsUrl: this.docsUrl,
      location: this.location,
      codeFrame: this.codeFrame,
    };
  }
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
    const defaultSuggestion = `Check the template syntax${location}. Ensure the render function returns a string.`;
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
        column: details.column,
      };
    }
  }
}

/**
 * Timeline context at the point of failure (for debugging)
 */
export interface TimeContext {
  sceneFrame: number;
  sceneTimeSeconds: number;
  sceneProgress: number;
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
      ? ` (${details.timeContext.sceneTimeSeconds.toFixed(3)}s, ${(details.timeContext.sceneProgress * 100).toFixed(1)}% progress)`
      : "";
    const defaultSuggestion = `The render function threw an error. Check that all data properties exist and values aren't NaN/undefined at this point in the timeline.`;
    super(
      `Template error at frame ${details.frame}${timeInfo}: ${details.originalError}`,
      "TEMPLATE_RUNTIME_ERROR",
      details,
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/templates#debugging"
    );
    this.name = "TemplateRuntimeError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        column: details.column,
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
      details,
      details.suggestion ?? defaultSuggestion,
      "https://superimg.dev/docs/templates"
    );
    this.name = "ValidationError";
    if (details.file && details.line !== undefined) {
      this.location = {
        file: details.file,
        line: details.line,
        column: details.column,
      };
    }
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
        column: details.column,
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
