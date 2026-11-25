import { describe, it, expect, vi } from "vitest";
import { compose } from "../composition/compose.js";
import { makeTestContext, asMarkup, boxedHtml } from "./__test-utils__/index.js";
import { collection, video, type JsonObject } from "@superimg/types";

interface Clip {
  id: string;
  title: string;
}

describe("compose", () => {
  it("composes different per-scene samples without a shared root data contract", () => {
    const title = video({ duration: "1s", sample: { title: "Hello" }, render: ctx => boxedHtml(ctx.data.title) });
    const count = video({ duration: "1s", sample: { count: 3 }, render: ctx => boxedHtml(String(ctx.data.count)) });
    const film = compose([title, { template: count, data: { count: 7 } }]);
    expect(asMarkup(film.render({ ...makeTestContext({ globalFrame: 0, totalFrames: 60 }), data: {} }))).toBe("Hello");
    expect(asMarkup(film.render({ ...makeTestContext({ globalFrame: 30, totalFrames: 60 }), data: {} }))).toBe("7");
  });

  it("preserves data typing when lowered into a deterministic collection", () => {
    const chapter = video<Clip>({
      duration: "1s",
      render: (ctx) => boxedHtml(`<h1>${ctx.data.title}</h1>`),
    });
    const media = compose<Clip>([chapter, chapter]);
    const batch = collection({
      entries: [{ id: "intro", title: "Introduction" }],
      media,
    });

    expect(batch.media.kind).toBe("media");
    expect(batch.entries).toHaveLength(1);
  });
  it("scene transitions at exact frame boundary", () => {
    const scene1 = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("scene1"),
    });
    const scene2 = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("scene2"),
    });
    const composed = compose([scene1, scene2]);

    const ctx29 = makeTestContext({
      globalFrame: 29,
      fps: 30,
      totalFrames: 60,
    });
    const ctx30 = makeTestContext({
      globalFrame: 30,
      fps: 30,
      totalFrames: 60,
    });

    expect(asMarkup(composed.render(ctx29))).toBe("scene1");
    expect(asMarkup(composed.render(ctx30))).toBe("scene2");
  });

  it("ctx.director() uses scene-local progress inside composed render", () => {
    const scene = video<JsonObject>({
      duration: 2,
      render: (ctx) => boxedHtml(String(ctx.director().progress)),
    });
    const composed = compose([scene, scene]);
    const fps = 30;
    const totalFrames = 120;

    const ctxScene1End = makeTestContext({ globalFrame: 59, fps, totalFrames });
    expect(parseFloat(asMarkup(composed.render(ctxScene1End)))).toBe(1);

    const ctxScene2Start = makeTestContext({ globalFrame: 60, fps, totalFrames });
    expect(parseFloat(asMarkup(composed.render(ctxScene2Start)))).toBe(0);
  });

  it("timeline.progress is 0 at scene start, ~1 at scene end", () => {
    const scene = video<JsonObject>({
      duration: 1,
      render: (ctx) => boxedHtml(String(ctx.timeline.progress)),
    });
    const composed = compose([scene]);

    const ctxStart = makeTestContext({
      globalFrame: 0,
      fps: 30,
      totalFrames: 30,
    });
    const ctxEnd = makeTestContext({
      globalFrame: 29,
      fps: 30,
      totalFrames: 30,
    });

    expect(parseFloat(asMarkup(composed.render(ctxStart)))).toBe(0);
    expect(parseFloat(asMarkup(composed.render(ctxEnd)))).toBe(1);
  });

  it("data merges with correct precedence: data < scene data < CLI", () => {
    const scene = video<JsonObject>({
      sample: { a: 1, b: 1, c: 1 },
      duration: 1,
      render: (ctx) => boxedHtml(JSON.stringify(ctx.data)),
    });
    const composed = compose([{ template: scene, data: { b: 2, c: 2 } }]);
    const ctx = makeTestContext({ data: { c: 3 } });

    expect(JSON.parse(asMarkup(composed.render(ctx)))).toEqual({ a: 1, b: 2, c: 3 });
  });

  it("warns on dimension mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scene1 = video<JsonObject>({
      size: { width: 1920, height: 1080 },
      duration: 1,
      render: () => boxedHtml(""),
    });
    const scene2 = video<JsonObject>({
      size: { width: 1080, height: 1080 },
      duration: 1,
      render: () => boxedHtml(""),
    });

    compose([scene1, scene2]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Width conflict")
    );
    warn.mockRestore();
  });

  it("warns on FPS mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const scene1 = video<JsonObject>({
      fps: 30,
      duration: 1,
      render: () => boxedHtml(""),
    });
    const scene2 = video<JsonObject>({
      fps: 60,
      duration: 1,
      render: () => boxedHtml(""),
    });

    compose([scene1, scene2]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("FPS conflict")
    );
    warn.mockRestore();
  });

  it("throws when scenes array is empty", () => {
    expect(() => compose([])).toThrow(/at least one scene/);
  });

  it("lowers scene composition to an ordinary media definition", () => {
    const scene1 = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("a"),
    });
    const scene2 = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("b"),
    });
    const composed = compose([
      { template: scene1, id: "intro" },
      { template: scene2, id: "outro" },
    ]);

    expect(composed).toMatchObject({
      kind: "media",
      media: "video",
      fallbackFormat: "mp4",
      animated: true,
    });
    expect("type" in composed).toBe(false);
    expect("scenes" in composed).toBe(false);
    expect(asMarkup(composed.render(makeTestContext({ globalFrame: 0 })))).toBe("a");
    expect(asMarkup(composed.render(makeTestContext({ globalFrame: 30 })))).toBe("b");
  });

  it("passes scene metadata into render context", () => {
    const scene = video<JsonObject>({
      duration: 1,
      render: (ctx) =>
        boxedHtml(JSON.stringify({
          sceneIndex: ctx.sceneIndex,
          sceneId: ctx.sceneId,
          timelineFrame: ctx.timeline.frame,
          timelineProgress: ctx.timeline.progress,
        })),
    });
    const composed = compose([{ template: scene, id: "hero" }]);

    const mid = makeTestContext({ globalFrame: 15, fps: 30, totalFrames: 30 });
    const parsed = JSON.parse(asMarkup(composed.render(mid)));

    expect(parsed.sceneIndex).toBe(0);
    expect(parsed.sceneId).toBe("hero");
    expect(parsed.timelineFrame).toBe(15);
    expect(parsed.timelineProgress).toBeCloseTo(15 / 29, 5);
  });

  it("applies exit transition at scene end", () => {
    const scene = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("<div>content</div>"),
    });
    const composed = compose([
      {
        template: scene,
        exit: { type: "fade", duration: "500ms" },
      },
    ]);

    const nearEnd = makeTestContext({ globalFrame: 28, fps: 30, totalFrames: 30 });
    const html = asMarkup(composed.render(nearEnd));
    const match = html.match(/opacity:([\d.]+)/);
    expect(match).not.toBeNull();
    expect(parseFloat(match![1]!)).toBeLessThan(1);
  });

  it("parses frame-based scene duration", () => {
    const scene = video<JsonObject>({
      fps: 30,
      duration: 1,
      render: () => boxedHtml(""),
    });
    const composed = compose([{ template: scene, duration: "30f" }]);
    expect(composed.config?.duration).toBeCloseTo(1, 5);
    expect(composed.config?.fps).toBe(30);
  });

  it("applies easing to transitions", () => {
    const scene = video<JsonObject>({
      duration: 1,
      render: () => boxedHtml("<div>content</div>"),
    });
    const composed = compose([
      {
        template: scene,
        enter: { type: "fade", duration: "500ms", easing: "easeOutCubic" },
      },
    ]);

    // Render at frame 7 (7/30 = 0.233s into a 0.5s transition = ~47% progress)
    const ctx = makeTestContext({
      globalFrame: 7,
      fps: 30,
      totalFrames: 30,
    });

    const html = asMarkup(composed.render(ctx));
    // With easing, opacity should NOT match linear progress
    // easeOutCubic(0.47) ≈ 0.85, NOT 0.47
    expect(html).toContain("opacity:");
    const match = html.match(/opacity:([\d.]+)/);
    expect(match).not.toBeNull();
    const opacity = parseFloat(match![1]!);
    // Linear would give ~0.47, easeOutCubic gives ~0.85
    expect(opacity).toBeGreaterThan(0.7);
  });

  it("bakes scene audio atScene onto absolute at", () => {
    const scene = video<JsonObject>({
      duration: 2,
      render: () => boxedHtml(""),
    });
    const composed = compose([
      { template: scene, id: "title" },
      {
        template: scene,
        id: "zoetrope",
        audio: [{ id: "ch1-voice", src: "voice.mp3", role: "voice" }],
      },
    ]);

    const audio = composed.config?.audio;
    expect(audio && "clips" in audio).toBe(true);
    if (!audio || !("clips" in audio)) return;
    expect(audio.clips).toEqual([
      expect.objectContaining({
        id: "ch1-voice",
        at: 2,
      }),
    ]);
    expect(audio.clips[0]).not.toHaveProperty("atScene");
  });
});
