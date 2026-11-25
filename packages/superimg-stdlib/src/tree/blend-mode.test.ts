import { describe, expect, it } from "vitest";
import { Frame, Vector, vector } from "./index.js";
import { needsBrowser } from "./classify.js";
import { lowerSvg } from "./lower-svg.js";

describe("SVG lane mix-blend-mode support", () => {
  it("keeps resvg-native blend modes (screen, multiply, overlay) off the browser path", () => {
    const tree = Frame(
      { width: 640, height: 360, fill: "#111827" },
      Vector(
        { width: 640, height: 360, viewBox: { x: 0, y: 0, width: 640, height: 360 } },
        vector.group(
          { style: { mixBlendMode: "screen" } },
          vector.circle({ cx: 320, cy: 180, r: 80, fill: "#fbbf24" }),
        ),
        vector.group(
          { style: "mix-blend-mode: multiply; opacity: 0.7" },
          vector.rect({ x: 10, y: 10, width: 100, height: 100, fill: "#38bdf8" }),
        ),
      ),
    );

    const verdict = needsBrowser(tree);
    expect(verdict.browser).toBe(false);
    expect(verdict.reasons).toEqual([]);

    const svg = lowerSvg(tree, { width: 640, height: 360 });
    expect(svg).toContain("mix-blend-mode:screen");
    expect(svg).toContain("mix-blend-mode: multiply");
  });

  it("emits mix-blend-mode on Frame containers without requiring Chromium", () => {
    const tree = Frame(
      { width: 200, height: 200, fill: "#000000" },
      Frame({ x: 20, y: 20, width: 100, height: 100, fill: "#ff0000", style: { mixBlendMode: "screen" } }),
    );
    expect(needsBrowser(tree).browser).toBe(false);
    const svg = lowerSvg(tree, { width: 200, height: 200 });
    expect(svg).toContain('style="mix-blend-mode:screen"');
  });

  it("routes plus-lighter (unsupported by resvg) to the browser path", () => {
    const tree = Frame(
      { width: 200, height: 200, fill: "#000000" },
      Vector(
        { width: 200, height: 200, viewBox: { x: 0, y: 0, width: 200, height: 200 } },
        vector.group(
          { style: { mixBlendMode: "plus-lighter" } },
          vector.circle({ cx: 100, cy: 100, r: 40, fill: "#fff" }),
        ),
      ),
    );
    const verdict = needsBrowser(tree);
    expect(verdict.browser).toBe(true);
    expect(verdict.reasons.some((r) => r.reason === "style:mixBlendMode")).toBe(true);
  });
});
