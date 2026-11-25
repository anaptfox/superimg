import { describe, expect, it } from "vitest";
import { analyzeTechnicalFrame, analyzeTechnicalSequence, technicalRuntimeFindings, mergeTechnicalScopes } from "./analysis.js";
import { Frame, Html, walkMediaTree } from "@superimg/stdlib/tree";
const sample = { frame: 0, progress: 0, html: "<svg>caption</svg>", width: 800, height: 400, background: "#111111", nodes: [{ tag: "VectorText", childCount: 1, id: "caption", color: "#111111", metricsExact: false, bounds: { x: 0, y: 0, width: 100, height: 20, estimated: true } }] };
describe("shared technical analysis", () => {
  it("accepts boxed opaque HTML defaults and retains explicit zero-box errors", () => {
    const analyze = (html: ReturnType<typeof Html>) => analyzeTechnicalFrame({ ...sample, nodes: walkMediaTree(html, { width: 800, height: 400 }) });
    const filled = analyze(Html({ html: "<b>widget</b>" }));
    expect(filled.issues.some(issue => issue.code === "ZERO_BOX")).toBe(false);
    expect(filled.coverage.geometry.opaqueRegions).toBe(1);
    expect(analyze(Html({ width: 0, height: 40, html: "<b>widget</b>" })).issues).toContainEqual(expect.objectContaining({ code: "ZERO_BOX", severity: "error" }));
  });
  it("accepts painted leaf containers while retaining empty-container and zero-box errors", () => {
    const tree = Frame({ width: 800, height: 400, fill: "#000000" },
      Frame({ id: "painted", width: 100, height: 100, fill: "#ffffff" }),
      Frame({ id: "empty", width: 100, height: 100 }),
      Frame({ id: "transparent", width: 100, height: 100, fill: "transparent" }),
      Frame({ id: "zero", width: 0, height: 100, fill: "#ffffff" }));
    const issues = analyzeTechnicalFrame({ ...sample, nodes: walkMediaTree(tree, { width: 800, height: 400 }) }).issues;
    expect(issues.filter(issue => issue.code === "EMPTY_CONTAINER").map(issue => issue.nodeId)).toEqual(["empty", "transparent"]);
    expect(issues).toContainEqual(expect.objectContaining({ code: "ZERO_BOX", nodeId: "zero", severity: "error" }));
  });
  it("checks vector text paint and discloses source estimates without a visual verdict", () => {
    const result = analyzeTechnicalFrame(sample);
    expect(result.issues.some(issue => issue.code === "LOW_CONTRAST_TEXT")).toBe(true);
    expect(result.coverage).toMatchObject({ samples: [{ frame: 0 }], geometry: { sourceEstimatedNodes: 1, browserMeasuredNodes: 0 }, visual: "unreviewed" });
    expect(result.coverage.checks.every(check => check.scope === "frame")).toBe(true);
  });
  it("runs identity analysis only for three distinct observed frames", () => {
    expect(analyzeTechnicalSequence([sample, sample]).coverage.checks.some(check => check.scope === "sequence")).toBe(false);
    const result = analyzeTechnicalSequence([sample, { ...sample, frame: 1, progress: 0.5, nodes: [] }, { ...sample, frame: 2, progress: 1 }]);
    expect(result.issues.some(issue => issue.code === "IDENTITY_FLICKER")).toBe(true);
    expect(result.coverage.checks.find(check => check.id === "sampled-identity")?.frames).toEqual([0, 1, 2]);
  });
  it("keeps missing trees opaque and complex paint explicitly unverified", () => {
    const { nodes: _nodes, ...input } = sample;
    expect(analyzeTechnicalFrame(input).coverage).toMatchObject({ unsupported: ["media-tree-unavailable"], geometry: { opaqueRegions: 1 } });
    const result = analyzeTechnicalFrame({ ...sample, nodes: [{ ...sample.nodes[0]!, color: "url(#gradient)" }] });
    expect(result.issues.some(issue => issue.code === "TEXT_PAINT_UNVERIFIED")).toBe(true);
    expect(result.issues.some(issue => issue.code === "LOW_CONTRAST_TEXT")).toBe(false);
  });
  it("projects compact public findings without private path data or lowered HTML", () => {
    const findings = technicalRuntimeFindings({ ...analyzeTechnicalFrame(sample), issues: [{ code: "INVALID_PATH_DATA", severity: "error", message: "invalid path", frame: 0, progress: 0, nodeId: "mark", details: { d: "M lots of private geometry", reason: "invalid" } }] });
    expect(findings[0]?.details).toEqual({ reason: "invalid", frame: 0, progress: 0, nodeId: "mark" });
    expect(JSON.stringify(findings)).not.toContain("private geometry");
  });

  it("retains browser measurement coverage when a command extends the sampled source scope", () => {
    const source = analyzeTechnicalFrame(sample).coverage;
    const previous = { ...source, geometry: { ...source.geometry, browserMeasuredNodes: 2, browserOpaqueRegions: 1, opaqueRegions: 1 }, checks: [...source.checks, { id: "rendered-layout", scope: "frame" as const, frames: [0] }] };
    const merged = mergeTechnicalScopes(analyzeTechnicalSequence([sample, { ...sample, frame: 2, progress: 1 }]).coverage, previous);
    expect(merged.geometry).toMatchObject({ sourceEstimatedNodes: 2, browserMeasuredNodes: 2, opaqueRegions: 1 });
    expect(merged.checks.filter(check => check.id === "rendered-layout")).toHaveLength(1);
    expect(merged.samples.map(sample => sample.frame)).toEqual([0, 2]);
  });

});
