//! Deterministic stock-view matcher. No LLM. Bot may pin viewId.

import {
  atomKinds,
  isCortexStockViewId,
  type CortexBundle,
  type CortexStockViewId,
} from "@superimg/types";

export type CortexMatch =
  | {
      readonly ok: true;
      readonly viewId: CortexStockViewId;
      readonly reason: string;
    }
  | {
      readonly ok: false;
      readonly code: "NO_VIEW";
      readonly reason: string;
    };

export function matchCortexView(
  bundle: CortexBundle,
  options: { viewId?: string } = {},
): CortexMatch {
  const pinned = options.viewId;
  if (pinned !== undefined) {
    if (!isCortexStockViewId(pinned)) {
      return {
        ok: false,
        code: "NO_VIEW",
        reason: `Unknown view '${pinned}'`,
      };
    }
    return {
      ok: true,
      viewId: pinned,
      reason: `Pinned view '${pinned}'`,
    };
  }

  const kinds = atomKinds(bundle);
  const eventCount = bundle.atoms.filter((atom) => atom.kind === "event").length;
  const hasMetrics = kinds.has("metric") || kinds.has("series") || kinds.has("status");
  const storyIntent =
    bundle.brief.intent === "decision_support" || bundle.brief.intent === "explanation";

  // event-story is alignedIntervals. A single event has no duration to align.
  if (eventCount >= 2 && (storyIntent || hasMetrics)) {
    return {
      ok: true,
      viewId: "event-story",
      reason: "alignedIntervals over two or more events on one clock",
    };
  }

  if (hasMetrics) {
    return {
      ok: true,
      viewId: "daily-project-report",
      reason: "valueAgainstReference over named metrics",
    };
  }

  if (bundle.custom !== undefined && bundle.atoms.length === 0) {
    return {
      ok: false,
      code: "NO_VIEW",
      reason: `Opaque custom kind '${bundle.custom.kind}' has no matching program`,
    };
  }

  return {
    ok: false,
    code: "NO_VIEW",
    reason: "No stock view for this atom set; compose or author a program",
  };
}
