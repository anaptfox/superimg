import { describe, expect, it } from "vitest";
import { withRenderedLayoutCoverage } from "./coverage.js";
import { mergeTechnicalCoverage } from "../validation/analysis.js";

describe("rendered observation coverage", () => {
  it("separates measured browser observations, truncation, opaque regions and unmapped nodes", () => {
    const coverage = withRenderedLayoutCoverage(mergeTechnicalCoverage([]), { renderedLayout: [{
      frame: 4, nodes: [{ id: "title", bounds: { x: 1, y: 2, width: 3, height: 4 } }, { tag: "canvas" }],
      coverage: { truncated: true, opaque: [{ kind: "canvas", bounds: { x: 0, y: 0, width: 20, height: 10 } }] },
    }] }, []);
    expect(coverage).toMatchObject({ geometry: { sourceEstimatedNodes: 0, browserMeasuredNodes: 2, opaqueRegions: 1 }, checks: [{ id: "rendered-layout", scope: "frame", frames: [4] }], visual: "unreviewed" });
    expect(coverage?.unsupported).toEqual(["browser-observation-truncated", "browser-opaque-regions", "browser-nodes-without-semantic-id"]);
    expect(JSON.stringify(coverage)).not.toContain('"bounds"');
  });
  it("does not turn a failed browser probe into measured coverage", () => {
    const coverage = withRenderedLayoutCoverage(undefined, undefined, [{ code: "RENDERED_LAYOUT_FAILED", category: "render", severity: "error", message: "probe unavailable" }]);
    expect(coverage).toMatchObject({ geometry: { browserMeasuredNodes: 0 }, unsupported: ["rendered-layout-unavailable"], checks: [], visual: "unreviewed" });
  });
});
