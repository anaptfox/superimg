import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { define, video, type Duration, type JsonObject, type ResolveFn } from "@superimg/types";
import { compose } from "../composition/compose.js";
import { sequence } from "../composition/sequence.js";
import { choose } from "../composition/choose.js";
import { together } from "../composition/together.js";
import { time } from "../composition/time.js";
import { MediaIRError, resolveMediaIR } from "../ir/index.js";
import { boxedHtml } from "./__test-utils__/index.js";

describe("resolveMediaIR", () => {
  it("compiles deterministic media with schema-0 coordinates", async () => {
    const media = video<JsonObject>({
      sample: { title: "Hello" },
      duration: "0.5s",
      render(ctx) {
        const t = ctx.director({ enter: "30%", hold: "50%", exit: "20%" });
        const card = t.motion({ id: "title.enter", y: 20 });
        return boxedHtml(`<div style="${card.style}">${ctx.data.title}</div>`);
      },
    });

    const { ir } = await resolveMediaIR(media, {
      sourceId: "hello.media.ts",
      entryId: "intro",
      variantId: "dark",
      editionId: "square",
      programHash: "a".repeat(64),
    });

    expect(ir.schemaVersion).toBe(0);
    expect(ir.identity).toEqual({
      sourceId: "hello",
      entryId: "intro",
      variantId: "dark",
      editionId: "square",
    });
    expect(ir.motions.some((motion) => motion.localId === "title.enter")).toBe(true);
    expect(ir.capabilities).not.toHaveProperty("semantic");
    expect(ir.extensions).toEqual({
      "superimg.native": {
        schemaVersion: 0,
        payload: {
          portable: false,
          reasons: [{ reason: "Html" }],
        },
      },
    });
  });

  it("compiles static media as a timeless single frame", async () => {
    const media = define<JsonObject>({
      render(ctx) {
        return boxedHtml(`<div>${ctx.width}x${ctx.height}</div>`);
      },
    });
    const { ir } = await resolveMediaIR(media, { sourceId: "still" });
    expect(ir.animated).toBe(false);
    expect(ir.clock).toMatchObject({ durationSeconds: 0, totalFrames: 1 });
  });

  it("captures HTML without neutral scene payloads", async () => {
    const media = video({
      duration: "0.2s",
      fps: 10,
      render: (ctx) => boxedHtml(`<div>${ctx.timeline.frame}</div>`),
    });
    const { captures } = await resolveMediaIR(media, { captureFrames: [0, 1] });
    expect(captures?.get(0)?.html).toContain("<div>0</div>");
    expect(captures?.get(1)?.html).toContain("<div>1</div>");
    expect(captures?.get(0)?.tree?.type).toBe("Html");
  });

  it("marks tree templates as visual: tree and captures the node", async () => {
    const { Frame, Text } = await import("@superimg/stdlib/tree");
    const media = video({
      duration: "0.2s",
      fps: 10,
      render: (ctx) =>
        Frame({ id: "root", width: ctx.width, height: ctx.height }, Text({ id: "title" }, "Hello")),
    });
    const { ir, captures } = await resolveMediaIR(media, {
      sourceId: "tree.media.ts",
      captureFrames: [0],
    });
    expect(ir.capabilities.visual).toBe("tree");
    expect(captures?.get(0)?.tree).toBeDefined();
    expect(captures?.get(0)?.html).toContain("Hello");
  });

  it("treats compose as an ordinary media definition", async () => {
    const first = video({ duration: "0.1s", fps: 10, render: () => boxedHtml("<p>first</p>") });
    const second = video({ duration: "0.1s", fps: 10, render: () => boxedHtml("<p>second</p>") });
    const media = compose([first, second]);
    const { ir } = await resolveMediaIR(media, { sourceId: "sequence" });
    expect(ir.identity.sourceId).toBe("sequence");
    expect(ir.clock.totalFrames).toBe(2);
  });

  it("prepares resolved retained children per occurrence before compiling IR", async () => {
    const resolve: ResolveFn<{ label: string; frames: number }> = ({ data }) => ({
      duration: `${data.frames}f` as Duration,
      data: { label: `${data.label}!` },
    });
    const child = video<{ label: string; frames: number }>({
      size: { width: 1200, height: 675 },
      fps: 25,
      // The authored projection needs a provisional duration. Preparation
      // re-times the program from each occurrence's resolved duration.
      duration: "1f",
      sample: { label: "sample", frames: 1 },
      resolve,
      render: (ctx) => boxedHtml(`${ctx.data.label}:${ctx.timeline.frame}`),
    });
    const media = time(sequence([
      { id: "short", content: child, data: { label: "short", frames: 2 } },
      { id: "long", content: child, data: { label: "long", frames: 3 } },
    ]), { size: { width: 1200, height: 675 }, fps: 25 });

    const { ir, captures } = await resolveMediaIR(media, {
      // One requested capture is enough: composition boundary captures are
      // collected while this same IR pass evaluates the prepared program.
      captureFrames: [0],
      data: { uses: { long: { label: "entry", frames: 3 } } },
    });

    expect(ir.clock.totalFrames).toBe(5);
    expect(ir.scenes.map(({ id, range }) => ({ id, range }))).toEqual([
      { id: "short", range: { startFrame: 0, endFrame: 2 } },
      { id: "long", range: { startFrame: 2, endFrame: 5 } },
    ]);
    expect(captures?.get(0)?.html).toContain("short!:0");
    expect(captures?.get(1)?.html).toContain("short!:1");
    expect(captures?.get(2)?.html).toContain("entry!:0");
    expect(captures?.get(4)?.html).toContain("entry!:2");
  });

  it("retains nested sequence identity, exact frames, and local phases in IR", async () => {
    const still = define({
      config: { width: 1200, height: 675 },
      render: () => boxedHtml("<p>still</p>"),
    });
    const demo = define({
      config: { width: 1200, height: 675, fps: 25, duration: "7f" },
      render(ctx) {
        ctx.director({ enter: "100%" });
        return boxedHtml(`<p>local frame ${ctx.timeline.frame}</p>`);
      },
    });
    const program = sequence([
      { id: "opener", content: still, hold: "1s" },
      { id: "chapter", content: sequence([
        { id: "demo", content: demo },
        { id: "result", content: still, hold: "1s" },
      ]) },
    ]);
    const media = time(program, { size: { width: 1200, height: 675 }, fps: 25 });
    const { ir, captures } = await resolveMediaIR(media, {
      sourceId: "story-kit",
      captureFrames: [0],
    });

    expect(ir.clock.totalFrames).toBe(57);
    expect([...captures!.keys()]).toEqual([0, 24, 25, 31, 32, 56]);
    expect(ir.scenes.map(({ id, range }) => ({ id, range }))).toEqual([
      { id: "opener", range: { startFrame: 0, endFrame: 25 } },
      { id: "chapter/demo", range: { startFrame: 25, endFrame: 32 } },
      { id: "chapter/result", range: { startFrame: 32, endFrame: 57 } },
    ]);
    expect(ir.scenes[1]?.phases).toEqual([{ name: "enter", start: 0, end: 1 }]);
    expect(ir.observations.sceneRuns.map((run) => run.range)).toEqual([
      { startFrame: 0, endFrame: 25 },
      { startFrame: 25, endFrame: 32 },
      { startFrame: 32, endFrame: 57 },
    ]);
    expect(ir.extensions["superimg.composition"]?.payload).toMatchObject({
      program: { op: "sequence", parts: [{ path: "opener" }, { path: "chapter" }] },
      schedule: { fps: 25, totalFrames: 57 },
    });
    expect(captures?.get(25)?.html).toContain("local frame 0");
    expect(captures?.get(31)?.html).toContain("local frame 6");
  });

  it("keeps unselected choices named while scheduling only the selected route", async () => {
    const still = define({
      config: { width: 1200, height: 675 },
      render: () => boxedHtml("<p>lesson</p>"),
    });
    const lesson = sequence([
      { id: "question", content: still, hold: "1f" },
      { id: "explain", content: choose({
        beginner: sequence([{ id: "short", content: still, hold: "2f" }]),
        advanced: sequence([{ id: "detail", content: still, hold: "3f" }]),
      }) },
      { id: "close", content: still, hold: "1f" },
    ]);
    const media = time(lesson, {
      size: { width: 1200, height: 675 },
      fps: 25,
      routes: { explain: "advanced" },
    });
    const { ir } = await resolveMediaIR(media);
    expect(ir.scenes.map((scene) => ({ path: scene.id, start: scene.range.startFrame }))).toEqual([
      { path: "question", start: 0 },
      { path: "explain/advanced/detail", start: 1 },
      { path: "close", start: 4 },
    ]);
    const payload = ir.extensions["superimg.composition"]?.payload;
    expect(payload?.schedule).toMatchObject({ selectedRoutes: { explain: "advanced" }, totalFrames: 5 });
    const parts = (payload?.program as { parts: Array<{ id: string; content: unknown }> }).parts;
    const choice = parts.find((part) => part.id === "explain")?.content as {
      op: string;
      selected: string;
      paths: Array<{ id: string; selected: boolean }>;
    };
    expect(choice.op).toBe("choose");
    expect(choice.selected).toBe("advanced");
    expect(choice.paths.map(({ id, selected }) => ({ id, selected }))).toEqual([
      { id: "beginner", selected: false },
      { id: "advanced", selected: true },
    ]);
  });

  it("projects simultaneous children into flat IR segments without losing child paths", async () => {
    const left = define({
      config: { width: 600, height: 675, fps: 25, duration: "3f" },
      render: (ctx) => boxedHtml(`<p>left ${ctx.timeline.frame}</p>`),
    });
    const right = define({
      config: { width: 600, height: 675, fps: 25, duration: "5f" },
      render: (ctx) => boxedHtml(`<p>right ${ctx.timeline.frame}</p>`),
    });
    const close = define({
      config: { width: 1200, height: 675 },
      render: () => boxedHtml("<p>close</p>"),
    });
    const comparison = together([
      { id: "left", content: left, rect: { x: 0, y: 0, width: 600, height: 675 }, fit: "contain" },
      { id: "right", content: right, rect: { x: 600, y: 0, width: 600, height: 675 }, fit: "contain" },
    ], { end: "hold" });
    const media = time(sequence([
      { id: "compare", content: comparison },
      { id: "close", content: close, hold: "1f" },
    ]), { size: { width: 1200, height: 675 }, fps: 25 });
    const { ir, captures } = await resolveMediaIR(media, { captureFrames: [0, 2, 3, 4, 5] });
    expect(ir.clock.totalFrames).toBe(6);
    expect(ir.scenes.map((scene) => ({ id: scene.id, range: scene.range }))).toEqual([
      { id: "compare@0", range: { startFrame: 0, endFrame: 3 } },
      { id: "compare@3", range: { startFrame: 3, endFrame: 5 } },
      { id: "close", range: { startFrame: 5, endFrame: 6 } },
    ]);
    expect(ir.extensions["superimg.composition"]?.payload).toMatchObject({
      segments: [
        { active: [{ path: "compare/left", held: false }, { path: "compare/right", held: false }] },
        { active: [{ path: "compare/left", held: true }, { path: "compare/right", held: false }] },
        { active: [{ path: "close", held: false }] },
      ],
    });
    expect(captures?.get(3)?.html).toContain("left 2");
    expect(captures?.get(3)?.html).toContain("right 3");
    expect(captures?.get(5)?.html).toContain("close");
  });

  it("retains nested placement transforms in the serialized composition schedule", async () => {
    const leaf = define({
      config: { width: 400, height: 300, fps: 25, duration: "1f" },
      render: () => boxedHtml("<p>nested</p>"),
    });
    const inner = together([
      { id: "leaf", content: leaf, rect: { x: 20, y: 10, width: 400, height: 300 }, fit: "contain" },
    ], { end: "hide" });
    const outer = together([
      { id: "inner", content: inner, rect: { x: 100, y: 80, width: 800, height: 600 }, fit: "cover" },
    ], { end: "hide" });
    const media = time(outer, { size: { width: 1200, height: 675 }, fps: 25 });

    const { ir } = await resolveMediaIR(media);
    expect(ir.extensions["superimg.composition"]?.payload).toMatchObject({
      program: { op: "together", parts: [{ path: "inner", content: { op: "together" } }] },
      schedule: {
        leaves: [{
          path: "inner/leaf",
          placementChain: [
            { groupPath: "root", fit: "cover", rect: { x: 100, y: 80, width: 800, height: 600 } },
            { groupPath: "inner", fit: "contain", rect: { x: 20, y: 10, width: 400, height: 300 } },
          ],
        }],
      },
    });
  });

  it("detects non-deterministic markup when verification is requested", async () => {
    let count = 0;
    const media = video({
      duration: "0.1s",
      fps: 10,
      render: () => boxedHtml(`<div>${count++}</div>`),
    });
    await expect(resolveMediaIR(media, { verify: true })).rejects.toMatchObject({
      code: "nondeterministic",
    } satisfies Partial<MediaIRError>);
  });

  it("hashes a readable local font and warns when native metrics cannot unpack it", async () => {
    const requireStdlib = createRequire(new URL("../../../superimg-stdlib/package.json", import.meta.url));
    const fontDir = dirname(requireStdlib.resolve("katex"));
    const ttf = "fonts/KaTeX_Main-Regular.ttf";
    const woff2 = "fonts/KaTeX_Main-Regular.woff2";
    const media = (src: string) => video({
      duration: "0.1s",
      fps: 10,
      fonts: [{ family: "Probe", src }],
      render: () => boxedHtml(`<p style="color:#111827">Hi</p>`),
    });
    const fontIssue = (src: string, sourceDir = fontDir) => resolveMediaIR(media(src), { sourceId: "font-probe", sourceDir }).then(({ ir }) => {
      const asset = ir.assets.find((item) => item.kind === "font" && item.src === src);
      return { asset, issues: ir.capabilities.issues };
    });

    const readable = await fontIssue(ttf);
    expect(readable.asset?.contentHash).toEqual(expect.any(String));
    expect(readable.issues.some((issue) => issue.code === "missing_asset" || issue.code === "font_metrics")).toBe(false);

    const webOnly = await fontIssue(woff2);
    expect(webOnly.asset?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(webOnly.issues.filter((issue) => issue.code === "font_metrics")).toHaveLength(1);
    expect(webOnly.issues.some((issue) => issue.code === "missing_asset")).toBe(false);

    const missing = await fontIssue("no-such-font.woff2");
    expect(missing.asset?.contentHash).toBeUndefined();
    expect(missing.issues.some((issue) => issue.code === "missing_asset")).toBe(true);
    expect(missing.issues.some((issue) => issue.code === "font_metrics")).toBe(false);
  });
});
