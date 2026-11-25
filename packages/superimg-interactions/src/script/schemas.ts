import type { JsonSchema } from "@foxworth/boundary/program";
import { declaredErrorDetailsSchema } from "../declared-error.js";
import { SCRIPT_INTERACTION_IDS } from "./contracts.js";

const NON_EMPTY = { type: "string", minLength: 1 } as const;
const HASH = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;
const SECONDS = { type: "number", minimum: 0 } as const;
const BLOCK_ID = { type: "string", pattern: "^[A-Za-z0-9-]{1,80}$" } as const;
const POSITIVE_INT = { type: "integer", minimum: 1 } as const;

export const SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA =
  declaredErrorDetailsSchema("media-script-interaction-error");

/** Proven refusals. None of them leaves an effect behind. */
export const SCRIPT_DECLARED_ERROR_SCHEMAS = {
  INVALID_INPUT: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  SCRIPT_NOT_FOUND: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  SCRIPT_OUTSIDE_ROOT: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  NOT_A_SCRIPT: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  NO_SCRIPT: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  MULTIPLE_SCRIPTS: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  UNSUPPORTED_SOURCE: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  COLLECTION_PROVIDER_DEFERRED: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  EMPTY_COLLECTION: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  UNKNOWN_ENTRY: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  INVALID_CUE: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
  BLOCK_NOT_PLACED: SCRIPT_INTERACTION_ERROR_DETAILS_SCHEMA,
} as const;

const SOURCES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "kind", "scriptPath", "sources"],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-script-sources" },
    scriptPath: NON_EMPTY,
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "relativePath"],
        properties: { sourceId: NON_EMPTY, relativePath: NON_EMPTY },
      },
    },
  },
} as const satisfies JsonSchema;

const CUES_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion", "kind", "sourceId", "relativePath", "programHash", "scriptPath",
    "scriptHash", "fps", "durationSeconds", "cues", "unplaced", "unknownCues", "findings",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-script-cues" },
    sourceId: NON_EMPTY,
    relativePath: NON_EMPTY,
    entryId: NON_EMPTY,
    programHash: HASH,
    scriptPath: NON_EMPTY,
    scriptHash: HASH,
    fps: { type: "number", exclusiveMinimum: 0 },
    durationSeconds: SECONDS,
    cues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blockId", "startSeconds", "endSeconds", "stillSeconds", "costSeconds"],
        properties: {
          blockId: BLOCK_ID,
          startSeconds: SECONDS,
          endSeconds: SECONDS,
          stillSeconds: SECONDS,
          costSeconds: SECONDS,
        },
      },
    },
    unplaced: { type: "array", items: BLOCK_ID },
    unknownCues: { type: "array", items: NON_EMPTY },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["blockId", "code", "message"],
        properties: { blockId: NON_EMPTY, code: NON_EMPTY, message: NON_EMPTY },
      },
    },
  },
} as const satisfies JsonSchema;

const STILL_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion", "kind", "sourceId", "relativePath", "programHash", "scriptHash",
    "blockId", "atSeconds", "frame", "mimeType", "bytes", "width", "height", "sha256",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-script-still" },
    sourceId: NON_EMPTY,
    relativePath: NON_EMPTY,
    entryId: NON_EMPTY,
    programHash: HASH,
    scriptHash: HASH,
    blockId: BLOCK_ID,
    atSeconds: SECONDS,
    frame: { type: "integer", minimum: 0 },
    mimeType: { const: "image/png" },
    bytes: NON_EMPTY,
    width: POSITIVE_INT,
    height: POSITIVE_INT,
    sha256: HASH,
  },
} as const satisfies JsonSchema;

export type ScriptNativeInteractionSpec = Readonly<{
  id: string;
  input: JsonSchema;
  output: JsonSchema;
  reads: readonly string[];
  changes: readonly string[];
  summary: string;
}>;

export const SCRIPT_INTERACTION_SPECS = Object.freeze({
  sources: Object.freeze({
    id: SCRIPT_INTERACTION_IDS.sources,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["script"],
      properties: { script: NON_EMPTY },
    },
    output: SOURCES_OUTPUT_SCHEMA,
    reads: ["media.sources", "media.scripts:{input.script}"],
    changes: [],
    summary: "List the media sources that import one script file, without running them",
  }),
  cues: Object.freeze({
    id: SCRIPT_INTERACTION_IDS.cues,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["source"],
      properties: { source: NON_EMPTY, entryId: NON_EMPTY },
    },
    output: CUES_OUTPUT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.scripts"],
    changes: [],
    summary: "Report where each script block sits on one film's clock",
  }),
  still: Object.freeze({
    id: SCRIPT_INTERACTION_IDS.still,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["source", "blockId"],
      properties: { source: NON_EMPTY, blockId: BLOCK_ID, entryId: NON_EMPTY, maxWidth: { type: "integer", minimum: 16 } },
    },
    output: STILL_OUTPUT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.scripts"],
    changes: [],
    summary: "Render the frame a film shows for one script block",
  }),
} as const satisfies Record<string, ScriptNativeInteractionSpec>);
