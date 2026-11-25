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
import { RENDER_COMPILED_INTERACTIONS, RENDER_INTERACTION_DEFINITIONS } from "./compiled.js";
import { RenderInteractionError } from "./contracts.js";
import type { RenderInteractionMount } from "./mount.js";
import { RENDER_DECLARED_ERROR_SCHEMAS, RENDER_INTERACTION_SPECS } from "./schemas.js";

export type InstallRenderInteractionsOptions<Context> = Readonly<{
  installationId: InstallationId;
  realizationIds: RealizationIds;
  requests?: InstallInteractionsOptions<
    typeof RENDER_INTERACTION_DEFINITIONS,
    Context
  >["requests"];
}>;

function isDeclaredRenderCode(
  code: string,
): code is keyof typeof RENDER_DECLARED_ERROR_SCHEMAS {
  return Object.hasOwn(RENDER_DECLARED_ERROR_SCHEMAS, code);
}

function nativeBinding<Context>(
  mount: RenderInteractionMount<Context>,
): NativeInteractionBinding<
  (typeof RENDER_INTERACTION_DEFINITIONS)["render"],
  (typeof RENDER_INTERACTION_SPECS)["render"],
  Context
> {
  const definition = RENDER_INTERACTION_DEFINITIONS.render;
  const handle = RENDER_COMPILED_INTERACTIONS.handles.render;
  return {
    interaction: handle,
    target: RENDER_INTERACTION_SPECS.render,
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
        if (cause instanceof RenderInteractionError && isDeclaredRenderCode(cause.code)) {
          throw declaredInteractionError(
            definition,
            cause.code,
            declaredErrorDetails("render-interaction-error", cause.path, cause.message),
          );
        }
        throw cause;
      }
    },
  };
}

/** Return execution availability separately from the host-held revocation controller. */
export function installRenderInteractions<Context>(
  mount: RenderInteractionMount<Context>,
  options: InstallRenderInteractionsOptions<Context>,
): InstalledInteractions<Context> {
  return installInteractions(RENDER_COMPILED_INTERACTIONS, {
    installationId: options.installationId,
    realizationIds: options.realizationIds,
    bindings: [nativeBinding(mount)],
    ...(options.requests === undefined ? {} : { requests: options.requests }),
  });
}
