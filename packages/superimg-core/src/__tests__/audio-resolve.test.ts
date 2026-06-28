import { describe, it, expect } from "vitest";
import {
  normalizeAudioInput,
  ensureClipIds,
  inferAudioRole,
  resolveAudioTimeline,
} from "../shared/audio-resolve.js";
import { buildTimelineModel } from "../shared/timeline-model.js";
import { compose } from "../composition/compose.js";
import { scene } from "../composition/scene.js";
import { define } from "@superimg/types";

describe("audio-resolve", () => {
  it("normalizes clip shapes", () => {
    const clip = { id: "bed", src: "a.mp3", role: "music" as const };
    expect(normalizeAudioInput(clip).clips).toEqual([clip]);
    expect(normalizeAudioInput([clip]).clips).toEqual([clip]);
    expect(normalizeAudioInput({ clips: [clip] }).clips).toEqual([clip]);
  });

  it("round-trips through JSON", () => {
    const input = {
      clips: [
        {
          id: "vo",
          src: "voice.mp3",
          role: "voice",
          atScene: "ch1",
          fadeIn: "0.5s",
        },
      ],
      mix: { ducking: true },
    };
    const parsed = JSON.parse(JSON.stringify(input));
    expect(normalizeAudioInput(parsed)).toEqual(parsed);
  });

  it("auto-generates clip ids", () => {
    const { clips, warnings } = ensureClipIds([{ src: "bed.mp3" }]);
    expect(clips[0]?.id).toBe("clip-0");
    expect(warnings.length).toBe(1);
  });

  it("infers role from filename", () => {
    expect(inferAudioRole({ src: "assets/ch1-vo.mp3" })).toBe("voice");
    expect(inferAudioRole({ src: "assets/lofi-bg.mp3" })).toBe("music");
  });

  it("resolves atScene against compose scenes", () => {
    const resolved = resolveAudioTimeline(
      {
        clips: [
          { id: "vo", src: "ch1.mp3", role: "voice", atScene: "ch1" },
          { id: "bed", src: "bed.mp3", role: "music", loop: true },
        ],
      },
      {
        fps: 30,
        videoDurationSeconds: 60,
        scenes: [
          { id: "hook", startSeconds: 0, endSeconds: 8 },
          { id: "ch1", startSeconds: 8, endSeconds: 53 },
          { id: "outro", startSeconds: 53, endSeconds: 60 },
        ],
      },
    );

    expect(resolved?.clips.find((c) => c.id === "vo")?.atSeconds).toBe(8);
    expect(resolved?.mix.ducking).toBe(true);
  });

  it("buildTimelineModel exposes video and audio lanes", () => {
    const hook = define({
      config: { fps: 30, duration: 2 },
      sample: {},
      render: () => "<div></div>",
    });
    const main = define({
      config: { fps: 30, duration: 3 },
      sample: {},
      render: () => "<div></div>",
    });
    const template = compose(
      [
        scene(hook, { id: "hook", duration: "2s" }),
        scene(main, {
          id: "ch1",
          duration: "3s",
          audio: { id: "vo", src: "ch1.mp3", role: "voice" },
        }),
      ],
      {
        config: {
          audio: {
            clips: [{ id: "bed", src: "bed.mp3", role: "music", loop: true }],
            mix: { ducking: true },
          },
        },
      },
    );

    const resolved = resolveAudioTimeline(template.config?.audio, {
      fps: 30,
      videoDurationSeconds: 5,
      scenes: [
        { id: "hook", startSeconds: 0, endSeconds: 2 },
        { id: "ch1", startSeconds: 2, endSeconds: 5 },
      ],
    });

    const model = buildTimelineModel(template, resolved);
    expect(model?.tracks.find((t) => t.id === "video")?.items).toHaveLength(2);
    expect(model?.tracks.find((t) => t.id === "audio-music")?.items[0]?.id).toBe("bed");
    expect(model?.tracks.find((t) => t.id === "audio-voice")?.items[0]?.startSeconds).toBe(2);
  });
});