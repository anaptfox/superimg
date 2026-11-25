import {
  compileInteractions,
  defineInteraction,
  type InteractionLowering,
} from "@foxworth/boundary";
import { portableSchema } from "@foxworth/boundary/program";
import {
  MEDIA_DECLARED_ERROR_SCHEMAS,
  MEDIA_INTERACTION_SPECS,
  type MediaNativeInteractionSpec,
} from "./schemas.js";

const mediaErrorDetails = portableSchema(MEDIA_DECLARED_ERROR_SCHEMAS.INVALID_INPUT);

function lowerMediaInteraction(spec: MediaNativeInteractionSpec) {
  return defineInteraction({
    id: spec.id,
    input: portableSchema(spec.input),
    output: portableSchema(spec.output),
    errors: {
      INVALID_INPUT: mediaErrorDetails,
    },
    reads: [...spec.reads],
    changes: [...spec.changes],
    ...(spec.idempotencyKey === undefined ? {} : { idempotencyKey: spec.idempotencyKey }),
    ...(spec.compensates === undefined ? {} : { compensates: spec.compensates }),
    summary: spec.summary,
  });
}

export const MEDIA_INTERACTION_DEFINITIONS = Object.freeze({
  speechVoices: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.speechVoices),
  speechSynthesize: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.speechSynthesize),
  narrationPrepare: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.narrationPrepare),
  narrationReview: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.narrationReview),
  discover: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.discover),
  check: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.check),
  inspect: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.inspect),
  describe: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.describe),
  compile: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.compile),
  thumbnail: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.thumbnail),
  arrange: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.arrange),
  snapshot: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.snapshot),
  export: lowerMediaInteraction(MEDIA_INTERACTION_SPECS.export),
});

export const MEDIA_INTERACTION_LOWERING: InteractionLowering<
  typeof MEDIA_INTERACTION_SPECS,
  typeof MEDIA_INTERACTION_DEFINITIONS
> = {
  lower(_value, { alias }) {
    return MEDIA_INTERACTION_DEFINITIONS[alias];
  },
};

export const MEDIA_COMPILED_INTERACTIONS = compileInteractions(
  MEDIA_INTERACTION_SPECS,
  MEDIA_INTERACTION_LOWERING,
);
