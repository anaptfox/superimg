import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { exportMedia, inspect, render, createRuntime } from "@superimg/core/runtime";
import { choose, replaceOccurrence, sequence, time } from "@superimg/core";
import type { PlaywrightEngine } from "@superimg/playwright/engine";
import {
  MEDIA_ELEMENT,
  collection,
  image,
  svg,
  video,
  type ExportProgressEvent,
  type MediaElement,
  type DeterministicMediaDefinition,
  type JsonObject,
  type ResolveInput,
} from "@superimg/types";
import { createNodeRuntimeAdapter, hasSharpBindingCandidate, nodePlaywrightEngineOptions } from "./adapter.js";

describe("Sharp platform binding detection", () => {
  it("resolves Sharp's exported native loader subpath when package-root resolution is blocked", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-sharp-binding-"));
    try {
      const sharpEntry = join(root, "node_modules", "sharp", "dist", "index.cjs");
      const platformPackage = join(root, "node_modules", "@img", "sharp-darwin-arm64");
      await mkdir(join(root, "node_modules", "sharp", "dist"), { recursive: true });
      await mkdir(platformPackage, { recursive: true });
      await writeFile(sharpEntry, "module.exports = {};\n");
      await writeFile(join(platformPackage, "package.json"), JSON.stringify({
        name: "@img/sharp-darwin-arm64",
        exports: { "./sharp.node": "./index.cjs", "./package": "./package.json" },
      }));
      await writeFile(join(platformPackage, "index.cjs"), "module.exports = {};\n");

      const resolver = createRequire(pathToFileURL(sharpEntry));
      expect(() => resolver.resolve("@img/sharp-darwin-arm64")).toThrow(/exports|main/i);
      expect(hasSharpBindingCandidate(resolver, "@img/sharp-darwin-arm64")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("Node value-first runtime adapter", () => {
  it("invalidates an earlier frame when a later route changes the exposed root duration", async () => {
    const observedTotals: number[] = [];
    let rasterizations = 0;
    const opening = video({
      size: { width: 80, height: 40 }, fps: 10, duration: "1f",
      render(ctx) {
        observedTotals.push(ctx.totalFrames);
        return Html({ html: String(ctx.totalFrames) });
      },
    });
    const tail = image({ size: { width: 80, height: 40 }, render: () => Html({ html: "tail" }) });
    const program = sequence([
      { id: "opening", content: opening },
      { id: "answer", content: choose({
        short: sequence([{ id: "tail", content: tail, hold: "1f" }]),
        long: sequence([{ id: "tail", content: tail, hold: "2f" }]),
      }) },
    ]);
    const options = { size: { width: 80, height: 40 }, fps: 10 } as const;
    const adapter = createNodeRuntimeAdapter({
      createEngine: () => fakeStillEngine(() => { rasterizations += 1; }),
      compositionFrameCache: {
        schemaVersion: 1, runtimeVersion: "test-renderer-v1",
        identity: ({ path }) => ({ id: path, version: "v1" }),
      },
    });
    try {
      await renderAdapter(adapter, time(program, { ...options, routes: { answer: "short" } }), "0f");
      await renderAdapter(adapter, time(program, { ...options, routes: { answer: "long" } }), "0f");
      expect(observedTotals).toEqual([2, 3]);
      expect(rasterizations).toBe(2);
    } finally { await adapter.dispose(); }
  });

  it("reuses an earlier frame across later route and scoped-data changes", async () => {
    const rendered: string[] = [];
    let rasterizations = 0;
    const still = (label: string) => image({
      size: { width: 80, height: 40 },
      render: () => { rendered.push(label); return Html({ html: label }); },
    });
    const program = sequence([
      { id: "opening", content: still("opening"), hold: "1f" },
      { id: "answer", content: choose({
        basic: sequence([{ id: "panel", content: still("basic"), hold: "1f" }]),
        advanced: sequence([{ id: "panel", content: still("advanced"), hold: "1f" }]),
      }) },
    ]);
    const options = { size: { width: 80, height: 40 }, fps: 10 } as const;
    const basic = time(program, { ...options, routes: { answer: "basic" } });
    const advanced = time(program, { ...options, routes: { answer: "advanced" } });
    const adapter = createNodeRuntimeAdapter({
      createEngine: () => fakeStillEngine(() => { rasterizations += 1; }),
      compositionFrameCache: {
        schemaVersion: 1,
        runtimeVersion: "test-renderer-v1",
        identity: ({ path }) => ({ id: path, version: "v1" }),
      },
    });
    try {
      await renderAdapter(adapter, basic, "0f", { uses: { "answer/basic/panel": { title: "one" } } });
      await renderAdapter(adapter, advanced, "0f", { uses: { "answer/advanced/panel": { title: "two" } } });
      expect(rendered).toEqual(["opening"]);
      expect(rasterizations).toBe(1);

      await renderAdapter(adapter, basic, "1f", { uses: { "answer/basic/panel": { title: "one" } } });
      await renderAdapter(adapter, basic, "1f", { uses: { "answer/basic/panel": { title: "changed" } } });
      await renderAdapter(adapter, advanced, "1f", { uses: { "answer/advanced/panel": { title: "two" } } });
      expect(rendered).toEqual(["opening", "basic", "basic", "advanced"]);
      expect(rasterizations).toBe(4);
    } finally { await adapter.dispose(); }
  });

  it("reuses an unaffected retained frame after selective replacement before child render and rasterization", async () => {
    let firstRenders = 0;
    let oldTailRenders = 0;
    let newTailRenders = 0;
    let rasterizations = 0;
    const first = image({
      size: { width: 80, height: 40 },
      render: () => { firstRenders += 1; return Html({ html: "first" }); },
    });
    const oldTail = image({
      size: { width: 80, height: 40 },
      render: () => { oldTailRenders += 1; return Html({ html: "old-tail" }); },
    });
    const newTail = image({
      size: { width: 80, height: 40 },
      render: () => { newTailRenders += 1; return Html({ html: "new-tail" }); },
    });
    const program = sequence([
      { id: "first", content: first, hold: "1f" },
      { id: "tail", content: oldTail, hold: "1f" },
    ]);
    const before = time(program, { size: { width: 80, height: 40 }, fps: 10 });
    const after = time(replaceOccurrence(program, "tail", newTail), { size: { width: 80, height: 40 }, fps: 10 });
    const adapter = createNodeRuntimeAdapter({
      createEngine: () => fakeStillEngine(() => { rasterizations += 1; }),
      compositionFrameCache: {
        schemaVersion: 1,
        runtimeVersion: "test-renderer-v1",
        identity: ({ path, media }) => path === "first"
          ? { id: "first", version: "v1" }
          : media.render === oldTail.render ? { id: "tail", version: "old" }
          : { id: "tail", version: "new" },
      },
    });
    try {
      await renderAdapter(adapter, before, "0f");
      await renderAdapter(adapter, before, "1f");
      await renderAdapter(adapter, after, "0f");
      await renderAdapter(adapter, after, "1f");
      expect(firstRenders).toBe(1);
      expect(oldTailRenders).toBe(1);
      expect(newTailRenders).toBe(1);
      expect(rasterizations).toBe(3);
    } finally { await adapter.dispose(); }
  });

  it("never stores a captured frame under an identity version observed after rasterization", async () => {
    let version = "v1";
    let renders = 0;
    let rasterizations = 0;
    const panel = image({
      size: { width: 80, height: 40 },
      render: () => { renders += 1; return Html({ html: "panel" }); },
    });
    const media = time(sequence([{ id: "panel", content: panel, hold: "1f" }]), { size: { width: 80, height: 40 }, fps: 10 });
    const adapter = createNodeRuntimeAdapter({
      createEngine: () => fakeStillEngine(() => { rasterizations += 1; version = "v2"; }),
      compositionFrameCache: {
        schemaVersion: 1,
        runtimeVersion: "test-renderer-v1",
        identity: () => ({ id: "panel", version }),
      },
    });
    try {
      await renderAdapter(adapter, media, "0f");
      await renderAdapter(adapter, media, "0f");
      expect(renders).toBe(2);
      expect(rasterizations).toBe(2);
    } finally { await adapter.dispose(); }
  });

  it("does not reuse retained frames without complete identity evidence, and invalidates complete render inputs", async () => {
    let renders = 0;
    let rasterizations = 0;
    const leaf = (label: string) => image({
      size: { width: 80, height: 40 },
      render: () => { renders += 1; return Html({ html: label }); },
    });
    const plain = leaf("plain");
    const cached = time(sequence([{ id: "panel", content: plain, hold: "1f" }]), { size: { width: 80, height: 40 }, fps: 10 });
    const changedClock = time(sequence([{ id: "panel", content: plain, hold: "1f" }]), { size: { width: 80, height: 40 }, fps: 20 });
    const changedRoute = time({ op: "choose", paths: {
      one: sequence([{ id: "panel", content: plain, hold: "1f" }]),
      two: sequence([{ id: "panel", content: plain, hold: "1f" }]),
    } }, { size: { width: 80, height: 40 }, fps: 10, routes: { root: "two" } });
    const adapter = createNodeRuntimeAdapter({
      createEngine: () => fakeStillEngine(() => { rasterizations += 1; }),
      compositionFrameCache: {
        schemaVersion: 1,
        runtimeVersion: "test-renderer-v1",
        identity: ({ path }) => path === "panel" ? { id: "panel", version: "v1" } : undefined,
      },
    });
    try {
      await renderAdapter(adapter, cached, "0f");
      await renderAdapter(adapter, changedClock, "0f");
      await renderAdapter(adapter, changedRoute, "0f");
      // Missing identity for route/two disables reuse. The authored frame rate
      // also produces a distinct key with the same occurrence identity.
      expect(renders).toBe(3);
      expect(rasterizations).toBe(3);
    } finally { await adapter.dispose(); }

    renders = 0;
    rasterizations = 0;
    const uncached = createNodeRuntimeAdapter({ createEngine: () => fakeStillEngine(() => { rasterizations += 1; }) });
    try {
      await renderAdapter(uncached, cached, "0f");
      await renderAdapter(uncached, cached, "0f");
      expect(renders).toBe(2);
      expect(rasterizations).toBe(2);
    } finally { await uncached.dispose(); }
  });

  it("uses resolved duration, data and edition in exact renders and export renditions", async () => {
    const resolve = vi.fn(({ data, config }: ResolveInput<{ title: string; count: number }>) => ({
      duration: data.count * 2,
      fps: 10,
      data: { title: `${data.title}:${config.width}` },
    }));
    const media = video({
      duration: "1s",
      size: { width: 320, height: 180 },
      sample: { title: "sample", count: 2 },
      variants: { long: { title: "variant", count: 4 } },
      editions: { square: { size: { width: 80, height: 80 } } },
      resolve,
      render: (ctx) => {
        const text = `${ctx.data.title}:duration${ctx.timeline.durationSeconds}:frame${ctx.timeline.frame}`;
        return Html({ html: text });
      },
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());
    try {
      const result = await render(runtime, media, { as: "html", at: "20f", variantId: "long", editionId: "square" });
      expect(await result.text()).toContain("variant:80:duration8:frame20");
      expect(resolve).toHaveBeenCalledTimes(1);
      resolve.mockClear();
      const bundle = await exportMedia(runtime, media, {
        for: [
          { id: "wide", format: "html", width: 320, height: 180 },
          { id: "square", format: "html", width: 80, height: 80 },
          { id: "square2", format: "html", width: 160, height: 160 },
        ],
        variantIds: ["long"],
        at: "20f",
      });
      try {
        expect(resolve).toHaveBeenCalledTimes(2);
        for (const artifact of bundle.artifacts) {
          const text = await new Response(artifact.stream()).text();
          const width = artifact.coordinates.editionId === "square" ? 80 : 320;
          expect(text).toContain(`variant:${width}:duration8:frame20`);
        }
      } finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); }
  });

  it("freezes explicit bytes and renders a self-contained HTML document", async () => {
    const media = image({
      size: { width: 320, height: 180 },
      assets: {
        logo: {
          bytes: new Uint8Array([137, 80, 78, 71]),
          mimeType: "image/png",
        },
      },
      render: (ctx) => Html({
        width: "fill",
        height: "fill",
        html: `<img alt="logo" src="${ctx.asset("logo")}">`,
      }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());

    const report = await inspect(runtime, media);
    expect(report.assets).toMatchObject([{
      name: "logo",
      mimeType: "image/png",
      byteLength: 4,
    }]);
    expect(report.assets[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);

    const result = await render(runtime, media, { as: "html" });
    expect(await result.text()).toContain("data:image/png;base64,iVBORw==");
    expect(result).not.toHaveProperty("path");
    await runtime.dispose();
  });

  it("renders and exports SVG documents and browser-free PNG stills", async () => {
    const media = svg({
      size: { width: 96, height: 64 },
      render: () => element(
        "Vector",
        { width: "fill", height: "fill", viewBox: { x: 0, y: 0, width: 96, height: 64 } },
        element("VectorPath", { d: "M0 0H96V64H0Z", fill: "#663399" }),
      ),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());

    const document = await render(runtime, media, { as: "svg" });
    expect(await document.text()).toMatch(/^<svg\b/);

    const png = await render(runtime, media, { as: "png" });
    expect(Array.from((await read(png.stream())).slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "thumb", format: "png", width: 96, height: 64 }],
    });
    expect(bundle.manifest.artifacts).toMatchObject([{
      path: "thumb.png",
      mimeType: "image/png",
      coordinates: { renditionId: "thumb" },
    }]);
    await bundle.dispose();
    await runtime.dispose();
  });

  it("resolves each selected provider entry once before export", async () => {
    const provider = vi.fn(() => [{ id: "one", count: 3 }, { id: "two", count: 5 }]);
    const resolve = vi.fn(({ data }: ResolveInput<{ id: string; count: number }>) => ({
      duration: data.count,
      data: { label: `resolved-${data.id}` },
    }));
    const media = collection({
      entries: provider,
      media: video<{ id: string; count: number; label?: string }>({
        duration: "1s",
        size: { width: 80, height: 40 },
        resolve,
        render: (ctx) => Html({ html: `${ctx.data.label}:duration${ctx.timeline.durationSeconds}` }),
      }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());
    const bundle = await exportMedia(runtime, media, {
      providers: "resolve",
      for: [{ id: "card", format: "html", width: 80, height: 40 }],
      at: "1s",
    });
    try {
      expect(provider).toHaveBeenCalledTimes(1);
      expect(resolve).toHaveBeenCalledTimes(2);
      const text = await Promise.all(bundle.artifacts.map((artifact) => new Response(artifact.stream()).text()));
      expect(text[0]).toContain("resolved-one:duration3");
      expect(text[1]).toContain("resolved-two:duration5");
    } finally {
      await bundle.dispose();
      await runtime.dispose();
    }
  });

  it("keeps prepared composition renditions separate for collection entries", async () => {
    const child = video({
      size: { width: 80, height: 40 },
      fps: 10,
      duration: "1s",
      sample: { label: "sample", count: 10 },
      resolve({ data }) { return { duration: `${data.count}f` }; },
      render: (ctx) => Html({ html: `${ctx.data.label}:duration${ctx.timeline.durationSeconds}` }),
    });
    const entries = [
      { id: "one", uses: { card: { label: "one", count: 10 } } },
      { id: "two", uses: { card: { label: "two", count: 20 } } },
    ];
    const media = collection({
      entries,
      media: time<(typeof entries)[number]>(
        sequence([{ id: "card", content: child }]),
        { size: { width: 80, height: 40 }, fps: 10 },
      ),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());
    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "card", format: "html", width: 80, height: 40 }],
      at: "0f",
    });
    try {
      const output = await Promise.all(bundle.artifacts.map(async (artifact) => ({
        path: artifact.path,
        html: await artifact.text(),
      })));
      expect(output.find((item) => item.path === "one/card.html")?.html).toContain("one:duration1");
      expect(output.find((item) => item.path === "two/card.html")?.html).toContain("two:duration2");
    } finally {
      await bundle.dispose();
      await runtime.dispose();
    }
  });

  it("prepares a retained composition on its authored canvas before exporting to a destination canvas", async () => {
    const child = video({
      size: { width: 80, height: 40 },
      fps: 10,
      duration: "1s",
      render: () => Html({ html: "child" }),
    });
    const media = time(
      sequence([{ id: "child", content: child }]),
      { size: { width: 80, height: 40 }, fps: 10 },
    );
    const runtime = createRuntime(createNodeRuntimeAdapter());
    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "larger", format: "html", width: 160, height: 80 }],
      at: "0f",
    });
    try {
      expect(await bundle.artifacts[0]!.text()).toContain("child");
    } finally {
      await bundle.dispose();
      await runtime.dispose();
    }
  });

  it("fits a retained composition to the YouTube canvas while keeping its authored clock", async () => {
    const child = video({
      size: { width: 1280, height: 720 },
      fps: 25,
      duration: "1s",
      render: () => Html({ html: "child" }),
    });
    const media = time(
      sequence([{ id: "child", content: child }]),
      { size: { width: 1280, height: 720 }, fps: 25 },
    );
    const adapter = createNodeRuntimeAdapter({ animatedFormats: ["mp4"] });
    try {
      const preflight = await adapter.preflight({
        operation: "export",
        programDigest: "composition-25fps",
        media,
        options: { for: ["youtube"] },
      });
      const prepared = preflight.prepared as { readonly renditions?: ReadonlyMap<string, { readonly definition: typeof media }> };
      const rendition = prepared.renditions?.get(JSON.stringify([null, "default", "default", "youtube"]));
      expect(rendition?.definition.composition?.schedule.fps).toBe(25);
      expect(rendition?.definition.config?.fps).toBe(25);
      const painted = rendition!.definition.render({
        std: {},
        timeline: {},
        globalFrame: 0,
        globalTimeSeconds: 0,
        totalFrames: 25,
        totalDurationSeconds: 1,
        sceneIndex: 0,
        sceneId: "root",
        fps: 25,
        isFinite: true,
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        isPortrait: false,
        isLandscape: true,
        isSquare: false,
        data: {},
        assets: {},
        asset: (name: string) => name,
      } as never);
      expect(JSON.stringify(painted)).toContain("1920px");
      expect(JSON.stringify(painted)).toContain("1080px");
    } finally {
      await adapter.dispose();
    }
  });

  it("executes a provider once only after explicit opt-in", async () => {
    let calls = 0;
    const media = collection({
      entries: async () => {
        calls += 1;
        return [{ id: "one", title: "One" }];
      },
      media: image<{ id: string; title: string }>({
        size: { width: 80, height: 40 },
        render: (ctx) => Html({ html: `<h1>${ctx.data.title}</h1>` }),
      }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());

    await inspect(runtime, media);
    expect(calls).toBe(0);
    const bundle = await exportMedia(runtime, media, {
      providers: "resolve",
      for: [{ id: "card", format: "html", width: 80, height: 40 }],
    });
    expect(calls).toBe(1);
    expect(bundle.artifacts[0]!.path).toBe("one/card.html");
    expect(new TextDecoder().decode(await read(bundle.artifacts[0]!.stream()))).toContain("One");
    await bundle.dispose();
    await runtime.dispose();
  });

  it("reports ordered, monotonic work for every collection rendition", async () => {
    const media = collection({
      entries: [
        { id: "one", title: "One" },
        { id: "two", title: "Two" },
      ],
      media: image<{ id: string; title: string }>({
        size: { width: 80, height: 40 },
        render: (ctx) => Html({ html: `<h1>${ctx.data.title}</h1>` }),
      }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());
    const events: ExportProgressEvent[] = [];

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "card", format: "html", width: 80, height: 40 }],
      onProgress: async (event) => {
        await Promise.resolve();
        events.push(event);
      },
    });

    expect(bundle.artifacts.map((artifact) => artifact.path)).toEqual([
      "one/card.html",
      "two/card.html",
    ]);
    const stageEvents = events.filter((event) => event.item === undefined);
    expect(stageEvents.map((event) => event.state)).toEqual([
      "started",
      "running",
      "running",
      "running",
      "succeeded",
    ]);
    expect(stageEvents.map((event) => event.work)).toEqual([
      { unit: "renditions", completed: 0, total: 2 },
      { unit: "renditions", completed: 0, total: 2 },
      { unit: "renditions", completed: 1, total: 2 },
      { unit: "renditions", completed: 2, total: 2 },
      { unit: "renditions", completed: 2, total: 2 },
    ]);

    const itemEvents = events.filter((event) => event.item !== undefined);
    const itemIds = new Set(itemEvents.map((event) => event.item!.itemId));
    expect(itemIds.size).toBe(2);
    expect(new Set(itemEvents.map((event) => event.item!.entryId))).toEqual(
      new Set(["one", "two"]),
    );
    for (const itemId of itemIds) {
      const item = itemEvents.filter((event) => event.item!.itemId === itemId);
      expect(item.map((event) => event.state)).toEqual([
        "started",
        "running",
        "succeeded",
      ]);
      expect(item.map((event) => event.work)).toEqual([
        { unit: "frames", completed: 0, total: 1 },
        { unit: "frames", completed: 1, total: 1 },
        { unit: "frames", completed: 1, total: 1 },
      ]);
    }
    expect(events.at(-1)).toMatchObject({
      kind: "@foxworth/superimg/export-progress",
      stageId: "runtime.render",
      state: "succeeded",
      work: { unit: "renditions", completed: 2, total: 2 },
    });

    await bundle.dispose();
    await runtime.dispose();
  });

  it("does not let observer failures affect export output", async () => {
    const media = image({
      size: { width: 80, height: 40 },
      render: () => Html({ html: "<h1>Observed</h1>" }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter());
    let calls = 0;

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "card", format: "html", width: 80, height: 40 }],
      async onProgress() {
        calls += 1;
        await Promise.resolve();
        throw new Error("observer unavailable");
      },
    });

    expect(bundle.artifacts).toHaveLength(1);
    expect(calls).toBeGreaterThan(1);
    await bundle.dispose();
    await runtime.dispose();
  });

  it.each([{ fps: 25, frames: 7 }, { fps: 30, frames: 9 }])(
    "exports seven authored frames at $fps fps as exactly $frames output frames",
    async ({ fps, frames }) => {
      let lastFrame = -1;
      const media = time(sequence([{ id: "clip", content: video({
        size: { width: 80, height: 40 }, fps: 25, duration: "7f",
        render: (ctx) => { lastFrame = ctx.timeline.frame; return Html({ html: String(lastFrame) }); },
      }) }]), { size: { width: 80, height: 40 }, fps: 25 });
      const runtime = createRuntime(createNodeRuntimeAdapter({
        animatedFormats: ["mp4"], createEngine: () => fakeAnimatedEngine(),
      }));
      const events: ExportProgressEvent[] = [];
      try {
        const bundle = await exportMedia(runtime, media, {
          for: fps === 25 ? [{ id: "clip", format: "mp4", width: 80, height: 40 }] : ["youtube"],
          onProgress: (event) => { events.push(event); },
        });
        try {
          expect(events.filter((event) => event.item !== undefined).at(-1)?.work)
            .toEqual({ unit: "frames", completed: frames, total: frames });
          expect(lastFrame).toBe(6);
        } finally { await bundle.dispose(); }
      } finally { await runtime.dispose(); }
    },
  );

  it("reports every animated frame in monotonic order", async () => {
    const media = video({
      duration: "3f",
      fps: 10,
      size: { width: 80, height: 40 },
      render: (ctx) => Html({ html: `<h1>${ctx.timeline.frame}</h1>` }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter({
      animatedFormats: ["mp4"],
      createEngine: () => fakeAnimatedEngine(),
    }));
    const events: ExportProgressEvent[] = [];

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "clip", format: "mp4", width: 80, height: 40 }],
      onProgress: (event) => {
        events.push(event);
      },
    });

    const itemEvents = events.filter((event) => event.item !== undefined);
    expect(itemEvents.map((event) => event.state)).toEqual([
      "started",
      "running",
      "running",
      "running",
      "succeeded",
    ]);
    expect(itemEvents.map((event) => event.work)).toEqual([
      { unit: "frames", completed: 0, total: 3 },
      { unit: "frames", completed: 1, total: 3 },
      { unit: "frames", completed: 2, total: 3 },
      { unit: "frames", completed: 3, total: 3 },
      { unit: "frames", completed: 3, total: 3 },
    ]);
    expect(events.filter((event) => event.item === undefined).map((event) => event.work)).toEqual([
      { unit: "renditions", completed: 0, total: 1 },
      { unit: "renditions", completed: 0, total: 1 },
      { unit: "renditions", completed: 1, total: 1 },
      { unit: "renditions", completed: 1, total: 1 },
    ]);

    await bundle.dispose();
    await runtime.dispose();
  });

  it("preserves completed rendition work when a later rendition fails", async () => {
    const media = animatedCollection();
    const runtime = createRuntime(createNodeRuntimeAdapter({
      animatedFormats: ["mp4"],
      createEngine: () => fakeAnimatedEngine({ failAdapter: 1 }),
    }));
    const events: ExportProgressEvent[] = [];

    await expect(exportMedia(runtime, media, {
      for: [{ id: "clip", format: "mp4", width: 80, height: 40 }],
      onProgress: (event) => {
        events.push(event);
      },
    })).rejects.toMatchObject({ code: "RUNTIME_INFRASTRUCTURE_ERROR" });

    const first = events.filter((event) => event.item?.entryId === "one");
    expect(first.map((event) => event.state)).toEqual([
      "started",
      "running",
      "running",
      "running",
      "succeeded",
    ]);
    const second = events.filter((event) => event.item?.entryId === "two");
    expect(second.map((event) => event.state)).toEqual(["started", "failed"]);
    expect(second.at(-1)).toMatchObject({
      state: "failed",
      work: { unit: "frames", completed: 0, total: 3 },
      error: { message: "second rendition failed" },
    });
    expect(events.filter((event) => event.item === undefined).at(-1)).toMatchObject({
      state: "failed",
      work: { unit: "renditions", completed: 1, total: 2 },
      error: { message: "second rendition failed" },
    });

    await runtime.dispose();
  });

  it("normalizes timeout cancellation for both progress and the export outcome", async () => {
    const media = video({
      duration: "3f",
      fps: 10,
      size: { width: 80, height: 40 },
      render: () => Html({ html: "<h1>Cancel</h1>" }),
    });
    const runtime = createRuntime(createNodeRuntimeAdapter({
      animatedFormats: ["mp4"],
      createEngine: () => fakeAnimatedEngine({ timeoutAdapter: 0 }),
    }));
    const events: ExportProgressEvent[] = [];

    await expect(exportMedia(runtime, media, {
      for: [{ id: "clip", format: "mp4", width: 80, height: 40 }],
      onProgress: (event) => {
        events.push(event);
      },
    })).rejects.toMatchObject({ code: "RUNTIME_CANCELLED" });

    const cancelled = events.filter((event) => event.state === "cancelled");
    expect(cancelled).toHaveLength(2);
    expect(cancelled.map((event) => event.item === undefined ? "stage" : "item")).toEqual([
      "item",
      "stage",
    ]);
    expect(cancelled.map((event) => event.reason)).toEqual([
      "render deadline exceeded",
      "render deadline exceeded",
    ]);
    expect(events.some((event) => event.state === "failed")).toBe(false);

    await runtime.dispose();
  });

  it("does not replace an unprintable runtime failure while reporting it", async () => {
    const failure = Object.create(null) as object;
    const media = video({
      duration: "1f",
      fps: 10,
      size: { width: 80, height: 40 },
      render: () => Html({ html: "<h1>Failure</h1>" }),
    });
    const adapter = createNodeRuntimeAdapter({
      animatedFormats: ["mp4"],
      createEngine: () => fakeAnimatedEngine({ failure }),
    });
    const events: ExportProgressEvent[] = [];
    const options = {
      for: [{ id: "clip", format: "mp4" as const, width: 80, height: 40 }],
      onProgress: (event: ExportProgressEvent) => {
        events.push(event);
      },
    };
    const request = {
      operation: "export" as const,
      programDigest: "0".repeat(64),
      media,
      options,
    };
    const preflight = await adapter.preflight(request);
    let caught: unknown;

    try {
      await adapter.exportMedia({ ...request, preflight });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(failure);
    expect(events.filter((event) => event.state === "failed")).toMatchObject([
      { error: { message: "Runtime export failed" } },
      { error: { message: "Runtime export failed" } },
    ]);
    await preflight.dispose?.();
    await adapter.dispose();
  });

  it("leaves still page pooling off unless a host opts in", () => {
    expect(nodePlaywrightEngineOptions()).toEqual({ perRenderContext: true });
    expect(nodePlaywrightEngineOptions({ poolStillPages: false })).toEqual({
      perRenderContext: true,
    });
    expect(nodePlaywrightEngineOptions({ poolStillPages: true })).toEqual({
      perRenderContext: true,
      poolStillPages: true,
    });
  });

  it("advertises every server-backed animated format when node-av is resolvable", () => {
    const adapter = createNodeRuntimeAdapter();
    expect(adapter.capabilities.animated).toEqual(expect.arrayContaining([
      "mp4", "webm", "mov", "mkv",
    ]));
  });

  it("rejects invalid native video policies during preflight before creating an engine", async () => {
    const media = video({
      duration: "1f",
      fps: 10,
      size: { width: 80, height: 40 },
      render: () => Html({ html: "<h1>Preflight</h1>" }),
    });
    const invalidPolicies = [
      { video: { codec: "prores" as const, alpha: "keep" as const } },
      { video: { codec: "vp9" as const, alpha: "keep" as const } },
      { video: { quality: { bitrate: 1000, quantizer: 12 } as never } },
    ];

    for (const encoding of invalidPolicies) {
      let engineCalls = 0;
      const runtime = createRuntime(createNodeRuntimeAdapter({
        animatedFormats: ["mp4"],
        createEngine: () => {
          engineCalls += 1;
          return fakeAnimatedEngine();
        },
      }));
      await expect(exportMedia(runtime, media, {
        for: [{ id: "invalid", format: "mp4", width: 80, height: 40, encoding }],
      })).rejects.toMatchObject({ code: "MEDIA_PREFLIGHT_FAILED" });
      expect(engineCalls).toBe(0);
      await runtime.dispose();
    }
  });
});

function animatedCollection() {
  return collection({
    entries: [
      { id: "one", title: "One" },
      { id: "two", title: "Two" },
    ],
    media: video<{ id: string; title: string }>({
      duration: "3f",
      fps: 10,
      size: { width: 80, height: 40 },
      render: (ctx) => Html({ html: `<h1>${ctx.data.title}</h1>` }),
    }),
  });
}

function fakeAnimatedEngine(options: Readonly<{
  failAdapter?: number;
  timeoutAdapter?: number;
  failure?: unknown;
}> = {}): PlaywrightEngine {
  let adapterIndex = 0;
  const engine = {
    async init() {},
    createAdapters() {
      const currentAdapter = adapterIndex;
      adapterIndex += 1;
      return {
        renderer: {
          async init() {},
          async rasterize() {
            return Buffer.from([currentAdapter]);
          },
          async dispose() {},
        },
        encoder: {
          async init() {},
          async addFrame() {
            if (options.failure !== undefined) {
              throw options.failure;
            }
            if (options.failAdapter === currentAdapter) {
              throw new Error("second rendition failed");
            }
            if (options.timeoutAdapter === currentAdapter) {
              throw new DOMException("render deadline exceeded", "TimeoutError");
            }
          },
          async finalize() {
            return new Uint8Array([1, 2, 3]);
          },
          async dispose() {},
        },
      };
    },
    async dispose() {},
  };
  return engine as unknown as PlaywrightEngine;
}

function fakeStillEngine(onRasterize: () => void): PlaywrightEngine {
  let width = 1;
  let height = 1;
  return {
    async init() {},
    createAdapters() {
      return {
        renderer: {
          async init(config: { width: number; height: number; dpr?: number }) {
            width = Math.round(config.width * (config.dpr ?? 1));
            height = Math.round(config.height * (config.dpr ?? 1));
          },
          async rasterize() { onRasterize(); return png(width, height); },
          async dispose() {},
        },
        encoder: { async init() {}, async addFrame() {}, async finalize() { return new Uint8Array(); }, async dispose() {} },
      };
    },
    async dispose() {},
  } as unknown as PlaywrightEngine;
}

async function renderAdapter(
  adapter: ReturnType<typeof createNodeRuntimeAdapter>,
  media: DeterministicMediaDefinition<JsonObject>,
  at: `${number}f`,
  data: JsonObject = {},
): Promise<void> {
  const selection = {
    media,
    data,
    coordinates: { variantId: "default", editionId: "default" },
  };
  const options = { as: "png" as const, at };
  const preflight = await adapter.preflight({ operation: "render", programDigest: "cache-test", media, options, selection });
  await adapter.render({ operation: "render", programDigest: "cache-test", media, options, selection, preflight });
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

async function read(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const response = new Response(stream);
  return new Uint8Array(await response.arrayBuffer());
}

function Html(props: Record<string, unknown>): MediaElement {
  return element("Html", { width: "fill", height: "fill", ...props });
}

function element(type: string, props: Record<string, unknown>, ...children: MediaElement[]): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type,
    props,
    children,
  } as MediaElement;
}
