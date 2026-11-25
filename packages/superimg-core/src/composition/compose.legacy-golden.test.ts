import { describe, expect, it } from "vitest";
import { type JsonObject, type MediaDefinition, type RenderContext, video } from "@superimg/types";
import { compose } from "./compose.js";
import { asMarkup, boxedHtml, makeTestContext } from "../__tests__/__test-utils__/index.js";

interface ChapterData extends JsonObject {
  chapter: string;
  cue: string;
}

function chapter(
  duration: `${number}s`,
  sample: ChapterData,
  fps: number,
  width: number,
  height: number,
) {
  return video<ChapterData>({
    duration,
    fps,
    size: { width, height },
    sample,
    render: (ctx) => boxedHtml(JSON.stringify({
      chapter: ctx.data.chapter,
      cue: ctx.data.cue,
      sceneId: ctx.sceneId,
      sceneIndex: ctx.sceneIndex,
      frame: ctx.timeline.frame,
      seconds: ctx.timeline.seconds,
      progress: ctx.timeline.progress,
    })),
  });
}

function renderedFrame(
  film: MediaDefinition<ChapterData, "video", RenderContext<ChapterData>>,
  globalFrame: number,
  totalFrames: number,
  data: Partial<ChapterData> = {},
) {
  const context = {
    ...makeTestContext({
      globalFrame,
      fps: 24,
      totalFrames,
    }),
    // Composition merges this runtime patch over every occurrence's sample.
    data: data as ChapterData,
  } satisfies RenderContext<ChapterData>;
  return JSON.parse(asMarkup(film.render(context)));
}

describe("legacy compose() frame goldens", () => {
  it("keeps compose-demo cuts, scene clocks, and duration trimming frame-exact", () => {
    const firstLight = chapter("2s", { chapter: "first-light", cue: "sample" }, 24, 1280, 720);
    const midday = chapter("5s", { chapter: "midday", cue: "sample" }, 24, 1280, 720);
    const dusk = chapter("1s", { chapter: "dusk", cue: "sample" }, 24, 1280, 720);
    const film = compose(
      [
        { template: firstLight, id: "first-light", data: { cue: "scene" } },
        // This cut is intentionally shorter than the source chapter, as an editor trim would be.
        { template: midday, id: "midday", duration: "3f" },
        { template: dusk, id: "dusk" },
      ],
      { config: { fps: 24, width: 1280, height: 720 } },
    );

    // 48 frames of first light + a 3-frame midday trim + 24 frames of dusk.
    expect(film.config).toMatchObject({ fps: 24, width: 1280, height: 720, duration: 75 / 24 });

    const frames = [0, 47, 48, 50, 51, 74].map((frame) =>
      renderedFrame(film, frame, 75, { cue: "run" }),
    );
    expect(frames).toEqual([
      { chapter: "first-light", cue: "run", sceneId: "first-light", sceneIndex: 0, frame: 0, seconds: 0, progress: 0 },
      { chapter: "first-light", cue: "run", sceneId: "first-light", sceneIndex: 0, frame: 47, seconds: 2, progress: 1 },
      { chapter: "midday", cue: "run", sceneId: "midday", sceneIndex: 1, frame: 0, seconds: 0, progress: 0 },
      { chapter: "midday", cue: "run", sceneId: "midday", sceneIndex: 1, frame: 2, seconds: 0.125, progress: 1 },
      { chapter: "dusk", cue: "run", sceneId: "dusk", sceneIndex: 2, frame: 0, seconds: 0, progress: 0 },
      { chapter: "dusk", cue: "run", sceneId: "dusk", sceneIndex: 2, frame: 23, seconds: 1, progress: 1 },
    ]);
  });

  it("keeps documentary-style audio anchored to scene starts while retaining composition config", () => {
    const title = chapter("1s", { chapter: "title", cue: "sample" }, 10, 1920, 1080);
    const chapterOne = chapter("2s", { chapter: "zoetrope", cue: "sample" }, 10, 1920, 1080);
    const colophon = chapter("1s", { chapter: "colophon", cue: "sample" }, 10, 1920, 1080);
    const reel = compose(
      [
        {
          id: "title",
          template: title,
          audio: { id: "title-voice", src: "title.mp3", role: "voice" },
        },
        {
          id: "zoetrope",
          template: chapterOne,
          duration: "5f",
          audio: {
            id: "zoetrope-voice",
            src: "zoetrope.mp3",
            role: "voice",
            trim: { in: "200ms", out: "800ms" },
          },
        },
        { id: "colophon", template: colophon },
      ],
      {
        config: {
          fps: 10,
          width: 1920,
          height: 1080,
          audio: {
            clips: [{ id: "bed", src: "bed.mp3", role: "music", at: "250ms", loop: true }],
            mix: { ducking: true, duckingLevel: 0.25 },
          },
        },
      },
    );

    // title is [0, 10), zoetrope is its 5-frame trim [10, 15), then colophon.
    expect(reel.config).toMatchObject({ fps: 10, width: 1920, height: 1080, duration: 2.5 });
    expect(reel.config?.audio).toEqual({
      clips: [
        { id: "bed", src: "bed.mp3", role: "music", at: "250ms", loop: true },
        { id: "title-voice", src: "title.mp3", role: "voice", at: 0 },
        {
          id: "zoetrope-voice",
          src: "zoetrope.mp3",
          role: "voice",
          trim: { in: "200ms", out: "800ms" },
          at: 1,
        },
      ],
      mix: { ducking: true, duckingLevel: 0.25 },
    });
  });
});
