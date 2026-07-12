import { describe, expect, it } from "vitest";
import type { TemplateModule } from "@superimg/types";
import { activePhaseAt, probeDirectorPhases } from "../rendering/probe-phases.js";

describe("probeDirectorPhases", () => {
  it("captures phase layout from director() call", () => {
    const template: TemplateModule = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 10, width: 640, height: 360 },
      render(ctx) {
        const d = ctx.director({ intro: "20%", body: "60%", outro: "20%" });
        return `<div>${d.active}</div>`;
      },
    };

    const phases = probeDirectorPhases(template);
    expect(phases).not.toBeNull();
    expect(phases!.map((p) => p.name)).toEqual(["intro", "body", "outro"]);
    expect(phases![0]!.start).toBeCloseTo(0);
    expect(phases![0]!.end).toBeCloseTo(0.2);
    expect(phases![1]!.start).toBeCloseTo(0.2);
    expect(phases![1]!.end).toBeCloseTo(0.8);
    expect(phases![2]!.end).toBeCloseTo(1);
  });

  it("returns null when director is never called with phases", () => {
    const template: TemplateModule = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 2 },
      render() {
        return "<div>static</div>";
      },
    };
    expect(probeDirectorPhases(template)).toBeNull();
  });

  it("activePhaseAt finds phase and local progress", () => {
    const phases = [
      { name: "a", start: 0, end: 0.5, fraction: 0.5 },
      { name: "b", start: 0.5, end: 1, fraction: 0.5 },
    ];
    const mid = activePhaseAt(phases, 0.25);
    expect(mid?.phase.name).toBe("a");
    expect(mid?.phaseLocal).toBeCloseTo(0.5);

    const later = activePhaseAt(phases, 0.75);
    expect(later?.phase.name).toBe("b");
    expect(later?.phaseLocal).toBeCloseTo(0.5);
  });
});
