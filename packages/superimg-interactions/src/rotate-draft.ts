import { portableSchema, type InteractionContract } from "@foxworth/boundary/program";
import { defineInteraction } from "@foxworth/boundary";

/** Drafted contract. Not part of the live Media Program until a host recompiles. */
export const MEDIA_ARTIFACT_ROTATE_CONTRACT = Object.freeze({
  version: 1,
  id: "media.artifact.rotate",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["artifactId", "degrees"],
    properties: {
      artifactId: { type: "string", minLength: 1 },
      degrees: { type: "integer" },
    },
  },
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["artifactId"],
    properties: {
      artifactId: { type: "string", minLength: 1 },
    },
  },
  reads: Object.freeze(["media.artifacts"]),
  changes: Object.freeze(["media.artifacts"]),
}) as InteractionContract;

export const mediaArtifactRotate = defineInteraction({
  id: MEDIA_ARTIFACT_ROTATE_CONTRACT.id,
  input: portableSchema(MEDIA_ARTIFACT_ROTATE_CONTRACT.inputSchema),
  output: portableSchema(MEDIA_ARTIFACT_ROTATE_CONTRACT.outputSchema),
  reads: [...MEDIA_ARTIFACT_ROTATE_CONTRACT.reads],
  changes: [...MEDIA_ARTIFACT_ROTATE_CONTRACT.changes],
  summary: "Rotate one artifact raster by an exact degree amount",
});
