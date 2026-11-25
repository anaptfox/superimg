import { describe, expect, it } from "vitest";
import type { TemplateModule } from "@superimg/types";
import { activePhaseAt, probeDirectorPhases } from "../rendering/probe-phases.js";
import { boxedHtml } from "./__test-utils__/index.js";

describe("probeDirectorPhases", () => {
  it("captures phase layout from director() call", () => {
    const template: TemplateModule = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 10, width: 640, height: 360 },
      render(ctx) {
        const d = ctx.director({ intro: "20%", body: "60%", outro: "20%" });
        return boxedHtml(`<div>${d.active}</div>`);
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
        return boxedHtml("<div>static</div>");
      },
    };
    expect(probeDirectorPhases(template)).toBeNull();
  });

  it("activePhaseAt finds phase and local progress", () => {
    const phases = [
      { name: "a", start: 0, end: 0.5, fraction: 0.5, duration: 0.5, startSec: 0, endSec: 5 },
      { name: "b", start: 0.5, end: 1, fraction: 0.5, duration: 0.5, startSec: 5, endSec: 10 },
    ];
    const mid = activePhaseAt(phases, 0.25);
    expect(mid?.phase.name).toBe("a");
    expect(mid?.phaseLocal).toBeCloseTo(0.5);

    const later = activePhaseAt(phases, 0.75);
    expect(later?.phase.name).toBe("b");
    expect(later?.phaseLocal).toBeCloseTo(0.5);

    expect(activePhaseAt(phases, 1)?.phase.name).toBe("b");
  });

  it("keeps an overlapping earlier phase active at the end of the scene", () => {
    const phases = [
      { name: "stuck", start: 0, end: 0.4, fraction: 0.4, duration: 4.8, startSec: 0, endSec: 4.8 },
      { name: "out", start: 0.4, end: 1, fraction: 0.6, duration: 7, startSec: 4.8, endSec: 11.8 },
      { name: "hop", start: 0.08, end: 0.12, fraction: 0.04, duration: 0.45, startSec: 1, endSec: 1.45 },
    ];
    expect(activePhaseAt(phases, 0.1)?.phase.name).toBe("stuck");
    expect(activePhaseAt(phases, 0.5)?.phase.name).toBe("out");
    expect(activePhaseAt(phases, 1)?.phase.name).toBe("out");
  });
});
