//! Validation types for AI-generated templates

import type { JsonObject } from "./json.js";

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
  | "RENDER_RETURNED_NON_TREE"
  | "RENDER_RETURNED_EMPTY"
  | "ALL_FRAMES_EMPTY"
  // Output issues
  | "ANIMATION_PRODUCES_NAN"
  | "UNDEFINED_IN_OUTPUT"
  | "NULL_IN_OUTPUT"
  | "TEXT_PAINT_UNVERIFIED"
  // Stdlib usage
  | "INVALID_EASING_NAME"
  // Asset usage
  | "UNDECLARED_ASSET"
  // SuperImg footguns (static / heuristic)
  | "UNITLESS_MOTION_TIME"
  | "ZERO_BOX"
  | "EMPTY_CONTAINER"
  | "IDENTITY_FLICKER"
  | "DUPLICATE_NODE_ID"
  | "UNRESOLVED_NODE_REF"
  | "INVALID_PATH_DATA"
  | "NAMESPACE_MISMATCH"
  | "TEXT_RUN_OUTSIDE_TEXT"
  | "TEXT_METRICS_APPROXIMATE"
  | "EMPTY_CLIP_OR_MASK"
  | "OPAQUE_REGION"
  | "TEMPORAL_API_ON_STATIC"
  | "SCENE_LOCAL_USES_GLOBAL"
  | "FIXED_DURATION_STACK_GROWTH"
  | "MEDIUM_MISMATCH"
  | "RAW_SVG_IN_HTML"
  | "UNPAINTED_STAGE"
  | "LOW_CONTRAST_TEXT"
  | "MISSING_EDITION"
  | "SPARSE_FOCAL"
  | "FOCAL_COVERAGE_UNVERIFIED"
  // Motion craft (warnings by default)
  | "CRAFT_HOLD_TOO_SHORT"
  | "CRAFT_EXIT_SLOWER_THAN_ENTER"
  | "CRAFT_STAGGER_OVER_CAP"
  | "CRAFT_TEXT_HOLD_SHORT"
  | "CRAFT_LINEAR_POSITIONAL"
  | "CRAFT_LONG_CONTINUOUS_MOVE"
  | "CRAFT_NO_HOLD_PHASE"
  | "PLATE_ON_STILL"
  | "PLATE_NO_ASSET"
  | "PLATE_TOO_LONG"
  | "PLATE_BAKED_BG"
  | "CSS_MOTION_IN_DRIVE";

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
  /** Stable semantic-tree identity, when the node declares one. */
  nodeId?: string;
  /** Structural tree path at the sampled frame. */
  nodePath?: string;
  /** Other semantic ids involved in this issue (references or duplicates). */
  relatedIds?: string[];
  /** Rule-specific machine-readable evidence. */
  details?: Record<string, unknown>;
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
  /** Video duration (default: 3). Accepts number (seconds), "5s", "500ms", or "30f". */
  duration?: number | string;
  /** Optional data to merge with template defaults */
  data?: JsonObject;
  /** Check for NaN/undefined in output (default: true) */
  checkOutput?: boolean;
  /** Check for invalid easing names in code (default: true) */
  checkEasingNames?: boolean;
  /** Run motion craft heuristics (default: false) */
  craft?: boolean;
  /** Treat craft warnings as errors (default: false) */
  craftStrict?: boolean;
}
