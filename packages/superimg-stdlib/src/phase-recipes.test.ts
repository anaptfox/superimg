import { describe, expect, it } from "vitest";
import { PHASE_RECIPES, fromText, recipe } from "./phase-recipes.js";

describe("phase recipes", () => {
  it("returns known recipes summing near 100%", () => {
    for (const name of Object.keys(PHASE_RECIPES) as (keyof typeof PHASE_RECIPES)[]) {
      const r = recipe(name);
      const sum = Object.values(r).reduce((a, v) => a + parseFloat(v), 0);
      expect(sum).toBeCloseTo(100, 0);
    }
  });

  it("card matches director default shape", () => {
    expect(recipe("card")).toEqual({ enter: "15%", hold: "70%", exit: "15%" });
  });

  it("fromText builds layoutTimeline result", () => {
    const { phases, totalSeconds, order } = fromText("hello world today", {
      enter: 0.4,
      pad: 0.5,
    });
    expect(order).toEqual(["enter", "hold", "exit"]);
    expect(totalSeconds).toBeGreaterThan(0.4);
    expect(phases.enter).toMatch(/%$/);
  });
});
