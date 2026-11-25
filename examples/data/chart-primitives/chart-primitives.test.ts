import { describe, expect, it } from "vitest";
import { createRenderContext } from "../../../packages/superimg-core/src/rendering/create-render-context";
import { lowerRenderOutput } from "../../../packages/superimg-core/src/rendering/lower-output";
import { walkMediaTree } from "../../../packages/superimg-stdlib/src/tree/walk";
import { renderChartPrimitives } from "./chart-primitives.media";
describe("typed chart composition", () => {
  const render = (frame: number, width: number, height: number) =>
    lowerRenderOutput(
      renderChartPrimitives(createRenderContext(frame, 30, 150, width, height)),
    );
  const nodesAt = (frame: number, width: number, height: number) =>
    walkMediaTree(
      renderChartPrimitives(createRenderContext(frame, 30, 150, width, height)),
      { width, height },
    );
  const ESSENTIAL = ["eyebrow", "headline", "headline-2", "reading", "reading-label", "line-title", "bars-title", "explanation"];
  for (const [width, height] of [
    [1920, 1080],
    [1080, 1080],
  ] as const) {
    it(`keeps copy, readings and both graphs within the stage at ${width}×${height}`, () => {
      const nodes = nodesAt(100, width, height);
      const essential = nodes.filter((node) => ESSENTIAL.includes(node.id ?? ""));
      expect(essential.map((node) => node.id).sort()).toEqual([...ESSENTIAL].sort());
      for (const node of [...essential, ...nodes.filter((node) => node.id === "line-chart" || node.id === "bars-chart")]) {
        expect(node.bounds, node.id).toBeDefined();
        const bounds = node.bounds!;
        expect(bounds.x, node.id).toBeGreaterThanOrEqual(40);
        expect(bounds.y, node.id).toBeGreaterThanOrEqual(40);
        expect(bounds.x + bounds.width, node.id).toBeLessThanOrEqual(width - 40);
        expect(bounds.y + bounds.height, node.id).toBeLessThanOrEqual(height - 40);
      }
      // The two graphs stack on one grid: same left edge, same width, no overlap.
      const lineChart = nodes.find((node) => node.id === "line-chart")!.bounds!;
      const barsChart = nodes.find((node) => node.id === "bars-chart")!.bounds!;
      expect(lineChart.x).toBe(barsChart.x);
      expect(lineChart.width).toBe(barsChart.width);
      expect(lineChart.y + lineChart.height).toBeLessThanOrEqual(barsChart.y);
      // Copy never sits on the graphs.
      const reading = nodes.find((node) => node.id === "reading")!.bounds!;
      const overlaps = (a: typeof reading, b: typeof reading) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps(reading, lineChart)).toBe(false);
      expect(overlaps(reading, barsChart)).toBe(false);
      const explanation = nodes.find((node) => node.id === "explanation")!.bounds!;
      expect(overlaps(explanation, barsChart)).toBe(false);
    });
  }
  it("keeps the headline readable on the painted stage without decorative fades", () => {
    const nodes = nodesAt(149, 1920, 1080);
    for (const id of ["headline", "headline-2", "reading-label", "line-title", "bars-title"]) {
      const node = nodes.find((n) => n.id === id)!;
      expect(node.color, id).toMatch(/^#/);
      expect(node.motion?.opacity ?? 1, id).toBe(1);
    }
    expect(nodes[0]?.paint?.fill).toBe("#0C0D10");
  });
  for (const [width, height] of [
    [1920, 1080],
    [1080, 1920],
    [1080, 1080],
  ]) {
    it(`preserves independent chart occurrences and finite geometry at ${width}×${height}`, () => {
      const html = render(100, width!, height!);
      const nodes = nodesAt(100, width!, height!);
      expect(nodes.some((node) => node.tag === "Html" || node.opaque)).toBe(
        false,
      );
      // The reading is the resolved April datum, not hand-typed copy.
      expect(html).toMatch(/>\s*58\s*</);
      expect(html).toContain("APR · ACTIVE PROJECTS");
      expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(3);
      expect(html).toContain("MONTHLY ADOPTION");
      expect(html).toContain("API");
      expect(html).toContain("Prior only");
      expect(html).not.toMatch(/NaN|Infinity|<canvas|<script/);
    });
    it(`seeks deterministically in shuffled order at ${width}×${height}`, () => {
      const frames = [0, 21, 59, 84, 149];
      const baseline = new Map(
        frames.map((frame) => [frame, render(frame, width!, height!)]),
      );
      for (const frame of [149, 21, 0, 84, 59, 21, 149, 0])
        expect(render(frame, width!, height!)).toBe(baseline.get(frame));
    });
  }
  it("grows the three bar groups on their own offsets from one zero line", () => {
    const early = render(44, 1920, 1080); // 1.47s: Web growing, API not yet
    const settled = render(149, 1920, 1080);
    expect(early).not.toBe(settled);
    expect(settled).toContain("CHANGE BY CHANNEL");
  });
});
