import {
  compileInteractions,
  defineInteraction,
  type InteractionLowering,
} from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import {
  RENDER_DECLARED_ERROR_SCHEMAS,
  RENDER_INTERACTION_SPECS,
  type RenderNativeInteractionSpec,
} from "./schemas.js";

const renderErrorDetails = portableSchema(RENDER_DECLARED_ERROR_SCHEMAS.INVALID_INPUT);

function lowerRenderInteraction(spec: RenderNativeInteractionSpec) {
  return defineInteraction({
    id: spec.id,
    input: portableSchema(spec.input),
    output: portableSchema(spec.output),
    errors: {
      INVALID_INPUT: renderErrorDetails,
      PACKAGE_NOT_FOUND: renderErrorDetails,
      PACKAGE_CHANGED: renderErrorDetails,
      UNSUPPORTED_RENDER_PATH: renderErrorDetails,
      RESULT_CONFLICT: renderErrorDetails,
    },
    reads: [...spec.reads],
    changes: [...spec.changes],
    ...(spec.idempotencyKey === undefined ? {} : { idempotencyKey: spec.idempotencyKey }),
    ...(spec.compensates === undefined ? {} : { compensates: spec.compensates }),
    summary: spec.summary,
  });
}

export const RENDER_INTERACTION_DEFINITIONS = Object.freeze({
  render: lowerRenderInteraction(RENDER_INTERACTION_SPECS.render),
});

export const RENDER_INTERACTION_LOWERING: InteractionLowering<
  typeof RENDER_INTERACTION_SPECS,
  typeof RENDER_INTERACTION_DEFINITIONS
> = {
  lower(_value, { alias }) {
    return RENDER_INTERACTION_DEFINITIONS[alias];
  },
};

export const RENDER_COMPILED_INTERACTIONS = compileInteractions(
  RENDER_INTERACTION_SPECS,
  RENDER_INTERACTION_LOWERING,
);
