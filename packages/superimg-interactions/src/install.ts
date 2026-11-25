import {
  declaredInteractionError,
  installInteractions,
  type InstallInteractionsOptions,
  type InstallationId,
  type InstalledInteractions,
  type NativeInteractionBinding,
  type RealizationIds,
} from "@foxworth/boundary";
import { MEDIA_COMPILED_INTERACTIONS, MEDIA_INTERACTION_DEFINITIONS } from "./compiled.js";
import { MediaInteractionError } from "./contracts.js";
import { declaredErrorDetails } from "./declared-error.js";
import type { MediaInteractionMount } from "./mount.js";
import { MEDIA_DECLARED_ERROR_SCHEMAS, MEDIA_INTERACTION_SPECS } from "./schemas.js";

export type InstallMediaInteractionsOptions<Context> = Readonly<{
  installationId: InstallationId;
  realizationIds: RealizationIds;
  requests?: InstallInteractionsOptions<
    typeof MEDIA_INTERACTION_DEFINITIONS,
    Context
  >["requests"];
}>;

type MediaAlias = keyof typeof MEDIA_INTERACTION_SPECS;

function isDeclaredMediaCode(
  code: string,
): code is keyof typeof MEDIA_DECLARED_ERROR_SCHEMAS {
  return Object.hasOwn(MEDIA_DECLARED_ERROR_SCHEMAS, code);
}

function nativeBinding<Context>(
  alias: MediaAlias,
  mount: MediaInteractionMount<Context>,
): NativeInteractionBinding<
  (typeof MEDIA_INTERACTION_DEFINITIONS)[MediaAlias],
  (typeof MEDIA_INTERACTION_SPECS)[MediaAlias],
  Context
> {
  const definition = MEDIA_INTERACTION_DEFINITIONS[alias];
  const handle = MEDIA_COMPILED_INTERACTIONS.handles[alias];
  return {
    interaction: handle,
    target: MEDIA_INTERACTION_SPECS[alias],
    async dispatch(request) {
      try {
        return await mount.dispatch(
          {
            interactionId: handle.interactionId,
            input: request.input,
          } as never,
          request.context,
        ) as never;
      } catch (cause) {
        if (cause instanceof MediaInteractionError && isDeclaredMediaCode(cause.code)) {
          throw declaredInteractionError(
            definition,
            cause.code,
            declaredErrorDetails("media-interaction-error", cause.path, cause.message),
          );
        }
        throw cause;
      }
    },
  };
}

/** Return execution availability separately from the host-held revocation controller. */
export function installMediaInteractions<Context>(
  mount: MediaInteractionMount<Context>,
  options: InstallMediaInteractionsOptions<Context>,
): InstalledInteractions<Context> {
  const aliases = Object.keys(MEDIA_INTERACTION_SPECS) as MediaAlias[];
  return installInteractions(MEDIA_COMPILED_INTERACTIONS, {
    installationId: options.installationId,
    realizationIds: options.realizationIds,
    bindings: aliases.map((alias) => nativeBinding(alias, mount)),
    ...(options.requests === undefined ? {} : { requests: options.requests }),
  });
}
