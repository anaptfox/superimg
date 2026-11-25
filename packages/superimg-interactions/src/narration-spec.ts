import type { JsonSchema } from "@foxworth/boundary/program";

const provider = { enum: ["macos-say", "piper", "elevenlabs"] } as const;
const target = {
  type: "object",
  additionalProperties: false,
  required: ["targetId", "artifactId"],
  properties: {
    targetId: { type: "string", minLength: 1 },
    artifactId: { type: "string", minLength: 1 },
  },
} as const;
// Provider and recipe invariants are parsed by the shared host, not duplicated here.
const object = { type: "object" } as const;
const voicesInput = {
  type: "object",
  additionalProperties: false,
  required: ["provider"],
  properties: { provider },
} as const satisfies JsonSchema;
const synthesizeInput = {
  type: "object",
  additionalProperties: false,
  required: ["provider", "request", "target"],
  properties: {
    provider,
    request: object,
    target,
    refresh: { type: "boolean" },
  },
} as const satisfies JsonSchema;
const prepareInput = {
  type: "object",
  additionalProperties: false,
  required: ["recipe", "target"],
  properties: {
    recipe: object,
    target,
    preview: { type: "boolean" },
    refresh: { type: "boolean" },
  },
} as const satisfies JsonSchema;

export const SPEECH_VOICES_SPEC = {
  id: "media.speech.voices",
  input: voicesInput,
  output: object,
  reads: ["media.speech.providers"],
  changes: [],
  summary: "Discover explicitly selected host speech voices",
};
export const SPEECH_SYNTHESIZE_SPEC = {
  id: "media.speech.synthesize",
  input: synthesizeInput,
  output: object,
  reads: ["media.speech.providers"],
  changes: ["media.artifacts", "media.speech.usage"],
  summary: "Synthesize one segment and publish its frozen audio artifact",
};
export const NARRATION_PREPARE_SPEC = {
  id: "media.narration.prepare",
  input: prepareInput,
  output: object,
  reads: ["media.speech.providers"],
  changes: ["media.artifacts", "media.speech.usage"],
  summary:
    "Prepare independently cached speech and a measured portable narration plan",
};
export const NARRATION_REVIEW_SPEC = {
  id: "media.narration.review",
  input: {
    type: "object",
    additionalProperties: false,
    required: ["target"],
    properties: { target, encodedArtifactId: { type: "string", minLength: 1 } },
  } as const satisfies JsonSchema,
  output: object,
  reads: ["media.artifacts"],
  changes: ["media.reviews"],
  summary:
    "Verify prepared narration bytes and publish a local review report and viewer",
};
