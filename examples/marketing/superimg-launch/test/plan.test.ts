import { describe, expect, it } from "vitest";
import { clamp, lerp } from "@foxworth/superimg/stdlib/math";
import { END, HANDOFF_POSE, KIT_POSE, POSTER_SCENE_AT, RESUME_AT, SHOW, fanTime, marks, performer, plan, sceneTime, trickTime, type Cue } from "../cut/plan";
import { DURATION as FAN_END, pose } from "../peg/motion";
import { ENTRIES, FORMATS, arrangement } from "../cut/prints";

/** The director's linear span over a cue, for checking the clocks without a render context. */
const span = (cue: Cue) => {
  const [a, b] = plan.cues[cue];
  return (t: number) => clamp((t - a) / (b - a), 0, 1);
};
const fan = (t: number) => fanTime(t, c => span(c)(t), lerp);
const times = Array.from({ length: Math.round(END * 240) + 1 }, (_, i) => Math.min(END, i / 240));

describe("launch film timing", () => {
  it("runs 34.9 s: 1047 frames at 30 fps", () => {
    expect(END).toBe(34.9);
    expect(Math.round(END * 30)).toBe(1047);
  });

  it("keeps the accepted opening and act boundaries", () => {
    expect(plan.acts.reuse).toEqual([0, 9]);
    expect(Object.values(marks)).toEqual([9, 11.8, 11.8, 15.6, 18.8, 20.1, 23.45, 26.55, 27.1, 30.3, 32.8, 34.9]);
    const acts = Object.values(plan.acts);
    for (let i = 1; i < acts.length; i++) expect(acts[i]![0]).toBe(acts[i - 1]![1]);
  });

  it("ends on the campaign kit: the close sits in its act, the website line and the kit each hold at least 1.2 s", () => {
    const [from, to] = plan.acts.close;
    for (const c of ["siteOut", "skyDown", "kitBack", "closeType"] as const) {
      expect(plan.cues[c][0]).toBeGreaterThanOrEqual(from);
      expect(plan.cues[c][1]).toBeLessThanOrEqual(to);
    }
    expect(from - plan.cues.siteType[1]).toBeGreaterThanOrEqual(1.2);
    const settled = Math.max(plan.cues.kitBack[1], plan.cues.closeType[1]);
    expect(Number((END - settled).toFixed(2))).toBe(1.3);
  });

  it("plays the card trick on the opening clock, finishes it on rest and lands in the first print on the kit pose", () => {
    for (const t of times.filter(t => t <= 9)) expect(fan(t)).toBe(Math.min(Math.max(t, 0), SHOW));
    expect(fan(marks.tFinish - 1e-9)).toBeCloseTo(FAN_END, 6);
    expect(fan(marks.tBoth - 0.01)).toBe(KIT_POSE);
    expect(ENTRIES[0]!.moment).toBe(KIT_POSE);
  });

  it("hands Peg over once, on the same pose, and its clocks never jump", () => {
    expect(fan(marks.tAbility - 1e-9)).toBeCloseTo(HANDOFF_POSE, 3);
    expect(trickTime(marks.tAbility)).toBe(HANDOFF_POSE);
    let worst = 0;
    for (let i = 1; i < times.length; i++) {
      const [p, q] = [times[i - 1]!, times[i]!];
      if (performer(p) === "fan" && performer(q) === "fan") {
        let d = Math.abs(fan(q) - fan(p));
        if (d > FAN_END / 2) d = FAN_END - d; // the card trick loops: its end pose is its rest pose
        worst = Math.max(worst, d);
      } else worst = Math.max(worst, Math.abs(trickTime(q) - trickTime(p)));
    }
    expect(worst).toBeLessThanOrEqual((1 / 240) * 1.01);
  });

  it("freezes the miniature on the poster's printed instant and lets it go as the website arrives", () => {
    expect(sceneTime(marks.tFreeze + 0.01)).toBe(POSTER_SCENE_AT);
    expect(sceneTime(RESUME_AT - 1e-6)).toBe(POSTER_SCENE_AT);
    expect(sceneTime(RESUME_AT + 0.1)).not.toBe(POSTER_SCENE_AT);
  });

  it("finishes the trick on the rest pose", () => {
    expect(pose(FAN_END)).toEqual(pose(0));
  });
});

describe("campaign kit", () => {
  it("prints two entries in three formats, every Peg on the format's floor and inside it", () => {
    expect(ENTRIES.map(e => e.id)).toEqual(["reuse", "revise"]);
    expect(FORMATS.map(f => f.id)).toEqual(["poster", "square", "banner"]);
    for (const e of ENTRIES) for (const f of FORMATS) {
      const A = arrangement(e, f);
      expect(A.peg.x).toBeGreaterThan(0);
      expect(A.peg.x).toBeLessThan(f.w);
      expect(A.peg.floor).toBeLessThan(f.h);
    }
  });
});
