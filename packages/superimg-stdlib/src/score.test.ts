import { describe, expect, it } from "vitest";
import { createScore, mergeMotion } from "./score.js";

/** Helper: create a timeline at scene progress sp, with 10s total duration. */
function s(sp: number, phases?: Record<string, string>) {
  return createScore(
    { sceneProgress: sp, sceneTimeSeconds: sp * 10, sceneDurationSeconds: 10 },
    phases,
  );
}

describe("score — phase normalization", () => {
  it("rejects phases that sum past 100%", () => {
    expect(() => s(0, { a: "60%", b: "60%" })).toThrow(/exceeds 100%/);
  });

  it("rejects zero or negative durations", () => {
    expect(() => s(0, { a: "-1s" })).toThrow(/invalid phase/);
    expect(() => s(0, { a: "0s" })).toThrow(/invalid phase/);
  });

  it("rejects empty layouts", () => {
    expect(() => s(0, {})).toThrow(/at least one phase/);
  });

  it("rejects strings without a valid unit", () => {
    expect(() => s(0, { a: "foo" })).toThrow(/must end with/);
  });

  it("accepts custom phase names", () => {
    const t = s(0.5, { intro: "20%", reveal: "50%", outro: "30%" });
    expect(t.active).toBe("reveal");
    expect(t.within("reveal")).toBeCloseTo(0.6, 5);
  });

  it("`within(phase, { duration })` maps a sub-window to 0-1", () => {
    const t = s(0.05, { intro: "2s", hold: "6s", exit: "2s" });
    const p = t.within("intro", { duration: 0.5 });
    expect(p).toBeCloseTo(0.5, 5);
  });

  it("`within(phase, { at, duration })` delays the sub-window", () => {
    const t = s(0.1, { intro: "2s", hold: "6s", exit: "2s" });
    expect(t.within("intro", { at: 0.5, duration: 0.5 })).toBe(0);
    const t2 = s(0.15, { intro: "2s", hold: "6s", exit: "2s" });
    expect(t2.within("intro", { at: 0.5, duration: 0.5 })).toBeCloseTo(0.5, 5);
  });

  it("`span(from, to)` maps scene-absolute seconds to 0-1", () => {
    const t = s(0.05, { all: "100%" });
    expect(t.span("0s", "1s")).toBeCloseTo(0.5, 5);
    expect(s(0, { all: "100%" }).span("0s", "1s")).toBe(0);
    expect(s(0.1, { all: "100%" }).span("0s", "1s")).toBe(1);
  });

  it("`transition(from, to, easing)` eases span progress", () => {
    const t = s(0.05, { all: "100%" });
    const raw = t.span("0s", "1s");
    const eased = t.transition("0s", "1s", "easeOutCubic");
    expect(eased).toBeGreaterThan(raw);
    expect(t.transition("0s", "1s")).toBeCloseTo(raw, 5);
  });

  it("`inSpan(from, to)` is true only inside the window", () => {
    expect(s(0, { all: "100%" }).inSpan("0s", "1s")).toBe(false);
    expect(s(0.05, { all: "100%" }).inSpan("0s", "1s")).toBe(true);
    expect(s(0.1, { all: "100%" }).inSpan("0s", "1s")).toBe(false);
  });

  it("accepts seconds strings", () => {
    const t = s(0.5, { enter: "2s", hold: "6s", exit: "2s" });
    expect(t.active).toBe("hold");
  });

  it("accepts milliseconds strings", () => {
    const t = s(0.5, { enter: "2000ms", hold: "6000ms", exit: "2000ms" });
    expect(t.active).toBe("hold");
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
    const t = s(0.6, { enter: "10%", hold: "40%" });
    expect(t.active).toBe("idle");
  });

  it("snaps to last phase at sp=1", () => {
    expect(s(1).active).toBe("exit");
  });

  it("within() maps 0..1 inside a phase", () => {
    const t = s(0.075, { enter: "15%", hold: "70%", exit: "15%" });
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

  it("`at` as fraction staggers the enter window", () => {
    const phases = { enter: "20%", hold: "60%", exit: "20%" };
    const early = s(0.1, phases).motion({ y: 20, at: 0 });
    const late = s(0.1, phases).motion({ y: 20, at: 0.8 });
    expect(early.enter).toBeGreaterThan(late.enter);
  });

  it("`at` as seconds string staggers the enter window", () => {
    const phases = { enter: "2s", hold: "6s", exit: "2s" };
    const early = s(0.1, phases).motion({ y: 20, at: "0s" });
    const late = s(0.1, phases).motion({ y: 20, at: "1.6s" });
    expect(early.enter).toBeGreaterThan(late.enter);
  });

  it("`for` as seconds string controls animation duration", () => {
    const phases = { enter: "2s", hold: "6s", exit: "2s" };
    // At sp=0.05 (0.5s into 10s): for="2s" fills the whole enter phase → halfway
    const slow = s(0.05, phases).motion({ for: "2s" });
    // for="0.1s" completes in 0.1s → already fully entered at sp=0.05
    const fast = s(0.05, phases).motion({ for: "0.1s" });
    expect(fast.enter).toBeGreaterThan(slow.enter);
  });

  it("`window` overrides phase-based timing for enter", () => {
    const t = s(0.5);
    const m = t.motion({ window: [0, 1] });
    expect(m.enter).toBeGreaterThan(0.4);
    expect(m.enter).toBeLessThan(1);
  });

  it("exit pose defaults to mirror of enter start", () => {
    const t = s(1);
    const m = t.motion({ y: 30 });
    expect(m.transform).toContain("translateY(-30px)");
  });

  it("exit pose can be overridden per axis", () => {
    const t = s(1);
    const m = t.motion({ y: 30, exit: { y: -80 } });
    expect(m.transform).toContain("translateY(-80px)");
  });

  it("no exit when the layout has a single phase", () => {
    const t = s(1, { all: "100%" });
    const m = t.motion();
    expect(m.exit).toBe(0);
    expect(m.opacity).toBeCloseTo(1, 3);
  });

  it("exposes structured numeric values on MotionResult", () => {
    const t = s(0.5);
    const m = t.motion();
    expect(typeof m.x).toBe("number");
    expect(typeof m.y).toBe("number");
    expect(typeof m.scale).toBe("number");
    expect(typeof m.rotate).toBe("number");
    expect(typeof m.blur).toBe("number");
  });

  it("builds a ready-to-use style string with opacity", () => {
    const t = s(0.5);
    const m = t.motion({ y: 20 });
    expect(m.style).toMatch(/opacity:/);
    expect(m.transform).toBe("");
  });

  it("custom easing function works", () => {
    const t = s(0.1);
    const linear = t.motion({ easing: (x) => x });
    const ease = t.motion({ easing: "easeOutCubic" });
    expect(ease.enter).toBeGreaterThan(linear.enter);
  });

  it("spring object easing works", () => {
    const t = s(0.5);
    const m = t.motion({ easing: { stiffness: 200, damping: 20 } });
    expect(m.enter).toBeGreaterThan(0);
    expect(m.enter).toBeLessThanOrEqual(1.5); // may overshoot
  });

  it("all 31 EasingName values resolve without error", () => {
    const names = [
      "linear", "easeInQuad", "easeOutQuad", "easeInOutQuad",
      "easeInSine", "easeOutSine", "easeInOutSine",
      "easeInCubic", "easeOutCubic", "easeInOutCubic",
      "easeInQuart", "easeOutQuart", "easeInOutQuart",
      "easeInQuint", "easeOutQuint", "easeInOutQuint",
      "easeInExpo", "easeOutExpo", "easeInOutExpo",
      "easeInCirc", "easeOutCirc", "easeInOutCirc",
      "easeInBack", "easeOutBack", "easeInOutBack",
      "easeInElastic", "easeOutElastic", "easeInOutElastic",
      "easeInBounce", "easeOutBounce", "easeInOutBounce",
    ] as const;
    for (const name of names) {
      expect(() => s(0.5).motion({ easing: name })).not.toThrow();
    }
  });

  it("rejects unknown easing names", () => {
    expect(() => s(0.5).motion({ easing: "bogus" as never })).toThrow();
  });
});

describe("score — tween", () => {
  it("scopes scalar interpolation to a phase", () => {
    const phases = { enter: "20%", hold: "60%", exit: "20%" };
    expect(s(0, phases).tween(0, 100, { during: "enter" })).toBeCloseTo(0, 5);
    expect(s(0.2, phases).tween(0, 100, { during: "enter" })).toBeCloseTo(100, 5);
    expect(s(0.1, phases).tween(0, 100, { during: "enter" })).toBeGreaterThan(50);
  });

  it("respects `at` fraction offset inside the phase", () => {
    const early = s(0.05, { enter: "20%", hold: "80%" }).tween(0, 1, {
      during: "enter", at: 0,
    });
    const late = s(0.05, { enter: "20%", hold: "80%" }).tween(0, 1, {
      during: "enter", at: 0.8,
    });
    expect(early).toBeGreaterThan(late);
  });

  it("respects `for` seconds string", () => {
    const v = s(0.05, { enter: "2s", hold: "8s" }).tween(0, 100, {
      during: "enter", for: "0.5s",
    });
    // 0.5s window out of 2s enter → at sp=0.05 (0.5s) we're at the end of the window
    expect(v).toBeGreaterThan(90);
  });

  it("linear pattern", () => {
    const v = s(0.1, { enter: "20%", hold: "80%" }).tween(0, 100, {
      during: "enter", pattern: "linear",
    });
    expect(v).toBeCloseTo(50, 3);
  });

  it("sine pattern peaks at midpoint", () => {
    const phases = { enter: "20%", hold: "80%" };
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
    const phases = { enter: "10%", hold: "80%", exit: "10%" };
    const before = s(0.5, phases).value(0.7, { fadeOn: "exit" });
    const mid = s(0.95, phases).value(0.7, { fadeOn: "exit" });
    expect(before.opacity).toBe(1);
    expect(mid.opacity).toBeCloseTo(0.5, 1);
  });

  it("restricts visibility to `during` phases", () => {
    const phases = { a: "30%", b: "40%", c: "30%" };
    const inA = s(0.1, phases).value("x", { during: "b" });
    const inB = s(0.5, phases).value("x", { during: "b" });
    expect(inA.opacity).toBe(0);
    expect(inB.opacity).toBe(1);
  });

  it("accepts array of phases for fadeOn / during", () => {
    const phases = { a: "30%", b: "40%", c: "30%" };
    const inA = s(0.1, phases).value("x", { during: ["a", "b"] });
    const inC = s(0.8, phases).value("x", { during: ["a", "b"] });
    expect(inA.opacity).toBe(1);
    expect(inC.opacity).toBe(0);
  });
});

describe("score — mergeMotion()", () => {
  it("merges two motion results, last-wins per property", () => {
    const a = s(0.5).motion({ y: 20 });
    const b = { y: 40 };
    const merged = mergeMotion(a, b);
    expect(merged.y).toBe(40);
    expect(merged.opacity).toBe(a.opacity); // from a
  });

  it("rebuilds transform from merged values", () => {
    const a = s(0.5).motion();
    const merged = mergeMotion(a, { scale: 1.05 });
    expect(merged.transform).toContain("scale(1.05)");
    expect(merged.style).toMatch(/opacity:/);
  });

  it("visible flag carries through", () => {
    const m = s(0).motion(); // not yet entered
    const merged = mergeMotion(m, { scale: 1 });
    expect(merged.visible).toBe(false);
  });
});

describe("score — real migration samples", () => {
  it("stats-card pattern: y motion with stagger in enter (fraction at)", () => {
    const t = s(0.03, { enter: "30%", hold: "45%", exit: "25%" });
    const value = t.motion({ y: 15, at: 0.15 });
    // sp 0.03 < (0.3 × 0.15 = 0.045), still before the staggered start → near-zero enter
    expect(value.enter).toBeLessThan(0.05);
  });

  it("stats-card pattern: y motion with stagger in enter (seconds at)", () => {
    // enter is 3s (30% of 10s). at "0.45s" = 15% into enter (same as 0.15 fraction)
    const t = s(0.03, { enter: "30%", hold: "45%", exit: "25%" });
    const value = t.motion({ y: 15, at: "0.45s" });
    expect(value.enter).toBeLessThan(0.05);
  });

  it("speaker window pattern: window timing", () => {
    const t = s(0.04, { enter: "8%", hold: "83%", exit: "9%" });
    const photo = t.motion({ window: [0, 0.08] });
    expect(photo.enter).toBeGreaterThan(0.1);
    expect(photo.exit).toBe(0);
  });

  it("list stagger: 5-item iteration via at = i/n", () => {
    const t = s(0.05, { enter: "20%", hold: "60%", exit: "20%" });
    const opacities = [0, 1, 2, 3, 4].map((i) =>
      t.motion({ at: i / 5, easing: "easeOutElastic" }).opacity,
    );
    for (let i = 0; i < opacities.length - 1; i++) {
      expect(opacities[i]!).toBeGreaterThanOrEqual(opacities[i + 1]!);
    }
  });
});
