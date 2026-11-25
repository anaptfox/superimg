import { describe, expect, it } from "vitest";
import { createMediaIR, video } from "@superimg/types";
import { timelineFromMediaIR } from "../ir/pure/timeline.js";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { boxedHtml } from "./__test-utils__/index.js";

describe("Media IR timeline", () => {
  it("retains audio source, role, visibility, mix and unquantized placement", async () => {
    const media = video({
      duration: "3s", fps: 30,
      audio: { clips: [{ id: "voice", src: "voice.wav", role: "voice", at: "0.15s", duration: "1s", volume: 0.4, loop: true, showInTimeline: false }] },
      render: () => boxedHtml("<div></div>"),
    });
    const { ir } = await resolveMediaIR(media);
    const item = timelineFromMediaIR(ir).lanes.find((lane) => lane.kind === "audio")?.items[0];
    expect(item?.meta).toMatchObject({ src: "voice.wav", role: "voice", volume: 0.4, loop: true, showInTimeline: false, startSeconds: 0.15, endSeconds: 1.15 });
  });
  it("projects passive scenes, tracks, and motions", () => {
    const ir = createMediaIR({
      sourceId: "timeline",
      override: {
        tracks: [
          {
            id: "audio::voice",
            kind: "audio",
            sceneId: "default",
            range: { startFrame: 0, endFrame: 90 },
            src: "voice.wav",
          },
        ],
        motions: [
          {
            id: "default::title.enter",
            localId: "title.enter",
            sceneId: "default",
            kind: "motion",
            enter: { startFrame: 0, endFrame: 15 },
          },
        ],
      },
    });

    const timeline = timelineFromMediaIR(ir);
    expect(timeline.lanes.map((lane) => lane.kind)).toEqual([
      "scene",
      "phase",
      "audio",
      "motion",
      "opaque",
    ]);
  });
});

describe("audio timeline migration", () => {
  it("groups visible clips by role without losing their exact resolved values", async () => {
    const media = video({ duration: "3s", fps: 30, audio: { clips: [
      { id: "voice", label: "Narrator", src: "voice.wav", role: "voice", at: "0.15s", duration: "1s", volume: 0.4, loop: true },
      { id: "music", src: "music.wav", role: "music", at: "0.3s", duration: "2s" },
      { id: "hidden", src: "hidden.wav", role: "voice", duration: "1s", showInTimeline: false },
    ] }, render: () => boxedHtml("<div></div>") });
    const { ir } = await resolveMediaIR(media);
    expect(timelineFromMediaIR(ir).lanes.find(lane => lane.id === "audio")?.items).toHaveLength(3);
    const timeline = timelineFromMediaIR(ir, { audioLanes: "role", includeHiddenAudio: false });
    const audio = timeline.lanes.filter(lane => lane.kind === "audio");
    expect(audio.map(lane => lane.id)).toEqual(["audio-music", "audio-voice"]);
    expect(audio.flatMap(lane => lane.items).map(item => item.meta?.src)).toEqual(["music.wav", "voice.wav"]);
    expect(audio[1]!.items[0]).toMatchObject({ label: "Narrator", meta: { src: "voice.wav", role: "voice", showInTimeline: true, volume: 0.4, loop: true, startSeconds: 0.15, endSeconds: 1.15 } });
    expect(audio[1]!.items[0]!.range).toEqual({ startFrame: 5, endFrame: 35 });
    expect(timeline.durationSeconds).toBe(3);
    expect(timelineFromMediaIR(ir, { audioLanes: "role", includeHiddenAudio: true }).lanes.find(lane => lane.id === "audio-voice")?.items).toHaveLength(2);
  });
  it("returns a scene timeline without audio lanes when audio is absent or hidden", async () => {
    const make = (audio?: { id: string; src: string; showInTimeline: boolean }) => video({ duration: "1s", fps: 30, ...(audio ? { audio } : {}), render: () => boxedHtml("<div></div>") });
    for (const media of [make(), make({ id: "hidden", src: "hidden.wav", showInTimeline: false })]) {
      const { ir } = await resolveMediaIR(media);
      const timeline = timelineFromMediaIR(ir, { audioLanes: "role", includeHiddenAudio: false });
      expect(timeline.lanes.some(lane => lane.kind === "audio")).toBe(false);
      expect(timeline.lanes.some(lane => lane.kind === "scene")).toBe(true);
    }
  });
});

it("keeps unclassified and unknown audio roles and does not hide other track kinds", () => {
  const ir = createMediaIR({ sourceId: "roles", override: { tracks: [
    { id: "unclassified", kind: "audio", sceneId: "default", range: { startFrame: 0, endFrame: 1 } },
    { id: "custom", kind: "audio", role: "narration", sceneId: "default", range: { startFrame: 0, endFrame: 1 } },
    { id: "text", kind: "transcript", sceneId: "default", range: { startFrame: 0, endFrame: 1 }, meta: { showInTimeline: false } },
  ] } });
  const timeline = timelineFromMediaIR(ir, { audioLanes: "role", includeHiddenAudio: false });
  expect(timeline.lanes.filter(lane => lane.kind === "audio").map(lane => lane.id)).toEqual(["audio-narration", "audio-unclassified"]);
  expect(timeline.lanes.find(lane => lane.kind === "transcript")?.items[0]?.id).toBe("text");
});
