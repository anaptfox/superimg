import { describe, expect, it } from "vitest";
import { renderTemplateFrame } from "@superimg/core/testing";
import { video, Frame, Fill, Text } from "@foxworth/superimg";
import {
  checkLoopSeam,
  checkLoopSeamVisual,
  htmlStructuralFingerprint,
  renderLoopBoundary,
} from "./loop-seam.js";
import { scrapeHtmlSemantics } from "./html-semantics.js";

function seam(html: string, progress: number) {
  const { text, colors } = scrapeHtmlSemantics(html);
  return { html, progress, text, colors, htmlBytes: Buffer.byteLength(html) };
}

const clock = { fps: 30, totalFrames: 120, width: 100, height: 100 };

describe("virtual loop boundary", () => {
  it("closes a 120-frame periodic phase without duplicating the last encoded frame", () => {
    const template = video({
      duration: "4s", fps: 30, size: { width: 100, height: 100 }, temporal: "loop",
      render: (ctx) => Frame({ id: "grain", x: 20 + 10 * Math.sin(2 * Math.PI * (ctx.timeline.frame % 120) / 120), y: 20, width: 10, height: 10 }, Fill({ color: "#fff" })),
    });
    const start = renderTemplateFrame({ template, ...clock, frame: 0 });
    const last = renderTemplateFrame({ template, ...clock, frame: 119 });
    const boundary = renderLoopBoundary({ template, ...clock });
    expect(boundary).toMatchObject({ frame: 120, progress: 1, timelineSeconds: 4 });
    expect(last.html).not.toBe(start.html);
    expect(checkLoopSeam([seam(start.html, 0), seam(last.html, 1)])).toHaveLength(1);
    expect(checkLoopSeam([seam(start.html, 0), seam(boundary.html, 1)])).toEqual([]);
  });

  it.each(["position", "label", "color"])("rejects a %s discontinuity at the virtual boundary", (fault) => {
    const template = video({
      duration: "4s", fps: 30, size: { width: 100, height: 100 }, temporal: "loop",
      render: (ctx) => Frame({ id: "subject", x: fault === "position" ? ctx.timeline.frame / 2 : 0, width: 100, height: 100 },
        Fill({ color: fault === "color" && ctx.timeline.frame >= 120 ? "#f00" : "#000" }),
        Text({ color: "#fff", size: 12 }, fault === "label" && ctx.timeline.frame >= 120 ? "Changed" : "Start")),
    });
    const start = renderTemplateFrame({ template, ...clock, frame: 0 });
    const boundary = renderLoopBoundary({ template, ...clock });
    expect(checkLoopSeam([seam(start.html, 0), seam(boundary.html, 1)]).some((issue) => issue.code === "LOOP_SEAM_BROKEN")).toBe(true);
  });

  it("rejects a retained occurrence clock instead of treating its clamped last frame as closure", () => {
    const template = video({ duration: "4s", render: () => Frame({ width: 100, height: 100 }, Fill({ color: "#fff" })) });
    Object.defineProperty(template, "composition", { value: { schedule: { totalFrames: 120 } } });
    expect(() => renderLoopBoundary({ template, ...clock })).toThrow(/do not expose a virtual cycle boundary/);
  });
});

describe("checkLoopSeam", () => {
  it("passes when text and colors match at 0 and 1", () => {
    const issues = checkLoopSeam([
      { progress: 0, text: ["hello"], colors: ["#fff"], htmlBytes: 10 },
      { progress: 1, text: ["hello"], colors: ["#fff"], htmlBytes: 10 },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("does not accept partial coverage or a single sampled pose as proof of closure", () => {
    for (const samples of [[], [seam("", 0)], [seam("", .1), seam("", .9)]]) {
      expect(checkLoopSeam(samples).some((issue) => issue.code === "LOOP_SEAM_BROKEN")).toBe(true);
    }
  });

  it("fails when text differs", () => {
    const issues = checkLoopSeam([
      { progress: 0, text: ["a"], colors: ["#000"], htmlBytes: 1 },
      { progress: 1, text: ["b"], colors: ["#000"], htmlBytes: 1 },
    ]);
    expect(issues.some((i) => i.code === "LOOP_SEAM_BROKEN")).toBe(true);
  });

  it("fails when colors differ", () => {
    const issues = checkLoopSeam([
      { progress: 0, text: [], colors: ["#111"], htmlBytes: 1 },
      { progress: 1, text: [], colors: ["#222"], htmlBytes: 1 },
    ]);
    expect(issues.some((i) => i.code === "LOOP_SEAM_VISUAL" || i.code === "LOOP_SEAM_BROKEN")).toBe(
      true,
    );
  });

  it("fails when HTML structure differs", () => {
    const issues = checkLoopSeam([
      {
        progress: 0,
        text: [],
        colors: [],
        htmlBytes: 1,
        html: '<div style="opacity:1">A</div>',
      },
      {
        progress: 1,
        text: [],
        colors: [],
        htmlBytes: 1,
        html: '<div style="opacity:0">B</div>',
      },
    ]);
    expect(issues.some((i) => i.code === "LOOP_SEAM_BROKEN")).toBe(true);
  });

  it("treats color/text order as sets", () => {
    const issues = checkLoopSeam([
      { progress: 0, text: ["b", "a"], colors: ["#b", "#a"], htmlBytes: 1 },
      { progress: 1, text: ["a", "b"], colors: ["#a", "#b"], htmlBytes: 1 },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("normalizes scale floats in fingerprint", () => {
    const a = htmlStructuralFingerprint('<div style="transform: scale(0.9600001)"></div>');
    const b = htmlStructuralFingerprint('<div style="transform: scale(0.96)"></div>');
    // scale(*) replaces both; remaining floats toFixed(2)
    expect(a).toBe(b);
  });
});

describe("checkLoopSeamVisual", () => {
  it("fails when mae over threshold", () => {
    expect(checkLoopSeamVisual(10, 2.5).some((i) => i.code === "LOOP_SEAM_VISUAL")).toBe(true);
  });
  it("passes under threshold", () => {
    expect(checkLoopSeamVisual(1, 2.5)).toHaveLength(0);
  });
  it("accepts moving wrap steps comparable to neighboring motion, not just identical endpoints", () => {
    expect(checkLoopSeamVisual(12, 2.5, { before: 10, after: 11 })).toEqual([]);
  });
  it("rejects a sudden wrap jump when neighboring steps are settled", () => {
    expect(checkLoopSeamVisual(12, 2.5, { before: .5, after: 1 })[0]?.code).toBe("LOOP_SEAM_VISUAL");
  });
  it("retains the absolute tolerance for a held seam and rejects unavailable comparisons", () => {
    expect(checkLoopSeamVisual(1, 2.5, { before: 0, after: 0 })).toEqual([]);
    for (const neighbors of [{ before: null, after: 1 }, { before: NaN, after: 1 }, { before: 1, after: -1 }]) {
      expect(checkLoopSeamVisual(1, 2.5, neighbors)[0]?.code).toBe("LOOP_SEAM_VISUAL");
    }
    expect(checkLoopSeamVisual(NaN)[0]?.code).toBe("LOOP_SEAM_VISUAL");
  });
});
