import {
  declaredInteractionError,
  installInteractions,
  type InstallInteractionsOptions,
  type InstallationId,
  type InstalledInteractions,
  type NativeInteractionBinding,
  type RealizationIds,
} from "@foxworth/boundary";
import { declaredErrorDetails } from "../declared-error.js";
import { EDIT_COMPILED_INTERACTIONS, EDIT_INTERACTION_DEFINITIONS } from "./compiled.js";
import { EditInteractionError } from "./contracts.js";
import type { EditInteractionMount } from "./mount.js";
import { EDIT_DECLARED_ERROR_SCHEMAS, EDIT_INTERACTION_SPECS } from "./schemas.js";

export type InstallEditInteractionsOptions<Context> = Readonly<{
  installationId: InstallationId;
  realizationIds: RealizationIds;
  requests?: InstallInteractionsOptions<
    typeof EDIT_INTERACTION_DEFINITIONS,
    Context
  >["requests"];
}>;

type EditAlias = keyof typeof EDIT_INTERACTION_SPECS;

function isDeclaredEditCode(
  code: string,
): code is keyof typeof EDIT_DECLARED_ERROR_SCHEMAS {
  return Object.hasOwn(EDIT_DECLARED_ERROR_SCHEMAS, code);
}

function nativeBinding<Context>(
  alias: EditAlias,
  mount: EditInteractionMount<Context>,
): NativeInteractionBinding<
  (typeof EDIT_INTERACTION_DEFINITIONS)[EditAlias],
  (typeof EDIT_INTERACTION_SPECS)[EditAlias],
  Context
> {
  const definition = EDIT_INTERACTION_DEFINITIONS[alias];
  const handle = EDIT_COMPILED_INTERACTIONS.handles[alias];
  return {
    interaction: handle,
    target: EDIT_INTERACTION_SPECS[alias],
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
        if (cause instanceof EditInteractionError && isDeclaredEditCode(cause.code)) {
          throw declaredInteractionError(
            definition,
            cause.code,
            declaredErrorDetails("media-edit-interaction-error", cause.path, cause.message),
          );
        }
        throw cause;
      }
    },
  };
}

/** Return execution availability separately from the host-held revocation controller. */
export function installEditInteractions<Context>(
  mount: EditInteractionMount<Context>,
  options: InstallEditInteractionsOptions<Context>,
): InstalledInteractions<Context> {
  const aliases = Object.keys(EDIT_INTERACTION_SPECS) as EditAlias[];
  return installInteractions(EDIT_COMPILED_INTERACTIONS, {
    installationId: options.installationId,
    realizationIds: options.realizationIds,
    bindings: aliases.map((alias) => nativeBinding(alias, mount)),
    ...(options.requests === undefined ? {} : { requests: options.requests }),
  });
}
