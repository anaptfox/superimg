//! Typed Media IR errors.

export type MediaIRErrorCode =
  | "invalid_schema"
  | "unknown_version"
  | "unsupported_capability"
  | "invalid_range"
  | "non_finite"
  | "missing_field"
  | "invalid_type"
  | "nondeterministic"
  | "animation_mode"
  | "unstable_identity"
  | "missing_id"
  | "unknown_target"
  | "artifact_integrity"
  | "path_traversal"
  | "clock_mismatch"
  | "missing_hash"
  | "resource_limit"
  | "queue_full";

export class MediaIRError extends Error {
  readonly code: MediaIRErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: MediaIRErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "MediaIRError";
    this.code = code;
    if (details) this.details = details;
  }
}
