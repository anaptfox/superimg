import {
  normalizeJson,
  validateSchemaValue,
  type InteractionDescriptor,
  type JsonSchema,
  type JsonValue,
} from "@foxworth/boundary/program";
import { SCRIPT_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  SCRIPT_INTERACTION_IDS,
  ScriptInteractionError,
  type ScriptInteractionHandlers,
  type ScriptInteractionId,
  type ScriptInteractionInputById,
  type ScriptInteractionOutputById,
  type ScriptInteractionRequestFor,
} from "./contracts.js";

export type CreateScriptInteractionMountOptions<Context> = Readonly<{
  handlers: ScriptInteractionHandlers<Context>;
}>;

export type ScriptDirectDispatcher<Context> = <Id extends ScriptInteractionId>(
  request: ScriptInteractionRequestFor<Id>,
  context: Context,
) => Promise<ScriptInteractionOutputById[Id]>;

export type ScriptInteractionMount<Context> = Readonly<{
  dispatch: ScriptDirectDispatcher<Context>;
}>;

/** Every script interaction is a read, so the only mode is direct. */
export type ScriptInteractionExposure = Readonly<Partial<{
  sources: "direct";
  cues: "direct";
  still: "direct";
}>>;

function descriptorFor(interactionId: string): InteractionDescriptor {
  const descriptor = SCRIPT_COMPILED_INTERACTIONS.program.interactions.find(
    (entry) => entry.contract.id === interactionId,
  );
  if (!descriptor) {
    throw new ScriptInteractionError(
      "UNKNOWN_INTERACTION",
      "request.interactionId",
      `unknown script interaction: ${interactionId}`,
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
    throw new ScriptInteractionError(code, path, `${path} must be portable JSON`, { cause });
  }
  const issues = validateSchemaValue(schema, normalized, path);
  if (issues.length > 0) {
    throw new ScriptInteractionError(
      code,
      path,
      `${path} does not match its interaction contract`,
      { issues },
    );
  }
  return normalized;
}

export function createScriptInteractionMount<Context>(
  options: CreateScriptInteractionMountOptions<Context>,
): ScriptInteractionMount<Context> {
  async function dispatchJson(
    context: Context,
    interactionId: ScriptInteractionId,
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
      case SCRIPT_INTERACTION_IDS.sources:
        output = await options.handlers.sources({
          input: input as unknown as ScriptInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case SCRIPT_INTERACTION_IDS.cues:
        output = await options.handlers.cues({
          input: input as unknown as ScriptInteractionInputById[typeof interactionId],
          context,
        });
        break;
      case SCRIPT_INTERACTION_IDS.still:
        output = await options.handlers.still({
          input: input as unknown as ScriptInteractionInputById[typeof interactionId],
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

  const dispatch = (async <Id extends ScriptInteractionId>(
    request: ScriptInteractionRequestFor<Id>,
    context: Context,
  ) =>
    dispatchJson(context, request.interactionId, request.input) as unknown as Promise<
      ScriptInteractionOutputById[Id]
    >) as ScriptDirectDispatcher<Context>;

  return Object.freeze({ dispatch });
}
