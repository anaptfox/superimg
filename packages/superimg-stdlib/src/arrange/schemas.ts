//! JSON Schema for each pattern's portable spec.
//!
//! Restricted to the vocabulary the Ops operation layer already embeds
//! (`type`, `properties`, `required`, `additionalProperties`, `items`,
//! `minItems`, `minLength`, `enum`, `anyOf`), so a door can publish these
//! unchanged as an operation input contract.
//!
//! These describe shape, not invariants. A spec can satisfy its schema and
//! still fail `check` — that is the intended division: schema is what a
//! caller may send, `check` is whether the arrangement earns its place.

/** Structural only. stdlib does not own JSON Schema semantics. */
export type ArrangeJsonSchema = Readonly<Record<string, unknown>>;

const STRING = { type: "string" } as const;
const NON_EMPTY = { type: "string", minLength: 1 } as const;
const NUMBER = { type: "number" } as const;
const BOOLEAN = { type: "boolean" } as const;
const STRING_ARRAY = { type: "array", items: STRING } as const;

const EVIDENCE = {
  enum: ["observation", "derived", "interpretation", "proposal"],
} as const;

const SIZE = {
  type: "object",
  additionalProperties: false,
  required: ["width", "height"],
  properties: { width: NUMBER, height: NUMBER },
} as const;

const SRC_VIEW = {
  type: "object",
  additionalProperties: false,
  required: ["src"],
  properties: {
    src: NON_EMPTY,
    fit: { enum: ["cover", "contain", "fill"] },
  },
} as const;

const SPECIMEN = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label", "view"],
  properties: {
    id: NON_EMPTY,
    label: NON_EMPTY,
    view: SRC_VIEW,
    provenance: STRING,
  },
} as const;

const REGION = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "width", "height"],
  properties: { x: NUMBER, y: NUMBER, width: NUMBER, height: NUMBER },
} as const;

const BASE_PROPERTIES = {
  question: NON_EMPTY,
  workRemoved: NON_EMPTY,
  evidence: EVIDENCE,
  source: STRING,
  size: SIZE,
} as const;

const BASE_REQUIRED = ["question", "workRemoved", "evidence"] as const;

const POINT_WITH_CONTEXT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED, "context", "focus", "correspondence"],
  properties: {
    ...BASE_PROPERTIES,
    context: SPECIMEN,
    focus: {
      type: "object",
      additionalProperties: false,
      required: ["id", "label", "view"],
      properties: {
        id: NON_EMPTY,
        label: NON_EMPTY,
        view: SRC_VIEW,
        provenance: STRING,
        region: REGION,
      },
    },
    correspondence: { enum: ["inset", "highlight", "panels"] },
  },
} as const;

const REGISTERED_COMPARISON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED, "states", "frame", "correspondence"],
  properties: {
    ...BASE_PROPERTIES,
    states: { type: "array", minItems: 2, items: SPECIMEN },
    frame: {
      type: "object",
      additionalProperties: false,
      properties: {
        viewport: {
          type: "object",
          additionalProperties: false,
          required: ["width", "height"],
          properties: { width: NUMBER, height: NUMBER },
        },
        units: STRING,
        crop: STRING,
        timeWindow: STRING,
        scale: { enum: ["shared", "independent"] },
      },
    },
    correspondence: { type: "array", minItems: 1, items: NON_EMPTY },
    mismatches: STRING_ARRAY,
    layout: { enum: ["side-by-side", "stacked"] },
  },
} as const;

const INTERVAL = {
  type: "object",
  additionalProperties: false,
  required: ["start", "end"],
  properties: {
    id: STRING,
    start: NUMBER,
    end: NUMBER,
    label: STRING,
    uncertain: BOOLEAN,
  },
} as const;

const ALIGNED_INTERVALS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED, "timeRef", "tracks"],
  properties: {
    ...BASE_PROPERTIES,
    timeRef: {
      type: "object",
      additionalProperties: false,
      required: ["unit", "origin"],
      properties: {
        unit: { enum: ["ms", "s", "min", "hour", "day"] },
        origin: NUMBER,
        originLabel: STRING,
      },
    },
    tracks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "intervals"],
        properties: {
          id: NON_EMPTY,
          label: NON_EMPTY,
          intervals: { type: "array", minItems: 1, items: INTERVAL },
        },
      },
    },
    compare: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "tracks"],
      properties: {
        kind: { enum: ["overlap"] },
        tracks: { type: "array", minItems: 2, maxItems: 2, items: NON_EMPTY },
      },
    },
    motion: {
      type: "object",
      additionalProperties: false,
      required: ["phase"],
      properties: {
        phase: { enum: ["hold", "predict", "reveal"] },
        predict: { enum: ["tick", "empty", "ghost"] },
        revealIds: STRING_ARRAY,
      },
    },
  },
} as const;

const VALUE_AGAINST_REFERENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED, "items", "frame"],
  properties: {
    ...BASE_PROPERTIES,
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "value"],
        properties: {
          id: NON_EMPTY,
          label: NON_EMPTY,
          value: { anyOf: [STRING, NUMBER] },
          unit: STRING,
          reference: NUMBER,
        },
      },
    },
    frame: {
      type: "object",
      additionalProperties: false,
      properties: {
        units: STRING,
        scale: { enum: ["shared", "per-item"] },
      },
    },
  },
} as const;

const MECHANISM_STRIP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [...BASE_REQUIRED, "nodes", "edges", "layout"],
  properties: {
    ...BASE_PROPERTIES,
    nodes: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: { id: NON_EMPTY, label: NON_EMPTY, note: STRING },
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "claim"],
        properties: {
          from: NON_EMPTY,
          to: NON_EMPTY,
          label: STRING,
          // Per-edge evidence: a mechanism is a chain of separately
          // supported steps, not one grade for the whole picture.
          claim: EVIDENCE,
        },
      },
    },
    layout: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "order"],
          properties: {
            kind: { const: "pipeline" },
            order: { type: "array", items: NON_EMPTY },
          },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["kind", "layers"],
          properties: {
            kind: { const: "layers" },
            layers: { type: "array", items: { type: "array", items: NON_EMPTY } },
          },
        },
      ],
    },
    motion: {
      type: "object",
      additionalProperties: false,
      required: ["phase"],
      properties: {
        phase: { enum: ["hold", "predict", "reveal"] },
        revealIds: STRING_ARRAY,
      },
    },
  },
} as const;

export const ARRANGE_PATTERN_SCHEMAS = Object.freeze({
  "point-with-context": POINT_WITH_CONTEXT_SCHEMA,
  "registered-comparison": REGISTERED_COMPARISON_SCHEMA,
  "aligned-intervals": ALIGNED_INTERVALS_SCHEMA,
  "value-against-reference": VALUE_AGAINST_REFERENCE_SCHEMA,
  "mechanism-strip": MECHANISM_STRIP_SCHEMA,
}) satisfies Readonly<Record<string, ArrangeJsonSchema>>;
