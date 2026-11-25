import { describe, expect, it } from "vitest";
import { comparableInspectorCaptures, pixelDifference, selectedNodeFindings, visibleNodeCrop, type InspectorCapture, type InspectorFindingsReport } from "./inspector-evidence.js";
import type { RuntimeFinding } from "@superimg/types";

type ComparisonFixture = { -readonly [K in "backend" | "report" | "evidence"]: InspectorCapture[K] };
function capture(revision: string): ComparisonFixture {
  const source = { id: "media", revision };
  return {
    backend: "snapdom",
    report: {
      schema: "superimg-accepted-capture/1", status: "accepted", issues: [],
      freshness: { status: "matched", reason: "accepted-source-matches", expected: source, accepted: source },
      timings: { clock: "local-monotonic", totalMs: 1 },
      identityAfter: { browserVersion: "Chromium fixture", url: "http://localhost/preview", documentTimeOrigin: 1, viewport: { width: 1200, height: 800, dpr: 2 } },
      after: {
        schemaVersion: 1, generation: 1, source, width: 320, height: 180, fps: 30, totalFrames: 1,
        coordinates: { entryId: null, variantId: null, editionId: "default" }, surfaceId: "preview", requestedFrame: 0, presented: { frame: 0, revision: 1 },
        clock: { owner: "inspection", isPlaying: false }, currentPart: null, parts: [], routes: {}, activeOccurrences: [], stepId: null,
        semantic: null, nodes: [], geometry: { coordinateSpace: "host-viewport", iframePath: [], dpr: 2, surface: { x: 10, y: 20, width: 640, height: 360 }, frame: null },
        readiness: { status: "ready", error: null }, coverage: { dom: "measured", opaque: [] }, disposed: false,
      },
    },
    evidence: {
      warnings: [], requested: { width: 320, height: 180, dpr: 1, scale: 1, region: null }, actual: { width: 320, height: 180 },
      geometry: { w0: 320, h0: 180, vbW: 320, vbH: 180, targetW: 320, targetH: 180, contentX: 0, contentY: 0, clip: null },
      context: null, timings: { captureMs: 1, encodeMs: 1, totalMs: 2 },
    },
  };
}
describe("inspector media comparison", () => {
  it("allows source edits but requires equivalent selection and fresh current pixels", () => {
    const before = capture("before"), after = capture("after");
    expect(comparableInspectorCaptures(before, after)).toEqual([]);
    after.report.after!.width = 1080;
    expect(comparableInspectorCaptures(before, after)).toContain("width-differs");
    after.report.freshness = { ...after.report.freshness, status: "stale" };
    expect(comparableInspectorCaptures(before, after)).toContain("current-source-stale");
  });
  it("permits source and presentation revisions, reloads, node selection and inspector movement", () => {
    const before = capture("before"), after = capture("after");
    after.report.after!.generation = 8;
    after.report.after!.presented!.revision = 12;
    after.report.after!.geometry.surface = { x: 700, y: 400, width: 160, height: 90 };
    after.report.after!.nodes = [{ id: "other-selection", occurrence: null, authoredBounds: null, kind: "frame", actions: [], sceneId: null, bounds: { x: 0, y: 0, width: 20, height: 20 } }];
    after.report.identityAfter!.documentTimeOrigin = 99;
    expect(comparableInspectorCaptures(before, after)).toEqual([]);
  });
  it.each([
    ["backend", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value, "backend"), "capture-backend-unavailable"],
    ["evidence", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value, "evidence"), "capture-requested-unavailable"],
    ["requested scale", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.evidence.requested, "scale"), "capture-scale-unavailable"],
    ["requested region", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.evidence.requested, "region"), "capture-region-unavailable"],
    ["actual pixels", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.evidence, "actual"), "capture-actual-unavailable"],
    ["stage geometry", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.evidence, "geometry"), "capture-geometry-unavailable"],
    ["geometry field", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.evidence.geometry!, "vbW"), "capture-geometry-unavailable"],
    ["browser UA", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.report.identityAfter!, "browserVersion"), "browser-version-unavailable"],
    ["URL", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.report.identityAfter!, "url"), "url-unavailable"],
    ["viewport", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.report.identityAfter!, "viewport"), "viewport-unavailable"],
    ["viewport DPR", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.report.identityAfter!.viewport, "dpr"), "viewport-unavailable"],
    ["frame", (value: ReturnType<typeof capture>) => Reflect.deleteProperty(value.report.after!, "presented"), "frame-unavailable"],
  ])("rejects legacy captures missing %s even when both lack it", (_name, remove, reason) => {
    const before = capture("same"), after = capture("same"); remove(before); remove(after);
    expect(comparableInspectorCaptures(before, after)).toContain(reason);
  });
  it.each([
    ["DPR", { dpr: 2 }, "capture-dpr-differs"],
    ["scale", { scale: 2 }, "capture-scale-differs"],
    ["region", { region: "viewport" as const }, "capture-region-differs"],
  ])("rejects changed requested %s even when image dimensions match", (_name, requested, reason) => {
    const before = capture("same"), after = capture("same");
    after.evidence = { ...after.evidence, requested: { ...after.evidence.requested, ...requested } };
    expect(comparableInspectorCaptures(before, after)).toContain(reason);
  });
  it("rejects pixel, capture geometry, browser and viewport mismatches", () => {
    const before = capture("same"), after = capture("same");
    after.evidence = { ...after.evidence, actual: { width: 640, height: 360 }, geometry: { ...after.evidence.geometry!, contentX: 5 } };
    after.report.identityAfter!.browserVersion = "Other Chromium";
    after.report.identityAfter!.viewport.dpr = 1;
    after.report.identityAfter!.url = "http://localhost/other";
    expect(comparableInspectorCaptures(before, after)).toEqual(expect.arrayContaining(["capture-actual-differs", "capture-geometry-differs", "browser-version-differs", "viewport-differs", "url-differs"]));
  });
  it("rejects unknown freshness, nonfinite geometry and differing authored selections", () => {
    const before = capture("same"), after = capture("same");
    after.report.freshness = { ...after.report.freshness, status: "unknown" };
    after.evidence = { ...after.evidence, geometry: { ...after.evidence.geometry!, w0: Number.NaN } };
    after.report.after!.coordinates = { entryId: "other", variantId: null, editionId: "default" };
    expect(comparableInspectorCaptures(before, after)).toEqual(expect.arrayContaining(["current-source-unavailable", "capture-geometry-unavailable", "selection-coordinates-differs"]));
  });
  it("counts media pixels including alpha without inferring a design verdict", () => {
    const before = new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 0]);
    const after = new Uint8ClampedArray([1, 2, 3, 255, 1, 2, 3, 255]);
    expect(pixelDifference(before, after)).toMatchObject({ changedPixels: 1, totalPixels: 2 });
    expect(() => pixelDifference(before, after.slice(0, 4))).toThrow("dimensions");
  });
  it("clips offstage selected-node bounds without adding pixels from the other side", () => {
    expect(visibleNodeCrop({ x: -20, y: 10, width: 100, height: 20 }, { width: 100, height: 100 }, { width: 100, height: 100 })).toEqual({ x: 0, y: 10, width: 80, height: 20 });
    expect(visibleNodeCrop({ x: 200, y: 0, width: 20, height: 20 }, { width: 100, height: 100 }, { width: 200, height: 200 })).toBeNull();
  });
});

function findingFixture() {
  const snapshot = capture("revision").report.after!;
  snapshot.compilation = { status: "succeeded", source: snapshot.source!, hostGeneration: 5 };
  snapshot.nodes = [{ id: "title", occurrence: null, kind: "text", actions: [], sceneId: null, bounds: { x: 0, y: 0, width: 20, height: 20 }, authoredBounds: null }];
  const finding: RuntimeFinding = { code: "ZERO_BOX", category: "render", severity: "error", message: "title has no box", coordinates: { variantId: "default", editionId: "default" }, details: { nodeId: "title", frame: 0 } };
  const envelope: InspectorFindingsReport = { source: { id: "media", revision: "revision" }, generation: 5, frame: 0, report: { coordinates: [{ variantId: "default", editionId: "default" }], findings: [finding] } };
  return { snapshot, envelope, finding, target: { id: "title", occurrence: null as string | null } };
}
describe("selected-node findings", () => {
  it("joins an exact canonical node and frame while disclosing global findings", () => {
    const { snapshot, envelope, target, finding } = findingFixture();
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "available", findings: [finding], unassociatedCount: 0 });
    envelope.report!.findings = [finding, { ...finding, code: "UNPAINTED_STAGE", details: {} }, { ...finding, details: { nodeId: "sibling", frame: 0 } }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "partial", findings: [finding], unassociatedCount: 1 });
  });
  it("requires explicit occurrence identity for retained nodes and never guesses from a path", () => {
    const { snapshot, envelope, target, finding } = findingFixture();
    snapshot.nodes[0]!.occurrence = target.occurrence = "chapter/card";
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "partial", findings: [], unassociatedCount: 1 });
    envelope.report!.findings = [{ ...finding, details: { nodeId: "title", frame: 0, occurrence: "chapter/card" } }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "available", findings: [expect.objectContaining({ code: "ZERO_BOX" })] });
    envelope.report!.findings = [{ ...finding, details: { nodePath: "chapter/card/title", frame: 0 } }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "partial", findings: [], unassociatedCount: 1 });
  });
  it.each(["source", "generation", "frame", "selection"] as const)("rejects a report with a different %s scope", field => {
    const { snapshot, envelope, target } = findingFixture();
    if (field === "source") envelope.source!.revision = "older";
    if (field === "generation") envelope.generation = 4;
    if (field === "frame") envelope.frame = 1;
    if (field === "selection") envelope.report!.coordinates = [{ variantId: "other", editionId: "default" }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "unavailable", findings: [] });
  });
  it("does not attach findings for a different frame, occurrence or per-finding coordinates", () => {
    const { snapshot, envelope, target, finding } = findingFixture();
    envelope.report!.findings = [{ ...finding, details: { nodeId: "title", frame: 1 } }, { ...finding, details: { nodeId: "title", frame: 0, occurrence: "other" } }, { ...finding, coordinates: { variantId: "other", editionId: "default" } }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "partial", findings: [], unassociatedCount: 3 });
  });
  it("discloses unavailable reports and ambiguous canonical identity", () => {
    const { snapshot, envelope, target } = findingFixture();
    expect(selectedNodeFindings(snapshot, target)).toMatchObject({ state: "unavailable", reason: "findings-report-unavailable" });
    snapshot.nodes = [...snapshot.nodes, { ...snapshot.nodes[0]! }];
    expect(selectedNodeFindings(snapshot, target, envelope)).toMatchObject({ state: "unavailable", reason: "canonical-node-identity-unverified", findings: [] });
  });
});
