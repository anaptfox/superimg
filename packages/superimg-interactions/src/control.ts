import {
  type ControlRequester,
  type MaybePromise,
  type ResolvedControl,
} from "@foxworth/boundary/control";
import { contributeControlRequests } from "@foxworth/boundary/control/host";
import type { RealizationId } from "@foxworth/boundary";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";

export type MediaControlRequestContribution<Actor, Context> = Readonly<{
  control: ResolvedControl<Context>;
  executionRealizationId: RealizationId;
  actor(context: Context): MaybePromise<Actor>;
}>;

export function contributeMediaControlRequests<Actor, Context>(
  requester: ControlRequester<Actor, Context>,
  contributions: Readonly<Partial<{
    snapshot: MediaControlRequestContribution<Actor, Context>;
    compile: MediaControlRequestContribution<Actor, Context>;
    export: MediaControlRequestContribution<Actor, Context>;
  }>>,
) {
  const handles = MEDIA_COMPILED_INTERACTIONS.handles;
  return contributeControlRequests(MEDIA_COMPILED_INTERACTIONS, requester, {
    ...(contributions.snapshot === undefined
      ? {}
      : {
          snapshot: {
            interaction: handles.snapshot,
            control: contributions.snapshot.control,
            executionRealizationId: contributions.snapshot.executionRealizationId,
            actor: contributions.snapshot.actor,
          },
        }),
    ...(contributions.compile === undefined
      ? {}
      : {
          compile: {
            interaction: handles.compile,
            control: contributions.compile.control,
            executionRealizationId: contributions.compile.executionRealizationId,
            actor: contributions.compile.actor,
          },
        }),
    ...(contributions.export === undefined
      ? {}
      : {
          export: {
            interaction: handles.export,
            control: contributions.export.control,
            executionRealizationId: contributions.export.executionRealizationId,
            actor: contributions.export.actor,
          },
        }),
  });
}
