import {
  normalizeJson,
  validateSchemaValue,
  type JsonSchema,
  type JsonValue,
  type InteractionDescriptor,
} from "@foxworth/boundary/program";
import type { InteractionMode } from "@foxworth/boundary";
import { MEDIA_COMPILED_INTERACTIONS } from "./compiled.js";
import {
  MEDIA_INTERACTION_IDS,
  MediaInteractionError,
  type MediaInteractionHandlers,
  type MediaInteractionId,
  type MediaInteractionInputById,
  type MediaInteractionOutputById,
  type MediaInteractionRequestFor,
} from "./contracts.js";
import {
  createMediaInteractionProgressReporter,
  type MediaInteractionProgressFailure,
  type MediaInteractionProgressOptions,
  type MediaInteractionProgressReporter,
  type MediaInteractionProgressUpdate,
} from "./progress.js";

export type MediaInteractionProgressResolverArgs<Context> = Readonly<{
  context: Context;
  interactionId: MediaInteractionId;
}>;

export type MediaInteractionProgressResolver<Context> = (
  args: MediaInteractionProgressResolverArgs<Context>,
) => Promise<MediaInteractionProgressOptions | undefined> | MediaInteractionProgressOptions | undefined;

/** Explicit host signal that an interaction may have crossed an effect seam. */
export class MediaInteractionUncertainError extends Error {
  readonly reason: string;

  constructor(
    reason: string,
    options: Readonly<{ cause?: unknown }> = {},
  ) {
    super(reason, options.cause === undefined ? undefined : { cause: options.cause });
    if (reason.length === 0) {
      throw new TypeError("MediaInteractionUncertainError reason must not be empty");
    }
    this.name = "MediaInteractionUncertainError";
    this.reason = reason;
  }
}

export type CreateMediaInteractionMountOptions<Context> = Readonly<{
  handlers: MediaInteractionHandlers<Context>;
  /** Resolves a host-local observer. Its runtime objects never enter the Program. */
  progress?: MediaInteractionProgressResolver<Context>;
}>;

export type MediaDirectDispatcher<Context> = <Id extends MediaInteractionId>(
  request: MediaInteractionRequestFor<Id>,
  context: Context,
) => Promise<MediaInteractionOutputById[Id]>;

export type MediaInteractionMount<Context> = Readonly<{
  dispatch: MediaDirectDispatcher<Context>;
}>;

export type MediaInteractionExposure = Readonly<Partial<{
  discover: "direct";
  describe: "direct";
  check: "direct";
  inspect: "direct";
  snapshot: InteractionMode;
  compile: InteractionMode;
  thumbnail: "direct";
  arrange: "direct";
  speechVoices: "direct";
  speechSynthesize: InteractionMode;
  narrationPrepare: InteractionMode;
  narrationReview: InteractionMode;
  export: InteractionMode;
}>>;

function descriptorFor(interactionId: string): InteractionDescriptor {
  const descriptor = MEDIA_COMPILED_INTERACTIONS.program.interactions.find(
    (entry) => entry.contract.id === interactionId,
  );
  if (!descriptor) {
    throw new MediaInteractionError(
      "UNKNOWN_INTERACTION",
      "request.interactionId",
      `unknown media interaction: ${interactionId}`,
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
    throw new MediaInteractionError(
      code,
      path,
      `${path} must be portable JSON`,
      { cause },
    );
  }
  const issues = validateSchemaValue(schema, normalized, path);
  if (issues.length > 0) {
    throw new MediaInteractionError(
      code,
      path,
      `${path} does not match its interaction contract`,
      { issues },
    );
  }
  return normalized;
}

function isCancellationError(cause: unknown): boolean {
  if (
    cause instanceof Error &&
    (cause.name === "AbortError" || cause.name === "TimeoutError")
  ) {
    return true;
  }
  try {
    return typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "RUNTIME_CANCELLED";
  } catch {
    return false;
  }
}

function progressFailure(cause: unknown, interactionId: string): MediaInteractionProgressFailure {
  if (cause instanceof MediaInteractionError) {
    return {
      code: cause.code,
      path: cause.path,
      message: cause.message,
    };
  }
  return {
    code: "INTERACTION_FAILED",
    path: interactionId,
    message: cause instanceof Error ? cause.message : "The media interaction failed",
  };
}

async function reportInteractionTerminal(
  progress: MediaInteractionProgressReporter | undefined,
  update: MediaInteractionProgressUpdate,
): Promise<void> {
  if (!progress) return;
  try {
    await progress.report(update);
  } catch {
    // Observation protocol errors cannot replace the handler result or error.
  }
}

export function createMediaInteractionMount<Context>(
  options: CreateMediaInteractionMountOptions<Context>,
): MediaInteractionMount<Context> {
  async function dispatchJson(
    context: Context,
    interactionId: MediaInteractionId,
    rawInput: unknown,
  ): Promise<JsonValue> {
    const descriptor = descriptorFor(interactionId);
    let progress: MediaInteractionProgressReporter | undefined;
    let resumed = false;
    if (options.progress) {
      try {
        const progressOptions = await options.progress({ context, interactionId });
        if (progressOptions) {
          resumed = progressOptions.resume !== undefined;
          progress = createMediaInteractionProgressReporter(progressOptions, {
            programDigest: MEDIA_COMPILED_INTERACTIONS.program.programDigest,
            interactionId,
            contractDigest: descriptor.contractDigest,
          });
          await progress.report({
            subject: { kind: "interaction" },
            state: resumed ? "running" : "started",
          });
        }
      } catch (cause) {
        // Incompatible execution evidence must stop dispatch, even when optional
        // observation failures are otherwise isolated from native execution.
        if (typeof cause === "object" && cause !== null && "code" in cause &&
          cause.code === "LEGACY_EXECUTION_IDENTITY") throw cause;
        progress = undefined;
      }
    }

    try {
      const input = boundaryValue(
        rawInput,
        descriptor.contract.inputSchema,
        `${interactionId}.input`,
        "INVALID_INPUT",
      );
      const progressArgument = progress === undefined ? {} : { progress };
      let output: unknown;
      switch (interactionId) {
        case MEDIA_INTERACTION_IDS.speechVoices:
        case MEDIA_INTERACTION_IDS.speechSynthesize:
        case MEDIA_INTERACTION_IDS.narrationPrepare:
        case MEDIA_INTERACTION_IDS.narrationReview: {
          const alias = interactionId === MEDIA_INTERACTION_IDS.speechVoices ? "speechVoices"
            : interactionId === MEDIA_INTERACTION_IDS.speechSynthesize ? "speechSynthesize"
            : interactionId === MEDIA_INTERACTION_IDS.narrationReview ? "narrationReview" : "narrationPrepare";
          const handler = options.handlers[alias];
          if (!handler) throw new MediaInteractionError("CONTROL_UNAVAILABLE", interactionId, "This host has not configured narration interactions");
          output = await handler({ input: input as never, context, ...progressArgument });
          break;
        }
        case MEDIA_INTERACTION_IDS.discover:
          output = await options.handlers.discover({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.describe:
          output = await options.handlers.describe({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.check:
          output = await options.handlers.check({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.inspect:
          output = await options.handlers.inspect({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.snapshot:
          output = await options.handlers.snapshot({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.compile:
          output = await options.handlers.compile({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.thumbnail:
          output = await options.handlers.thumbnail({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.arrange:
          output = await options.handlers.arrange({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
        case MEDIA_INTERACTION_IDS.export:
          output = await options.handlers.export({
            input: input as MediaInteractionInputById[typeof interactionId],
            context,
            ...progressArgument,
          });
          break;
      }
      const validatedOutput = boundaryValue(
        output,
        descriptor.contract.outputSchema,
        `${interactionId}.output`,
        "INVALID_OUTPUT",
      );
      await reportInteractionTerminal(progress, {
        subject: { kind: "interaction" },
        state: "succeeded",
      });
      return validatedOutput;
    } catch (cause) {
      if (progress) {
        if (cause instanceof MediaInteractionUncertainError) {
          await reportInteractionTerminal(progress, {
            subject: { kind: "interaction" },
            state: "uncertain",
            reason: cause.reason,
          });
        } else if (isCancellationError(cause)) {
          const reason = cause instanceof Error && cause.message.length > 0
            ? cause.message
            : undefined;
          await reportInteractionTerminal(progress, {
            subject: { kind: "interaction" },
            state: "cancelled",
            ...(reason === undefined ? {} : { reason }),
          });
        } else {
          await reportInteractionTerminal(progress, {
            subject: { kind: "interaction" },
            state: "failed",
            error: progressFailure(cause, interactionId),
          });
        }
      }
      throw cause;
    }
  }

  const dispatch = (async <Id extends MediaInteractionId>(
    request: MediaInteractionRequestFor<Id>,
    context: Context,
  ): Promise<MediaInteractionOutputById[Id]> =>
    dispatchJson(context, request.interactionId, request.input) as Promise<
      MediaInteractionOutputById[Id]
    >) as MediaDirectDispatcher<Context>;

  return Object.freeze({ dispatch });
}
