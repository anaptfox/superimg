import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  buildInspectTreeSnapshot,
  missingTreeIssue,
  scanIdentityFlicker,
  scanPlateAssetIssues,
  scanTreeLayoutIssues,
  scanTreeSemanticIssues,
  type SemanticTreeNode,
} from "../tree-check.js";
import { derivePhasesFromIR, phaseHoldBoundarySamples, sceneBoundarySamples } from "../ir-phases.js";

describe("scanTreeLayoutIssues", () => {
  it("warns when text metrics are approximate", () => {
    const issues = scanTreeLayoutIssues(
      [{
        tag: "Text",
        id: "title",
        childCount: 0,
        fontFamily: "Nope",
        metricsExact: false,
        layout: { x: 0, y: 0, width: 80, height: 20 },
      }],
      { frame: 0, progress: 0 },
    );
    const warning = issues.find((issue) => issue.code === "TEXT_METRICS_APPROXIMATE");
    expect(warning).toMatchObject({
      severity: "warning",
      nodeId: "title",
      details: { fontFamily: "Nope" },
    });
  });

  it("flags zero-area boxes", () => {
    const issues = scanTreeLayoutIssues(
      [{ tag: "Frame", id: "win", childCount: 1, layout: { x: 0, y: 0, width: 0, height: 80 } }],
      { frame: 10, progress: 0.25 },
    );
    expect(issues.some((i) => i.code === "ZERO_BOX")).toBe(true);
    expect(issues[0]?.suggestion).toMatch(/inspect/);
  });

  it("flags empty labeled containers", () => {
    const issues = scanTreeLayoutIssues(
      [
        { tag: "Stack", id: "col-running", childCount: 0, layout: { x: 0, y: 0, width: 200, height: 400 } },
        { tag: "Stack", id: "col-backlog", childCount: 4, layout: { x: 200, y: 0, width: 200, height: 400 } },
      ],
      { frame: 12, progress: 0.43 },
    );
    expect(issues.some((i) => i.code === "EMPTY_CONTAINER" && i.message.includes("col-running"))).toBe(true);
  });

  it("skips Spacer zero boxes", () => {
    const issues = scanTreeLayoutIssues(
      [{ tag: "Spacer", childCount: 0, layout: { x: 0, y: 0, width: 0, height: 0 } }],
      { frame: 0, progress: 0 },
    );
    expect(issues).toEqual([]);
  });

  it("allows one zero axis for visible vector geometry", () => {
    const line = scanTreeLayoutIssues(
      [{
        tag: "path",
        childCount: 0,
        namespace: "svg",
        bounds: { x: 20, y: 0, width: 0, height: 100 },
      } as SemanticTreeNode],
      { frame: 0, progress: 0 },
    );
    const point = scanTreeLayoutIssues(
      [{
        tag: "path",
        childCount: 0,
        namespace: "svg",
        bounds: { x: 20, y: 20, width: 0, height: 0 },
      } as SemanticTreeNode],
      { frame: 0, progress: 0 },
    );
    expect(line.some((issue) => issue.code === "ZERO_BOX")).toBe(false);
    expect(point.some((issue) => issue.code === "ZERO_BOX")).toBe(true);
  });
});

describe("semantic tree snapshot", () => {
  it("emits a versioned golden snapshot with explicit opaque coverage", () => {
    const snapshot = buildInspectTreeSnapshot([
      {
        tag: "Frame",
        id: "root",
        childCount: 2,
        path: "/0",
        depth: 0,
        namespace: "html",
        layout: { x: 0, y: 0, width: 1920, height: 1080 },
      },
      {
        tag: "Html",
        id: "vendor-chart",
        childCount: 0,
        path: "/0/0",
        parentPath: "/0",
        depth: 1,
        namespace: "html",
        layout: { x: 0, y: 0, width: 640, height: 360 },
        opaque: true,
      },
      {
        tag: "path",
        id: "trend",
        childCount: 0,
        path: "/0/1/0",
        parentPath: "/0/1",
        depth: 2,
        namespace: "svg",
        bounds: { x: 10, y: 20, width: 300, height: 80 },
        paint: { stroke: "#38bdf8", strokeWidth: 4 },
        geometry: { kind: "path", d: "M10 100 L310 20", valid: true },
      },
    ] as SemanticTreeNode[]);

    expect(snapshot).toMatchInlineSnapshot(`
      {
        "coverage": {
          "inspectableNodeRatio": 0.6666666666666666,
          "inspectableNodes": 2,
          "opaqueRegions": 1,
          "totalNodes": 3,
        },
        "nodes": [
          {
            "childCount": 2,
            "depth": 0,
            "id": "root",
            "layout": {
              "height": 1080,
              "width": 1920,
              "x": 0,
              "y": 0,
            },
            "namespace": "html",
            "opaque": false,
            "path": "/0",
            "tag": "Frame",
          },
          {
            "childCount": 0,
            "depth": 1,
            "id": "vendor-chart",
            "layout": {
              "height": 360,
              "width": 640,
              "x": 0,
              "y": 0,
            },
            "namespace": "html",
            "opaque": true,
            "parentPath": "/0",
            "path": "/0/0",
            "tag": "Html",
          },
          {
            "bounds": {
              "height": 80,
              "width": 300,
              "x": 10,
              "y": 20,
            },
            "childCount": 0,
            "depth": 2,
            "geometry": {
              "d": "M10 100 L310 20",
              "kind": "path",
              "valid": true,
            },
            "id": "trend",
            "namespace": "svg",
            "opaque": false,
            "paint": {
              "stroke": "#38bdf8",
              "strokeWidth": 4,
            },
            "parentPath": "/0/1",
            "path": "/0/1/0",
            "tag": "path",
          },
        ],
        "roots": [
          "/0",
        ],
        "schemaVersion": 2,
        "source": "tree",
      }
    `);
  });

  it("reports an opaque root as zero semantic coverage", () => {
    expect(buildInspectTreeSnapshot(undefined)).toMatchObject({
      schemaVersion: 2,
      source: "unavailable",
      coverage: {
        totalNodes: 0,
        inspectableNodes: 0,
        opaqueRegions: 1,
        inspectableNodeRatio: 0,
      },
    });
    expect(missingTreeIssue({ frame: 3, progress: 0.5 })).toMatchObject({
      code: "OPAQUE_REGION",
      nodePath: "/",
      details: { source: "unavailable" },
    });
  });
});

describe("scanTreeSemanticIssues", () => {
  it("returns structured diagnostics for invalid vector relationships", () => {
    const nodes: SemanticTreeNode[] = [
      { tag: "Vector", id: "art", childCount: 5, path: "/0", depth: 0, namespace: "svg" },
      {
        tag: "path",
        id: "edge",
        childCount: 0,
        path: "/0/0",
        parentPath: "/0",
        depth: 1,
        namespace: "html",
        geometry: { kind: "path", d: "", valid: false, error: "missing moveto" },
        relations: {
          mask: "url(#missing-mask)",
          filter: "missing-filter",
          references: ["missing-mask", "missing-filter"],
        },
      },
      { tag: "g", id: "edge", childCount: 1, path: "/0/1", parentPath: "/0", depth: 1, namespace: "svg" },
      { tag: "tspan", childCount: 1, path: "/0/1/0", parentPath: "/0/1", depth: 2, namespace: "svg" },
      { tag: "mask", id: "empty", childCount: 0, path: "/0/2", parentPath: "/0", depth: 1, namespace: "svg" },
      { tag: "Html", id: "opaque", childCount: 0, path: "/0/3", parentPath: "/0", depth: 1, namespace: "html", opaque: true },
    ];
    const issues = scanTreeSemanticIssues(nodes, { frame: 12, progress: 0.4 });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_NODE_ID",
      "UNRESOLVED_NODE_REF",
      "INVALID_PATH_DATA",
      "NAMESPACE_MISMATCH",
      "TEXT_RUN_OUTSIDE_TEXT",
      "EMPTY_CLIP_OR_MASK",
      "OPAQUE_REGION",
    ]));
    expect(issues.find((issue) => issue.code === "UNRESOLVED_NODE_REF")).toMatchObject({
      nodeId: "edge",
      nodePath: "/0/0",
      relatedIds: ["missing-mask"],
      details: { reference: "missing-mask" },
    });
    expect(issues.find((issue) => issue.code === "DUPLICATE_NODE_ID")?.details).toEqual({
      paths: ["/0/0", "/0/1"],
      occurrences: 2,
    });
    expect(issues.some(
      (issue) => issue.code === "UNRESOLVED_NODE_REF" && issue.relatedIds?.includes("missing-filter"),
    )).toBe(true);
  });

  it("accepts a resolved clip and a text run under vector text", () => {
    const issues = scanTreeSemanticIssues([
      { tag: "Vector", childCount: 3, path: "/0", depth: 0, namespace: "svg" },
      { tag: "clipPath", id: "crop", childCount: 1, path: "/0/0", parentPath: "/0", depth: 1, namespace: "svg" },
      { tag: "path", id: "photo", childCount: 0, path: "/0/1", parentPath: "/0", depth: 1, namespace: "svg", relations: { clip: "crop" }, geometry: { kind: "path", d: "M0 0L20 20", valid: true } },
      { tag: "text", childCount: 1, path: "/0/2", parentPath: "/0", depth: 1, namespace: "svg" },
      { tag: "tspan", childCount: 1, path: "/0/2/0", parentPath: "/0/2", depth: 2, namespace: "svg" },
    ], { frame: 0, progress: 0 });
    expect(issues).toEqual([]);
  });
});

describe("scanPlateAssetIssues", () => {
  it("warns only when the compiled atlas preflight actually fails", () => {
    const root = mkdtempSync(join(tmpdir(), "superimg-plate-check-"));
    const tree = {
      type: "Frame",
      children: [{ type: "Plate", props: { id: "mascot", src: "mascot.mp4" }, children: [] }],
    };
    try {
      const missing = scanPlateAssetIssues(tree, root, { frame: 0, progress: 0 });
      expect(missing).toHaveLength(1);
      expect(missing[0]).toMatchObject({
        code: "PLATE_NO_ASSET",
        nodeId: "mascot",
        nodePath: "/0/0",
      });

      const plateRoot = join(root, ".superimg", "plates", "mascot");
      mkdirSync(join(plateRoot, "frames"), { recursive: true });
      writeFileSync(join(plateRoot, "frames", "sheet-000.webp"), "atlas");
      writeFileSync(join(plateRoot, "manifest.json"), JSON.stringify({
        schemaVersion: 0,
        atlas: { sheets: [{ file: "frames/sheet-000.webp" }] },
      }));

      expect(scanPlateAssetIssues(tree, root, { frame: 0, progress: 0 })).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("scanIdentityFlicker", () => {
  it("flags id that vanishes then returns", () => {
    const issues = scanIdentityFlicker([
      { progress: 0.2, frame: 6, nodes: [{ tag: "Text", id: "claim", childCount: 1 }] },
      { progress: 0.4, frame: 12, nodes: [] },
      { progress: 0.6, frame: 18, nodes: [{ tag: "Text", id: "claim", childCount: 1 }] },
    ]);
    expect(issues.some((i) => i.code === "IDENTITY_FLICKER")).toBe(true);
    expect(issues[0]?.suggestion).toMatch(/inspect/);
  });

  it("flags opacity dip then recovery", () => {
    const issues = scanIdentityFlicker([
      {
        progress: 0.3,
        frame: 9,
        nodes: [{
          tag: "Text",
          id: "claim",
          childCount: 1,
          motion: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, phase: "steady" },
        }],
      },
      {
        progress: 0.4,
        frame: 12,
        nodes: [{
          tag: "Text",
          id: "claim",
          childCount: 1,
          motion: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 0.05, phase: "steady" },
        }],
      },
      {
        progress: 0.5,
        frame: 15,
        nodes: [{
          tag: "Text",
          id: "claim",
          childCount: 1,
          motion: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1, phase: "steady" },
        }],
      },
    ]);
    expect(issues.some((i) => i.code === "IDENTITY_FLICKER" && i.message.includes("opacity"))).toBe(true);
  });
});

describe("phaseHoldBoundarySamples", () => {
  it("maps child phases to their scene's frame range", () => {
    const ir = createMediaIR({
      fps: 25,
      totalFrames: 57,
      durationSeconds: 57 / 25,
      override: {
        scenes: [
          { id: "opener", index: 0, range: { startFrame: 0, endFrame: 25 }, phases: [], markers: [], transitions: [] },
          { id: "chapter/demo", index: 1, range: { startFrame: 25, endFrame: 32 }, phases: [{ name: "enter", start: 0, end: 1 }], markers: [], transitions: [] },
          { id: "chapter/result", index: 2, range: { startFrame: 32, endFrame: 57 }, phases: [], markers: [], transitions: [] },
        ],
      },
    });
    const report = derivePhasesFromIR(ir);
    expect(report.allPhases).toMatchObject([
      { name: "enter", startFrame: 25, endFrame: 31, startSec: 1, endSec: 32 / 25 },
    ]);
    expect(report.scenePhases["chapter/demo"]?.[0]?.start).toBeCloseTo(25 / 56);
    expect(sceneBoundarySamples(ir).map(({ frame }) => frame)).toEqual([
      0, 1, 12, 24, 25, 26, 28, 31, 32, 33, 44, 56,
    ]);
  });

  it("includes midpoints and boundaries", () => {
    const samples = phaseHoldBoundarySamples(
      [
        { name: "hook", start: 0, end: 0.2, startSec: 0, endSec: 2, startFrame: 0, endFrame: 59 },
        { name: "app", start: 0.2, end: 0.8, startSec: 2, endSec: 8, startFrame: 60, endFrame: 239 },
        { name: "cta", start: 0.8, end: 1, startSec: 8, endSec: 10, startFrame: 240, endFrame: 299 },
      ],
      30,
      10,
    );
    const progresses = samples.map((s) => s.progress);
    expect(progresses).toContain(0);
    expect(progresses).toContain(1);
    expect(progresses.some((p) => Math.abs(p - 0.1) < 0.02)).toBe(true);
    expect(progresses.some((p) => Math.abs(p - 0.5) < 0.02)).toBe(true);
  });
});


describe("native vector material namespaces", () => {
  it.each([
    "VectorCircle", "VectorRect", "VectorViewport", "VectorLinearGradient",
    "VectorStop", "VectorPattern", "VectorFilter", "VectorGaussianBlur",
    "VectorMerge", "VectorMergeNode", "VectorTurbulence", "VectorDisplacementMap",
  ])("requires an SVG parent for %s", (tag) => {
    const node = { tag, childCount: 0, path: "0.0", namespace: "html" as const };
    expect(scanTreeSemanticIssues([node], { frame: 0, progress: 0 }))
      .toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
    expect(scanTreeSemanticIssues([{ ...node, namespace: "svg" }], { frame: 0, progress: 0 }))
      .not.toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
  });
});
