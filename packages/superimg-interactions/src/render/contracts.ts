import type {
  OutputRequest,
  RuntimeProfileName,
} from "@superimg/types";
import type { JsonObject, JsonValue } from "@foxworth/boundary/program";

export const RENDER_INTERACTION_IDS = Object.freeze({
  render: "media.package.render",
} as const);

export type RenderInteractionId =
  (typeof RENDER_INTERACTION_IDS)[keyof typeof RENDER_INTERACTION_IDS];

export type MediaPackageRenderInteractionInput = Readonly<{
  schemaVersion: 0;
  sourceId: string;
  packageHash: string;
  data: JsonObject;
  output: Readonly<OutputRequest>;
}>;

export type MediaPackageRenderReceipt = Readonly<{
  schemaVersion: 0;
  kind: "media-render-result";
  resultId: string;
  sourceId: string;
  packageHash: string;
  profile: RuntimeProfileName;
  mimeType: string;
  byteLength: number;
  sha256: string;
  output: Readonly<OutputRequest>;
}>;

export interface RenderInteractionInputById {
  readonly "media.package.render": MediaPackageRenderInteractionInput;
}

export interface RenderInteractionOutputById {
  readonly "media.package.render": MediaPackageRenderReceipt;
}

export type RenderInteractionRequestFor<Id extends RenderInteractionId> = Readonly<{
  interactionId: Id;
  input: RenderInteractionInputById[Id];
}>;

export type RenderInteractionHandlers<Context> = Readonly<{
  render(args: Readonly<{
    input: MediaPackageRenderInteractionInput;
    context: Context;
  }>): Promise<MediaPackageRenderReceipt> | MediaPackageRenderReceipt;
}>;

export type RenderInteractionErrorCode =
  | "UNKNOWN_INTERACTION"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "CONTROL_UNAVAILABLE"
  | "CONTROL_TARGET_MISMATCH"
  | "INVALID_CONTROL_CONFIGURATION"
  | "PACKAGE_NOT_FOUND"
  | "PACKAGE_CHANGED"
  | "UNSUPPORTED_RENDER_PATH"
  | "RESULT_CONFLICT";

export type RenderInteractionDeclaredErrorCode =
  | RenderInteractionErrorCode
  | "CANCELLED"
  | "INTERACTION_FAILED";

export type RenderInteractionDeclaredError = JsonObject & Readonly<{
  schemaVersion: 1;
  kind: "render-interaction-error";
  code: RenderInteractionDeclaredErrorCode;
  path: string;
  message: string;
}>;

export class RenderInteractionError extends Error {
  readonly code: RenderInteractionErrorCode;
  readonly path: string;
  readonly detail: JsonValue | undefined;

  constructor(
    code: RenderInteractionErrorCode,
    path: string,
    message: string,
    options: Readonly<{ cause?: unknown; detail?: JsonValue }> = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "RenderInteractionError";
    this.code = code;
    this.path = path;
    this.detail = options.detail;
  }
}
