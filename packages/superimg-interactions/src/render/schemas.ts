import type { JsonSchema } from "@foxworth/boundary/program";
import { declaredErrorDetailsSchema } from "../declared-error.js";
import { RENDER_INTERACTION_IDS } from "./contracts.js";

const NON_EMPTY = { type: "string", minLength: 1 } as const;
const SHA256_HEX = {
  type: "string",
  pattern: "^[a-f0-9]{64}$",
} as const;
const RESULT_ID = {
  type: "string",
  pattern: "^sha256:[a-f0-9]{64}$",
} as const;
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["format"],
  properties: {
    format: {
      enum: ["mp4", "webm", "mov", "mkv", "gif", "png", "webp", "jpeg", "svg", "html"],
    },
    width: { type: "integer", minimum: 1 },
    height: { type: "integer", minimum: 1 },
    fps: { type: "number", exclusiveMinimum: 0 },
    profile: { enum: ["browser", "edge", "node", "node-media"] },
  },
} as const satisfies JsonSchema;

export const MEDIA_PACKAGE_RENDER_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "sourceId", "packageHash", "data", "output"],
  properties: {
    schemaVersion: { const: 0 },
    sourceId: NON_EMPTY,
    packageHash: SHA256_HEX,
    data: { type: "object" },
    output: OUTPUT_SCHEMA,
  },
} as const satisfies JsonSchema;

export const MEDIA_PACKAGE_RENDER_RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "kind",
    "resultId",
    "sourceId",
    "packageHash",
    "profile",
    "mimeType",
    "byteLength",
    "sha256",
    "output",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-render-result" },
    resultId: RESULT_ID,
    sourceId: NON_EMPTY,
    packageHash: SHA256_HEX,
    profile: { enum: ["browser", "edge", "node", "node-media"] },
    mimeType: NON_EMPTY,
    byteLength: { type: "integer", minimum: 0 },
    sha256: SHA256_HEX,
    output: OUTPUT_SCHEMA,
  },
} as const satisfies JsonSchema;

export const RENDER_INTERACTION_ERROR_DETAILS_SCHEMA =
  declaredErrorDetailsSchema("render-interaction-error");

export const RENDER_DECLARED_ERROR_SCHEMAS = {
  INVALID_INPUT: RENDER_INTERACTION_ERROR_DETAILS_SCHEMA,
  PACKAGE_NOT_FOUND: RENDER_INTERACTION_ERROR_DETAILS_SCHEMA,
  PACKAGE_CHANGED: RENDER_INTERACTION_ERROR_DETAILS_SCHEMA,
  UNSUPPORTED_RENDER_PATH: RENDER_INTERACTION_ERROR_DETAILS_SCHEMA,
  RESULT_CONFLICT: RENDER_INTERACTION_ERROR_DETAILS_SCHEMA,
} as const;

export const PACKAGE_RENDER_CONTROL_STATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "input",
    "resultId",
    "profile",
    "dataDigest",
    "capabilitiesDigest",
    "packageStoreDigest",
    "resultStoreDigest",
  ],
  properties: {
    input: MEDIA_PACKAGE_RENDER_INPUT_SCHEMA,
    resultId: RESULT_ID,
    profile: { enum: ["browser", "edge", "node", "node-media"] },
    dataDigest: RESULT_ID,
    capabilitiesDigest: RESULT_ID,
    packageStoreDigest: RESULT_ID,
    resultStoreDigest: RESULT_ID,
  },
} as const satisfies JsonSchema;

export const PACKAGE_RENDER_CONTROL_PREVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "sourceId",
    "packageHash",
    "resultId",
    "profile",
    "dataDigest",
    "output",
  ],
  properties: {
    sourceId: NON_EMPTY,
    packageHash: SHA256_HEX,
    resultId: RESULT_ID,
    profile: { enum: ["browser", "edge", "node", "node-media"] },
    dataDigest: RESULT_ID,
    output: OUTPUT_SCHEMA,
  },
} as const satisfies JsonSchema;

export type RenderNativeInteractionSpec = Readonly<{
  id: string;
  input: JsonSchema;
  output: JsonSchema;
  reads: readonly string[];
  changes: readonly string[];
  summary: string;
  idempotencyKey?: string;
  compensates?: string;
}>;

export const RENDER_INTERACTION_SPECS = Object.freeze({
  render: Object.freeze({
    id: RENDER_INTERACTION_IDS.render,
    input: MEDIA_PACKAGE_RENDER_INPUT_SCHEMA,
    output: MEDIA_PACKAGE_RENDER_RECEIPT_SCHEMA,
    reads: ["media.packages:{input.sourceId}", "media.render-capabilities"],
    changes: ["media.render-results:{input.sourceId}:{input.packageHash}"],
    idempotencyKey: "packageHash",
    summary: "Render one exact predeployed media package into a durable result",
  }),
}) satisfies Readonly<Record<string, RenderNativeInteractionSpec>>;
