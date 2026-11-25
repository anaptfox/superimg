//! Shared comparison failure policy, independent of terminal exit codes.
import type { MediaIRDiff } from "@superimg/types";

export type MediaDiffFailOn =
  | "any"
  | "timing"
  | "content"
  | "motion"
  | "assets"
  | "opaque"
  | "none";

export function shouldFailMediaDiff(diff: MediaIRDiff, failOn: MediaDiffFailOn): boolean {
  if (failOn === "none") return false;
  if (failOn === "any") return diff.result === "mediaAffecting";
  const map: Record<string, string[]> = {
    timing: ["duration", "fps", "phase", "scene", "canvas"],
    content: ["semantic", "track", "render-config", "intent", "opaque-markup"],
    motion: ["motion"],
    assets: ["asset", "audio", "marker", "track"],
    opaque: ["opaque-markup"],
  };
  const cats = map[failOn] ?? [];
  return diff.changes.some((c) => cats.includes(c.category));
}
