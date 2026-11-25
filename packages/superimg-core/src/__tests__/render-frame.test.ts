import { describe, it, expect } from "vitest";
import type { TemplateModule } from "@superimg/types";
import { resolveFrameIndex, renderTemplateFrame } from "../rendering/render-frame.js";
import { installStillLaneKit } from "../rendering/still-lane-kit.js";
import { defaultStillLaneKit } from "../rendering/still-lane-install.js";

// Entry points install the browser-free still lane; this test imports the module directly.
installStillLaneKit(defaultStillLaneKit);
import { boxedHtml } from "./__test-utils__/index.js";
import { sequence } from "../composition/sequence.js";
import { time } from "../composition/time.js";
import { video } from "@superimg/types";

describe("resolveFrameIndex", () => {
  it("uses a resolved count instead of rebuilding it from seconds", () => {
    expect(resolveFrameIndex({ progress: 1, fps: 25, durationSeconds: 0.28, totalFrames: 7 })).toBe(6);
    expect(resolveFrameIndex({ frame: 999, totalFrames: 1 })).toBe(0);
    expect(() => resolveFrameIndex({ totalFrames: 0 })).toThrow(/positive safe integer/);
  });
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
  it("rejects an explicit count or fps that contradicts a retained clock", () => {
    const film = time(sequence([{ id: "clip", content: video({
      size: { width: 320, height: 180 }, fps: 25, duration: "7f", render: () => boxedHtml("clip"),
    }) }]), { size: { width: 320, height: 180 }, fps: 25 });
    expect(() => renderTemplateFrame({ template: film, totalFrames: 8 })).toThrow(/retained clock/);
    expect(() => renderTemplateFrame({ template: film, fps: 30 })).toThrow(/retained clock/);
  });
  it("merges sample data and binds scene progress at frame", () => {
    const template: TemplateModule & { sample?: Record<string, unknown> } = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 2, width: 640, height: 360 },
      sample: { title: "from sample" },
      render: (ctx) =>
        boxedHtml(`<div data-title="${ctx.data.title}" data-progress="${ctx.timeline.progress}"></div>`),
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
      render: (ctx) => boxedHtml(`<span>${(ctx.data as { label: string }).label}</span>`),
    };

    const { html } = renderTemplateFrame({
      template,
      data: { label: "override" },
      composite: false,
    });
    expect(html).toContain("override");
    expect(html).not.toContain("sample");
  });

  it("lowers a media tree to HTML", async () => {
    const { Frame, Text } = await import("@superimg/stdlib/tree");
    const template: TemplateModule = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 1, width: 200, height: 100 },
      render: (ctx) =>
        Frame({ width: ctx.width, height: ctx.height, id: "root" }, Text("tree-frame")),
    };
    const { html, tree } = renderTemplateFrame({ template, progress: 0, composite: false });
    expect(html).toContain("tree-frame");
    expect(html).toContain("data-si-primitive");
    expect(tree?.type).toBe("Frame");
    expect(tree?.props.id).toBe("root");
  });

  it("lowers nested tree coordinates relative to the parent", async () => {
    const { Frame } = await import("@superimg/stdlib/tree");
    const template: TemplateModule = {
      medium: "html",
      animated: true,
      config: { fps: 30, duration: 1, width: 400, height: 200 },
      render: () =>
        Frame(
          { width: 400, height: 200, id: "stage" },
          Frame(
            { id: "outer", x: 40, y: 20, width: 200, height: 100 },
            Frame({ id: "inner", x: 10, y: 8, width: 40, height: 16 }),
          ),
        ),
    };
    const { html } = renderTemplateFrame({ template, progress: 0, composite: false });
    const inner = html.match(/id="inner"[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(inner).toContain("left:10px");
    expect(inner).toContain("top:8px");
    expect(inner).not.toContain("left:50px");
  });

  it("lowers a browser-free still through the svg lane", async () => {
    const { Frame, Stack, Text } = await import("@superimg/stdlib/tree");
    const template: TemplateModule = {
      medium: "html",
      animated: false,
      config: { width: 320, height: 180, background: "#112233" },
      render: () =>
        Frame(
          { width: "fill", height: "fill" },
          Stack({ width: "fill", height: "fill", align: "center", justify: "center" }, Text("Lane")),
        ),
    };
    const frame = renderTemplateFrame({ template, composite: true });
    expect(frame.lane).toBe("svg");
    expect(frame.browserReasons).toEqual([]);
    expect(frame.svg).toContain("<svg");
    expect(frame.svg).toContain("<text");
    expect(frame.svg).toContain("Lane");
    expect(frame.svg).toContain("#112233");
    expect(frame.html).toContain("data-si-primitive");
  });

  it("keeps a still on the html lane when the tree needs a browser", async () => {
    const { Frame, Html } = await import("@superimg/stdlib/tree");
    const template: TemplateModule = {
      medium: "html",
      animated: false,
      config: { width: 64, height: 64 },
      render: () => Frame({ width: "fill", height: "fill" }, Html({ id: "markup", html: "<b>x</b>" })),
    };
    const frame = renderTemplateFrame({ template, composite: true });
    expect(frame.lane).toBe("html");
    expect(frame.svg).toBeUndefined();
    expect(frame.browserReasons).toEqual([{ nodeId: "markup", reason: "Html" }]);
    expect(frame.compositeHtml).toContain("<b>x</b>");
  });
});
