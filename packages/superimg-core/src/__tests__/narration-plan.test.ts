import { describe, expect, it } from "vitest";
import { planNarration } from "../shared/narration-plan.js";

const segment = {
  id: "hook",
  src: "audio/hook.wav",
  sampleRate: 48000,
  sampleFrames: 192000,
};
describe("planNarration", () => {
  it("reserves entrance and prediction pause around sample-exact speech", () => {
    const plan = planNarration([{
      ...segment,
      beforeSeconds: 0.5,
      afterSeconds: 1,
    }], { mode: "natural", fps: 30 });
    expect(plan.durationSeconds).toBe(5.5);
    expect(plan.audio.clips[0]).toMatchObject({ at: "0.5s", duration: "4s" });
    expect(plan.phases).toEqual({ hook: "5.5s" });
    expect(plan.findings).toEqual([]);
  });
  it("reports fixed overflow without truncating speech", () => {
    const plan = planNarration([{
      ...segment,
      beforeSeconds: 0.5,
      afterSeconds: 1,
      budgetSeconds: 5,
    }], { mode: "fixed", fps: 30 });
    expect(plan.durationSeconds).toBe(5);
    expect(plan.findings[0]?.overflowSeconds).toBe(0.5);
    expect(plan.audio.clips[0]?.duration).toBe("4s");
  });
  it("uses absolute frame rounding for long fixed sequences", () => {
    const segments = Array.from(
      { length: 1000 },
      (_, i) => ({
        ...segment,
        id: `s${i}`,
        sampleFrames: 100,
        budgetSeconds: 0.101,
      }),
    );
    const plan = planNarration(segments, { mode: "fixed", fps: 30 });
    expect(plan.totalFrames).toBe(3030);
    expect(plan.findings).toEqual([]);
  });
  it("records natural quantization padding without dropping speech samples", () => {
    const plan = planNarration(
      Array.from(
        { length: 20 },
        (_, i) => ({ ...segment, id: `s${i}`, sampleFrames: 4801 }),
      ),
      { mode: "natural", fps: 30 },
    );
    expect(plan.findings).toEqual([]);
    expect(
      plan.segments.every((s) =>
        s.endSeconds + 1e-10 >= s.speechStartSeconds + s.speechDurationSeconds
      ),
    ).toBe(true);
  });
  it("rejects duplicate ids, unsafe duration metadata and missing budgets", () => {
    expect(() =>
      planNarration([segment, segment], { mode: "natural", fps: 30 })
    ).toThrow(/duplicate/);
    expect(() =>
      planNarration([{ ...segment, sampleRate: 0 }], {
        mode: "natural",
        fps: 30,
      })
    ).toThrow(/sampleRate/);
    expect(() => planNarration([segment], { mode: "fixed", fps: 30 })).toThrow(
      /budgetSeconds/,
    );
  });
  it("keeps honest clip-relative words and rejects words outside the asset", () => {
    const transcript = [{ text: "hello", start: 0, end: 0.4 }];
    const plan = planNarration([{ ...segment, beforeSeconds: 1, transcript }], {
      mode: "natural",
      fps: 30,
    });
    expect(plan.audio.clips[0]?.transcript).toEqual(transcript);
    expect(() =>
      planNarration([{
        ...segment,
        transcript: [{ text: "bad", start: 0, end: 5 }],
      }], { mode: "natural", fps: 30 })
    ).toThrow(/transcript/);
  });
});
