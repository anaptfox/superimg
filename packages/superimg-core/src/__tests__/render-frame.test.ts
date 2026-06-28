import { describe, it, expect } from "vitest";
import type { TemplateModule } from "@superimg/types";
import { resolveFrameIndex, renderTemplateFrame } from "../rendering/render-frame.js";

describe("resolveFrameIndex", () => {
  it("clamps frame to valid range", () => {
    expect(resolveFrameIndex({ frame: 0, fps: 30, durationSeconds: 2 })).toBe(0);
    expect(resolveFrameIndex({ frame: 59, fps: 30, durationSeconds: 2 })).toBe(59);
    expect(resolveFrameIndex({ frame: 999, fps: 30, durationSeconds: 2 })).toBe(59);
  });

  it("maps progress to frame", () => {
    expect(resolveFrameIndex({ progress: 0, fps: 30, durationSeconds: 2 })).toBe(0);
    expect(resolveFrameIndex({ progress: 1, fps: 30, durationSeconds: 2 })).toBe(59);
    expect(resolveFrameIndex({ progress: 0.5, fps: 30, durationSeconds: 2 })).toBe(30);
  });
});

describe("renderTemplateFrame", () => {
  it("merges sample data and binds scene progress at frame", () => {
    const template: TemplateModule & { sample?: Record<string, unknown> } = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 2, width: 640, height: 360 },
      sample: { title: "from sample" },
      render: (ctx) =>
        `<div data-title="${ctx.data.title}" data-progress="${ctx.timeline.progress}"></div>`,
    };

    const mid = renderTemplateFrame({ template, progress: 0.5, composite: false });
    expect(mid.html).toContain('data-title="from sample"');
    expect(mid.frame).toBe(30);
    expect(mid.ctx.timeline.progress).toBeCloseTo(0.5, 1);
  });

  it("options.data overrides sample", () => {
    const template: TemplateModule & { sample?: Record<string, unknown> } = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 1, width: 100, height: 100 },
      sample: { label: "sample" },
      render: (ctx) => `<span>${(ctx.data as { label: string }).label}</span>`,
    };

    const { html } = renderTemplateFrame({
      template,
      data: { label: "override" },
      composite: false,
    });
    expect(html).toContain("override");
    expect(html).not.toContain("sample");
  });
});