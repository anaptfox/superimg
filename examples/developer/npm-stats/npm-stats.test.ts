import { beforeAll, describe, expect, it } from "vitest";
import { createRenderContext } from "../../../packages/superimg-core/src/rendering/create-render-context";
import { lowerRenderOutput } from "../../../packages/superimg-core/src/rendering/lower-output";
import {
  createPreparedStdlibForTemplate,
  type PreparedStdlib,
} from "../../../packages/superimg-core/src/shared/stdlib-capabilities";
import { walkMediaTree } from "../../../packages/superimg-stdlib/src/tree/walk";
import { scanTreePaintIssues } from "../../../packages/superimg-core/src/validation/tree-paint";
import stats, { renderNpmStats } from "./npm-stats.media";
let prepared: PreparedStdlib;
beforeAll(async () => {
  prepared = await createPreparedStdlibForTemplate(stats);
});
describe("npm history chart", () => {
  const context = (frame: number, width: number, height: number, data = stats.sample!) =>
    createRenderContext(
      frame,
      30,
      204,
      width,
      height,
      data,
      {},
      undefined,
      undefined,
      undefined,
      undefined,
      prepared,
    );
  const render = (frame: number, width = 1920, height = 1080) =>
    lowerRenderOutput(renderNpmStats(context(frame, width, height)));
  const ESSENTIAL = ["registry-label", "package-name", "download-reading", "observed-caption", "period-total"];
  const overlaps = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  it("keeps chart and logo inspectable without markup holes", () => {
    const html = render(150);
    expect(html).toContain("<svg");
    expect(html).toContain("PERIOD TOTAL");
    expect(html).toContain("6 OBSERVATIONS");
    expect(html).not.toMatch(/NaN|Infinity|<foreignObject/);
  });
  it("avoids zero-length guide geometry before the line starts moving", () => {
    for (const frame of [0, 1, 20, 21, 22]) {
      const nodes = walkMediaTree(renderNpmStats(context(frame, 1920, 1080)), { width: 1920, height: 1080 });
      expect(nodes.filter(node => node.tag === "VectorPath" && node.bounds?.width === 0 && node.bounds?.height === 0)).toEqual([]);
    }
  });
  it("keeps package identity and labels visible throughout the final hold", () => {
    for (const frame of [153, 203]) {
      const nodes = walkMediaTree(renderNpmStats(context(frame, 1920, 1080)), { width: 1920, height: 1080 });
      for (const id of ["registry-label", "package-name", "observed-caption"]) {
        const node = nodes.find(node => node.id === id)!;
        expect(node.motion?.opacity ?? 1, id).toBe(1);
      }
    }
  });
  it("labels travelling readings as interpolated and the final datum as observed", () => {
    expect(render(75)).toContain("interpolated ·");
    expect(render(203)).toContain("observed Jun 2024");
    expect(render(203)).not.toContain("interpolated ·");
  });
  it("samples the same frame independently of preceding frames", () => {
    const reference = new Map(
      [0, 30, 90, 150, 203].map((frame) => [frame, render(frame)]),
    );
    for (const frame of [203, 0, 90, 30, 150, 0, 203])
      expect(render(frame)).toBe(reference.get(frame));
  });
  for (const [width, height] of [
    [1920, 1080],
    [1080, 1080],
  ] as const) {
    it(`keeps essential ink on the stage and off the graph at ${width}×${height}`, () => {
      const tree = renderNpmStats(context(150, width, height));
      const nodes = walkMediaTree(tree, { width, height });
      const issues = scanTreePaintIssues(nodes, { width, height, frame: 150, progress: 150 / 203 });
      expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
      const essential = nodes.filter((node) => ESSENTIAL.includes(node.id ?? ""));
      expect(essential.map((node) => node.id).sort()).toEqual([...ESSENTIAL].sort());
      const chart = nodes.find((node) => node.id === "chart")!.bounds!;
      for (const node of essential) {
        const bounds = node.bounds!;
        expect(bounds, node.id).toBeDefined();
        expect(bounds.x, node.id).toBeGreaterThanOrEqual(40);
        expect(bounds.y, node.id).toBeGreaterThanOrEqual(40);
        expect(bounds.x + bounds.width, node.id).toBeLessThanOrEqual(width - 40);
        expect(bounds.y + bounds.height, node.id).toBeLessThanOrEqual(height - 40);
        expect(overlaps(bounds, chart), node.id).toBe(false);
      }
      // Body copy carries an explicit color over the painted stage.
      for (const node of essential) expect(node.color, node.id).toMatch(/^#/);
      expect(nodes[0]?.paint?.fill).toBe("#0C0D10");
    });
  }
  it("gives the square edition a reading above its caption above the graph", () => {
    const width = 1080, height = 1080;
    const nodes = walkMediaTree(renderNpmStats(context(150, width, height)), { width, height });
    const reading = nodes.find((node) => node.id === "download-reading")!.bounds!;
    const caption = nodes.find((node) => node.id === "observed-caption")!.bounds!;
    const chart = nodes.find((node) => node.id === "chart")!.bounds!;
    expect(reading.y + reading.height).toBeLessThanOrEqual(caption.y);
    expect(caption.y + caption.height).toBeLessThanOrEqual(chart.y);
    expect(chart.width).toBeGreaterThanOrEqual(width * 0.8);
  });
  it("renders narrow editions and the empty state", () => {
    expect(render(150, 1080, 1920)).not.toContain("NaN");
    expect(render(150, 1080, 1080)).toContain("PERIOD TOTAL");
    expect(render(150, 1200, 630)).toContain("PERIOD TOTAL");
    expect(
      lowerRenderOutput(renderNpmStats(context(0, 1080, 1080, { ...stats.sample!, downloads: [] }))),
    ).toContain("No download observations");
  });
});
