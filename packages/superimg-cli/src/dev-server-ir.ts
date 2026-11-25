//! Hash-gated IR change classification for dev-server hot reload.

import type { MediaIRHashes } from "@superimg/types";

function isStaleGenerationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "stale_generation"
  );
}

export type ChangeClass = "no-change" | "markup-update" | "reload";

/**
 * Classify Media IR hash delta for dev-server WS broadcast.
 * - no-change: intent + markup unchanged (comment/refactor only)
 * - markup-update: intent same, markup changed (CSS/copy) — preserve playhead
 * - reload: intent changed or first compile — full reload
 */
export function classifyChange(
  prev: MediaIRHashes | null,
  next: MediaIRHashes,
): ChangeClass {
  if (!prev) return "reload";
  if (prev.intentHash === next.intentHash && prev.markupHash === next.markupHash) {
    return "no-change";
  }
  if (prev.intentHash === next.intentHash) return "markup-update";
  return "reload";
}

/**
 * Whether a successful IR recompile may broadcast a WS reload class.
 * Older watch epochs must not clobber a newer success.
 */
export function shouldBroadcastWatchSuccess(
  publishEpoch: number,
  currentEpoch: number,
): boolean {
  return publishEpoch === currentEpoch;
}

/**
 * Whether a failed IR recompile may broadcast `compile-error`.
 * - `stale_generation` is concurrent supersede — never mark Studio stale.
 * - Late failures from older watch epochs are ignored.
 */
export function shouldBroadcastCompileError(
  err: unknown,
  publishEpoch: number,
  currentEpoch: number,
): boolean {
  if (isStaleGenerationError(err)) return false;
  if (publishEpoch !== currentEpoch) return false;
  return true;
}
