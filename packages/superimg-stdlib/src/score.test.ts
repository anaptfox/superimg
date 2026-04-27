import { describe, expect, it } from "vitest";
import { createScore } from "./score.js";

function s(sp: number, phases?: Record<string, number>) {
  return createScore({ sceneProgress: sp, sceneTimeSeconds: sp * 10 }, phases);
}

describe("score — phase normalization", () => {
  it("validates fractions sum <= 1", () => {
    expect(() => s(0, { a: 0.6, b: 0.6 })).toThrow(/must sum to <= 1/);
  });

  it("rejects zero or negative fractions", () => {
    expect(() => s(0, { a: 0, b: 1 })).toThrow(/must be > 0/);
    expect(() => s(0, { a: -0.1, b: 0.9 })).toThrow(/must be > 0/);
  });

  it("rejects empty layouts", () => {
    expect(() => s(0, {})).toThrow(/at least one phase/);
  });

  it("accepts custom phase names", () => {
    const t = s(0.5, { intro: 0.2, reveal: 0.5, outro: 0.3 });
    expect(t.active).toBe("reveal");
    expect(t.within("reveal")).toBeCloseTo(0.6, 5);
  });
});

describe("score — probes", () => {
  it("exposes progress and seconds", () => {
    const t = s(0.3);
    expect(t.progress).toBe(0.3);
    expect(t.seconds).toBeCloseTo(3, 5);
  });

  it("computes active phase", () => {
    const t = s(0.1);
    expect(t.active).toBe("enter");
    expect(s(0.5).active).toBe("hold");
    expect(s(0.9).active).toBe("exit");
  });

  it("returns 'idle' in the silent remainder", () => {
    const t = s(0.6, { enter: 0.1, hold: 0.4 });
    expect(t.active).toBe("idle");
  });

  it("snaps to last phase at sp=1", () => {
    expect(s(1).active).toBe("exit");
  });

  it("within() maps 0..1 inside a phase", () => {
    const t = s(0.075, { enter: 0.15, hold: 0.7, exit: 0.15 });
    expect(t.within("enter")).toBeCloseTo(0.5, 5);
    expect(t.within("hold")).toBe(0);
    expect(t.within("exit")).toBe(0);
  });

  it("within() throws on unknown phase", () => {
    const t = s(0.5);
    expect(() => t.within("bogus" as never)).toThrow(/unknown phase/i);
  });
});

describe("score — motion enter/exit", () => {
  it("opacity 0 at sp=0 (fully entering)", () => {
    const t = s(0);
    const m = t.motion();
    expect(m.opacity).toBeCloseTo(0, 5);
    expect(m.enter).toBeCloseTo(0, 5);
    expect(m.exit).toBe(0);
    expect(m.visible).toBe(false);
    expect(m.phase).toBe("before");
  });

  it("opacity 1 at steady state (mid hold)", () => {
    const t = s(0.5);
    const m = t.motion();
    expect(m.opacity).toBeCloseTo(1, 3);
    expect(m.enter).toBe(1);
    expect(m.exit).toBe(0);
    expect(m.phase).toBe("steady");
  });

  it("opacity ~0 at sp=1 (fully exited)", () => {
    const t = s(1);
    const m = t.motion();
    expect(m.opacity).toBeCloseTo(0, 3);
    expect(m.exit).toBe(1);
    expect(m.phase).toBe("after");
  });

  it("exit=false holds through the exit phase", () => {
    const t = s(1);
    const m = t.motion({ exit: false });
    expect(m.opacity).toBeCloseTo(1, 3);
    expect(m.exit).toBe(0);
    expect(m.phase).toBe("steady");
  });

  it("honours the `during` phase", () => {
    const before = s(0.1).motion({ during: "hold" });
    const inside = s(0.5).motion({ during: "hold" });
    expect(before.enter).toBeCloseTo(0, 5);
    expect(inside.enter).toBeGreaterThan(0.3);
  });

  it("`at` staggers the enter window", () => {
    const phases = { enter: 0.2, hold: 0.6, exit: 0.2 };
    const early = s(0.1, phases).motion({ y: 20, at: 0 });
    const late = s(0.1, phases).motion({ y: 20, at: 0.8 });
    // Same sp; stagger pushes the late item's enter to later → less entered
    expect(early.enter).toBeGreaterThan(late.enter);
  });

  it("`window` overrides phase-based timing for enter", () => {
    const t = s(0.5);
    const m = t.motion({ window: [0, 1] });
    // With window = [0, 1], at sp=0.5 enter should be ~0.5 (cubic easing)
    expect(m.enter).toBeGreaterThan(0.4);
    expect(m.enter).toBeLessThan(1);
  });

  it("exit pose defaults to mirror of enter start", () => {
    const t = s(1);
    const m = t.motion({ y: 30 });
    // Fully exited: pose should be at (-30) — mirror of +30 start
    expect(m.transform).toContain("translateY(-30px)");
  });

  it("exit pose can be overridden per axis", () => {
    const t = s(1);
    const m = t.motion({ y: 30, exit: { y: -80 } });
    expect(m.transform).toContain("translateY(-80px)");
  });

  it("no exit when the layout has a single phase", () => {
    const t = s(1, { all: 1 });
    const m = t.motion();
    expect(m.exit).toBe(0);
    expect(m.opacity).toBeCloseTo(1, 3);
  });

  it("builds a ready-to-use style string with opacity + transform", () => {
    const t = s(0.5);
    const m = t.motion({ y: 20 });
    expect(m.style).toMatch(/opacity:/);
    // Steady state has no transform offset
    expect(m.transform).toBe("");
  });

  it("custom easing function works", () => {
    const t = s(0.1);
    const linear = t.motion({ easing: (x) => x });
    const ease = t.motion({ easing: "easeOutCubic" });
    expect(ease.enter).toBeGreaterThan(linear.enter);
  });

  it("spring(stiffness,damping) easing parses", () => {
    const t = s(0.5);
    const m = t.motion({ easing: "spring(200,20)" });
    expect(m.enter).toBeGreaterThan(0);
    expect(m.enter).toBeLessThanOrEqual(1);
  });

  it("named spring easing works", () => {
    const t = s(0.5);
    const m = t.motion({ easing: "spring" });
    expect(m.enter).toBeGreaterThan(0);
  });

  it("rejects unknown easing names", () => {
    expect(() => s(0.5).motion({ easing: "bogus" as never })).toThrow();
  });
});

describe("score — tween", () => {
  it("scopes scalar interpolation to a phase", () => {
    const phases = { enter: 0.2, hold: 0.6, exit: 0.2 };
    expect(s(0, phases).tween(0, 100, { during: "enter" })).toBeCloseTo(0, 5);
    expect(
      s(0.2, phases).tween(0, 100, { during: "enter" }),
    ).toBeCloseTo(100, 5);
    expect(
      s(0.1, phases).tween(0, 100, { during: "enter" }),
    ).toBeGreaterThan(50); // easeOutCubic at halfway
  });

  it("respects `at` offset inside the phase", () => {
    const early = s(0.05, { enter: 0.2, hold: 0.8 }).tween(0, 1, {
      during: "enter",
      at: 0,
    });
    const late = s(0.05, { enter: 0.2, hold: 0.8 }).tween(0, 1, {
      during: "enter",
      at: 0.8,
    });
    expect(early).toBeGreaterThan(late);
  });

  it("linear pattern", () => {
    const v = s(0.1, { enter: 0.2, hold: 0.8 }).tween(0, 100, {
      during: "enter",
      pattern: "linear",
    });
    expect(v).toBeCloseTo(50, 3);
  });

  it("sine pattern peaks at midpoint", () => {
    const phases = { enter: 0.2, hold: 0.8 };
    const mid = s(0.1, phases).tween(0, 100, { during: "enter", pattern: "sine" });
    expect(mid).toBeCloseTo(100, 3);
    const early = s(0.01, phases).tween(0, 100, { during: "enter", pattern: "sine" });
    expect(early).toBeLessThan(mid);
  });
});

describe("score — value", () => {
  it("passes through the value unchanged", () => {
    const t = s(0.5);
    const v = t.value(42, {});
    expect(v.current).toBe(42);
    expect(v.opacity).toBe(1);
  });

  it("fades opacity during fadeOn phase", () => {
    const phases = { enter: 0.1, hold: 0.8, exit: 0.1 };
    const before = s(0.5, phases).value(0.7, { fadeOn: "exit" });
    const mid = s(0.95, phases).value(0.7, { fadeOn: "exit" });
    expect(before.opacity).toBe(1);
    expect(mid.opacity).toBeCloseTo(0.5, 1);
  });

  it("restricts visibility to `during` phases", () => {
    const phases = { a: 0.3, b: 0.4, c: 0.3 };
    const inA = s(0.1, phases).value("x", { during: "b" });
    const inB = s(0.5, phases).value("x", { during: "b" });
    expect(inA.opacity).toBe(0);
    expect(inB.opacity).toBe(1);
  });

  it("accepts array of phases for fadeOn / during", () => {
    const phases = { a: 0.3, b: 0.4, c: 0.3 };
    const inA = s(0.1, phases).value("x", { during: ["a", "b"] });
    const inC = s(0.8, phases).value("x", { during: ["a", "b"] });
    expect(inA.opacity).toBe(1);
    expect(inC.opacity).toBe(0);
  });
});

describe("score — real migration samples", () => {
  it("stats-card pattern: y motion with stagger in enter", () => {
    const t = s(0.03, { enter: 0.3, hold: 0.45, exit: 0.25 });
    const value = t.motion({ y: 15, at: 0.15 });
    // sp 0.03 < (0.3 × 0.15 = 0.045), still before the staggered start → near-zero enter
    expect(value.enter).toBeLessThan(0.05);
  });

  it("speaker window pattern: window timing", () => {
    const t = s(0.04, { enter: 0.08, hold: 0.83, exit: 0.09 });
    const photo = t.motion({ window: [0, 0.08] });
    expect(photo.enter).toBeGreaterThan(0.1);
    expect(photo.exit).toBe(0);
  });

  it("list stagger: 5-item iteration via at = i/n", () => {
    const t = s(0.05, { enter: 0.2, hold: 0.6, exit: 0.2 });
    const opacities = [0, 1, 2, 3, 4].map((i) =>
      t.motion({ at: i / 5, easing: "easeOutElastic" }).opacity,
    );
    // Items with smaller `at` are more entered
    for (let i = 0; i < opacities.length - 1; i++) {
      expect(opacities[i]!).toBeGreaterThanOrEqual(opacities[i + 1]!);
    }
  });
});
