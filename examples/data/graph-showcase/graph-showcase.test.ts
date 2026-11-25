import { describe, expect, it } from "vitest";
import { createRenderContext } from "../../../packages/superimg-core/src/rendering/create-render-context";
import { lowerRenderOutput } from "../../../packages/superimg-core/src/rendering/lower-output";
import { walkMediaTree } from "../../../packages/superimg-stdlib/src/tree/walk";
import { charts, changes, geometry, renderGraphShowcase, weeks } from "./graph-showcase.media";

const frames = [0, 24, 60, 105, 150, 210, 237, 255, 345, 390, 465, 479];
const tree = (frame: number, width = 1920, height = 1080) => renderGraphShowcase(createRenderContext(frame, 30, 480, width, height));
const markup = (frame: number, width = 1920, height = 1080) => lowerRenderOutput(tree(frame, width, height));

describe("One Grid graph showcase", () => {
  it.each([[1920, 1080], [1080, 1080]])("shares the exact zero baseline between chart families at %s × %s", (width, height) => {
    const { line, bars } = charts(width, height, 1, 1);
    const g = geometry(width, height);
    expect(line.project("y", 0)).toBeCloseTo(bars.project("y", 0), 8);
    expect(g.y + line.project("y", 0)).toBeCloseTo(g.zero, 8);
    expect(line.scene.chart).toEqual(bars.scene.chart);
    const negative = bars.points.find(point => (point.datum as { id: string }).id === "cli:current")!;
    const positive = bars.points.find(point => (point.datum as { id: string }).id === "web:current")!;
    expect(negative.y).toBeGreaterThan(bars.project("y", 0));
    expect(positive.y).toBeLessThan(bars.project("y", 0));
    expect(bars.points.filter(point => (point.datum as { channel: string }).channel === "API")).toHaveLength(1);
  });
  it("does not invent the missing current datum or a numeric claim", () => {
    expect(changes.filter(row => row.channel === "API")).toEqual([{ id: "api:prior", channel: "API", series: "Prior", change: 25 }]);
    expect(weeks.at(-1)?.projects).toBe(52);
    expect(markup(210)).toContain("ILLUSTRATIVE DATA");
    expect(markup(210)).toContain(">52<");
    expect(markup(345)).toContain("prior only — not zero");
  });
  it.each([[1920, 1080], [1080, 1080]])("has deterministic, finite, semantic frames at %s × %s", (width, height) => {
    const samples = new Map(frames.map(frame => [frame, markup(frame, width, height)]));
    for (const frame of [...frames].reverse().concat([0, 345, 210, 479])) expect(markup(frame, width, height)).toBe(samples.get(frame));
    for (const html of samples.values()) expect(html).not.toMatch(/NaN|Infinity|<canvas|<script|<foreignObject/);
  });
  it.each([[1920, 1080], [1080, 1080]])("keeps held copy within the authored stage at %s × %s", (width, height) => {
    for (const frame of [60, 210, 345, 465, 479]) {
      const nodes = walkMediaTree(tree(frame, width, height), { width, height });
      expect(nodes.some(node => node.opaque)).toBe(false);
      const copy = nodes.filter(node => node.text && node.id);
      expect(copy.length).toBeGreaterThan(3);
      for (const node of copy) {
        const bounds = node.bounds!;
        expect(bounds, `${frame}: ${node.id}`).toBeDefined();
        expect(bounds.x, `${frame}: ${node.id}`).toBeGreaterThanOrEqual(0);
        expect(bounds.y, `${frame}: ${node.id}`).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width, `${frame}: ${node.id}`).toBeLessThanOrEqual(width + .5);
        expect(bounds.y + bounds.height, `${frame}: ${node.id}`).toBeLessThanOrEqual(height + .5);
      }
    }
  });
});
