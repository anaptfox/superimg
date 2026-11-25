import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { createRuntime, exportMedia, render } from "@superimg/core/runtime";
import {
  CapabilityUnavailableError,
  MEDIA_ELEMENT,
  MediaPreflightError,
  image,
  svg,
  video,
  type ResolveInput,
  type MediaElement,
} from "@superimg/types";
import { createEdgeRuntimeAdapter } from "./adapter.js";
import { hashTemplateOutputs, sequence, time } from "@superimg/core";
import { aliasSvgFont } from "@superimg/core/edge";

describe("edge value-first runtime adapter", () => {
  it("refuses native surface output before rendering or export", async () => {
    const runtime = createRuntime(createEdgeRuntimeAdapter({ defaultFonts: false }));
    const media = image({ size: { width: 64, height: 64 }, nativeModuleSets: [{ identity: hashTemplateOutputs([]), outputs: [] }], render: () => element("Html", { html: '<canvas></canvas><script data-superimg-native></script>' }) });
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
    const runtime = createRuntime(createEdgeRuntimeAdapter({ defaultFonts: false }));
    const media = image({ size: { width: 64, height: 64 }, render: () => element("Html", { html: '<canvas></canvas><script data-superimg-native></script>' }) });
    try {
      await expect(render(runtime, media, { as: "html" })).rejects.toMatchObject({ code: "NATIVE_SURFACE_UNSUPPORTED" });
      await expect(exportMedia(runtime, media, { for: [{ id: "native", format: "html", width: 64, height: 64 }] })).rejects.toMatchObject({ code: "NATIVE_SURFACE_UNSUPPORTED" });
    }
    finally { await runtime.dispose(); }
  });
  it("renders and exports the last authored frame of a seven-frame retained program", async () => {
    const media = time(sequence([{ id: "clip", content: video({
      size: { width: 320, height: 180 }, fps: 25, duration: "7f",
      render: (ctx) => element("Html", { html: `<p>frame${ctx.timeline.frame}</p>` }),
    }) }]), { size: { width: 320, height: 180 }, fps: 25 });
    const runtime = createRuntime(createEdgeRuntimeAdapter());
    try {
      const result = await render(runtime, media, { as: "html", at: "999f" });
      expect(await result.text()).toContain("frame6");
      const bundle = await exportMedia(runtime, media, {
        for: [{ id: "last", format: "html", width: 320, height: 180 }], at: "999f",
      });
      try {
        expect(await new Response(bundle.artifacts[0]!.stream()).text()).toContain("frame6");
      } finally { await bundle.dispose(); }
    } finally { await runtime.dispose(); }
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
        return element("Html", { html: text });
      },
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter());
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

  it("is document-only without explicitly configured resvg WASM", async () => {
    const media = image({
      size: { width: 100, height: 50 },
      render: () => element("Html", { html: "<strong>Edge</strong>" }),
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter());
    expect(runtime.capabilities.rasters).toEqual([]);
    expect(runtime.capabilities.collections.providers).toBe(false);

    const result = await render(runtime, media, { as: "html" });
    expect(await result.text()).toContain("Edge");
    await expect(render(runtime, media, { as: "png" })).rejects.toBeInstanceOf(CapabilityUnavailableError);

    const bundle = await exportMedia(runtime, media, {
      for: [{ id: "edge", format: "html", width: 100, height: 50 }],
    });
    expect(bundle.artifacts[0]).toMatchObject({ path: "edge.html", mimeType: "text/html;charset=utf-8" });
    await bundle.dispose();
    await runtime.dispose();
  });

  it("turns invalid configured WASM into a structured preflight finding", async () => {
    const media = svg({
      size: { width: 16, height: 16 },
      render: () => element(
        "Vector",
        { viewBox: { x: 0, y: 0, width: 16, height: 16 } },
        element("VectorPath", { d: "M0 0H16V16H0Z", fill: "#000" }),
      ),
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter({ wasm: new Uint8Array([0, 1, 2]) }));
    const failure = await render(runtime, media, { as: "png" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MediaPreflightError);
    expect((failure as MediaPreflightError).findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "RESVG_WASM_UNAVAILABLE", category: "capability" }),
    ]));
    await runtime.dispose();
  });

  it("advertises and performs SVG-to-PNG only with real WASM bytes", async () => {
    const wasm = new Uint8Array(await readFile(new URL(
      "../../superimg-core/node_modules/@resvg/resvg-wasm/index_bg.wasm",
      import.meta.url,
    )));
    const media = svg({
      size: { width: 64, height: 64 },
      render: () => element(
        "Vector",
        { width: "fill", height: "fill", viewBox: { x: 0, y: 0, width: 64, height: 64 } },
        element("VectorPath", { d: "M0 0H64V64H0Z", fill: "#336699" }),
      ),
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter({ wasm }));
    expect(runtime.capabilities.rasters).toEqual(["png"]);
    const result = await render(runtime, media, { as: "png" });
    expect(Array.from((await read(result.stream())).slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    await runtime.dispose();
  });

  it("honors declared font aliases when rasterizing SVG text", async () => {
    const wasm = new Uint8Array(await readFile(new URL("../../superimg-core/node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url)));
    const regular = new Uint8Array(await readFile(new URL("../../superimg-core/assets/fonts/Inter-400.ttf", import.meta.url)));
    const bold = new Uint8Array(await readFile(new URL("../../superimg-core/assets/fonts/Inter-700.ttf", import.meta.url)));
    const media = (family: string, weight = 400) => svg({
      size: { width: 300, height: 80 },
      fonts: [{ family: "RegularAlias", src: regular }, { family: "BoldAlias", src: bold }],
      render: () => element("Vector", { width: 300, height: 80, viewBox: { x: 0, y: 0, width: 300, height: 80 } },
        { $$typeof: MEDIA_ELEMENT, type: "VectorText", props: { x: 4, y: 55, size: 42, family, weight, fill: "#000" }, children: ["Wide glyphs"] } as unknown as MediaElement),
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter({ wasm }));
    try {
      const a = await (await render(runtime, media("RegularAlias"), { as: "png" })).bytes();
      const b = await (await render(runtime, media("BoldAlias"), { as: "png" })).bytes();
      const reference = await (await render(runtime, media("Inter", 700), { as: "png" })).bytes();
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0);
      expect(Buffer.compare(Buffer.from(b), Buffer.from(reference))).toBe(0);
    } finally { await runtime.dispose(); }
  });

  it("selects a collection face for raster and HTML output", async () => {
    const wasm = new Uint8Array(await readFile(new URL("../../superimg-core/node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url)));
    const regular = Buffer.from(await readFile(new URL("../../superimg-core/assets/fonts/Inter-400.ttf", import.meta.url)));
    const bold = Buffer.from(await readFile(new URL("../../superimg-core/assets/fonts/Inter-700.ttf", import.meta.url)));
    const header = Buffer.alloc(20);
    header.write("ttcf", 0, "ascii");
    header.writeUInt32BE(0x00010000, 4);
    header.writeUInt32BE(2, 8);
    const padding = Buffer.alloc((4 - regular.length % 4) % 4);
    const offsets = [header.length, header.length + regular.length + padding.length];
    header.writeUInt32BE(offsets[0]!, 12);
    header.writeUInt32BE(offsets[1]!, 16);
    const collection = Buffer.concat([header, regular, padding, bold]);
    for (const [index, font] of [regular, bold].entries()) {
      for (let i = 0; i < font.readUInt16BE(4); i++) {
        const position = offsets[index]! + 12 + i * 16 + 8;
        collection.writeUInt32BE(collection.readUInt32BE(position) + offsets[index]!, position);
      }
    }
    const media = (source: Uint8Array) => image({
      size: { width: 300, height: 80 }, fonts: [{ family: "CollectionAlias", weight: 700, src: source }],
      render: () => element("Vector", { width: 300, height: 80, viewBox: { x: 0, y: 0, width: 300, height: 80 } },
        { $$typeof: MEDIA_ELEMENT, type: "VectorText", props: { x: 4, y: 55, size: 42, family: "CollectionAlias", weight: 700, fill: "#000" }, children: ["Wide glyphs"] } as unknown as MediaElement),
    });
    const runtime = createRuntime(createEdgeRuntimeAdapter({ wasm }));
    try {
      const collected = await (await render(runtime, media(collection), { as: "png" })).bytes();
      const standalone = await (await render(runtime, media(bold), { as: "png" })).bytes();
      expect(Buffer.compare(Buffer.from(collected), Buffer.from(standalone))).toBe(0);
      const html = await (await render(runtime, media(collection), { as: "html" })).text();
      const match = /font-family:"CollectionAlias"[^}]+base64,([^\"]+)/.exec(html);
      expect(match).not.toBeNull();
      const embedded = Buffer.from(match![1]!, "base64");
      expect(embedded.readUInt32BE(0)).toBe(0x00010000);
      expect(embedded.equals(collection)).toBe(false);
      expect(Buffer.compare(embedded, Buffer.from(aliasSvgFont(bold, "CollectionAlias", 700)))).toBe(0);
    } finally { await runtime.dispose(); }
  });
});

function element(type: string, props: Record<string, unknown>, ...children: MediaElement[]): MediaElement {
  return { $$typeof: MEDIA_ELEMENT, type, props: type === "Html" ? { width: "fill", height: "fill", ...props } : props, children } as MediaElement;
}

async function read(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
