import { describe, expect, it } from "vitest";
import { clock } from "./clock.js";

describe("film clock", () => {
  it("uses the pixel reading rule and starts each shot on its own clock", () => {
    const result = clock([
      { kind: "shot", id: "lookout" },
      { kind: "speech", id: "question", who: "pig", lines: ["Pears?"], pace: "beat" },
      { kind: "speech", id: "reply", who: "chick", lines: ["One two three four", "five six seven eight"] },
      { kind: "shot", id: "silent" },
    ]);
    const [lookout, silent] = result.shots;
    const [question, reply] = lookout!.lines;
    const typing = 0.8;
    expect(question).toMatchObject({ start: 0.3, typed: 0.3 + 6 * 0.021, end: 0.3 + 1.6 });
    expect(reply!.start).toBeCloseTo(2.45);
    expect(reply!.typed).toBeCloseTo(2.45 + typing);
    expect(reply!.end).toBeCloseTo(2.45 + typing + 0.33 * 8);
    expect(lookout!.duration).toBe(reply!.end + 0.3);
    expect(silent).toMatchObject({ start: lookout!.end, duration: 2.4, still: 0.7 * 2.4 });
    expect(result.total).toBe(lookout!.duration + 2.4);
    expect(result.findings).toEqual([]);
  });

  it("honors each explicit shot, speech, and card time and publishes film seconds", () => {
    const result = clock([
      { kind: "shot", id: "opener", hold: 2, still: 0 },
      { kind: "shot", id: "ending", hold: 4, still: 3 },
      { kind: "speech", id: "speech", who: "mira", lines: ["Go!"], at: { start: 0, end: 0.3125 } },
      { kind: "card", id: "card", lines: ["Credit"], at: { start: 1, end: 3 } },
    ]);
    expect(result.total).toBe(6);
    expect(result.cues).toEqual([
      { id: "opener", start: 0, end: 2, still: 0 },
      { id: "ending", start: 2, end: 6, still: 5 },
      { id: "speech", start: 2, end: 2.3125, still: 2.2625 },
      { id: "card", start: 3, end: 5, still: 4.4 },
    ]);
  });

  it("reports a speech beyond its shot even when a later block ends earlier", () => {
    const result = clock([
      { kind: "shot", id: "short", hold: 1 },
      { kind: "speech", id: "late", who: "mira", lines: ["Later."], at: { start: 0.75, end: 1.4 } },
      { kind: "card", id: "early", lines: ["Earlier."], at: { start: 0, end: 0.5 } },
    ]);
    expect(result.total).toBe(1);
    expect(result.findings).toEqual([expect.objectContaining({ id: "short", code: "SHOT_SHORTER_THAN_LINES" })]);
  });
});
