//! Player load preparation — resolve template + session options once per load.

import {
  SuperImgError,
} from "@superimg/types";
import type { LoadOptions, LoadResult, PlayerInput } from "./player-types.js";
import {
  assertMediaIRMatchesRuntime,
} from "./player-types.js";
import type { MediaIR } from "@superimg/types";

export type { PreparedSessionLoad } from "./player-load-core.js";

export async function prepareSessionLoad(
  input: PlayerInput,
  options: LoadOptions,
  size: import("@superimg/types").CanvasSize | undefined,
) {
  assertPassivePlayerInput(input);
  const load = await import("./player-load-core.js");
  return load.prepareSessionLoad(input, options, size);
}

function assertPassivePlayerInput(input: PlayerInput): void {
  const kind = (input as unknown as { kind?: unknown })?.kind;
  if (kind !== "interactive") return;
  throw new SuperImgError(
    "Interactive definitions cannot be loaded by the passive Player.",
    "INTERACTIVE_PLAYER_REQUIRED",
    { kind },
    "Use createInteractivePlayer() from @foxworth/superimg/interactive/player or InteractivePlayer from @foxworth/superimg/react/interactive so guide, scene, action, and snapshot semantics are preserved.",
  );
}

export async function openPlayerSession(
  prepared: import("./player-load-core.js").PreparedSessionLoad,
  options: LoadOptions,
  playerMode: "render-only" | "dev",
  playbackMode: import("@superimg/types").PlaybackMode,
) {
  const load = await import("./player-load-core.js");
  return load.openPlayerSession(prepared, options, playerMode, playbackMode);
}

/** Validate optional mediaIR against session state; returns IR to attach or null. */
export function resolveMediaIRForSession(
  options: LoadOptions,
  state: { width: number; height: number; fps: number; totalFrames: number },
): MediaIR | null {
  if (!options.mediaIR) return null;
  assertMediaIRMatchesRuntime(
    options.mediaIR,
    state,
    "MediaIR clock/canvas does not match resolved template",
  );
  return options.mediaIR;
}

export function loadErrorResult(error: unknown): LoadResult {
  const err = error instanceof Error ? error : new Error(String(error));
  const isIr =
    (err as { code?: string }).code === "IR_CLOCK_MISMATCH" ||
    /MediaIR|IR_CLOCK/i.test(err.message);
  const errDetails = (err as { details?: unknown }).details;
  const authoredSuggestion = (err as { suggestion?: unknown }).suggestion;
  return {
    status: "error",
    errorType: "validation",
    message: err.message,
    suggestion: isIr
      ? "Recompile Media IR for the same template config/data/preset before loading."
      : typeof authoredSuggestion === "string" && authoredSuggestion.length > 0
        ? authoredSuggestion
        : "Correct the reported media error and load it again.",
    details: {
      error: err.name,
      code: (err as { code?: string }).code,
      // SuperImgError context (e.g. IR vs runtime clock numbers) — keep it
      // structured so hosts can log/diagnose without parsing a stack.
      ...(errDetails && typeof errDetails === "object"
        ? (errDetails as Record<string, unknown>)
        : {}),
    },
  };
}

/** A request was valid but lost the race to a more recent load request. */
export function supersededLoadResult(): LoadResult {
  return loadErrorResult(new SuperImgError(
    "Load was superseded by a newer request.",
    "PLAYER_LOAD_SUPERSEDED",
    {},
    "Use the result of the most recent load request.",
  ));
}
