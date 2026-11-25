import { describe, expect, it } from "vitest";
import { define, type JsonObject } from "@superimg/types";
import {
  createImageRenderContext,
  createRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
} from "../index.js";
import { boxedHtml, boxedSvg } from "./__test-utils__/index.js";

describe("runtime template info", () => {
  it("preserves portable explicit font faces alongside Google declarations and authored CSS", () => {
    const info = resolveRuntimeTemplateInfo(define({
      config: {
        fonts: [
          { family: "Inter", weight: 400, src: new Uint8Array([0, 1, 0, 0]) },
          { family: "Inter", weight: 700, style: "italic", src: new Uint8Array([79, 84, 84, 79]).buffer },
          { family: "Remote", src: "https://example.com/font?v=2" },
          { family: "Server", src: "./assets/font.ttf" },
          { kind: "google", spec: " Roboto:wght@400 " },
        ],
        inlineCss: ["body{color:red}"],
      },
      render: () => boxedHtml("<div />"),
    }));
    expect(info.fonts).toEqual(["Roboto:wght@400"]);
    expect(info.fontCss).toEqual([
      '@font-face{font-family:"Inter";font-style:normal;font-weight:400;src:url("data:font/ttf;base64,AAEAAA==") format("truetype");font-display:block}',
      '@font-face{font-family:"Inter";font-style:italic;font-weight:700;src:url("data:font/otf;base64,T1RUTw==") format("opentype");font-display:block}',
      '@font-face{font-family:"Remote";font-style:normal;font-weight:400;src:url("https://example.com/font?v=2");font-display:block}',
    ]);
    expect(info.inlineCss).toEqual(["body{color:red}"]);
  });

  it.each([
    ["wOFF", "font/woff", "woff"],
    ["wOF2", "font/woff2", "woff2"],
    ["ttcf", "font/collection", "collection"],
  ])("embeds %s bytes with the corresponding browser format", (signature, mime, format) => {
    const bytes = new Uint8Array([99, ...Array.from(signature, (char) => char.charCodeAt(0)), 99]);
    const info = resolveRuntimeTemplateInfo(define({
      config: { fonts: [{ family: "Subset", src: bytes.subarray(1, 5) }] },
      render: () => boxedHtml("<div />"),
    }));
    expect(info.fontCss[0]).toContain(`data:${mime};base64,`);
    expect(info.fontCss[0]).toContain(`format("${format}")`);
  });

  it("resolves still image defaults without temporal frames", () => {
    const template = define<JsonObject>({
      sample: { title: "default" },
      config: { width: 1200, height: 630 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template, { data: { title: "override" } });

    expect(info.medium).toBe("html");
    expect(info.isAnimated).toBe(false);
    expect(info.width).toBe(1200);
    expect(info.height).toBe(630);
    expect(info.fps).toBe(1);
    expect(info.totalFrames).toBe(1);
    expect(info.data.title).toBe("override");
  });

  it("resolves static-SVG, animated, and video timing consistently", () => {
    // Static SVG: declares only duration (for CSS) — not animated.
    const svg = define<JsonObject>({ medium: "svg",
      config: { width: 400, height: 300, duration: 2 },
      render: () => boxedSvg(""),
    });
    // Animated HTML (formerly "gif") — fps + duration ⇒ N frames.
    const animatedShort = define<JsonObject>({
      config: { width: 320, height: 180, fps: 12, duration: 2 },
      render: () => boxedHtml("<div />"),
    });
    const video = define<JsonObject>({
      config: { width: 640, height: 360, fps: 24, duration: 2 },
      render: () => boxedHtml("<div />"),
    });

    expect(resolveRuntimeTemplateInfo(svg)).toMatchObject({
      medium: "svg",
      isAnimated: false,
      fps: 1,
      duration: 2,
      totalFrames: 1,
    });
    expect(resolveRuntimeTemplateInfo(animatedShort)).toMatchObject({
      medium: "html",
      isAnimated: true,
      fps: 12,
      duration: 2,
      totalFrames: 24,
    });
    expect(resolveRuntimeTemplateInfo(video)).toMatchObject({
      medium: "html",
      isAnimated: true,
      fps: 24,
      duration: 2,
      totalFrames: 48,
    });
  });

  it("parses static SVG duration strings for CSS animation metadata", () => {
    const svg = define<JsonObject>({ medium: "svg",
      config: { width: 400, height: 300, duration: "2500ms" },
      render: () => boxedSvg(""),
    });

    expect(resolveRuntimeTemplateInfo(svg)).toMatchObject({
      medium: "svg",
      isAnimated: false,
      fps: 1,
      duration: 2.5,
      totalFrames: 1,
    });
  });
});

describe("sample field in resolveRuntimeTemplateInfo", () => {
  it("uses template.sample as default data when no options.data is provided", () => {
    const template = define<JsonObject>({
      sample: { title: "from sample" },
      config: { width: 800, height: 600 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ title: "from sample" });
  });

  it("options.data fully overrides template.sample", () => {
    const template = define<JsonObject>({
      sample: { title: "sample value", extra: "keep" },
      config: { width: 800, height: 600 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template, { data: { title: "override" } });

    // options.data spreads over sample — only explicitly supplied keys override
    expect(info.data.title).toBe("override");
  });

  it("merges sample and options.data — sample provides base, options.data overrides", () => {
    const template = define<JsonObject>({
      sample: { title: "default title", color: "#000" },
      config: { width: 1920, height: 1080, fps: 30, duration: 2 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template, {
      data: { title: "override title" },
    });

    expect(info.data.title).toBe("override title");
    expect(info.data.color).toBe("#000");
  });

  it("produces empty data object when neither sample nor options.data is supplied", () => {
    const template = define<JsonObject>({
      config: { width: 400, height: 400 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({});
  });

  it("works correctly for gif templates with sample", () => {
    const template = define<JsonObject>({
      sample: { text: "animated" },
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ text: "animated" });
    expect(info.isAnimated).toBe(true);
  });

  it("works correctly for svg templates with sample", () => {
    const template = define<JsonObject>({ medium: "svg",
      sample: { label: "svg sample" },
      config: { width: 400, height: 300 },
      render: () => boxedSvg(""),
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ label: "svg sample" });
    expect(info.medium).toBe("svg");
  });

  it("handles a template without a sample field (no own property)", () => {
    const template = define<JsonObject>({
      config: { width: 200, height: 200 },
      render: () => boxedHtml("<div />"),
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({});
  });
});

describe("static render contexts", () => {
  it("omits temporal fields from image and SVG contexts", () => {
    const imageCtx = createImageRenderContext(1200, 630);
    const svgCtx = createSvgRenderContext(400, 300, { duration: 2 });

    expect("globalFrame" in imageCtx).toBe(false);
    expect("fps" in imageCtx).toBe(false);
    expect("globalFrame" in svgCtx).toBe(false);
    expect("fps" in svgCtx).toBe(false);
    expect(svgCtx.duration).toBe(2);
  });

  it("keeps temporal fields in video contexts", () => {
    const videoCtx = createRenderContext(3, 30, 90, 1920, 1080, {});

    expect(videoCtx.globalFrame).toBe(3);
    expect(videoCtx.fps).toBe(30);
    expect(videoCtx.totalFrames).toBe(90);
  });
});
