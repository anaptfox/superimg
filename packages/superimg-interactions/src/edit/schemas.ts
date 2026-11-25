import type { JsonSchema } from "@foxworth/boundary/program";
import { declaredErrorDetailsSchema } from "../declared-error.js";
import { EDIT_INTERACTION_IDS } from "./contracts.js";

const NON_EMPTY = { type: "string", minLength: 1 } as const;
const HASH = { type: "string", pattern: "^[a-f0-9]{64}$" } as const;
const FINITE = { type: "number" } as const;

export const EDIT_INTERACTION_ERROR_DETAILS_SCHEMA =
  declaredErrorDetailsSchema("media-edit-interaction-error");

export const EDIT_DECLARED_ERROR_SCHEMAS = {
  INVALID_INPUT: EDIT_INTERACTION_ERROR_DETAILS_SCHEMA,
  SOURCE_STALE: EDIT_INTERACTION_ERROR_DETAILS_SCHEMA,
  BINDING_UNAVAILABLE: EDIT_INTERACTION_ERROR_DETAILS_SCHEMA,
  INSUFFICIENT_OBSERVATION: EDIT_INTERACTION_ERROR_DETAILS_SCHEMA,
  EFFECT_POLICY_VIOLATION: EDIT_INTERACTION_ERROR_DETAILS_SCHEMA,
} as const;

const PRECONDITIONS = {
  type: "object",
  additionalProperties: false,
  required: ["intentHash", "sourceHashes"],
  properties: {
    intentHash: HASH,
    sourceHashes: {
      type: "object",
      additionalProperties: HASH,
    },
  },
} as const satisfies JsonSchema;

const COMMAND_BASE = {
  schemaVersion: { const: 0 },
  source: NON_EMPTY,
  expected: PRECONDITIONS,
} as const;

const OBSERVATION = {
  type: "object", additionalProperties: false, required: ["frame", "coordinates"],
  properties: {
    frame: { type: "integer", minimum: 0 },
    coordinates: { type: "object", additionalProperties: false, required: ["sourceId", "variantId", "editionId"], properties: { sourceId: NON_EMPTY, entryId: NON_EMPTY, variantId: NON_EMPTY, editionId: NON_EMPTY } },
  },
} as const satisfies JsonSchema;

const AUDIO_PLACEMENT_INPUT = {
  type: "object", additionalProperties: false, required: ["schemaVersion", "source", "kind", "target", "value", "expected"],
  properties: { ...COMMAND_BASE, kind: { const: "set-audio-clip-placement" },
    target: { type: "object", additionalProperties: false, required: ["clipId", "bindingId"], properties: { clipId: NON_EMPTY, bindingId: NON_EMPTY } },
    value: { type: "object", additionalProperties: false, required: ["atSeconds"], properties: { atSeconds: { type: "number", minimum: 0 } } },
  },
} as const satisfies JsonSchema;

const NODE_PROPERTY_INPUT = {
  type: "object", additionalProperties: false, required: ["schemaVersion", "source", "kind", "target", "value", "expected"],
  properties: { ...COMMAND_BASE, observation: OBSERVATION, kind: { const: "set-node-property" },
    target: { type: "object", additionalProperties: false, required: ["nodeId", "property", "bindingId"], properties: { nodeId: NON_EMPTY, bindingId: NON_EMPTY, property: { enum: ["color", "fill", "size", "weight", "width", "height", "src"] } } },
    value: { type: "object", additionalProperties: false, required: ["value"], properties: { value: { anyOf: [NON_EMPTY, { type: "number", exclusiveMinimum: 0 }] } } },
  },
} as const satisfies JsonSchema;

const TEXT_INPUT = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "source", "kind", "target", "value", "expected"],
  properties: { ...COMMAND_BASE, observation: OBSERVATION, kind: { const: "set-node-text" },
    target: { type: "object", additionalProperties: false, required: ["nodeId", "textBindingId"], properties: { nodeId: NON_EMPTY, textBindingId: NON_EMPTY } },
    value: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } },
  },
} as const satisfies JsonSchema;

const TRANSFORM_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "source", "kind", "target", "value", "expected"],
  properties: {
    ...COMMAND_BASE,
    kind: { const: "set-node-transform" },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["nodeId", "xBindingId", "yBindingId"],
      properties: { nodeId: NON_EMPTY, xBindingId: NON_EMPTY, yBindingId: NON_EMPTY },
    },
    value: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: { x: FINITE, y: FINITE },
    },
  },
} as const satisfies JsonSchema;

const TRIM_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "source", "kind", "target", "mode", "end", "expected"],
  properties: {
    ...COMMAND_BASE,
    kind: { const: "trim-scene-end" },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["sceneId", "durationBindingId"],
      properties: { sceneId: NON_EMPTY, durationBindingId: NON_EMPTY },
    },
    mode: { const: "ripple" },
    end: {
      type: "object",
      additionalProperties: false,
      required: ["space", "frame"],
      properties: { space: { const: "global" }, frame: { type: "integer", minimum: 1 } },
    },
  },
} as const satisfies JsonSchema;

const PHASE_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "source", "kind", "target", "mode", "value", "unit", "expected"],
  properties: {
    ...COMMAND_BASE,
    kind: { const: "set-phase-boundary" },
    target: {
      type: "object",
      additionalProperties: false,
      required: [
        "sceneId", "leftPhaseName", "rightPhaseName", "leftBindingId", "rightBindingId",
      ],
      properties: {
        sceneId: NON_EMPTY, leftPhaseName: NON_EMPTY, rightPhaseName: NON_EMPTY,
        leftBindingId: NON_EMPTY, rightBindingId: NON_EMPTY,
      },
    },
    mode: { const: "zero-sum" },
    value: {
      type: "object",
      additionalProperties: false,
      required: ["left", "right"],
      properties: { left: { type: "number", exclusiveMinimum: 0 }, right: { type: "number", exclusiveMinimum: 0 } },
    },
    unit: { enum: ["percent", "seconds"] },
  },
} as const satisfies JsonSchema;

const COMPOSITION_HOLD_INPUT = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "source", "kind", "target", "value", "expected"],
  properties: {
    ...COMMAND_BASE,
    kind: { const: "set-composition-hold" },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["occurrencePath", "holdBindingId"],
      properties: { occurrencePath: NON_EMPTY, holdBindingId: NON_EMPTY },
    },
    value: {
      type: "object",
      additionalProperties: false,
      required: ["hold"],
      properties: { hold: { type: "string", pattern: "^(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:ms|s|f)$" } },
    },
  },
} as const satisfies JsonSchema;

const COMMAND_SCHEMA = {
  oneOf: [AUDIO_PLACEMENT_INPUT, NODE_PROPERTY_INPUT, TEXT_INPUT, TRANSFORM_INPUT, TRIM_INPUT, PHASE_INPUT, COMPOSITION_HOLD_INPUT],
} as const satisfies JsonSchema;

const COORDINATES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sourceId", "variantId", "editionId"],
  properties: {
    sourceId: NON_EMPTY,
    entryId: NON_EMPTY,
    variantId: NON_EMPTY,
    editionId: NON_EMPTY,
  },
} as const satisfies JsonSchema;

const BINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "bindingId", "targetId", "propertyPath", "capability"],
  properties: {
    schemaVersion: { const: 0 },
    bindingId: NON_EMPTY,
    targetId: NON_EMPTY,
    propertyPath: NON_EMPTY,
    capability: { enum: ["exact", "inspect-only", "opaque"] },
    reason: {
      enum: [
        "animated-transform", "expression-binding", "missing-property",
        "computed-property", "spread-property", "duplicate-target", "unstable-node",
        "missing-stable-id", "cross-file-target", "derived-duration",
        "single-scene-template", "opaque-visual",
      ],
    },
    value: {},
    source: {
      type: "object",
      additionalProperties: false,
      required: ["relativePath", "sourceHash", "startByte", "endByte", "syntaxKind"],
      properties: {
        relativePath: NON_EMPTY,
        sourceHash: HASH,
        startByte: { type: "integer", minimum: 0 },
        endByte: { type: "integer", minimum: 0 },
        syntaxKind: { enum: ["number-literal", "string-duration", "string-literal"] },
      },
    },
  },
} as const satisfies JsonSchema;

const MANIFEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "coordinates", "intentHash", "summary", "bindings"],
  properties: {
    schemaVersion: { const: 0 },
    coordinates: COORDINATES_SCHEMA,
    intentHash: HASH,
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["exactBindingCount", "inspectOnlyCount", "opaqueCount"],
      properties: {
        exactBindingCount: { type: "integer", minimum: 0 },
        inspectOnlyCount: { type: "integer", minimum: 0 },
        opaqueCount: { type: "integer", minimum: 0 },
      },
    },
    bindings: { type: "array", items: BINDING_SCHEMA },
  },
} as const satisfies JsonSchema;

const SOURCE_HASHES_SCHEMA = {
  type: "object",
  additionalProperties: HASH,
} as const satisfies JsonSchema;

const APPLY_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion", "transaction", "manifest", "media", "diff",
    "verificationFrames", "changedPaths", "diagnostics",
  ],
  properties: {
    schemaVersion: { const: 0 },
    transaction: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion", "transactionId", "operation", "state",
        "beforeSourceHashes", "afterSourceHashes", "inverse",
      ],
      properties: {
        schemaVersion: { const: 0 },
        transactionId: HASH,
        operation: COMMAND_SCHEMA,
        state: { const: "committed" },
        beforeSourceHashes: SOURCE_HASHES_SCHEMA,
        afterSourceHashes: SOURCE_HASHES_SCHEMA,
        inverse: COMMAND_SCHEMA,
      },
    },
    manifest: MANIFEST_SCHEMA,
    media: { type: "object" },
    diff: { type: "object" },
    verificationFrames: { type: "array", items: { type: "integer", minimum: 0 } },
    changedPaths: { type: "array", items: NON_EMPTY },
    diagnostics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "message"],
        properties: { code: NON_EMPTY, message: NON_EMPTY, bindingId: NON_EMPTY },
      },
    },
  },
} as const satisfies JsonSchema;

const BINDINGS_OUTPUT = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "kind", "source", "sourceId", "manifest", "sourceHashes"],
  properties: {
    schemaVersion: { const: 0 },
    kind: { const: "media-edit-bindings" },
    source: NON_EMPTY,
    sourceId: NON_EMPTY,
    manifest: MANIFEST_SCHEMA,
    sourceHashes: SOURCE_HASHES_SCHEMA,
  },
} as const satisfies JsonSchema;

export type EditNativeInteractionSpec = Readonly<{
  id: string;
  input: JsonSchema;
  output: JsonSchema;
  reads: readonly string[];
  changes: readonly string[];
  summary: string;
  idempotencyKey?: string;
  compensates?: string;
}>;

const EDIT_MUTATION_TRAITS = {
  reads: ["media.sources:{input.source}", "media.ir:{input.source}"],
  changes: ["media.sources:{input.source}"],
  idempotencyKey: "expected.intentHash",
} as const;

export const EDIT_INTERACTION_SPECS = Object.freeze({
  bindings: Object.freeze({
    id: EDIT_INTERACTION_IDS.bindings,
    input: {
      type: "object",
      additionalProperties: false,
      required: ["source"],
      properties: { source: NON_EMPTY },
    },
    output: BINDINGS_OUTPUT,
    reads: ["media.sources:{input.source}"],
    changes: [],
    summary: "Inspect exact and non-editable source bindings",
  }),
  setAudioClipPlacement: Object.freeze({ id: EDIT_INTERACTION_IDS.setAudioClipPlacement, input: AUDIO_PLACEMENT_INPUT, output: APPLY_OUTPUT, ...EDIT_MUTATION_TRAITS, summary: "Change an inline audio clip placement" }),
  setNodeProperty: Object.freeze({ id: EDIT_INTERACTION_IDS.setNodeProperty, input: NODE_PROPERTY_INPUT, output: APPLY_OUTPUT, ...EDIT_MUTATION_TRAITS, summary: "Change a supported literal node property" }),
  setNodeText: Object.freeze({ id: EDIT_INTERACTION_IDS.setNodeText, input: TEXT_INPUT, output: APPLY_OUTPUT, ...EDIT_MUTATION_TRAITS, summary: "Change one literal text node" }),
  setNodeTransform: Object.freeze({
    id: EDIT_INTERACTION_IDS.setNodeTransform,
    input: TRANSFORM_INPUT,
    output: APPLY_OUTPUT,
    ...EDIT_MUTATION_TRAITS,
    summary: "Move one stable literal-positioned media node",
  }),
  trimSceneEnd: Object.freeze({
    id: EDIT_INTERACTION_IDS.trimSceneEnd,
    input: TRIM_INPUT,
    output: APPLY_OUTPUT,
    ...EDIT_MUTATION_TRAITS,
    summary: "Trim one explicit compose scene with ripple timing",
  }),
  setPhaseBoundary: Object.freeze({
    id: EDIT_INTERACTION_IDS.setPhaseBoundary,
    input: PHASE_INPUT,
    output: APPLY_OUTPUT,
    ...EDIT_MUTATION_TRAITS,
    summary: "Rebalance two adjacent literal director phases",
  }),
  setCompositionHold: Object.freeze({
    id: EDIT_INTERACTION_IDS.setCompositionHold,
    input: COMPOSITION_HOLD_INPUT,
    output: APPLY_OUTPUT,
    ...EDIT_MUTATION_TRAITS,
    summary: "Change one literal still hold at an exact retained-composition occurrence path",
  }),
}) satisfies Readonly<Record<string, EditNativeInteractionSpec>>;
