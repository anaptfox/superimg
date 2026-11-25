import { describe, expect, it } from "vitest";
import { collection, googleFont, image, svg, video, type Duration, type Program, type RenderContext } from "@superimg/types";
import { sequence } from "./sequence.js";
import { choose } from "./choose.js";
import { together } from "./together.js";
import { compositionSchedule, planComposition } from "./plan.js";
import { time } from "./time.js";
import { asMarkup, boxedHtml, boxedSvg, makeTestContext } from "../__tests__/__test-utils__/index.js";
import { createPreparedStdlibForTemplate } from "../shared/stdlib-capabilities.js";

const size = { width: 1920, height: 1080 };
const options = { size, fps: 25 };

function still(label: string) {
  return image({ size, render: () => boxedHtml(label) });
}

function clip(label: string, duration: Duration) {
  return video({ size, fps: 25, duration, render: (ctx) => boxedHtml(`${label}:${ctx.timeline.frame}`) });
}

describe("retained sequence plan", () => {
  it("samples a 24 fps child on a 30 fps output clock without changing its own timeline", () => {
    const child = video({ size, fps: 24, duration: "1s", render: (ctx) => boxedHtml(`source:${ctx.fps}:${ctx.timeline.frame}`) });
    const film = time(sequence([{ id: "source", content: child }]), { size, fps: 30 });
    expect(film.composition!.schedule.leaves[0]).toMatchObject({ path: "source", totalFrames: 30, fps: 24 });
    const frame = (at: number) => asMarkup(film.render(makeTestContext({ globalFrame: at, fps: 30, totalFrames: 30 })));
    expect(frame(0)).toBe("source:24:0");
    expect(frame(1)).toBe("source:24:0");
    expect(frame(2)).toBe("source:24:1");
    expect(frame(29)).toBe("source:24:23");
  });

  it("lifts mixed-fps child audio at its native frame offsets", () => {
    const child = video({ size, fps: 24, duration: "24f", audio: { id: "tone", src: "data:audio/wav;base64,UklGRiQAAABXQVZF", at: "12f" }, render: () => boxedHtml("audio") });
    const film = time(sequence([{ id: "source", content: child }]), { size, fps: 30 });
    const audio = film.config?.audio;
    expect(audio && "clips" in audio ? audio.clips[0] : undefined).toMatchObject({ at: 0.5, duration: 0.5 });
  });

  it("fits a nested group's authored canvas into its parent rect", () => {
    const inner = together([
      { id: "tile", content: image({ size: { width: 400, height: 200 }, render: () => boxedHtml("tile") }), hold: "1s", rect: { x: 0, y: 0, width: 400, height: 200 }, fit: "contain" },
    ], { end: "hide", size: { width: 400, height: 200 } });
    const outer = together([
      { id: "inner", content: inner, rect: { x: 100, y: 100, width: 800, height: 800 }, fit: "contain" },
    ], { end: "hide" });
    const film = time(outer, options);
    const html = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 25 })));
    expect(html).toContain("width:400px;height:200px;transform:scale(2)");
    expect(html).toContain("tile");
  });

  it("projects a root group onto a different delivery size from its authored canvas", () => {
    const program = together([
      { id: "tile", content: image({ size: { width: 400, height: 200 }, render: () => boxedHtml("tile") }), hold: "1s", rect: { x: 0, y: 0, width: 400, height: 200 }, fit: "contain" },
    ], { end: "hide", size: { width: 400, height: 200 } });
    const film = time(program, { size: { width: 800, height: 800 }, fps: 25 });
    const html = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 25, width: 800, height: 800 })));
    expect(html).toContain("width:400px;height:200px;transform:scale(2)");
    expect(film.composition!.program).toBe(program);
  });

  it("fits an authored nested group in a sequence onto the output canvas", () => {
    const group = together([
      { id: "tile", content: image({ size: { width: 400, height: 200 }, render: () => boxedHtml("tile") }), hold: "1s", rect: { x: 0, y: 0, width: 400, height: 200 }, fit: "contain" },
    ], { end: "hide", size: { width: 400, height: 200 } });
    const film = time(sequence([{ id: "group", content: group, fit: "contain" }]), { size: { width: 800, height: 800 }, fps: 25 });
    const html = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 25, width: 800, height: 800 })));
    expect(html).toContain("width:400px;height:200px;transform:scale(2)");
    expect(film.composition!.schedule.leaves[0]!.placementChain).toHaveLength(2);
  });

  it("applies nested data and extends the selected group's final frame", () => {
    const child = video({ size, fps: 25, duration: "1s", sample: { title: "sample", color: "blue" }, render: (ctx) => boxedHtml(`${ctx.data.title}:${ctx.data.color}:${ctx.timeline.frame}`) });
    const group = sequence([{ id: "child", content: child, data: { color: "green" } }]);
    const film = time(sequence([{ id: "group", content: group, data: { title: "parent" }, hold: "2s" }]), options);
    expect(film.composition!.schedule.totalFrames).toBe(50);
    expect(film.composition!.schedule.leaves[0]).toMatchObject({ path: "group/child", contentEndFrame: 25, endFrame: 50 });
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 49, fps: 25, totalFrames: 50 })))).toBe("parent:green:24");
  });
  it("lifts and deduplicates selected child fonts on the root definition", () => {
    const firstFont = { family: "Child Sans", weight: 400, src: new Uint8Array([0, 1, 2]) };
    const first = video({
      size,
      fps: 25,
      duration: "1f",
      fonts: [googleFont("Inter:wght@400"), firstFont],
      render: () => boxedHtml("first"),
    });
    const second = video({
      size,
      fps: 25,
      duration: "1f",
      fonts: [googleFont("Inter:wght@400"), { family: "Child Sans", style: "normal", src: new Uint8Array([0, 1, 2]) }],
      render: () => boxedHtml("second"),
    });

    const film = time(sequence([
      { id: "first", content: first },
      { id: "second", content: second },
    ]), options);

    expect(film.config?.fonts).toEqual([googleFont("Inter:wght@400"), firstFont]);
  });

  it("rejects different sources for one lifted local font face", () => {
    const first = image({ size, fonts: [{ family: "Child Sans", src: new Uint8Array([1]) }], render: () => boxedHtml("first") });
    const second = image({ size, fonts: [{ family: "Child Sans", src: new Uint8Array([2]) }], render: () => boxedHtml("second") });

    expect(() => time(sequence([
      { id: "first", content: first, hold: "1f" },
      { id: "second", content: second, hold: "1f" },
    ]), options)).toThrow(/font face "Child Sans" at 400\/normal has conflicting sources/);
  });

  it("rejects child-relative font paths before lifting them to the root", () => {
    const child = image({ size, fonts: [{ family: "Child Sans", src: "fonts/child.ttf" }], render: () => boxedHtml("child") });

    expect(() => time(sequence([
      { id: "chapter", content: child, hold: "1f" },
    ]), options)).toThrow(/chapter: font "Child Sans" has a relative src/);
  });

  it("lifts selected child audio onto the root clock with one shared mix", () => {
    const mix = { ducking: false };
    const first = video({
      size,
      fps: 25,
      duration: "10f",
      audio: { clips: [{ id: "tone", src: "data:audio/wav;base64,UklGRiQAAABXQVZF", at: "2f" }], mix },
      render: () => boxedHtml("first"),
    });
    const second = video({
      size,
      fps: 25,
      duration: "10f",
      audio: { clips: [{ id: "tone", src: "data:audio/wav;base64,UklGRiQAAABXQVZG", at: "2f" }], mix },
      render: () => boxedHtml("second"),
    });

    const film = time(sequence([
      { id: "first", content: first },
      { id: "second", content: second },
    ]), options);

    expect(film.config?.audio).toMatchObject({
      clips: [
        expect.objectContaining({ id: "first/tone" }),
        expect.objectContaining({ id: "second/tone" }),
      ],
      mix,
    });
    const rootAudio = film.config?.audio;
    expect(rootAudio && "clips" in rootAudio ? rootAudio.clips[0]?.at : undefined).toBeCloseTo(2 / 25);
    expect(rootAudio && "clips" in rootAudio ? rootAudio.clips[1]?.at : undefined).toBeCloseTo(12 / 25);
    expect(rootAudio && "clips" in rootAudio ? rootAudio.clips[0]?.duration : undefined).toBeCloseTo(8 / 25);
    expect(rootAudio && "clips" in rootAudio ? rootAudio.clips[1]?.duration : undefined).toBeCloseTo(8 / 25);
  });

  it("prepares optional stdlib capabilities used only inside a child", async () => {
    const child = video({
      size,
      fps: 25,
      duration: "1f",
      render: (ctx) => boxedHtml(ctx.std.code.highlight("const x = 1", { lang: "ts", theme: "dark-plus" })),
    });
    const film = time(sequence([{ id: "code", content: child }]), options);
    const prepared = await createPreparedStdlibForTemplate(film);
    expect(prepared.code.getThemes().length).toBeGreaterThan(0);
  });

  it("retains nested occurrence paths and exact half-open integer frame ranges", () => {
    const chapter = sequence([
      { id: "demo", content: clip("demo", "7f") },
      { id: "result", content: still("result"), hold: "1s" },
    ]);
    const story = sequence([
      { id: "opener", content: still("opener"), hold: "1s" },
      { id: "chapter", content: chapter },
    ]);

    const plan = planComposition(story, options);
    expect(plan.totalFrames).toBe(57);
    expect(plan.leaves.map(({ path, startFrame, endFrame, totalFrames }) => ({ path, startFrame, endFrame, totalFrames }))).toEqual([
      { path: "opener", startFrame: 0, endFrame: 25, totalFrames: 25 },
      { path: "chapter/demo", startFrame: 25, endFrame: 32, totalFrames: 7 },
      { path: "chapter/result", startFrame: 32, endFrame: 57, totalFrames: 25 },
    ]);
    expect(compositionSchedule(plan)).toEqual({
      fps: 25,
      totalFrames: 57,
      selectedRoutes: {},
      leaves: expect.arrayContaining([expect.objectContaining({ path: "chapter/demo", startFrame: 25, endFrame: 32 })]),
    });
  });

  it("projects the same retained Program with local child clocks", () => {
    const story = sequence([
      { id: "opener", content: still("opener"), hold: "1s" },
      { id: "demo", content: clip("demo", "7f") },
      { id: "result", content: still("result"), hold: "1s" },
    ]);
    const film = time(story, options);
    expect(film.composition?.schedule.totalFrames).toBe(57);
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 24, fps: 25, totalFrames: 57 })))).toBe("opener");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 25, fps: 25, totalFrames: 57 })))).toBe("demo:0");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 31, fps: 25, totalFrames: 57 })))).toBe("demo:6");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 32, fps: 25, totalFrames: 57 })))).toBe("result");
  });

  it("fits an authored Program into a delivery canvas without changing its child canvas", () => {
    const authoredSize = { width: 1280, height: 720 };
    const child = video({
      size: authoredSize,
      fps: 25,
      duration: "1f",
      render: (ctx) => boxedHtml(`${ctx.width}x${ctx.height}`),
    });
    const film = time(sequence([{ id: "child", content: child }]), { size: authoredSize, fps: 25 });

    const wide = asMarkup(film.render(makeTestContext({ width: 1920, height: 1080, fps: 25, totalFrames: 1 })));
    expect(wide).toContain("width:1920px;height:1080px");
    expect(wide).toContain("transform:scale(1.5)");
    expect(wide).toContain("1280x720");

    const square = asMarkup(film.render(makeTestContext({ width: 1080, height: 1080, fps: 25, totalFrames: 1 })));
    expect(square).toContain("top:236.25px");
    expect(square).toContain("transform:scale(0.84375)");
    expect(square).toContain("1280x720");
  });

  it("allows the same source under distinct occurrence paths", () => {
    const source = still("same");
    const program = sequence([
      { id: "first", content: source, hold: "1f" },
      { id: "second", content: source, hold: "1f" },
    ]);
    expect(planComposition(program, options).leaves.map((leaf) => leaf.path)).toEqual(["first", "second"]);
  });

  it("maps landscape, square, and portrait children with explicit fit and keeps each authored canvas", () => {
    const landscape = video({ size: { width: 1920, height: 1080 }, fps: 25, duration: "1f", render: (ctx) => boxedHtml(`landscape:${ctx.width}x${ctx.height}`) });
    const square = image({ size: { width: 1080, height: 1080 }, render: (ctx) => boxedHtml(`square:${ctx.width}x${ctx.height}`) });
    const portrait = image({ size: { width: 1080, height: 1920 }, render: (ctx) => boxedHtml(`portrait:${ctx.width}x${ctx.height}`) });
    const program = sequence([
      { id: "landscape", content: landscape },
      { id: "square", content: square, hold: "1f", fit: "contain" },
      { id: "portrait", content: portrait, hold: "1f", fit: "cover" },
    ]);
    const plan = planComposition(program, options);
    expect(plan.leaves.map(({ path, width, height, fit }) => ({ path, width, height, fit }))).toEqual([
      { path: "landscape", width: 1920, height: 1080, fit: undefined },
      { path: "square", width: 1080, height: 1080, fit: "contain" },
      { path: "portrait", width: 1080, height: 1920, fit: "cover" },
    ]);
    const film = time(program, options);
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 3 })))).toContain("square:1080x1080");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 2, fps: 25, totalFrames: 3 })))).toContain("portrait:1080x1920");
    expect(() => time(sequence([{ id: "missing-fit", content: square, hold: "1f" }]), options)).toThrow(/requires an explicit fit/);
    expect(() => time(sequence([{ id: "invalid-fit", content: square, hold: "1f", fit: "stretch" as never }]), options)).toThrow(/fit must be contain, cover, or reflow/);
  });

  it("reflows a child at its direct target canvas while retaining its path, local clock, and assets", () => {
    const square = video({
      size: { width: 1080, height: 1080 },
      fps: 25,
      duration: "2f",
      assets: { logo: { url: "https://example.test/logo.png", type: "image" } },
      render: (ctx) => boxedHtml(`${ctx.sceneId}:${ctx.timeline.frame}:${ctx.width}x${ctx.height}:${ctx.asset("logo")}`),
    });
    const film = time(sequence([{ id: "square", content: square, fit: "reflow" }]), options);

    expect(film.composition?.schedule.leaves[0]).toMatchObject({ path: "square", fit: "reflow", width: 1080, height: 1080 });
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 2 })))).toBe("square:1:1920x1080:https://example.test/logo.png");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 2, asset: (key: string) => `memory://${key}` })))).toBe("square:1:1920x1080:memory://square/logo");
  });

  it("reflows a directly placed child at its rect without scaling its authored canvas", () => {
    const square = video({
      size: { width: 1080, height: 1080 },
      fps: 25,
      duration: "1f",
      render: (ctx) => boxedHtml(`square:${ctx.width}x${ctx.height}:${ctx.timeline.frame}`),
    });
    const film = time(sequence([{
      id: "stage",
      content: together([
        { id: "square", content: square, rect: { x: 100, y: 200, width: 960, height: 540 }, fit: "reflow" },
      ], { end: "hide" }),
    }]), options);
    const markup = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 1 })));

    expect(markup).toContain("square:960x540:0");
    expect(markup).toContain("left:100px;top:200px;width:960px;height:540px;overflow:hidden");
    expect(markup).not.toContain("transform:scale(");
  });

  it("reflows only at a leaf's immediate nested target, then maps that target through its parent coordinate system", () => {
    const inner = together([
      { id: "leaf", content: clip("inner", "1f"), rect: { x: 0, y: 0, width: 960, height: 540 }, fit: "reflow" },
    ], { end: "hide" });
    const outer = together([
      { id: "inner", content: inner, rect: { x: 100, y: 200, width: 480, height: 270 }, fit: "cover" },
    ], { end: "hide" });
    const film = time(sequence([{ id: "outer", content: outer }]), options);
    const markup = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 1 })));
    // The leaf sees its own inner target. The outer cover maps the inner
    // group's 960×540 canvas into the enclosing rectangle without changing it.
    expect(markup).toContain("inner:0");
    expect(markup).toContain("left:100px;top:200px;width:480px;height:270px");
    expect(markup).toContain("transform:scale(0.5)");
  });

  it("selects child variants and editions once, retaining the chosen rendition on the leaf", () => {
    const source = video({
      size,
      fps: 25,
      duration: "1f",
      sample: { title: "base" },
      variants: { compact: { title: "compact" } },
      editions: {
        square: {
          size: { width: 1080, height: 1080 },
          render: (ctx) => boxedHtml(`${ctx.data.title}:${ctx.width}x${ctx.height}`),
        },
      },
      render: (ctx) => boxedHtml(`${ctx.data.title}:${ctx.width}x${ctx.height}`),
    });
    const film = time(sequence([{
      id: "card",
      content: source,
      variant: "compact",
      edition: "square",
      fit: "contain",
    }]), options);

    expect(film.composition?.schedule.leaves[0]).toMatchObject({
      path: "card", width: 1080, height: 1080, variantId: "compact", editionId: "square",
    });
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 1 })))).toContain("compact:1080x1080");
    expect(() => time(sequence([{ id: "missing", content: source, variant: "nope" }]), options)).toThrow(/unknown child variant/);
    expect(() => time(sequence([{ id: "missing", content: source, edition: "nope" }]), options)).toThrow(/unknown child edition/);
  });

  it("lifts child presentation CSS to the shared root document and composes HTML with SVG leaves", () => {
    const html = video({
      size,
      fps: 25,
      duration: "1f",
      inlineCss: [".html-child{color:tomato}"],
      stylesheets: ["https://example.test/child.css"],
      render: () => boxedHtml('<div class="html-child">html leaf</div>'),
    });
    const vector = svg({
      size: { width: 600, height: 180 },
      inlineCss: ["svg{overflow:visible}"],
      render: () => boxedSvg("<text>svg leaf</text>", 600, 180),
    });
    const film = time(sequence([{
      id: "stage",
      content: together([
        { id: "html", content: html, rect: { x: 0, y: 0, width: 960, height: 540 }, fit: "contain" },
        { id: "vector", content: vector, hold: "1f", rect: { x: 960, y: 0, width: 960, height: 540 }, fit: "contain" },
      ], { end: "hide" }),
    }]), options);

    expect(film.medium).toBe("html");
    expect(film.config?.inlineCss).toEqual([".html-child{color:tomato}", "svg{overflow:visible}"]);
    expect(film.config?.stylesheets).toEqual(["https://example.test/child.css"]);
    const markup = asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 1 })));
    expect(markup).toContain("html leaf");
    expect(markup).toContain("svg leaf");
    expect(markup).toContain("left:960px;top:0px;width:960px;height:540px");
    expect(markup).toContain("transform:scale(1.6)");
  });

  it("rejects incompatible child Tailwind configurations in the one shared root document", () => {
    const first = video({ size, fps: 25, duration: "1f", tailwind: true, render: () => boxedHtml("first") });
    const second = video({
      size,
      fps: 25,
      duration: "1f",
      tailwind: { css: "@theme { --color-accent: #f00; }" },
      render: () => boxedHtml("second"),
    });
    expect(() => time(sequence([
      { id: "first", content: first },
      { id: "second", content: second },
    ]), options)).toThrow(/Tailwind config conflicts/);
  });

  it("applies per-occurrence data patches to reused sources", () => {
    const source = video({
      size,
      fps: 25,
      duration: "1f",
      sample: { title: "default", color: "blue" },
      render: (ctx) => boxedHtml(`${ctx.data.title}:${ctx.data.color}`),
    });
    const film = time(sequence([
      { id: "first", content: source, data: { title: "first" } },
      { id: "second", content: source, data: { title: "second", color: "red" } },
    ]), options);
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 2 })))).toBe("first:blue");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 2 })))).toBe("second:red");
    expect(() => film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 2, data: { title: "root" } }))).toThrow(/root data keys/);
  });

  it("does not expose shared nested data for a child render to mutate", () => {
    const patch = { settings: { label: "original" } };
    const source = video({
      size,
      fps: 25,
      duration: "1f",
      render: (ctx) => {
        const settings = ctx.data.settings as { label: string };
        try { settings.label = "changed"; } catch { /* immutable snapshot */ }
        return boxedHtml(settings.label);
      },
    });
    const film = time(sequence([
      { id: "first", content: source, data: patch },
      { id: "second", content: source, data: patch },
    ]), options);
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 2 })))).toBe("original");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 2 })))).toBe("original");
    expect(patch.settings.label).toBe("original");
    expect(Object.isFrozen(patch.settings)).toBe(false);
  });

  it("uses one retained program for isolated collection entry data", () => {
    const source = video({
      size,
      fps: 25,
      duration: "1f",
      sample: { title: "default" },
      render: (ctx) => boxedHtml(String(ctx.data.title)),
    });
    const entries = [
      { id: "first", uses: { card: { title: "Alpha" } } },
      { id: "second", uses: { card: { title: "Beta" } } },
    ];
    const film = time<(typeof entries)[number]>(sequence([{ id: "card", content: source }]), options);
    const family = collection({ entries, media: film });
    expect(family.kind).toBe("collection");
    const renderEntry = (data: (typeof entries)[number]) =>
      film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 1, data }) as RenderContext<(typeof entries)[number]>);
    expect(asMarkup(renderEntry(entries[0]!))).toBe("Alpha");
    expect(asMarkup(renderEntry(entries[1]!))).toBe("Beta");
    expect(() => film.render(makeTestContext({ data: { title: "not scoped" } }) as never)).toThrow(/root data keys/);
    expect(() => film.render(makeTestContext({ data: { uses: { absent: { title: "bad" } } } }) as never)).toThrow(/not a selected leaf/);
  });

  it("selects an explicit choice route, shifts later ranges, and gives the selected branch a local clock", () => {
    const lesson = choose({
      beginner: sequence([{ id: "walkthrough", content: clip("beginner", "2f") }]),
      advanced: sequence([{ id: "deep-dive", content: clip("advanced", "4f") }]),
    });
    const story = sequence([
      { id: "opener", content: clip("opener", "1f") },
      { id: "lesson", content: lesson },
      { id: "closing", content: clip("closing", "1f") },
    ]);
    const beginner = planComposition(story, { ...options, routes: { lesson: "beginner" } });
    const advanced = planComposition(story, { ...options, routes: { lesson: "advanced" } });
    expect(beginner.selectedRoutes).toEqual({ lesson: "beginner" });
    expect(beginner.leaves.map(({ path, startFrame, endFrame }) => ({ path, startFrame, endFrame }))).toEqual([
      { path: "opener", startFrame: 0, endFrame: 1 },
      { path: "lesson/beginner/walkthrough", startFrame: 1, endFrame: 3 },
      { path: "closing", startFrame: 3, endFrame: 4 },
    ]);
    expect(advanced.leaves.at(-1)).toMatchObject({ path: "closing", startFrame: 5, endFrame: 6 });

    const film = time(story, { ...options, routes: { lesson: "advanced" } });
    expect(film.composition?.schedule.selectedRoutes).toEqual({ lesson: "advanced" });
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 6 })))).toBe("advanced:0");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 4, fps: 25, totalFrames: 6 })))).toBe("advanced:3");
  });

  it("requires a valid route for every reachable choice and rejects unused route keys", () => {
    const lesson = choose({ beginner: clip("beginner", "1f"), advanced: clip("advanced", "2f") });
    const story = sequence([{ id: "lesson", content: lesson }]);
    expect(() => time(story, options)).toThrow(/requires an explicit route/);
    expect(() => time(story, { ...options, routes: { lesson: "missing" } })).toThrow(/not a declared path/);
    expect(() => time(story, { ...options, routes: { lesson: "beginner", other: "advanced" } })).toThrow(/does not target a choice/);
  });

  it("places simultaneous children on one clock, holds shorter terminal leaves, and advances sequence after the longest child", () => {
    const left = sequence([
      { id: "intro", content: clip("left-intro", "1f") },
      { id: "outro", content: clip("left-outro", "1f") },
    ]);
    const right = clip("right", "4f");
    const comparison = together([
      { id: "left", content: left, rect: { x: 0, y: 0, width: 960, height: 1080 }, fit: "contain" },
      { id: "right", content: right, rect: { x: 960, y: 180, width: 960, height: 720 }, fit: "cover" },
    ], { end: "hold" });
    const film = time(sequence([
      { id: "comparison", content: comparison },
      { id: "closing", content: clip("closing", "1f") },
    ]), options);
    const leaves = film.composition!.schedule.leaves;
    expect(leaves).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "comparison/left/outro", startFrame: 1, contentEndFrame: 2, endFrame: 4, placement: expect.objectContaining({ groupPath: "comparison", end: "hold", fit: "contain" }) }),
      expect.objectContaining({ path: "comparison/right", startFrame: 0, endFrame: 4, placement: expect.objectContaining({ groupPath: "comparison", end: "hold", fit: "cover" }) }),
      expect.objectContaining({ path: "closing", startFrame: 4, endFrame: 5 }),
    ]));
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 0, fps: 25, totalFrames: 5 })))).toContain("left-intro:0");
    const held = asMarkup(film.render(makeTestContext({ globalFrame: 2, fps: 25, totalFrames: 5 })));
    expect(held).toContain("left-outro:0");
    expect(held).toContain("right:2");
    expect(asMarkup(film.render(makeTestContext({ globalFrame: 4, fps: 25, totalFrames: 5 })))).toBe("closing:0");
  });

  it("hides shorter placed children while keeping the group alive through its longest child", () => {
    const comparison = together([
      { id: "short", content: clip("short", "1f"), rect: { x: 0, y: 0, width: 960, height: 1080 }, fit: "contain" },
      { id: "long", content: clip("long", "3f"), rect: { x: 960, y: 0, width: 960, height: 1080 }, fit: "contain" },
    ], { end: "hide" });
    const film = time(sequence([{ id: "comparison", content: comparison }]), options);
    expect(film.composition!.schedule.totalFrames).toBe(3);
    const middle = asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 3 })));
    expect(middle).not.toContain("short:");
    expect(middle).toContain("long:1");
  });

  it("keeps a hide group alive when its longest child is listed before a shorter child", () => {
    const comparison = together([
      { id: "long", content: clip("long", "3f"), rect: { x: 0, y: 0, width: 960, height: 1080 }, fit: "contain" },
      { id: "short", content: clip("short", "1f"), rect: { x: 960, y: 0, width: 960, height: 1080 }, fit: "contain" },
    ], { end: "hide" });
    const plan = planComposition(sequence([{ id: "comparison", content: comparison }]), options);
    expect(plan.totalFrames).toBe(3);
    expect(plan.leaves.map(({ path, endFrame }) => ({ path, endFrame }))).toEqual([
      { path: "comparison/long", endFrame: 3 },
      { path: "comparison/short", endFrame: 1 },
    ]);
  });

  it("composes nested together placements while retaining named paths and each child clock", () => {
    const inner = together([
      { id: "leaf", content: clip("inner", "2f"), rect: { x: 0, y: 0, width: 960, height: 540 }, fit: "contain" },
    ], { end: "hide" });
    const outer = together([
      { id: "inner", content: inner, rect: { x: 100, y: 200, width: 960, height: 540 }, fit: "cover" },
    ], { end: "hide" });
    const film = time(sequence([{ id: "outer", content: outer }]), options);
    const leaf = film.composition!.schedule.leaves[0]!;
    expect(leaf.path).toBe("outer/inner/leaf");
    expect(leaf.startFrame).toBe(0);
    expect(leaf.totalFrames).toBe(2);
    expect(leaf.placementChain).toEqual([
      expect.objectContaining({ groupPath: "outer", rect: { x: 100, y: 200, width: 960, height: 540 }, fit: "cover" }),
      expect.objectContaining({ groupPath: "outer/inner", rect: { x: 0, y: 0, width: 960, height: 540 }, fit: "contain" }),
    ]);
    const markup = asMarkup(film.render(makeTestContext({ globalFrame: 1, fps: 25, totalFrames: 2 })));
    expect(markup).toContain("left:100px;top:200px;width:960px;height:540px");
    expect(markup).toContain("inner:1");
  });

  it("rejects invalid sibling identity, missing still holds, and projected children", () => {
    const source = still("same");
    expect(() => sequence([{ id: "bad/id", content: source, hold: "1s" }])).toThrow(/safe path segment/);
    expect(() => sequence([{ id: "one", content: source }, { id: "one", content: source }])).toThrow(/duplicate sibling id/);
    expect(() => planComposition(sequence([{ id: "still", content: source }]), options)).toThrow(/still children require an explicit hold/);
    const projected = time(sequence([{ id: "still", content: source, hold: "1s" }]), options);
    expect(() => time(sequence([{ id: "nested", content: projected }]), options)).toThrow(/cannot be used as a child/);
    const cyclic = { op: "sequence", parts: [] } as unknown as Program;
    ((cyclic as unknown as { parts: unknown[] }).parts).push({ id: "self", content: cyclic });
    expect(() => sequence([{ id: "cycle", content: cyclic }])).toThrow(/cyclic Program graph/);
    expect(() => planComposition(cyclic, options)).toThrow(/cyclic Program graph/);
    expect(() => planComposition(sequence([{ id: "zero", content: clip("zero", "0f") }]), options)).toThrow(/whole positive safe output-frame count/);
    expect(() => planComposition(sequence([{ id: "huge", content: clip("huge", "999999999999999999999f" as Duration) }]), options)).toThrow(/whole positive safe output-frame count/);
  });

  it("accepts portable child assets and still rejects unselected choices", () => {
    const assetChild = video({ size, fps: 25, duration: "1f", assets: { logo: { url: "https://example.test/logo.png", type: "image" } }, render: () => boxedHtml("asset") });
    expect(planComposition(sequence([{ id: "asset", content: assetChild }]), options).leaves).toHaveLength(1);
    expect(() => planComposition({ op: "choose", paths: { a: still("a") } }, options)).toThrow(/requires an explicit route/);
  });
});
