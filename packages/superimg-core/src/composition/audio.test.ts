import { describe, expect, it } from "vitest";
import { video, type AudioValue } from "@superimg/types";
import { boxedHtml } from "../__tests__/__test-utils__/index.js";
import type { CompositionPlan, PlannedLeaf } from "./plan.js";
import { liftCompositionAudio } from "./audio.js";

const size = { width: 1920, height: 1080 };

function leaf(
  path: string,
  startFrame: number,
  endFrame: number,
  audio: AudioValue,
  contentEndFrame?: number,
): PlannedLeaf {
  return {
    path,
    startFrame,
    endFrame,
    totalFrames: endFrame - startFrame,
    ...(contentEndFrame === undefined ? {} : { contentEndFrame }),
    kind: "video",
    width: size.width,
    height: size.height,
    fps: 10,
    content: video({
      size,
      fps: 10,
      duration: `${endFrame - startFrame}f`,
      audio,
      render: () => boxedHtml("audio"),
    }),
  };
}

function plan(leaves: readonly PlannedLeaf[]): CompositionPlan {
  return {
    fps: 10,
    totalFrames: Math.max(...leaves.map((entry) => entry.endFrame)),
    selectedRoutes: {},
    leaves,
  };
}

describe("liftCompositionAudio", () => {
  it("offsets sequential child clips onto the root clock", () => {
    const audio = liftCompositionAudio(plan([
      leaf("intro", 0, 10, { id: "bed", src: "https://audio.example/intro.mp3", at: "2f" }),
      leaf("chapter", 10, 20, { id: "bed", src: "https://audio.example/chapter.mp3", at: "2f" }),
    ]));

    expect(audio).toEqual({
      clips: [
        expect.objectContaining({ id: "intro/bed", at: 0.2, duration: 0.8 }),
        expect.objectContaining({ id: "chapter/bed", at: 1.2, duration: 0.8 }),
      ],
    });
  });

  it("keeps together children simultaneous and retains a shared mix rule", () => {
    const mix = { master: 0.7, ducking: false };
    const audio = liftCompositionAudio(plan([
      leaf("comparison/left", 0, 10, { clips: [{ id: "voice", src: "https://audio.example/left.mp3" }], mix }),
      leaf("comparison/right", 0, 10, { clips: [{ id: "music", src: "https://audio.example/right.mp3" }], mix }),
    ]));

    expect(audio).toEqual({
      clips: [
        expect.objectContaining({ id: "comparison/left/voice", at: 0 }),
        expect.objectContaining({ id: "comparison/right/music", at: 0 }),
      ],
      mix,
    });
  });

  it("qualifies ids for repeated source occurrences", () => {
    const shared: AudioValue = { id: "theme", src: "https://audio.example/theme.mp3", loop: true, fadeIn: "2f", trim: { in: "1f" } };
    const audio = liftCompositionAudio(plan([
      leaf("opening", 0, 10, shared),
      leaf("closing", 10, 20, shared),
    ]));

    expect(audio?.clips).toEqual([
      expect.objectContaining({ id: "opening/theme", loop: true, fadeIn: "2f", trim: { in: "1f" } }),
      expect.objectContaining({ id: "closing/theme", loop: true, fadeIn: "2f", trim: { in: "1f" } }),
    ]);
  });

  it("bounds clips to authored content instead of a held together extension", () => {
    const audio = liftCompositionAudio(plan([
      leaf("short", 10, 20, { id: "bed", src: "https://audio.example/bed.mp3", at: "1f", duration: "10s" }, 14),
    ]));

    expect(audio?.clips[0]).toMatchObject({ id: "short/bed", at: 1.1 });
    expect(audio?.clips[0]?.duration).toBeCloseTo(0.3);
  });

  it("rejects child scene references because they have no root scene namespace", () => {
    expect(() => liftCompositionAudio(plan([
      leaf("chapter", 0, 10, { id: "voice", src: "https://audio.example/voice.mp3", atScene: "local-intro" }),
    ]))).toThrow(/atScene/);
  });

  it("rejects conflicting selected child mix options", () => {
    expect(() => liftCompositionAudio(plan([
      leaf("left", 0, 10, { clips: [{ id: "voice", src: "https://audio.example/voice.mp3" }], mix: { master: 0.7 } }),
      leaf("right", 0, 10, { clips: [{ id: "music", src: "https://audio.example/music.mp3" }], mix: { master: 0.9 } }),
    ]))).toThrow(/mix conflicts/);
  });

  it("rejects an ambiguous child-relative source path", () => {
    expect(() => liftCompositionAudio(plan([
      leaf("chapter", 0, 10, { id: "voice", src: "voice.mp3" }),
    ]))).toThrow(/relative src/);
  });
});
