export type EditInteractionErrorCode =
  | "UNKNOWN_INTERACTION"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "SOURCE_STALE"
  | "BINDING_UNAVAILABLE"
  | "INSUFFICIENT_OBSERVATION"
  | "EFFECT_POLICY_VIOLATION"
  | "CONTROL_UNAVAILABLE"
  | "CONTROL_TARGET_MISMATCH"
  | "INVALID_CONTROL_CONFIGURATION";

export type NodeEditErrorCode = EditInteractionErrorCode;

export class NodeEditError extends Error {
  readonly code: EditInteractionErrorCode;
  readonly path: string;
  readonly issues: readonly Readonly<{ path: string; message: string }>[] | undefined;

  constructor(
    code: EditInteractionErrorCode,
    path: string,
    message: string,
    options: Readonly<{
      cause?: unknown;
      issues?: readonly Readonly<{ path: string; message: string }>[];
    }> = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "EditInteractionError";
    this.code = code;
    this.path = path;
    this.issues = options.issues;
  }
}

/** The edit may have changed source and restoration could not be established.
 * Not a declared rejection: direct Boundary execution must retain certainty unknown.
 * The host reconciles the original plan; never automatically replay this attempt.
 */
export class NodeEditUncertainError extends Error {
  readonly certainty = "unknown" as const;
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EditInteractionUncertainError";
  }
}

/** Compatibility aliases preserve error identity for existing interaction hosts. */
export { NodeEditError as EditInteractionError, NodeEditUncertainError as EditInteractionUncertainError };
