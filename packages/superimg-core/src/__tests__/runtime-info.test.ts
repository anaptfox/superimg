import { describe, expect, it } from "vitest";
import { define } from "@superimg/types";
import {
  createImageRenderContext,
  createRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
} from "../index.js";
import type { AnyTemplateModule } from "@superimg/types";

describe("runtime template info", () => {
  it("resolves still image defaults without temporal frames", () => {
    const template = define({
      sample: { title: "default" },
      config: { width: 1200, height: 630 },
      render: () => "<div />",
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
    const svg = define({ medium: "svg",
      config: { width: 400, height: 300, duration: 2 },
      render: () => "<svg />",
    });
    // Animated HTML (formerly "gif") — fps + duration ⇒ N frames.
    const animatedShort = define({
      config: { width: 320, height: 180, fps: 12, duration: 2 },
      render: () => "<div />",
    });
    const video = define({
      config: { width: 640, height: 360, fps: 24, duration: 2 },
      render: () => "<div />",
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
});

describe("sample field in resolveRuntimeTemplateInfo", () => {
  it("uses template.sample as default data when no options.data is provided", () => {
    const template = define({
      sample: { title: "from sample" },
      config: { width: 800, height: 600 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ title: "from sample" });
  });

  it("options.data fully overrides template.sample", () => {
    const template = define({
      sample: { title: "sample value", extra: "keep" },
      config: { width: 800, height: 600 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template, { data: { title: "override" } });

    // options.data spreads over sample — only explicitly supplied keys override
    expect(info.data.title).toBe("override");
  });

  it("merges sample and options.data — sample provides base, options.data overrides", () => {
    const template = define({
      sample: { title: "default title", color: "#000" },
      config: { width: 1920, height: 1080, fps: 30, duration: 2 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template, {
      data: { title: "override title" },
    });

    expect(info.data.title).toBe("override title");
    expect(info.data.color).toBe("#000");
  });

  it("produces empty data object when neither sample nor options.data is supplied", () => {
    const template = define({
      config: { width: 400, height: 400 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({});
  });

  it("works correctly for gif templates with sample", () => {
    const template = define({
      sample: { text: "animated" },
      config: { width: 320, height: 180, fps: 10, duration: 1 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ text: "animated" });
    expect(info.isAnimated).toBe(true);
  });

  it("works correctly for svg templates with sample", () => {
    const template = define({ medium: "svg",
      sample: { label: "svg sample" },
      config: { width: 400, height: 300 },
      render: () => "<svg />",
    });

    const info = resolveRuntimeTemplateInfo(template);

    expect(info.data).toEqual({ label: "svg sample" });
    expect(info.medium).toBe("svg");
  });

  it("handles a template without a sample field (no own property)", () => {
    // Build a raw module object that truly lacks the sample property
    const template: AnyTemplateModule = {
      medium: "html",
      animated: false,
      config: { width: 200, height: 200 },
      render: () => "<div />",
    };

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
