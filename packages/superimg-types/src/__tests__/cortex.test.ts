import { describe, expect, it } from "vitest";
import { CortexBundleError, parseCortexBundle } from "../cortex.js";

describe("parseCortexBundle", () => {
  it("accepts a launch-shaped bundle and freezes it", () => {
    const bundle = parseCortexBundle({
      brief: {
        question: "How did yesterday's launch go?",
        intent: "decision_support",
        audience: "owner",
        emphasis: ["failures"],
      },
      atoms: [
        { kind: "event", at: "10:05", label: "LAUNCH" },
        { kind: "metric", label: "traffic", value: 430, unit: "%" },
      ],
      evidence: [{ id: "sentry-812", source: "sentry", label: "Sentry #812" }],
    });
    expect(bundle.brief.intent).toBe("decision_support");
    expect(bundle.atoms).toHaveLength(2);
    expect(Object.isFrozen(bundle)).toBe(true);
  });

  it("rejects a duck-typed object without brief and atoms", () => {
    expect(() => parseCortexBundle({ hello: true })).toThrow(CortexBundleError);
    expect(() => parseCortexBundle({ hello: true })).toThrow(/Unknown field 'hello'/);
  });

  it("rejects unknown editorial intent", () => {
    expect(() =>
      parseCortexBundle({
        brief: { question: "ok?", intent: "vibes", audience: "owner" },
        atoms: [],
      }),
    ).toThrow(/brief.intent/);
  });

  it("rejects an unknown atom kind", () => {
    expect(() =>
      parseCortexBundle({
        brief: { question: "ok?", intent: "status", audience: "owner" },
        atoms: [{ kind: "chart" }],
      }),
    ).toThrow(/atoms.0.kind/);
  });
});
