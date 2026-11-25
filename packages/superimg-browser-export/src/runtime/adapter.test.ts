import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRuntime, exportMedia, inspect, render } from "@superimg/core/runtime";
import { hashTemplateOutputs, sequence, time } from "@superimg/core";
import { CapabilityUnavailableError, MEDIA_ELEMENT, collection, image, video, type Duration, type ResolveInput, type MediaElement } from "@superimg/types";
import { createBrowserRuntimeAdapter } from "./adapter.js";
import * as edge from "@superimg/core/edge";

vi.mock("@superimg/core/edge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@superimg/core/edge")>();
  return {
    ...actual,
    textMeasurerFromFaces: vi.fn(actual.textMeasurerFromFaces),
    renderTemplateFrame: vi.fn(actual.renderTemplateFrame),
  };
});

describe("browser value-first runtime adapter", () => {
  it("refuses native surface output before rendering or export", async () => {
    const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
    const media = image({ size: { width: 64, height: 64 }, nativeModuleSets: [{ identity: hashTemplateOutputs([]), outputs: [] }], render: () => html('<canvas></canvas><script data-superimg-native></script>') });
    const composed = time(sequence([{ id: "native", content: media, hold: "1s" }]), { size: { width: 64, height: 64 }, fps: 5 });
    const refusal = { code: "MEDIA_PREFLIGHT_FAILED", findings: expect.arrayContaining([expect.objectContaining({ code: "NATIVE_SURFACE_UNSUPPORTED" })]) };
    try {
      for (const candidate of [media, composed]) {
        await expect(render(runtime, candidate, { as: "html" })).rejects.toMatchObject(refusal);
        await expect(exportMedia(runtime, candidate, { for: [{ id: "native", format: "html", width: 64, height: 64 }] })).rejects.toMatchObject(refusal);
      }
    } finally { await runtime.dispose(); }
  });
  it("refuses undeclared native markup rather than returning an unusable HTML artifact", async () => {
    const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
    const media = image({ size: { width: 64, height: 64 }, render: () => html('<canvas></canvas><script data-superimg-native></script>') });
    try {
      await expect(render(runtime, media, { as: "html" })).rejects.toMatchObject({ code: "NATIVE_SURFACE_UNSUPPORTED" });
      await expect(exportMedia(runtime, media, { for: [{ id: "native", format: "html", width: 64, height: 64 }] })).rejects.toMatchObject({ code: "NATIVE_SURFACE_UNSUPPORTED" });
    }
    finally { await runtime.dispose(); }
  });
  it.each(["valid", "none"] as const)("prepares %s font metrics once across a frozen export resource set", async (kind) => {
    const fonts = [400, 500, 700].map((weight) => ({
      family: "Fixture", weight,
      src: new Uint8Array(readFileSync(join(process.cwd(), `../superimg-core/assets/fonts/Inter-${weight}.ttf`))),
    }));
    const media = image({
      size: { width: 320, height: 80 },
      ...(kind === "none" ? {} : { fonts }),
      render: () => ({
        $$typeof: MEDIA_ELEMENT, type: "Frame", props: { width: "fill", height: "fill" },
        children: [
          { $$typeof: MEDIA_ELEMENT, type: "Fill", props: { color: "#fff", width: "fill", height: "fill" }, children: [] },
          text("Hello"),
        ],
      }),
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
    vi.mocked(edge.textMeasurerFromFaces).mockClear();
    vi.mocked(edge.renderTemplateFrame).mockClear();
    try {
      await inspect(runtime, media);
      expect(edge.textMeasurerFromFaces).not.toHaveBeenCalled();
      const bundle = await exportMedia(runtime, media, {
        for: Array.from({ length: 60 }, (_, i) => ({ id: `card-${i}`, format: "html" as const, width: 320, height: 80 })),
      });
      try {
        const outputs = await Promise.all(bundle.artifacts.map((artifact) => artifact.text()));
        expect(new Set(outputs).size).toBe(1);
        expect(outputs[0]).toContain("Hello");
        expect(edge.textMeasurerFromFaces).toHaveBeenCalledTimes(1);
        const calls = vi.mocked(edge.renderTemplateFrame).mock.calls;
        expect(calls).toHaveLength(60);
        for (const [options] of calls) {
          // An undefined prepared result must not trigger the per-frame fonts fallback.
          expect(options.fonts).toBeUndefined();
          expect(options.measurer).toBe(calls[0]![0].measurer);
        }
        if (kind === "valid") expect(calls[0]![0].measurer).toBeDefined();
      } finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); }
  });

  it("rejects invalid font bytes before preparing frame metrics", async () => {
    const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
    vi.mocked(edge.textMeasurerFromFaces).mockClear();
    try {
      await expect(render(runtime, image({
        fonts: [{ family: "Fixture", src: new Uint8Array([0, 1, 2, 3]) }],
        render: () => html("invalid font"),
      }), { as: "html" })).rejects.toMatchObject({ code: "MEDIA_PREFLIGHT_FAILED" });
      expect(edge.textMeasurerFromFaces).not.toHaveBeenCalled();
    } finally { await runtime.dispose(); }
  });
  it("renders and exports the final retained frame without an eighth frame", async () => {
    const media = time(sequence([{ id: "clip", content: video({
      size: { width: 80, height: 40 }, fps: 25, duration: "7f",
      render: (ctx) => html("frame" + ctx.globalFrame),
    }) }]), { size: { width: 80, height: 40 }, fps: 25 });
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    try {
      const result = await render(runtime, media, { as: "html", at: "999f" });
      expect(await result.text()).toContain("frame6");
      const bundle = await exportMedia(runtime, media, {
        for: [{ id: "last", format: "html", width: 80, height: 40 }], at: "999f",
      });
      try { expect(await new Response(bundle.artifacts[0]!.stream()).text()).toContain("frame6"); }
      finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); }
  });

  it("measures text using the frozen font bytes", async () => {
    const regular = new Uint8Array(readFileSync(join(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf")));
    const bold = new Uint8Array(readFileSync(join(process.cwd(), "../superimg-core/assets/fonts/Inter-700.ttf")));
    const mediaWithFont = (bytes: Uint8Array) => image({
      size: { width: 320, height: 80 },
      fonts: [{ family: "Fixture", weight: 400, src: bytes }],
      background: "#ffffff",
      render: () => text("Hello"),
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter({ defaultFonts: false }));
    try {
      const regularHtml = await (await render(runtime, mediaWithFont(regular), { as: "html" })).text();
      const boldHtml = await (await render(runtime, mediaWithFont(bold), { as: "html" })).text();
      expect(textWidth(regularHtml)).toBeLessThan(textWidth(boldHtml));
    } finally {
      await runtime.dispose();
    }
  });

  it("prepares a retained composition on its authored canvas before a larger export", async () => {
    const child = video({
      duration: "1s",
      fps: 10,
      size: { width: 80, height: 40 },
      render: () => html("authored child"),
    });
    const media = time(
      sequence([{ id: "child", content: child }]),
      { size: { width: 80, height: 40 }, fps: 10 },
    );
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    try {
      const bundle = await exportMedia(runtime, media, {
        for: [{ id: "larger", format: "html", width: 160, height: 80 }],
        at: "0f",
      });
      try {
        expect(await new Response(bundle.artifacts[0]!.stream()).text()).toContain("authored child");
      } finally {
        await bundle.dispose();
      }
    } finally {
      await runtime.dispose();
    }
  });

  it("prepares retained composition children once for render and export", async () => {
    const resolve = vi.fn(({ data }: ResolveInput<{ title: string; frames: number }>) => ({
      duration: `${data.frames}f` as Duration,
      data: { title: `${data.title}:resolved` },
    }));
    const child = video({
      duration: "1f",
      fps: 10,
      size: { width: 320, height: 180 },
      sample: { title: "sample", frames: 1 },
      resolve,
      render: (ctx) => html(`${ctx.data.title}:${ctx.timeline.frame}`),
    });
    const media = time(
      sequence([{ id: "clip", content: child }]),
      { size: { width: 320, height: 180 }, fps: 10 },
    );
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    try {
      const rendered = await render(runtime, media, {
        as: "html",
        at: "1f",
        data: { uses: { clip: { title: "entry", frames: 2 } } },
      });
      expect(await rendered.text()).toContain("entry:resolved:1");
      expect(resolve).toHaveBeenCalledTimes(1);

      resolve.mockClear();
      const bundle = await exportMedia(runtime, media, {
        for: [{ id: "clip", format: "html", width: 320, height: 180 }],
        at: "1f",
        data: { uses: { clip: { title: "export", frames: 2 } } },
      });
      try {
        expect(await new Response(bundle.artifacts[0]!.stream()).text()).toContain("export:resolved:1");
        expect(resolve).toHaveBeenCalledTimes(1);
      } finally {
        await bundle.dispose();
      }
    } finally {
      await runtime.dispose();
    }
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
        return html(text);
      },
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter());
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

  it("renders and exports portable HTML while freezing byte assets", async () => {
    const media = image({
      size: { width: 120, height: 60 },
      assets: {
        mark: { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png" },
      },
      render: (ctx) => html(`<img src="${ctx.asset("mark")}"><strong>Browser</strong>`),
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    const report = await inspect(runtime, media);
    expect(report.assets).toMatchObject([{ name: "mark", byteLength: 3, mimeType: "image/png" }]);

    const result = await render(runtime, media, { as: "html" });
    expect(await result.text()).toContain("data:image/png;base64,AQID");
    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "card", format: "html", width: 120, height: 60 }],
    });
    expect(bundle.artifacts[0]).toMatchObject({ path: "card.html", mimeType: "text/html;charset=utf-8" });
    await bundle.dispose();
    await runtime.dispose();
  });

  it("never advertises provider execution and rejects explicit provider resolution", async () => {
    let calls = 0;
    const media = collection({
      entries: () => {
        calls += 1;
        return [{ id: "one" }];
      },
      media: image<{ id: string }>({ render: () => html("one") }),
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    expect(runtime.capabilities.collections.providers).toBe(false);
    await inspect(runtime, media);
    expect(calls).toBe(0);
    await expect(inspect(runtime, media, { providers: "resolve" })).rejects.toBeInstanceOf(CapabilityUnavailableError);
    expect(calls).toBe(0);
    await runtime.dispose();
  });

  it("validates authored audio timelines in preflight without refusing them as unavailable", async () => {
    const media = video({
      duration: "2s",
      fps: 10,
      size: { width: 120, height: 60 },
      audio: {
        clips: [
          { id: "bed", src: "https://cdn.example/bed.mp3", role: "music", at: "0s", duration: "2s" },
        ],
        mix: { ducking: true, duckingLevel: 0.25 },
      },
      render: () => html("with audio"),
    });
    const runtime = createRuntime(createBrowserRuntimeAdapter());
    try {
      const rendered = await render(runtime, media, { as: "html", at: "0f" });
      expect(await rendered.text()).toContain("with audio");
    } finally {
      await runtime.dispose();
    }
  });
});

function html(value: string): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Html",
    props: { html: value, width: "fill", height: "fill" },
    children: [],
  } as MediaElement;
}

function text(value: string): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Text",
    props: { variant: "body", size: 32, weight: 400, fontFamily: "Fixture" },
    children: [value],
  };
}

function textWidth(html: string): number {
  const tag = html.match(/<p\b[^>]*data-si-primitive="Text"[^>]*>/)?.[0];
  const width = tag?.match(/\bwidth:([\d.]+)px/)?.[1];
  if (width === undefined) throw new Error("Rendered text width is missing");
  return Number(width);
}
