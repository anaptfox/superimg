import {
  normalizeJson,
  validateSchemaValue,
  type JsonSchema,
  type JsonValue,
  type InteractionDescriptor,
} from "@foxworth/boundary/program";
import type { InteractionMode } from "@foxworth/boundary";
import { EDIT_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  EDIT_INTERACTION_IDS,
  EditInteractionError,
  type EditInteractionHandlers,
  type EditInteractionId,
  type EditInteractionInputById,
  type EditInteractionOutputById,
  type EditInteractionRequestFor,
} from "./contracts.js";

export type CreateEditInteractionMountOptions<Context> = Readonly<{
  handlers: EditInteractionHandlers<Context>;
}>;

export type EditDirectDispatcher<Context> = <Id extends EditInteractionId>(
  request: EditInteractionRequestFor<Id>,
  context: Context,
) => Promise<EditInteractionOutputById[Id]>;

export type EditInteractionMount<Context> = Readonly<{
  dispatch: EditDirectDispatcher<Context>;
}>;

export type EditInteractionExposure = Readonly<Partial<{
  bindings: "direct";
  setAudioClipPlacement: InteractionMode;
  setNodeProperty: InteractionMode;
  setNodeText: InteractionMode;
  setNodeTransform: InteractionMode;
  trimSceneEnd: InteractionMode;
  setPhaseBoundary: InteractionMode;
  setCompositionHold: InteractionMode;
}>>;

function descriptorFor(interactionId: string): InteractionDescriptor {
  const descriptor = EDIT_COMPILED_INTERACTIONS.program.interactions.find(
    (entry) => entry.contract.id === interactionId,
  );
  if (!descriptor) {
    throw new EditInteractionError(
      "UNKNOWN_INTERACTION",
      "request.interactionId",
      `unknown edit interaction: ${interactionId}`,
    );
  }
  return descriptor;
}

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
    throw new EditInteractionError(code, path, `${path} must be portable JSON`, { cause });
  }
  const issues = validateSchemaValue(schema, normalized, path);
  if (issues.length > 0) {
    throw new EditInteractionError(
      code,
      path,
      `${path} does not match its interaction contract`,
      { issues },
    );
  }
  return normalized;
}

export function createEditInteractionMount<Context>(
  options: CreateEditInteractionMountOptions<Context>,
): EditInteractionMount<Context> {
  async function dispatchJson(
    context: Context,
    interactionId: EditInteractionId,
    rawInput: unknown,
  ): Promise<JsonValue> {
    const descriptor = descriptorFor(interactionId);
    const input = boundaryValue(
      rawInput,
      descriptor.contract.inputSchema,
      `${interactionId}.input`,
      "INVALID_INPUT",
    );
    let output: unknown;
    switch (interactionId) {
      case EDIT_INTERACTION_IDS.bindings:
        output = await options.handlers.bindings({
          input: input as EditInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case EDIT_INTERACTION_IDS.setAudioClipPlacement:
        output = await options.handlers.setAudioClipPlacement({ input: input as unknown as EditInteractionInputById[typeof interactionId], context });
        break;
      case EDIT_INTERACTION_IDS.setNodeProperty:
        output = await options.handlers.setNodeProperty({ input: input as unknown as EditInteractionInputById[typeof interactionId], context });
        break;
      case EDIT_INTERACTION_IDS.setNodeText:
        output = await options.handlers.setNodeText({ input: input as unknown as EditInteractionInputById[typeof interactionId], context });
        break;
      case EDIT_INTERACTION_IDS.setNodeTransform:
        output = await options.handlers.setNodeTransform({
          input: input as unknown as EditInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case EDIT_INTERACTION_IDS.trimSceneEnd:
        output = await options.handlers.trimSceneEnd({
          input: input as unknown as EditInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case EDIT_INTERACTION_IDS.setPhaseBoundary:
        output = await options.handlers.setPhaseBoundary({
          input: input as unknown as EditInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case EDIT_INTERACTION_IDS.setCompositionHold:
        output = await options.handlers.setCompositionHold({
          input: input as unknown as EditInteractionInputById[typeof interactionId],
          context,
        });
        break;
    }
    return boundaryValue(
      output,
      descriptor.contract.outputSchema,
      `${interactionId}.output`,
      "INVALID_OUTPUT",
    );
  }

  const dispatch = (async <Id extends EditInteractionId>(
    request: EditInteractionRequestFor<Id>,
    context: Context,
  ) =>
    dispatchJson(context, request.interactionId, request.input) as unknown as Promise<
      EditInteractionOutputById[Id]
    >) as EditDirectDispatcher<Context>;

  return Object.freeze({ dispatch });
}
