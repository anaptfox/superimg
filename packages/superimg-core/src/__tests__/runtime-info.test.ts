import { describe, expect, it } from "vitest";
import { defineGif, defineImage, defineScene, defineSvg } from "@superimg/types";
import {
  createImageRenderContext,
  createRenderContext,
  createSvgRenderContext,
  resolveRuntimeTemplateInfo,
} from "../index.js";

describe("runtime template info", () => {
  it("resolves still image defaults without temporal frames", () => {
    const template = defineImage({
      data: { title: "default" },
      config: { width: 1200, height: 630 },
      render: () => "<div />",
    });

    const info = resolveRuntimeTemplateInfo(template, { data: { title: "override" } });

    expect(info.kind).toBe("image");
    expect(info.isAnimated).toBe(false);
    expect(info.width).toBe(1200);
    expect(info.height).toBe(630);
    expect(info.fps).toBe(1);
    expect(info.totalFrames).toBe(1);
    expect(info.data.title).toBe("override");
  });

  it("resolves SVG, GIF, and video timing consistently", () => {
    const svg = defineSvg({
      config: { width: 400, height: 300, duration: 2 },
      render: () => "<svg />",
    });
    const gif = defineGif({
      config: { width: 320, height: 180, fps: 12, duration: 2 },
      render: () => "<div />",
    });
    const video = defineScene({
      config: { width: 640, height: 360, fps: 24, duration: 2 },
      render: () => "<div />",
    });

    expect(resolveRuntimeTemplateInfo(svg)).toMatchObject({
      kind: "svg",
      isAnimated: false,
      fps: 1,
      duration: 2,
      totalFrames: 1,
    });
    expect(resolveRuntimeTemplateInfo(gif)).toMatchObject({
      kind: "gif",
      isAnimated: true,
      fps: 12,
      duration: 2,
      totalFrames: 24,
    });
    expect(resolveRuntimeTemplateInfo(video)).toMatchObject({
      kind: "video",
      isAnimated: true,
      fps: 24,
      duration: 2,
      totalFrames: 48,
    });
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
