import type { JsonSchema } from "@foxworth/boundary/program";
import { MEDIA_INTERACTION_IDS } from "./contracts.js";

const NON_EMPTY = { type: "string", minLength: 1 } as const;
const POSITIVE_INT = { type: "integer", minimum: 1 } as const;

const THUMBNAIL_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["artifactId", "maxWidth"],
  properties: {
    artifactId: NON_EMPTY,
    maxWidth: POSITIVE_INT,
  },
} as const satisfies JsonSchema;

const THUMBNAIL_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["bytes", "width", "height"],
  properties: {
    /** Portable raster bytes, base64. Host encodes; the guest never sees PNG. */
    bytes: NON_EMPTY,
    width: POSITIVE_INT,
    height: POSITIVE_INT,
  },
} as const satisfies JsonSchema;

export const MEDIA_ARTIFACT_THUMBNAIL_SPEC = Object.freeze({
  id: MEDIA_INTERACTION_IDS.thumbnail,
  input: THUMBNAIL_INPUT_SCHEMA,
  output: THUMBNAIL_OUTPUT_SCHEMA,
  reads: ["media.artifacts:{input.artifactId}"],
  changes: ["media.thumbnails:{input.artifactId}"],
  idempotencyKey: "artifactId",
  summary: "Scale one decoded artifact raster and write its thumbnail",
});
