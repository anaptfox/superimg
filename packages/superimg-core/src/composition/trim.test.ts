import { describe, expect, it } from "vitest";
import { video, image } from "@superimg/types";
import { Html } from "@superimg/stdlib/tree";
import { sequence } from "./sequence.js";
import { time } from "./time.js";
import { planComposition } from "./plan.js";
import { renderTemplateFrame } from "../rendering/render-frame.js";

describe("Use.trim on retained compositions", () => {
  it("trims an animated child's duration and shifts its local clock by trim.in", () => {
    const seenFrames: number[] = [];
    const clip = video({
      size: { width: 320, height: 180 },
      fps: 10,
      duration: "5s",
      audio: {
        id: "vo",
        src: "https://cdn.example/vo.mp3",
        at: "0s",
        duration: "5s",
      },
      render(ctx) {
        seenFrames.push(ctx.timeline.frame);
        return Html({ width: "fill", height: "fill", html: `frame:${ctx.timeline.frame}` });
      },
    });

    const program = sequence([
      { id: "cut", content: clip, trim: { in: "1s", out: "3s" } },
    ]);

    const plan = planComposition(program, { size: { width: 320, height: 180 }, fps: 10 });
    expect(plan.totalFrames).toBe(20);
    expect(plan.leaves[0]).toMatchObject({
      path: "cut",
      startFrame: 0,
      endFrame: 20,
      totalFrames: 20,
      trimInFrames: 10,
      sourceTotalFrames: 50,
    });

    const timed = time(program, { size: { width: 320, height: 180 }, fps: 10 });
    expect(timed.config?.duration).toBe(2);
    // Audio clip lifted with trim.in shifted by 1s and clamped to 2s
    expect(timed.config?.audio).toMatchObject({
      clips: [
        {
          id: "cut/vo",
          at: 0,
          duration: 2,
          trim: { in: 1 },
        },
      ],
    });

    const first = renderTemplateFrame({
      template: timed as never,
      frame: 0,
      width: 320,
      height: 180,
      fps: 10,
      totalFrames: 20,
    });
    const last = renderTemplateFrame({
      template: timed as never,
      frame: 19,
      width: 320,
      height: 180,
      fps: 10,
      totalFrames: 20,
    });
    expect(first.html).toContain("frame:10");
    expect(last.html).toContain("frame:29");
    expect(seenFrames).toEqual([10, 29]);
  });

  it("rejects trim on stills, nested programs, and invalid bounds", () => {
    const still = image({ size: { width: 100, height: 100 }, render: () => Html({ html: "x" }) });
    const clip = video({ size: { width: 100, height: 100 }, fps: 10, duration: "2s", render: () => Html({ html: "x" }) });

    expect(() =>
      planComposition(sequence([{ id: "s", content: still, hold: "1s", trim: { in: "0s" } }]), { size: { width: 100, height: 100 }, fps: 10 }),
    ).toThrow(/only supported on animated/);

    expect(() =>
      planComposition(sequence([{ id: "c", content: clip, trim: { in: "1.5s", out: "1s" } }]), { size: { width: 100, height: 100 }, fps: 10 }),
    ).toThrow(/greater than trim\.in/);

    expect(() =>
      planComposition(sequence([{ id: "c", content: clip, trim: { in: "0s", out: "3s" } }]), { size: { width: 100, height: 100 }, fps: 10 }),
    ).toThrow(/exceeds child duration/);
  });
});
