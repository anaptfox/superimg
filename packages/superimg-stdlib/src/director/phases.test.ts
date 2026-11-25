import { describe, expect, it } from "vitest";
import { layoutPhases } from "./phases.js";

describe("phase layout bounds", () => {
  it.each([
    { duration: 120, seconds: [9, 8, 10, 8, 11, 10, 8, 10, 10, 10, 8, 6, 12] },
    { duration: 202, seconds: [11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 12, 12, 10, 12] },
  ])("keeps a complete $duration-second schedule inside [0, 1]", ({ duration, seconds }) => {
    // Both schedules used to return a final end strictly greater than 1,
    // which was rejected by the media.source.describe output contract.
    const config = Object.fromEntries(seconds.map((value, index) => [`shot${index}`, `${value}s`]));
    const phases = layoutPhases(config, duration);
    expect(phases.at(-1)?.end).toBe(1);
    let elapsed = 0;
    for (const [index, phase] of phases.entries()) {
      expect(phase.start).toBeGreaterThanOrEqual(0);
      expect(phase.end).toBeLessThanOrEqual(1);
      expect(phase.start).toBeLessThan(phase.end);
      expect(phase.start * duration).toBeCloseTo(elapsed, 10);
      elapsed += seconds[index]!;
      expect(phase.end * duration).toBeCloseTo(elapsed, 10);
      if (index > 0) expect(phase.start).toBe(phases[index - 1]!.end);
    }
  });

  it.each(["100.00000001%", "100.01%", "120%"])("rejects an authored %s overrun", (duration) => {
    expect(() => layoutPhases({ all: duration }, 120)).toThrow(/exceeds 100%/);
  });

  it("preserves a deliberately unallocated tail instead of stretching phases", () => {
    const phases = layoutPhases({ draw: "2s", hold: "7.999999s" }, 10);
    expect(phases[0]!.end).toBe(.2);
    expect(phases[1]!.start).toBe(.2);
    expect(phases[1]!.end).toBeLessThan(1);
    expect(phases[1]!.end * 10).toBeCloseTo(9.999999, 12);
  });
});
