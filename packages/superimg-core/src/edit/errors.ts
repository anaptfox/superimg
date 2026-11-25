//! Typed errors for pure edit helpers.

export type EditErrorCode =
  | "invalid_schema"
  | "unknown_version"
  | "unsupported_kind"
  | "invalid_frame"
  | "invalid_range"
  | "invalid_type"
  | "missing_field"
  | "unknown_space"
  | "unknown_scene"
  | "effect_policy"
  | "unsupported_mode";

export class EditError extends Error {
  readonly code: EditErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EditErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EditError";
    this.code = code;
    if (details) this.details = details;
  }
}
