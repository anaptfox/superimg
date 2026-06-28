import { describe, it, expect } from "vitest";
import { carousel, type CarouselOpts } from "./carousel.js";
import {
  assertIn01,
  assertMonotonic,
  carouselSchedule,
  linspace,
  slideOpacity,
} from "./__test-utils__/choreography.js";

const THREAD_OPTS: CarouselOpts = {
  during: 0,
  enter: 0.3,
  exit: 0.25,
  lead: 0.05,
  trail: 0.05,
};

function sweep(count: number, opts: Omit<CarouselOpts, "during">, steps = 51) {
  return linspace(0, 1, steps).map((during) => ({
    during,
    states: Array.from({ length: count }, (_, i) =>
      carousel(Array.from({ length: count }, (_, j) => j), { ...opts, during }).state(i),
    ),
  }));
}

describe("carousel — spot checks", () => {
  it("shows one item at a time and marks prior items gone", () => {
    const c = carousel([1, 2, 3], { during: 0.38, exit: 0.15, last: "exit" });
    expect(c.state(0).state).toBe("gone");
    expect(c.state(1).state).toBe("entering");
    expect(c.state(2).state).toBe("hidden");
  });

  it("holds last item when last is hold", () => {
    const c = carousel([1, 2, 3], { during: 0.95, last: "hold" });
    expect(c.state(2).state).toBe("hold");
    expect(c.state(2).visible).toBe(true);
  });

  it("overlaps exit with next enter", () => {
    const c = carousel([1, 2, 3], { during: 0.32, exit: 0.2, lead: 0.05, trail: 0.05 });
    expect(c.state(0).state).toBe("exiting");
    expect(c.state(1).state).toBe("entering");
    expect(c.state(0).exit).toBeGreaterThan(0);
    expect(c.state(1).enter).toBeGreaterThan(0);
  });

  it("exits with enter=1 and exit 0→1", () => {
    const c = carousel([1], { during: 0.9, exit: 0.2, lead: 0.05, trail: 0.05, last: "exit" });
    const s = c.state(0);
    expect(s.state).toBe("exiting");
    expect(s.enter).toBe(1);
    expect(s.exit).toBeGreaterThan(0);
    expect(s.exit).toBeLessThanOrEqual(1);
  });
});

describe("carousel — sweep invariants", () => {
  const configs: Array<{ name: string; count: number; opts: Omit<CarouselOpts, "during"> }> = [
    { name: "default", count: 3, opts: { last: "exit" } },
    { name: "thread-like", count: 3, opts: { ...THREAD_OPTS, last: "hold" } },
  ];

  for (const { name, count, opts } of configs) {
    describe(name, () => {
      const samples = sweep(count, opts);

      it("keeps enter and exit in [0, 1]", () => {
        for (const { states } of samples) {
          for (const s of states) {
            assertIn01(s.enter, `enter@${s.index}`);
            assertIn01(s.exit, `exit@${s.index}`);
            if (!["exiting", "gone"].includes(s.state)) expect(s.exit).toBe(0);
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

      it("exit increases monotonically during exiting", () => {
        for (let i = 0; i < count; i++) {
          const exits = samples
            .map((s) => s.states[i]!)
            .filter((s) => s.state === "exiting")
            .map((s) => s.exit);
          if (exits.length > 1) assertMonotonic(exits, "asc", `item${i}.exit`);
        }
      });

      it("hold→exit is continuous (enter=1, exit starts at 0)", () => {
        for (let i = 0; i < count; i++) {
          const series = samples.map((s) => s.states[i]!);
          for (let j = 1; j < series.length; j++) {
            const prev = series[j - 1]!;
            const curr = series[j]!;
            if (prev.state === "hold" && curr.state === "exiting") {
              expect(prev.enter).toBe(1);
              expect(curr.enter).toBe(1);
              expect(curr.exit).toBeLessThan(0.05);
              expect(slideOpacity(prev.state, prev.enter, prev.exit)).toBeCloseTo(
                slideOpacity(curr.state, curr.enter, curr.exit),
                1,
              );
            }
          }
        }
      });

      it("crossfades: exiting item has a visible successor", () => {
        for (const { states } of samples) {
          for (let i = 0; i < count - 1; i++) {
            if (states[i]!.state !== "exiting") continue;
            const next = states[i + 1]!;
            expect(["entering", "hold"]).toContain(next.state);
            expect(next.state).not.toBe("hidden");
          }
        }
      });

      it("has at least one active item during content span", () => {
        const sched = carouselSchedule(count, opts);
        const { contentStart } = sched(0);
        const lastEnd = sched(count - 1).itemEnd;
        for (const { during, states } of samples) {
          if (during < contentStart || during >= lastEnd) continue;
          const active = states.filter((s) => s.active);
          expect(active.length).toBeGreaterThanOrEqual(1);
        }
      });

      it("slide opacity decreases monotonically during exit (regression)", () => {
        for (let i = 0; i < count; i++) {
          const opacities = samples
            .map((s) => s.states[i]!)
            .filter((s) => s.state === "exiting")
            .map((s) => slideOpacity(s.state, s.enter, s.exit));
          if (opacities.length > 1) assertMonotonic(opacities, "desc", `item${i}.slideOpacity`);
        }
      });


    });
  }
});

describe("carousel — boundary frames", () => {
  it("hits itemStart, enterEnd, exitStart, itemEnd for item 0", () => {
    const count = 3;
    const opts = { exit: 0.2, lead: 0.05, trail: 0.05, last: "exit" as const };
    const sched = carouselSchedule(count, opts);
    const { itemStart, enterEnd, exitStart, itemEnd } = sched(0);

    const atStart = carousel([0, 1, 2], { ...opts, during: itemStart }).state(0);
    expect(atStart.state).toBe("entering");
    expect(atStart.enter).toBeCloseTo(0, 5);

    const atEnterEnd = carousel([0, 1, 2], { ...opts, during: enterEnd }).state(0);
    expect(atEnterEnd.state).toBe("hold");
    expect(atEnterEnd.enter).toBe(1);

    const atExitStart = carousel([0, 1, 2], { ...opts, during: exitStart }).state(0);
    expect(atExitStart.state).toBe("exiting");
    expect(atExitStart.exit).toBeCloseTo(0, 5);

    const beforeEnd = carousel([0, 1, 2], { ...opts, during: itemEnd - 1e-6 }).state(0);
    expect(beforeEnd.state).toBe("exiting");

    const atEnd = carousel([0, 1, 2], { ...opts, during: itemEnd }).state(0);
    expect(atEnd.state).toBe("gone");
  });
});

describe("carousel — edge cases", () => {
  it("returns hidden for out-of-range index", () => {
    const c = carousel(["a"], { during: 0.5 });
    expect(c.state(-1).state).toBe("hidden");
    expect(c.state(1).state).toBe("hidden");
  });

  it("handles empty items", () => {
    const c = carousel([], { during: 0.5 });
    expect(c.count).toBe(0);
    expect(c.state(0).state).toBe("hidden");
  });

  it("clamps during above 1", () => {
    const c = carousel([1], { during: 1.5, last: "hold" });
    expect(c.state(0).visible).toBe(true);
  });

  it("each() invokes callback for every item", () => {
    const seen: number[] = [];
    carousel(["a", "b"], { during: 0.5 }).each((_, __, i) => seen.push(i));
    expect(seen).toEqual([0, 1]);
  });
});