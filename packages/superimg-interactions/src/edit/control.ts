import {
  type ControlRequester,
  type MaybePromise,
  type ResolvedControl,
} from "@foxworth/boundary/control";
import { contributeControlRequests } from "@foxworth/boundary/control/host";
import type { RealizationId } from "@foxworth/boundary";
import { EDIT_COMPILED_INTERACTIONS } from "./compiled.js";

export type EditControlRequestContribution<Actor, Context> = Readonly<{
  control: ResolvedControl<Context>;
  executionRealizationId: RealizationId;
  actor(context: Context): MaybePromise<Actor>;
}>;

export function contributeEditControlRequests<Actor, Context>(
  requester: ControlRequester<Actor, Context>,
  contributions: Readonly<Partial<{
    setAudioClipPlacement: EditControlRequestContribution<Actor, Context>;
    setNodeProperty: EditControlRequestContribution<Actor, Context>;
    setNodeText: EditControlRequestContribution<Actor, Context>;
    setNodeTransform: EditControlRequestContribution<Actor, Context>;
    trimSceneEnd: EditControlRequestContribution<Actor, Context>;
    setPhaseBoundary: EditControlRequestContribution<Actor, Context>;
    setCompositionHold: EditControlRequestContribution<Actor, Context>;
  }>>,
) {
  const handles = EDIT_COMPILED_INTERACTIONS.handles;
  return contributeControlRequests(EDIT_COMPILED_INTERACTIONS, requester, {
    ...(contributions.setAudioClipPlacement === undefined ? {} : { setAudioClipPlacement: { interaction: handles.setAudioClipPlacement, control: contributions.setAudioClipPlacement.control, executionRealizationId: contributions.setAudioClipPlacement.executionRealizationId, actor: contributions.setAudioClipPlacement.actor } }),
    ...(contributions.setNodeProperty === undefined ? {} : { setNodeProperty: { interaction: handles.setNodeProperty, control: contributions.setNodeProperty.control, executionRealizationId: contributions.setNodeProperty.executionRealizationId, actor: contributions.setNodeProperty.actor } }),
    ...(contributions.setNodeText === undefined ? {} : { setNodeText: { interaction: handles.setNodeText, control: contributions.setNodeText.control, executionRealizationId: contributions.setNodeText.executionRealizationId, actor: contributions.setNodeText.actor } }),
    ...(contributions.setNodeTransform === undefined
      ? {}
      : {
          setNodeTransform: {
            interaction: handles.setNodeTransform,
            control: contributions.setNodeTransform.control,
            executionRealizationId: contributions.setNodeTransform.executionRealizationId,
            actor: contributions.setNodeTransform.actor,
          },
        }),
    ...(contributions.trimSceneEnd === undefined
      ? {}
      : {
          trimSceneEnd: {
            interaction: handles.trimSceneEnd,
            control: contributions.trimSceneEnd.control,
            executionRealizationId: contributions.trimSceneEnd.executionRealizationId,
            actor: contributions.trimSceneEnd.actor,
          },
        }),
    ...(contributions.setPhaseBoundary === undefined
      ? {}
      : {
          setPhaseBoundary: {
            interaction: handles.setPhaseBoundary,
            control: contributions.setPhaseBoundary.control,
            executionRealizationId: contributions.setPhaseBoundary.executionRealizationId,
            actor: contributions.setPhaseBoundary.actor,
          },
        }),
    ...(contributions.setCompositionHold === undefined
      ? {}
      : {
          setCompositionHold: {
            interaction: handles.setCompositionHold,
            control: contributions.setCompositionHold.control,
            executionRealizationId: contributions.setCompositionHold.executionRealizationId,
            actor: contributions.setCompositionHold.actor,
          },
        }),
  });
}
