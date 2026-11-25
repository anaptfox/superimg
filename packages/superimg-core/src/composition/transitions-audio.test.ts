import { describe, expect, it } from "vitest";
import { video } from "@superimg/types";
import { Frame, Text } from "@superimg/stdlib/tree";
import { renderTemplateFrame } from "../rendering/render-frame.js";
import { sequence } from "./sequence.js";
import { time } from "./time.js";

describe("retained sequence() + time() transitions and root audio", () => {
  const sceneA = video({
    size: { width: 640, height: 360 },
    fps: 10,
    duration: "1s",
    render: () => Frame({ width: 640, height: 360, fill: "#111" }, Text({ color: "#fff" }, "Scene A")),
  });

  const sceneB = video({
    size: { width: 640, height: 360 },
    fps: 10,
    duration: "1s",
    render: () => Frame({ width: 640, height: 360, fill: "#222" }, Text({ color: "#fff" }, "Scene B")),
  });

  it("retains and renders enter/exit transitions and resolves root audio atScene", () => {
    const program = sequence([
      { id: "a", content: sceneA, exit: { type: "fade", duration: "200ms" } },
      { id: "b", content: sceneB, enter: { type: "slide-left", duration: "300ms" } },
    ]);

    const timed = time(program, {
      size: { width: 640, height: 360 },
      fps: 10,
      audio: {
        clips: [
          { id: "bed", src: "https://example.com/bed.mp3", role: "music", loop: true },
          { id: "cue", src: "https://example.com/cue.mp3", role: "voice", atScene: "b", at: "0.2s" },
        ],
        mix: { ducking: true, duckingLevel: 0.25 },
      },
    });

    // Schedule retains transition metadata
    expect(timed.composition.schedule.leaves[0]?.exit).toMatchObject({ type: "fade", durationFrames: 2 });
    expect(timed.composition.schedule.leaves[1]?.enter).toMatchObject({ type: "slide-left", durationFrames: 3 });

    // Root audio resolves atScene "b" (starts at 1.0s) + 0.2s = 1.2s
    const audio = timed.config.audio;
    expect(audio && typeof audio === "object" && "clips" in audio).toBe(true);
    if (audio && typeof audio === "object" && "clips" in audio) {
      const cue = audio.clips.find((c) => c.id === "cue");
      expect(cue?.at).toBeCloseTo(1.2, 6);
    }

    // Frame 9 is inside scene A's 2-frame fade exit -> opacity wrapper present
    const exitFrame = renderTemplateFrame({ template: timed, frame: 9, fps: 10 });
    expect(exitFrame.html).toContain("opacity:");

    // Frame 10 is inside scene B's 3-frame slide-left enter -> translateX wrapper present
    const enterFrame = renderTemplateFrame({ template: timed, frame: 10, fps: 10 });
    expect(enterFrame.html).toContain("translateX(");
  });
});
