import { describe, expect, it } from "vitest";
import type { CortexBundle, EditorialBrief } from "@superimg/types";
import { matchCortexView } from "./match.js";

const ownerStatus: EditorialBrief = {
  question: "How are we doing?",
  intent: "status",
  audience: "owner",
};

const launchBrief: EditorialBrief = {
  question: "How did yesterday's launch go?",
  intent: "decision_support",
  audience: "owner",
  emphasis: ["unexpected outcomes", "failures"],
};

function bundle(partial: Partial<CortexBundle> & Pick<CortexBundle, "atoms">): CortexBundle {
  return {
    brief: partial.brief ?? ownerStatus,
    atoms: partial.atoms,
    ...(partial.custom !== undefined ? { custom: partial.custom } : {}),
    ...(partial.evidence !== undefined ? { evidence: partial.evidence } : {}),
  };
}

describe("matchCortexView", () => {
  it("selects event-story for a launch-shaped decision bundle", () => {
    const result = matchCortexView(
      bundle({
        brief: launchBrief,
        atoms: [
          { kind: "event", at: "2026-09-04T10:05:00Z", label: "LAUNCH" },
          { kind: "metric", label: "traffic", value: 430, unit: "%" },
          { kind: "event", at: "2026-09-04T14:22:00Z", label: "hotfix" },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true, viewId: "event-story" });
  });

  it("selects daily-project-report for metrics without events", () => {
    const result = matchCortexView(
      bundle({
        atoms: [
          { kind: "metric", label: "users", value: 512 },
          { kind: "metric", label: "revenue", value: 1640, unit: "USD" },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true, viewId: "daily-project-report" });
  });

  it("misses opaque custom data with no atoms", () => {
    const result = matchCortexView(
      bundle({
        atoms: [],
        custom: { kind: "fox.superimg.render-benchmark/v2", data: { ms: 12 } },
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "NO_VIEW" });
    if (!result.ok) expect(result.reason).toContain("fox.superimg.render-benchmark/v2");
  });

  it("does not select event-story for a single event", () => {
    const result = matchCortexView(
      bundle({
        brief: launchBrief,
        atoms: [{ kind: "event", at: "10:05", label: "LAUNCH" }],
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "NO_VIEW" });
  });

  it("honors a pinned stock view", () => {
    const result = matchCortexView(
      bundle({
        brief: launchBrief,
        atoms: [{ kind: "event", label: "LAUNCH" }],
      }),
      { viewId: "daily-project-report" },
    );
    expect(result).toMatchObject({
      ok: true,
      viewId: "daily-project-report",
      reason: "Pinned view 'daily-project-report'",
    });
  });

  it("rejects an unknown pinned view instead of guessing", () => {
    const result = matchCortexView(
      bundle({ atoms: [{ kind: "metric", label: "users", value: 1 }] }),
      { viewId: "sankey-of-feelings" },
    );
    expect(result).toMatchObject({ ok: false, code: "NO_VIEW" });
  });
});
