import type { JsonSchema } from "@foxworth/boundary/program";
import { SPEECH_VOICES_SPEC, SPEECH_SYNTHESIZE_SPEC, NARRATION_PREPARE_SPEC, NARRATION_REVIEW_SPEC } from "./narration-spec.js";
import { MEDIA_INTERACTION_IDS } from "./contracts.js";
import { declaredErrorDetailsSchema } from "./declared-error.js";
import { MEDIA_ARTIFACT_THUMBNAIL_SPEC } from "./thumbnail-spec.js";
import { MEDIA_ARRANGE_STILL_SPEC } from "./arrange-spec.js";

const SHA256 = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;
const NON_EMPTY = { type: "string", minLength: 1 } as const;
const SOURCE_PROPERTIES = { source: NON_EMPTY } as const;
const AT_SCHEMA = {
  anyOf: [{ type: "number", minimum: 0 }, NON_EMPTY],
} as const satisfies JsonSchema;
const TARGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["targetId", "publicationId"],
  properties: {
    targetId: NON_EMPTY,
    publicationId: NON_EMPTY,
  },
} as const satisfies JsonSchema;
const ARTIFACT_TARGET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["targetId", "artifactId"],
  properties: {
    targetId: NON_EMPTY,
    artifactId: NON_EMPTY,
  },
} as const satisfies JsonSchema;

export const MEDIA_INTERACTION_ERROR_DETAILS_SCHEMA =
  declaredErrorDetailsSchema("media-interaction-error");

/** Proven post-dispatch domain outcomes only. Host rejects malformed caller input. */
export const MEDIA_DECLARED_ERROR_SCHEMAS = {
  INVALID_INPUT: MEDIA_INTERACTION_ERROR_DETAILS_SCHEMA,
} as const;

const SNAPSHOT_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "data", "dataDigest"],
  properties: {
    id: NON_EMPTY,
    data: { type: "object" },
    dataDigest: SHA256,
  },
} as const satisfies JsonSchema;

export const MEDIA_COLLECTION_SNAPSHOT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "kind",
    "source",
    "sourceId",
    "providerHash",
    "snapshotDigest",
    "entries",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-collection-snapshot" },
    source: NON_EMPTY,
    sourceId: NON_EMPTY,
    providerHash: SHA256,
    snapshotDigest: SHA256,
    entries: { type: "array", minItems: 1, items: SNAPSHOT_ENTRY_SCHEMA },
  },
} as const satisfies JsonSchema;

const ENCODING_SCHEMA = {
  type: "object",
  additionalProperties: true,
} as const satisfies JsonSchema;

const EXPORT_RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "targetId",
    "publicationId",
    "manifestDigest",
    "manifest",
  ],
  properties: {
    schemaVersion: { const: 0 },
    targetId: NON_EMPTY,
    publicationId: NON_EMPTY,
    manifestDigest: SHA256,
    manifest: { type: "object" },
  },
} as const satisfies JsonSchema;

const RUNTIME_COORDINATES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["variantId", "editionId"],
  properties: {
    entryId: NON_EMPTY,
    variantId: NON_EMPTY,
    editionId: NON_EMPTY,
  },
} as const satisfies JsonSchema;

const RUNTIME_FINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["severity", "category", "code", "message"],
  properties: {
    severity: { enum: ["error", "warning", "info"] },
    category: {
      enum: [
        "authoring",
        "asset",
        "font",
        "collection",
        "interactive",
        "capability",
        "render",
      ],
    },
    code: NON_EMPTY,
    message: NON_EMPTY,
    suggestion: NON_EMPTY,
    coordinates: RUNTIME_COORDINATES_SCHEMA,
    details: { type: "object" },
  },
} as const satisfies JsonSchema;

const RUNTIME_COVERAGE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["samples", "checks", "geometry", "unsupported", "visual"],
  properties: {
    samples: { type: "array", items: { type: "object", additionalProperties: false, required: ["frame", "progress"], properties: {
      frame: { type: "integer", minimum: 0 }, progress: { type: "number", minimum: 0, maximum: 1 }, coordinates: RUNTIME_COORDINATES_SCHEMA,
    } } },
    checks: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "scope", "frames"], properties: {
      id: NON_EMPTY, scope: { enum: ["frame", "sequence"] }, frames: { type: "array", items: { type: "integer", minimum: 0 } },
    } } },
    geometry: { type: "object", additionalProperties: false, required: ["sourceEstimatedNodes", "fontMeasuredNodes", "browserMeasuredNodes", "opaqueRegions"], properties: {
      sourceEstimatedNodes: { type: "integer", minimum: 0 }, fontMeasuredNodes: { type: "integer", minimum: 0 }, browserMeasuredNodes: { type: "integer", minimum: 0 }, opaqueRegions: { type: "integer", minimum: 0 }, browserOpaqueRegions: { type: "integer", minimum: 0 },
    } },
    unsupported: { type: "array", items: NON_EMPTY }, visual: { const: "unreviewed" },
  },
} as const satisfies JsonSchema;

const CHECK_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "ok", "programDigest", "kind", "coordinates", "findings"],
  properties: {
    schemaVersion: { const: 0 },
    ok: { type: "boolean" },
    programDigest: NON_EMPTY,
    kind: { enum: ["video", "image", "svg", "collection", "interactive"] },
    coordinates: { type: "array", items: RUNTIME_COORDINATES_SCHEMA },
    findings: { type: "array", items: RUNTIME_FINDING_SCHEMA },
    coverage: RUNTIME_COVERAGE_SCHEMA,
  },
} as const satisfies JsonSchema;

const INSPECT_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "programDigest",
    "kind",
    "coordinates",
    "findings",
    "assets",
    "fonts",
  ],
  properties: {
    schemaVersion: { const: 0 },
    programDigest: NON_EMPTY,
    kind: { enum: ["video", "image", "svg", "collection", "interactive"] },
    config: { type: "object" },
    coordinates: { type: "array", items: RUNTIME_COORDINATES_SCHEMA },
    findings: { type: "array", items: RUNTIME_FINDING_SCHEMA },
    coverage: RUNTIME_COVERAGE_SCHEMA,
    assets: { type: "array", items: { type: "object" } },
    fonts: { type: "array", items: { type: "object" } },
    collection: { type: "object" },
    metadata: { type: "object" },
  },
} as const satisfies JsonSchema;

function sourceReportSchema(
  kind: "media-source-check" | "media-source-inspection",
  report: JsonSchema,
): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "kind", "sourceId", "relativePath", "programHash", "report"],
    properties: {
      schemaVersion: { const: 0 },
      kind: { const: kind },
      sourceId: NON_EMPTY,
      relativePath: NON_EMPTY,
      programHash: SHA256,
      report,
    },
  };
}

const CHECK_RESULT_SCHEMA = sourceReportSchema("media-source-check", CHECK_REPORT_SCHEMA);
const INSPECT_RESULT_SCHEMA = sourceReportSchema(
  "media-source-inspection",
  INSPECT_REPORT_SCHEMA,
);

const ARTIFACT_RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "kind",
    "targetId",
    "artifactId",
    "artifactHash",
    "programHash",
    "intentHash",
    "markupHash",
    "coordinates",
    "manifest",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-artifact" },
    targetId: NON_EMPTY,
    artifactId: NON_EMPTY,
    artifactHash: SHA256,
    programHash: SHA256,
    intentHash: SHA256,
    markupHash: SHA256,
    coordinates: { type: "object" },
    manifest: { type: "object" },
  },
} as const satisfies JsonSchema;

const DISCOVERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "kind", "sources"],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-project-discovery" },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "relativePath", "sourceKind"],
        properties: {
          sourceId: NON_EMPTY,
          relativePath: NON_EMPTY,
          sourceKind: { enum: ["media-module", "collection"] },
        },
      },
    },
  },
} as const satisfies JsonSchema;

const DESCRIPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "kind",
    "sourceId",
    "relativePath",
    "sourceKind",
    "programHash",
    "animated",
    "canvas",
    "fps",
    "duration",
    "totalFrames",
    "temporal",
    "fonts",
    "phases",
    "editions",
    "variantIds",
    "editionIds",
  ],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-source-description" },
    sourceId: NON_EMPTY,
    relativePath: NON_EMPTY,
    sourceKind: { enum: ["media", "collection", "interactive"] },
    programHash: SHA256,
    media: { enum: ["video", "image", "svg"] },
    medium: { enum: ["html", "svg"] },
    animated: { type: "boolean" },
    canvas: {
      type: "object",
      additionalProperties: false,
      required: ["width", "height"],
      properties: {
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
      },
    },
    fps: { type: "number", exclusiveMinimum: 0 },
    duration: { type: "number", minimum: 0 },
    totalFrames: { type: "integer", minimum: 1 },
    temporal: { enum: ["static", "once", "loop", "interactive"] },
    fonts: { type: "array", items: { type: "string" } },
    phases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "start", "end", "startSeconds", "endSeconds"],
        properties: {
          name: NON_EMPTY,
          start: { type: "number", minimum: 0, maximum: 1 },
          end: { type: "number", minimum: 0, maximum: 1 },
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", minimum: 0 },
        },
      },
    },
    editions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "width", "height"],
        properties: {
          id: NON_EMPTY,
          width: { type: "integer", minimum: 1 },
          height: { type: "integer", minimum: 1 },
        },
      },
    },
    collectionEntries: { enum: ["static", "provider"] },
    variantIds: { type: "array", items: { type: "string" } },
    editionIds: { type: "array", items: { type: "string" } },
  },
} as const satisfies JsonSchema;

const EXPORT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "publication", "destinations"],
  properties: {
    source: NON_EMPTY,
    publication: TARGET_SCHEMA,
    destinations: {
      type: "array",
      minItems: 1,
      uniqueItems: true,
      items: NON_EMPTY,
    },
    entryIds: { type: "array", uniqueItems: true, items: NON_EMPTY },
    variantIds: { type: "array", uniqueItems: true, items: NON_EMPTY },
    editionIds: { type: "array", uniqueItems: true, items: NON_EMPTY },
    snapshot: MEDIA_COLLECTION_SNAPSHOT_SCHEMA,
    stillFrame: {
      oneOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind"],
          properties: { kind: { const: "poster" } },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "at"],
          properties: {
            kind: { const: "at" },
            at: { anyOf: [{ type: "number", minimum: 0 }, NON_EMPTY] },
          },
        },
      ],
    },
    rasterizer: { enum: ["playwright", "blitz"] },
    debugHtml: { type: "boolean" },
    encoding: ENCODING_SCHEMA,
  },
} as const satisfies JsonSchema;

const SOURCE_SELECTION_PROPERTIES = {
  source: NON_EMPTY,
  data: { type: "object" },
  entryId: NON_EMPTY,
  variantId: NON_EMPTY,
  editionId: NON_EMPTY,
  snapshot: MEDIA_COLLECTION_SNAPSHOT_SCHEMA,
  at: AT_SCHEMA,
  renderedLayout: { type: "boolean" },
} as const;

const CHECK_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source"],
  properties: {
    ...SOURCE_SELECTION_PROPERTIES,
    craft: { type: "boolean" },
  },
} as const satisfies JsonSchema;

const INSPECT_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source"],
  properties: {
    ...SOURCE_SELECTION_PROPERTIES,
    includeIR: { type: "boolean" },
  },
} as const satisfies JsonSchema;

const COMPILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["source", "target"],
  properties: {
    source: NON_EMPTY,
    target: ARTIFACT_TARGET_SCHEMA,
    data: { type: "object" },
    entryId: NON_EMPTY,
    variantId: NON_EMPTY,
    editionId: NON_EMPTY,
    snapshot: MEDIA_COLLECTION_SNAPSHOT_SCHEMA,
    verify: { type: "boolean" },
    strict: { type: "boolean" },
    artifactSchemaVersion: { type: "integer", enum: [0, 1] },
  },
} as const satisfies JsonSchema;

export type MediaNativeInteractionSpec = Readonly<{
  id: string;
  input: JsonSchema;
  output: JsonSchema;
  reads: readonly string[];
  changes: readonly string[];
  summary: string;
  idempotencyKey?: string;
  compensates?: string;
}>;

export const MEDIA_INTERACTION_SPECS = Object.freeze({
  speechVoices: SPEECH_VOICES_SPEC,
  speechSynthesize: SPEECH_SYNTHESIZE_SPEC,
  narrationPrepare: NARRATION_PREPARE_SPEC,
  narrationReview: NARRATION_REVIEW_SPEC,
  discover: Object.freeze({
    id: MEDIA_INTERACTION_IDS.discover,
    input: { type: "object", additionalProperties: false, properties: {} },
    output: DISCOVERY_SCHEMA,
    reads: ["media.sources"],
    changes: [],
    summary: "Discover authored media sources without evaluating modules",
  }),
  check: Object.freeze({
    id: MEDIA_INTERACTION_IDS.check,
    input: CHECK_INPUT_SCHEMA,
    output: CHECK_RESULT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.snapshots:{input.source}"],
    changes: [],
    summary: "Check one media value without executing collection providers",
  }),
  inspect: Object.freeze({
    id: MEDIA_INTERACTION_IDS.inspect,
    input: INSPECT_INPUT_SCHEMA,
    output: INSPECT_RESULT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.snapshots:{input.source}"],
    changes: [],
    summary: "Inspect one media value without executing collection providers",
  }),
  describe: Object.freeze({
    id: MEDIA_INTERACTION_IDS.describe,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["source"],
      properties: SOURCE_PROPERTIES,
    },
    output: DESCRIPTION_SCHEMA,
    reads: ["media.sources:{input.source}"],
    changes: [],
    summary: "Describe one trusted media source without running providers",
  }),
  compile: Object.freeze({
    id: MEDIA_INTERACTION_IDS.compile,
    input: COMPILE_INPUT_SCHEMA,
    output: ARTIFACT_RECEIPT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.snapshots:{input.source}"],
    changes: ["media.artifacts:{input.target.targetId}:{input.target.artifactId}"],
    idempotencyKey: "target.artifactId",
    summary: "Compile and atomically publish a versioned Media IR artifact",
  }),
  thumbnail: MEDIA_ARTIFACT_THUMBNAIL_SPEC,
  arrange: MEDIA_ARRANGE_STILL_SPEC,
  snapshot: Object.freeze({
    id: MEDIA_INTERACTION_IDS.snapshot,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["source"],
      properties: SOURCE_PROPERTIES,
    },
    output: MEDIA_COLLECTION_SNAPSHOT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.providers:{input.source}"],
    changes: [],
    summary: "Resolve one exact deterministic collection snapshot",
  }),
  export: Object.freeze({
    id: MEDIA_INTERACTION_IDS.export,
    input: EXPORT_INPUT_SCHEMA,
    output: EXPORT_RECEIPT_SCHEMA,
    reads: ["media.sources:{input.source}", "media.snapshots:{input.source}", "media.destinations"],
    changes: ["media.publications:{input.publication.targetId}:{input.publication.publicationId}"],
    idempotencyKey: "publication.publicationId",
    summary: "Publish an exact media export bundle and return its receipt",
  }),
}) satisfies Readonly<Record<string, MediaNativeInteractionSpec>>;
