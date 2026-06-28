import { describe, it, expect } from "vitest";
import { stack, type StackOpts } from "./stack.js";
import {
  assertIn01,
  assertMonotonic,
  linspace,
  stackSchedule,
} from "./__test-utils__/choreography.js";

function sweep(count: number, opts: Omit<StackOpts, "during">, steps = 51) {
  return linspace(0, 1, steps).map((during) => ({
    during,
    states: Array.from({ length: count }, (_, i) =>
      stack(Array.from({ length: count }, (_, j) => j), { ...opts, during }).state(i),
    ),
  }));
}

describe("stack — spot checks", () => {
  it("accumulates revealed items", () => {
    const s = stack(["a", "b", "c"], { during: 0.42, lead: 0.02, trail: 0.02 });
    expect(s.state(0).state).toBe("revealed");
    expect(s.state(0).visible).toBe(true);
    expect(s.state(1).state).toBe("entering");
    expect(s.state(2).state).toBe("hidden");
  });

  it("exposes slot progress within item window", () => {
    const s = stack(["a"], { during: 0.3, lead: 0, trail: 0, enter: 0.5 });
    expect(s.state(0).slot).toBeGreaterThan(0);
    expect(s.state(0).slot).toBeLessThanOrEqual(1);
  });
});

describe("stack — sweep invariants", () => {
  const count = 4;
  const opts = { lead: 0.02, trail: 0.02, enter: 0.35 };
  const samples = sweep(count, opts);

  it("keeps enter and slot in [0, 1]", () => {
    for (const { states } of samples) {
      for (const s of states) {
        assertIn01(s.enter, `enter@${s.index}`);
        assertIn01(s.slot, `slot@${s.index}`);
      }
    }
  });

  it("hidden items are isolated", () => {
    for (const { states } of samples) {
      for (const s of states.filter((x) => x.state === "hidden")) {
        expect(s.enter).toBe(0);
        expect(s.slot).toBe(0);
        expect(s.visible).toBe(false);
        expect(s.active).toBe(false);
      }
    }
  });

  it("enter increases monotonically during entering", () => {
    for (let i = 0; i < count; i++) {
      const enters = samples
        .map((s) => s.states[i]!)
        .filter((s) => s.state === "entering")
        .map((s) => s.enter);
      if (enters.length > 1) assertMonotonic(enters, "asc", `item${i}.enter`);
    }
  });

  it("slot increases monotonically within each item window", () => {
    for (let i = 0; i < count; i++) {
      const sched = stackSchedule(count, opts);
      const { itemStart, itemEnd } = sched(i);
      const slots = samples
        .filter((s) => s.during >= itemStart && s.during <= itemEnd)
        .map((s) => s.states[i]!.slot);
      if (slots.length > 1) assertMonotonic(slots, "asc", `item${i}.slot`);
    }
  });

  it("accumulates: revealed items stay revealed as during increases", () => {
    for (let i = 0; i < count; i++) {
      const series = samples.map((s) => s.states[i]!);
      let seenRevealed = false;
      for (const s of series) {
        if (s.state === "revealed") seenRevealed = true;
        if (seenRevealed) expect(s.state).toBe("revealed");
      }
    }
  });

  it("enter reaches 1 after enter phase and stays 1", () => {
    for (let i = 0; i < count; i++) {
      const sched = stackSchedule(count, opts);
      const { enterEnd } = sched(i);
      const afterEnter = samples
        .filter((s) => s.during >= enterEnd)
        .map((s) => s.states[i]!);
      for (const s of afterEnter) {
        if (s.state !== "hidden") expect(s.enter).toBe(1);
      }
    }
  });

  it("slot continues advancing during revealed (sub-beat headroom)", () => {
    for (let i = 0; i < count; i++) {
      const sched = stackSchedule(count, opts);
      const { enterEnd, itemEnd } = sched(i);
      const mid = enterEnd + (itemEnd - enterEnd) * 0.5;
      const early = stack(Array.from({ length: count }), { ...opts, during: enterEnd + 1e-4 }).state(i);
      const later = stack(Array.from({ length: count }), { ...opts, during: mid }).state(i);
      if (early.state === "revealed" && later.state === "revealed") {
        expect(later.slot).toBeGreaterThan(early.slot);
      }
    }
  });

  it("at most one entering item at any time", () => {
    for (const { states } of samples) {
      const entering = states.filter((s) => s.state === "entering");
      expect(entering.length).toBeLessThanOrEqual(1);
    }
  });

  it("prefix revealed: earlier indices revealed before later ones enter", () => {
    for (const { states } of samples) {
      let seenEntering = false;
      for (const s of states) {
        if (s.state === "entering") seenEntering = true;
        if (seenEntering && s.state === "revealed") {
          expect(s.index).toBeLessThan(states.find((x) => x.state === "entering")?.index ?? count);
        }
      }
    }
  });
});

describe("stack — boundary frames", () => {
  it("hits itemStart, enterEnd, itemEnd for item 1", () => {
    const count = 3;
    const opts = { lead: 0.02, trail: 0.02, enter: 0.35 };
    const sched = stackSchedule(count, opts);
    const { itemStart, enterEnd, itemEnd } = sched(1);

    const atStart = stack([0, 1, 2], { ...opts, during: itemStart }).state(1);
    expect(atStart.state).toBe("entering");
    expect(atStart.enter).toBeCloseTo(0, 5);

    const atEnterEnd = stack([0, 1, 2], { ...opts, during: enterEnd }).state(1);
    expect(atEnterEnd.state).toBe("revealed");
    expect(atEnterEnd.enter).toBe(1);

    const atEnd = stack([0, 1, 2], { ...opts, during: itemEnd - 1e-6 }).state(1);
    expect(atEnd.state).toBe("revealed");
    expect(atEnd.slot).toBeCloseTo(1, 2);
  });
});

describe("stack — edge cases", () => {
  it("returns hidden for out-of-range index", () => {
    const s = stack(["a"], { during: 0.5 });
    expect(s.state(-1).state).toBe("hidden");
    expect(s.state(1).state).toBe("hidden");
  });

  it("handles empty items", () => {
    const s = stack([], { during: 0.5 });
    expect(s.count).toBe(0);
  });

  it("each() invokes callback for every item", () => {
    const seen: number[] = [];
    stack(["a", "b"], { during: 0.5 }).each((_, __, i) => seen.push(i));
    expect(seen).toEqual([0, 1]);
  });
});