import {
  compileInteractions,
  defineInteraction,
  type InteractionLowering,
} from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import {
  SCRIPT_DECLARED_ERROR_SCHEMAS,
  SCRIPT_INTERACTION_SPECS,
  type ScriptNativeInteractionSpec,
} from "./schemas.js";

const scriptErrorDetails = portableSchema(SCRIPT_DECLARED_ERROR_SCHEMAS.INVALID_INPUT);

function lowerScriptInteraction(spec: ScriptNativeInteractionSpec) {
  return defineInteraction({
    id: spec.id,
    input: portableSchema(spec.input),
    output: portableSchema(spec.output),
    errors: {
      INVALID_INPUT: scriptErrorDetails,
      SCRIPT_NOT_FOUND: scriptErrorDetails,
      SCRIPT_OUTSIDE_ROOT: scriptErrorDetails,
      NOT_A_SCRIPT: scriptErrorDetails,
      NO_SCRIPT: scriptErrorDetails,
      MULTIPLE_SCRIPTS: scriptErrorDetails,
      UNSUPPORTED_SOURCE: scriptErrorDetails,
      INVALID_CUE: scriptErrorDetails,
      BLOCK_NOT_PLACED: scriptErrorDetails,
    },
    reads: [...spec.reads],
    changes: [...spec.changes],
    summary: spec.summary,
  });
}

export const SCRIPT_INTERACTION_DEFINITIONS = Object.freeze({
  sources: lowerScriptInteraction(SCRIPT_INTERACTION_SPECS.sources),
  cues: lowerScriptInteraction(SCRIPT_INTERACTION_SPECS.cues),
  still: lowerScriptInteraction(SCRIPT_INTERACTION_SPECS.still),
});

export const SCRIPT_INTERACTION_LOWERING: InteractionLowering<
  typeof SCRIPT_INTERACTION_SPECS,
  typeof SCRIPT_INTERACTION_DEFINITIONS
> = {
  lower(_value, { alias }) {
    return SCRIPT_INTERACTION_DEFINITIONS[alias];
  },
};

export const SCRIPT_COMPILED_INTERACTIONS = compileInteractions(
  SCRIPT_INTERACTION_SPECS,
  SCRIPT_INTERACTION_LOWERING,
);
