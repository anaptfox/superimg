import {
  compileInteractions,
  defineInteraction,
  type InteractionLowering,
} from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import {
  EDIT_DECLARED_ERROR_SCHEMAS,
  EDIT_INTERACTION_SPECS,
  type EditNativeInteractionSpec,
} from "./schemas.js";

const editErrorDetails = portableSchema(EDIT_DECLARED_ERROR_SCHEMAS.INVALID_INPUT);

function lowerEditInteraction(spec: EditNativeInteractionSpec) {
  return defineInteraction({
    id: spec.id,
    input: portableSchema(spec.input),
    output: portableSchema(spec.output),
    errors: {
      INVALID_INPUT: editErrorDetails,
      SOURCE_STALE: editErrorDetails,
      BINDING_UNAVAILABLE: editErrorDetails,
      INSUFFICIENT_OBSERVATION: editErrorDetails,
      EFFECT_POLICY_VIOLATION: editErrorDetails,
    },
    reads: [...spec.reads],
    changes: [...spec.changes],
    ...(spec.idempotencyKey === undefined ? {} : { idempotencyKey: spec.idempotencyKey }),
    ...(spec.compensates === undefined ? {} : { compensates: spec.compensates }),
    summary: spec.summary,
  });
}

export const EDIT_INTERACTION_DEFINITIONS = Object.freeze({
  bindings: lowerEditInteraction(EDIT_INTERACTION_SPECS.bindings),
  setAudioClipPlacement: lowerEditInteraction(EDIT_INTERACTION_SPECS.setAudioClipPlacement),
  setNodeProperty: lowerEditInteraction(EDIT_INTERACTION_SPECS.setNodeProperty),
  setNodeText: lowerEditInteraction(EDIT_INTERACTION_SPECS.setNodeText),
  setNodeTransform: lowerEditInteraction(EDIT_INTERACTION_SPECS.setNodeTransform),
  trimSceneEnd: lowerEditInteraction(EDIT_INTERACTION_SPECS.trimSceneEnd),
  setPhaseBoundary: lowerEditInteraction(EDIT_INTERACTION_SPECS.setPhaseBoundary),
  setCompositionHold: lowerEditInteraction(EDIT_INTERACTION_SPECS.setCompositionHold),
});

export const EDIT_INTERACTION_LOWERING: InteractionLowering<
  typeof EDIT_INTERACTION_SPECS,
  typeof EDIT_INTERACTION_DEFINITIONS
> = {
  lower(_value, { alias }) {
    return EDIT_INTERACTION_DEFINITIONS[alias];
  },
};

export const EDIT_COMPILED_INTERACTIONS = compileInteractions(
  EDIT_INTERACTION_SPECS,
  EDIT_INTERACTION_LOWERING,
);
