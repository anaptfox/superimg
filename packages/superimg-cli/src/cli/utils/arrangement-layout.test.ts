import { expect, it } from "vitest";
import { inspectArrangementLayout } from "./arrangement-layout.js";

it("reports wrapped intended single-line chips while allowing other text to wrap", () => {
  const findings = inspectArrangementLayout({ renderedLayout: [{ nodes: [
    { id: "chip-label-origin", textLineCount: 2 },
    { id: "chip-label-unit", textLineCount: 1 },
    { id: "track-long-label", textLineCount: 3 },
    { id: "chip-label-missing", textLineCount: null },
  ] }] }, 12);
  expect(findings).toEqual([
    expect.objectContaining({ code: "CHIP_TEXT_WRAPPED", severity: "error", details: { nodeId: "chip-label-origin", frame: 12, observedLines: 2, expectedLines: 1 } }),
    expect.objectContaining({ code: "CHIP_WRAP_UNVERIFIED", severity: "warning", details: { nodeId: "chip-label-missing", frame: 12 } }),
  ]);
});

it("checks aligned-interval content height without imposing a universal ink ratio", () => {
  const node = (id: string, y: number, height: number) => ({ id, bounds: { y, height } });
  const metadata = (scale: number) => ({ renderedLayout: [{ height: 1000, nodes: [node("chip-label-unit", 20, 20), node("plot-a", 50, 50 * scale), node("plot-b", 50 + 100 * scale, 50 * scale)], coverage: { truncated: false } }] });
  expect(inspectArrangementLayout(metadata(1), 0)).toContainEqual(expect.objectContaining({ code: "SPARSE_ARRANGEMENT", details: expect.objectContaining({ nodeId: "arrangement", observedHeightFraction: .18 }) }));
  expect(inspectArrangementLayout(metadata(3), 0)).toContainEqual(expect.objectContaining({ code: "SPARSE_ARRANGEMENT", details: expect.objectContaining({ bottomFraction: .5 }) }));
  expect(inspectArrangementLayout(metadata(6), 0).some(f => f.code === "SPARSE_ARRANGEMENT")).toBe(false);
  expect(inspectArrangementLayout({ renderedLayout: [{ height: 1000, nodes: [node("unrelated-image", 0, 10)] }] }, 0)).toEqual([]);
});
