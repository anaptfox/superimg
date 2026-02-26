import { describe, it, expect } from "vitest";
import {
  createPhaseManager,
  getPhase,
  phaseProgress,
  type Phases,
} from "./timing.js";

describe("createPhaseManager / PhaseManager.get", () => {
  const phases: Phases = {
    intro: { start: 0, end: 1.0 },
    bars: { start: 1.0, end: 5.5 },
    highlight: { start: 5.5, end: 7.0 },
  };

  it("returns first phase at time 0", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(0);
    expect(result.name).toBe("intro");
    expect(result.progress).toBe(0);
  });

  it("returns intro phase with progress during phase", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(0.5);
    expect(result.name).toBe("intro");
    expect(result.progress).toBe(0.5);
  });

  it("returns bars at exact boundary (phases are [start, end))", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(1.0);
    expect(result.name).toBe("bars");
    expect(result.progress).toBeCloseTo(0, 5);
  });

  it("returns intro just before bars boundary", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(0.999);
    expect(result.name).toBe("intro");
    expect(result.progress).toBeGreaterThan(0.99);
  });

  it("returns bars phase with progress during phase", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(3.25);
    expect(result.name).toBe("bars");
    expect(result.progress).toBeCloseTo(0.5, 5); // (3.25 - 1) / 4.5 = 0.5
  });

  it("returns highlight phase at end", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(7.0);
    expect(result.name).toBe("highlight");
    expect(result.progress).toBe(1);
  });

  it("returns last phase at progress 1 when time exceeds all phases", () => {
    const pm = createPhaseManager(phases);
    const result = pm.get(10);
    expect(result.name).toBe("highlight");
    expect(result.progress).toBe(1);
  });

  it("returns first phase at progress 0 when time is before first phase", () => {
    const pm = createPhaseManager({ later: { start: 5, end: 10 } });
    const result = pm.get(0);
    expect(result.name).toBe("later");
    expect(result.progress).toBe(0);
  });

  it("handles single phase", () => {
    const pm = createPhaseManager({ only: { start: 0, end: 1 } });
    expect(pm.get(0).name).toBe("only");
    expect(pm.get(0.5).name).toBe("only");
    expect(pm.get(0.5).progress).toBe(0.5);
    expect(pm.get(1).name).toBe("only");
    expect(pm.get(1).progress).toBe(1);
  });

  it("handles zero-duration phase", () => {
    const pm = createPhaseManager({ instant: { start: 1, end: 1 } });
    const result = pm.get(1);
    expect(result.name).toBe("instant");
    expect(result.progress).toBe(1);
  });

  it("returns unknown when no phases defined", () => {
    const pm = createPhaseManager({});
    const result = pm.get(0);
    expect(result.name).toBe("unknown");
    expect(result.progress).toBe(0);
  });
});

describe("getPhasePhaseProgress", () => {
  const phases: Phases = {
    intro: { start: 0, end: 1.0 },
    bars: { start: 1.0, end: 5.5 },
  };

  it("returns 0 before phase starts", () => {
    const pm = createPhaseManager(phases);
    expect(pm.getPhaseProgress(0, "bars")).toBe(0);
    expect(pm.getPhaseProgress(0.5, "bars")).toBe(0);
  });

  it("returns progress during phase", () => {
    const pm = createPhaseManager(phases);
    expect(pm.getPhaseProgress(0.5, "intro")).toBe(0.5);
    expect(pm.getPhaseProgress(3.25, "bars")).toBeCloseTo(0.5, 5);
  });

  it("returns 1 after phase ends", () => {
    const pm = createPhaseManager(phases);
    expect(pm.getPhaseProgress(1.0, "intro")).toBe(1);
    expect(pm.getPhaseProgress(2.0, "intro")).toBe(1);
  });

  it("returns 0 for unknown phase", () => {
    const pm = createPhaseManager(phases);
    expect(pm.getPhaseProgress(0.5, "nonexistent")).toBe(0);
  });
});

describe("getPhase", () => {
  const phases: Phases = {
    intro: { start: 0, end: 1.0 },
    bars: { start: 1.0, end: 5.5 },
  };

  it("returns correct phase at given time", () => {
    expect(getPhase(0, phases).name).toBe("intro");
    expect(getPhase(0.5, phases).name).toBe("intro");
    expect(getPhase(0.5, phases).progress).toBe(0.5);
    expect(getPhase(2.0, phases).name).toBe("bars");
    expect(getPhase(2.0, phases).progress).toBeCloseTo(2 / 9, 5);
  });
});

describe("phaseProgress", () => {
  const phases: Phases = {
    intro: { start: 0, end: 1.0 },
    bars: { start: 1.0, end: 5.5 },
  };

  it("returns progress for specific phase", () => {
    expect(phaseProgress(0.5, "intro", phases)).toBe(0.5);
    expect(phaseProgress(3.25, "bars", phases)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for unknown phase", () => {
    expect(phaseProgress(0.5, "unknown", phases)).toBe(0);
  });
});
