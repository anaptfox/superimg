// This file represents a downstream framework's private media implementation
// boundary. Application consumers import the facade below; only the facade
// imports SuperImg.
import {
  EDIT_COMPILED_INTERACTIONS,
  MEDIA_COMPILED_INTERACTIONS,
  RENDER_COMPILED_INTERACTIONS,
  createEditInteractionMount,
  createMediaInteractionMount,
  createRenderInteractionMount,
  projectMediaInteractions,
  type MediaInteractionExposure,
} from "@foxworth/superimg-interactions";

const REQUEST_MEDIA_EXPOSURE = Object.freeze({
  snapshot: "request",
  export: "request",
} satisfies MediaInteractionExposure);

const DOWNSTREAM_SOURCE_ANALYSIS = Object.freeze({
  facades: Object.freeze(["application/media"]),
});

type DownstreamMediaProgramSummary = Readonly<{
  programDigest: string;
  interactionIds: readonly string[];
}>;

export type DownstreamMediaHostDescription = Readonly<{
  media: DownstreamMediaProgramSummary;
  edit: DownstreamMediaProgramSummary;
  render: DownstreamMediaProgramSummary;
  requestMediaInteractionIds: readonly string[];
  authoringFacades: readonly string[];
}>;

function unavailable(): never {
  throw new Error("The consumer boundary test does not execute host effects");
}

function mountPrivateSuperImgPrograms() {
  const media = createMediaInteractionMount({
    handlers: {
      discover: unavailable,
      describe: unavailable,
      check: unavailable,
      inspect: unavailable,
      snapshot: unavailable,
      compile: unavailable,
      export: unavailable,
    },
  });
  const edit = createEditInteractionMount({
    handlers: {
      bindings: unavailable,
      setNodeTransform: unavailable,
      trimSceneEnd: unavailable,
      setPhaseBoundary: unavailable,
    },
  });
  const render = createRenderInteractionMount({
    handlers: { render: unavailable },
  });
  return Object.freeze({ media, edit, render });
}

function summarize(program: Readonly<{
  programDigest: string;
  interactions: readonly Readonly<{ contract: Readonly<{ id: string }> }>[];
}>): DownstreamMediaProgramSummary {
  return Object.freeze({
    programDigest: program.programDigest,
    interactionIds: Object.freeze(
      program.interactions.map(({ contract }) => contract.id),
    ),
  });
}

/** Host-facing evidence with no SuperImg port or contract type in its surface. */
export async function describeDownstreamMediaHost(): Promise<DownstreamMediaHostDescription> {
  mountPrivateSuperImgPrograms();
  const projection = await projectMediaInteractions(REQUEST_MEDIA_EXPOSURE);
  return Object.freeze({
    media: summarize(MEDIA_COMPILED_INTERACTIONS.program),
    edit: summarize(EDIT_COMPILED_INTERACTIONS.program),
    render: summarize(RENDER_COMPILED_INTERACTIONS.program),
    requestMediaInteractionIds: Object.freeze(
      Object.keys(REQUEST_MEDIA_EXPOSURE),
    ),
    authoringFacades: DOWNSTREAM_SOURCE_ANALYSIS.facades,
  });
}
