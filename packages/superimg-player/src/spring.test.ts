import { describe, expect, it } from "vitest";
import { clampRubber, createSpring, momentumProject, rubberBand } from "./spring.js";

describe("rubberBand", () => {
  it("is 0 at 0", () => {
    expect(rubberBand(0, 1)).toBe(0);
  });

  it("grows slower than the overshoot", () => {
    const a = rubberBand(10, 100);
    const b = rubberBand(40, 100);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(10);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(40);
  });
});

describe("clampRubber", () => {
  it("passes through the unit interval", () => {
    expect(clampRubber(0.4)).toBe(0.4);
  });

  it("resists past 0 and 1", () => {
    expect(clampRubber(-0.4)).toBeLessThan(0);
    expect(clampRubber(-0.4)).toBeGreaterThan(-0.4);
    expect(clampRubber(1.4)).toBeGreaterThan(1);
    expect(clampRubber(1.4)).toBeLessThan(1.4);
  });
});

describe("createSpring", () => {
  it("settles on the target without overshoot when critically damped", () => {
    const spring = createSpring(0);
    spring.target = 1;
    let max = 0;
    for (let i = 0; i < 90; i++) {
      spring.step(16);
      max = Math.max(max, spring.position);
    }
    expect(spring.position).toBeGreaterThan(0.98);
    expect(spring.position).toBeLessThanOrEqual(1.02);
    expect(max).toBeLessThanOrEqual(1.02);
    expect(spring.atRest).toBe(true);
  });

  it("interrupt seeds presentation position and velocity", () => {
    const spring = createSpring(0);
    spring.target = 1;
    spring.interrupt(0.4, 2);
    expect(spring.position).toBe(0.4);
    expect(spring.velocity).toBe(2);
  });
});

describe("momentumProject", () => {
  it("projects positive velocity forward", () => {
    expect(momentumProject(800)).toBeGreaterThan(0);
  });

  it("projects negative velocity backward", () => {
    expect(momentumProject(-800)).toBeLessThan(0);
  });
});
