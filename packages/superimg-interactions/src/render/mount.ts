import {
  normalizeJson,
  validateSchemaValue,
  type JsonSchema,
  type JsonValue,
} from "@foxworth/boundary/program";
import type { InteractionMode } from "@foxworth/boundary";
import { RENDER_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  RENDER_INTERACTION_IDS,
  RenderInteractionError,
  type MediaPackageRenderInteractionInput,
  type MediaPackageRenderReceipt,
  type RenderInteractionHandlers,
  type RenderInteractionRequestFor,
} from "./contracts.js";
import {
  executeDirectPackageRender,
  type PackageRenderHostOptions,
} from "./service.js";

export type CreateRenderInteractionMountOptions<Context> = Readonly<{
  handlers: RenderInteractionHandlers<Context>;
}>;

export type CreateNodeRenderInteractionMountOptions<Context> =
  PackageRenderHostOptions<Context>;

export type RenderDirectDispatcher<Context> = (
  request: RenderInteractionRequestFor<typeof RENDER_INTERACTION_IDS.render>,
  context: Context,
) => Promise<MediaPackageRenderReceipt>;

export type RenderInteractionMount<Context> = Readonly<{
  dispatch: RenderDirectDispatcher<Context>;
}>;

export type RenderInteractionExposure = Readonly<{
  render?: InteractionMode;
}>;

function boundaryValue(
  value: unknown,
  schema: JsonSchema,
  path: string,
  code: "INVALID_INPUT" | "INVALID_OUTPUT",
): JsonValue {
  let normalized: JsonValue;
  try {
    normalized = normalizeJson(value, path);
  } catch (cause) {
    throw new RenderInteractionError(
      code,
      path,
      `${path} must be portable JSON`,
      { cause },
    );
  }
  const issues = validateSchemaValue(schema, normalized, path);
  if (issues.length > 0) {
    throw new RenderInteractionError(
      code,
      path,
      `${path} does not match the media.package.render contract`,
      { detail: { issues } as unknown as JsonValue },
    );
  }
  return normalized;
}

export function createRenderInteractionMount<Context>(
  options: CreateRenderInteractionMountOptions<Context>,
): RenderInteractionMount<Context> {
  const found = RENDER_COMPILED_INTERACTIONS.program.interactions.find(
    (entry) => entry.contract.id === RENDER_INTERACTION_IDS.render,
  );
  if (!found) {
    throw new RenderInteractionError(
      "UNKNOWN_INTERACTION",
      "request.interactionId",
      "unknown render interaction: media.package.render",
    );
  }
  const descriptor = found;

  async function dispatchJson(context: Context, rawInput: unknown): Promise<JsonValue> {
    const input = boundaryValue(
      rawInput,
      descriptor.contract.inputSchema,
      `${RENDER_INTERACTION_IDS.render}.input`,
      "INVALID_INPUT",
    ) as unknown as MediaPackageRenderInteractionInput;
    const output = await options.handlers.render({ input, context });
    return boundaryValue(
      output,
      descriptor.contract.outputSchema,
      `${RENDER_INTERACTION_IDS.render}.output`,
      "INVALID_OUTPUT",
    );
  }

  const dispatch: RenderDirectDispatcher<Context> = async (request, context) =>
    dispatchJson(context, request.input) as unknown as Promise<MediaPackageRenderReceipt>;

  return Object.freeze({ dispatch });
}

export function createNodeRenderInteractionMount<Context>(
  options: CreateNodeRenderInteractionMountOptions<Context>,
): RenderInteractionMount<Context> {
  return createRenderInteractionMount({
    handlers: {
      render: ({ input, context }) =>
        executeDirectPackageRender(options, input, context),
    },
  });
}
