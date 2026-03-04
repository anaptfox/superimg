//! Validation types for AI-generated templates

/**
 * Error codes for AI template validation.
 * Machine-readable codes for AI self-correction.
 */
export type ValidationErrorCode =
  // Syntax/Structure
  | "SYNTAX_ERROR"
  | "MISSING_DEFAULT_EXPORT"
  | "MISSING_RENDER_FUNCTION"
  | "RENDER_NOT_FUNCTION"
  // Runtime
  | "RENDER_TIMEOUT"
  | "RENDER_EXCEPTION"
  | "RENDER_RETURNED_NON_STRING"
  | "RENDER_RETURNED_EMPTY"
  // Output issues
  | "ANIMATION_PRODUCES_NAN"
  | "UNDEFINED_IN_OUTPUT"
  | "NULL_IN_OUTPUT"
  // Stdlib usage
  | "INVALID_EASING_NAME"
  // Asset usage
  | "UNDECLARED_ASSET";

/**
 * A single validation issue found during template validation.
 */
export interface ValidationIssue {
  /** Error severity: 'error' blocks rendering, 'warning' is informational */
  severity: "error" | "warning";
  /** Machine-readable error code for AI parsing */
  code: ValidationErrorCode;
  /** Human-readable message */
  message: string;
  /** Frame number where issue occurred (if applicable) */
  frame?: number;
  /** Progress value where issue occurred (0-1, if applicable) */
  progress?: number;
  /** Suggested fix for AI to apply */
  suggestion?: string;
  /** Relevant code snippet or HTML output context */
  context?: string;
}

/**
 * Result of AI template validation.
 */
export interface ValidationResult {
  /** Whether validation passed with no errors (warnings OK) */
  valid: boolean;
  /** List of all issues found */
  issues: ValidationIssue[];
  /** Rendered HTML samples for debugging (if validation succeeded partially) */
  samples?: { frame: number; progress: number; html: string }[];
  /** Total validation time in milliseconds */
  validationTimeMs: number;
}

/**
 * Options for AI template validation.
 */
export interface ValidationOptions {
  /** Progress values to sample (default: [0, 0.25, 0.5, 0.75, 1.0]) */
  sampleFrames?: number[];
  /** Timeout per render call in ms (default: 1000) */
  renderTimeout?: number;
  /** Video width for validation context (default: 1920) */
  width?: number;
  /** Video height for validation context (default: 1080) */
  height?: number;
  /** Frames per second (default: 30) */
  fps?: number;
  /** Video duration in seconds (default: 3) */
  durationSeconds?: number;
  /** Optional data to merge with template defaults */
  data?: Record<string, unknown>;
  /** Check for NaN/undefined in output (default: true) */
  checkOutput?: boolean;
  /** Check for invalid easing names in code (default: true) */
  checkEasingNames?: boolean;
}
