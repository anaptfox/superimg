import { describe, expect, it } from "vitest";
import type { InvocationObservation } from "@foxworth/boundary/program";
import { footprintSubsumes, scopedObservationFootprints } from "@foxworth/boundary/program";
import { verifyDirectHandlers } from "@foxworth/boundary/testing";
import { PreviewInspectionError, type PreviewInspection, type PreviewSnapshot } from "@superimg/player/inspection";
import {
  compilePreviewInteractions,
  createPreviewInteractionMount,
  createPreviewInteractionSlot,
} from "./boundary.js";

const bounds = { x: 0, y: 0, width: 320, height: 180 };
function legacySnapshot(surfaceId = "film", frame = 0) {
  return {
    schemaVersion: 1, surfaceId, generation: 1, source: null, requestedFrame: frame,
    presented: { frame, revision: 1 }, width: 320, height: 180, fps: 25, totalFrames: 7,
    clock: { owner: "inspection", isPlaying: false }, currentPart: null, parts: [], routes: {}, activeOccurrences: [], stepId: null, semantic: null, nodes: [],
    geometry: { coordinateSpace: "host-viewport", iframePath: [], dpr: 1, surface: bounds, frame: null },
    readiness: { status: "ready", error: null }, coverage: { dom: "unavailable", opaque: [] }, disposed: false,
  };
}
function makeInspection(
  resolveSnapshot: (surfaceId?: string, frame?: number) => unknown = (surfaceId, frame) => legacySnapshot(surfaceId, frame),
): PreviewInspection {
  const snapshot = async (input: { surfaceId: string; frame?: number }) =>
    resolveSnapshot(input.surfaceId, input.frame) as PreviewSnapshot;
  return {
    list: () => [{ surfaceId: "film", generation: 1, controls: ["seek", "mode"] }],
    inspect: snapshot,
    setMode: snapshot,
    seek: snapshot,
    selectPart: snapshot,
    selectRoute: snapshot,
    selectStep: snapshot,
    dispose() {},
    attach: () => ({ dispose() {} }),
  };
}
async function inspectOutput(value: unknown) {
  const inspection = makeInspection(() => value);
  const mount = createPreviewInteractionMount({ inspection, installationId: "schema-test", expose: ["inspect"], admit: () => ({ decision: "allow" }) });
  try {
    const handle = mount.projection.handles.inspect;
    if (!handle) throw new Error("Inspect projection handle is missing");
    const interaction = mount.binding.resolve(handle.interactionId);
    if (!interaction) throw new Error("Inspect binding realization is missing");
    return await mount.binding.connect().callRaw(interaction, { surfaceId: "film" }, {});
  } finally { mount.dispose(); }
}

describe("inspection Boundary output schema", () => {
  it("accepts legacy schema-1 snapshots without additive inspection fields", async () => {
    const snapshot = legacySnapshot();
    expect(await inspectOutput(snapshot)).toMatchObject({ certainty: "completed", result: { kind: "returned", value: snapshot } });
  });
  it("accepts absent-DOM observations and null content geometry emitted by mounted hosts", async () => {
    const snapshot = legacySnapshot();
    const current = { ...snapshot, observations: null, compilation: null, geometry: { ...snapshot.geometry, content: null } };
    expect(await inspectOutput(current)).toMatchObject({ certainty: "completed", result: { kind: "returned", value: current } });
  });
  it("retains compilation, selection, bounded DOM/SVG observations and content bounds", async () => {
    const snapshot = legacySnapshot();
    const current = { ...snapshot,
      compilation: { status: "failed", source: { id: "card", revision: "pending" }, inputIdentity: "inputs", projectionIdentity: "projection", hostGeneration: 2, error: { code: "MEDIA_SOURCE_PARSE_ERROR", message: "Unexpected token" } },
      coordinates: { entryId: null, variantId: "default", editionId: "square" },
      observations: { coordinateSpace: "document-viewport", nodes: [{ id: "label", occurrence: "hero", tag: "text", bounds, text: "Ready", typography: { "font-family": "Inter" }, svg: { coordinateSpace: "svg-user-space", bounds, textLength: 45 } }], coverage: { sampledNodes: 1, truncated: false, maxNodes: 800, maxTextLength: 120, opaque: [{ kind: "canvas", bounds }] } },
      geometry: { ...snapshot.geometry, content: bounds },
    };
    expect(await inspectOutput(current)).toMatchObject({ certainty: "completed", result: { kind: "returned", value: current } });
    for (const status of ["pending", "succeeded"]) expect(await inspectOutput({ ...current, compilation: { status } })).toMatchObject({ certainty: "completed", result: { kind: "returned" } });
  });
  it("continues rejecting invalid additive facts and unknown output fields", async () => {
    const snapshot = legacySnapshot();
    for (const invalid of [
      { ...snapshot, compilation: { status: "finished" } },
      { ...snapshot, coordinates: { entryId: null, variantId: "default" } },
      { ...snapshot, observations: { coordinateSpace: "host-viewport", nodes: [], coverage: {} } },
      { ...snapshot, geometry: { ...snapshot.geometry, content: { ...bounds, width: "320" } } },
      { ...snapshot, unexpected: true },
    ]) expect(await inspectOutput(invalid)).toMatchObject({ certainty: "unknown", result: { kind: "fault" } });
  });
  it("accepts optional node ancestry and clipping while rejecting malformed values", async () => {
    const node = { id: "label", occurrence: null, tag: "span", bounds, text: "Ready", typography: null, svg: null };
    const snapshotWithNode = (fields: Record<string, unknown>) => ({
      ...legacySnapshot(),
      observations: {
        coordinateSpace: "document-viewport",
        nodes: [{ ...node, id: "container", tag: "div", parentIndex: null }, { ...node, ...fields }],
        coverage: { sampledNodes: 2, truncated: false, maxNodes: 800, maxTextLength: 120, opaque: [] },
      },
    });
    for (const fields of [
      {},
      { parentIndex: null, clipping: {} },
      { parentIndex: 0, clipping: { "overflow-x": "hidden", "clip-path": "inset(0px)", "text-overflow": "ellipsis" } },
    ]) {
      const snapshot = snapshotWithNode(fields);
      expect(await inspectOutput(snapshot)).toMatchObject({ certainty: "completed", result: { kind: "returned", value: snapshot } });
    }
    for (const fields of [
      { parentIndex: -1 }, { parentIndex: 0.5 }, { parentIndex: "0" },
      { clipping: null }, { clipping: { "overflow-x": true } }, { unknownObservation: true },
    ]) expect(await inspectOutput(snapshotWithNode(fields))).toMatchObject({ certainty: "unknown", result: { kind: "fault" } });
  });
});

describe("inspection Boundary v0 capabilities", () => {
  it("declares per-surface scoped footprints subsumed by coarse preview footprints and emits scoped observations", async () => {
    const events: InvocationObservation[] = [];
    const mount = createPreviewInteractionMount({
      inspection: makeInspection(),
      installationId: "scoped-preview",
      expose: ["inspect", "seekFrame"],
      admit: () => ({ decision: "allow" }),
      observation: { publish: (event) => { events.push(event); } },
    });
    try {
      const seekContract = mount.program.interactions.find((entry) => entry.contract.id === "media.preview.seek-frame")!.contract;
      expect(seekContract.reads).toEqual(["preview:{input.surfaceId}"]);
      expect(seekContract.changes).toEqual(["preview.frame:{input.surfaceId}"]);
      expect(footprintSubsumes("preview", "preview:film")).toBe(true);
      expect(footprintSubsumes("preview.frame", "preview.frame:film")).toBe(true);

      const outcome = await mount.try.seekFrame({ surfaceId: "film", expectedGeneration: 1, frame: 3 }, {});
      expect(outcome).toMatchObject({ kind: "ok", value: { surfaceId: "film", requestedFrame: 3 } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        reads: ["preview:{input.surfaceId}"],
        changes: ["preview.frame:{input.surfaceId}"],
      });
      expect(
        scopedObservationFootprints(events[0]!.reads, events[0]!.changes, { surfaceId: "film" }),
      ).toEqual({
        scopedReads: ["preview:film"],
        scopedChanges: ["preview.frame:film"],
      });
    } finally {
      mount.dispose();
    }
  });

  it("supports typed try outcomes (ok, declared-error, denied) and unified authorize admission", async () => {
    const inspection = makeInspection((surfaceId) => {
      if (surfaceId === "missing") throw new PreviewInspectionError("SURFACE_NOT_FOUND", "Unknown surface", "missing");
      return legacySnapshot(surfaceId);
    });
    const authorizedTokens: string[] = [];
    const mount = createPreviewInteractionMount<{ token: string }, { actor: string }>({
      inspection,
      installationId: "auth-preview",
      expose: ["inspect"],
      allowedSurfaces: ["film", "missing"],
      authorize: ({ context }) => {
        if (context.token === "valid") {
          authorizedTokens.push(context.token);
          return { decision: "allow", context: { actor: "studio-agent" } };
        }
        return { decision: "deny", reason: "Invalid preview token" };
      },
    });
    try {
      expect(await mount.try.inspect({ surfaceId: "film" }, { token: "valid" })).toMatchObject({
        kind: "ok",
        value: { surfaceId: "film" },
      });
      expect(authorizedTokens).toEqual(["valid"]);

      expect(await mount.try.inspect({ surfaceId: "missing" }, { token: "valid" })).toMatchObject({
        kind: "declared-error",
        code: "PREVIEW_ERROR",
        details: { code: "SURFACE_NOT_FOUND", surfaceId: "missing" },
      });

      expect(await mount.try.inspect({ surfaceId: "film" }, { token: "bad" })).toMatchObject({
        kind: "denied",
      });

      expect(await mount.try.inspect({ surfaceId: "other" }, { token: "valid" })).toMatchObject({
        kind: "denied",
      });
    } finally {
      mount.dispose();
    }
  });

  it("atomically hot-swaps preview hosts via createPreviewInteractionSlot", async () => {
    const slot = createPreviewInteractionSlot({
      inspection: makeInspection((surfaceId) => legacySnapshot(surfaceId, 1)),
      installationId: "hot-preview",
      expose: ["inspect"],
      admit: () => ({ decision: "allow" }),
    });
    const digests: string[] = [];
    const unsubscribe = slot.subscribe((updated) => digests.push(updated.manifest.bindingDigest));
    try {
      const beforeDigest = slot.current.manifest.bindingDigest;
      expect(await slot.try().inspect({ surfaceId: "film" }, {})).toMatchObject({
        kind: "ok",
        value: { requestedFrame: 1 },
      });

      const rebound = slot.rebind(makeInspection((surfaceId) => legacySnapshot(surfaceId, 5)));
      expect(rebound.status).toBe("rebound");
      expect(slot.current.manifest.bindingDigest).not.toBe(beforeDigest);
      expect(digests).toEqual([slot.current.manifest.bindingDigest]);
      expect(await slot.try().inspect({ surfaceId: "film" }, {})).toMatchObject({
        kind: "ok",
        value: { requestedFrame: 5 },
      });
    } finally {
      unsubscribe();
      slot.dispose();
    }
  });

  it("passes Boundary verifyDirectHandlers contract harness for all preview interactions", async () => {
    const mount = createPreviewInteractionMount({
      inspection: makeInspection(),
      installationId: "verify-preview",
      expose: ["list", "inspect", "setMode", "seekFrame", "selectPart", "selectRoute", "selectStep"],
      admit: () => ({ decision: "allow" }),
    });
    try {
      const report = await verifyDirectHandlers({
        compiled: compilePreviewInteractions(),
        installation: mount.installation,
        context: {},
        maxSamplesPerInteraction: 3,
      });
      expect(report.ok, JSON.stringify(report.failures, null, 2)).toBe(true);
      expect(report.checkedInteractions).toBe(7);
      expect(report.validCasesRun).toBeGreaterThan(0);
      expect(report.invalidCasesRun).toBeGreaterThan(0);
    } finally {
      mount.dispose();
    }
  });
});
