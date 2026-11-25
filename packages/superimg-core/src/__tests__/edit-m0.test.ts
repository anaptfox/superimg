//! M0 edit contracts: frames, validation, inverse, effect policy, JSON round-trip.

import { describe, it, expect } from "vitest";
import type {
  EditManifest,
  MediaEditCommand,
  MediaIRDiff,
  MediaIR,
} from "@superimg/types";
import {
  EditError,
  assertEditFrame,
  assertEditFrameRange,
  convertEditFramePoint,
  convertEditFrameRange,
  globalFrameToScene,
  invertOperation,
  invertSetNodeTransform,
  invertTrimSceneEnd,
  isP0TimeSpace,
  makeDurationBindingId,
  makeCompositionHoldBindingId,
  makePropertyBindingId,
  parseDurationBindingId,
  parseCompositionHoldBindingId,
  parsePropertyBindingId,
  roundTripEditManifest,
  roundTripMediaEditCommand,
  sceneFrameToGlobal,
  toEditUiState,
  validateEditManifest,
  validateMediaEditCommand,
  validateSpatialEffectPolicy,
  validateTemporalEffectPolicy,
  visualCapabilityToEdit,
} from "../edit/index.js";
import { selectVerificationFrames } from "../ir/pure/frames.js";

function sampleTransformOp(
  overrides: Partial<Extract<MediaEditCommand, { kind: "set-node-transform" }>> = {},
): Extract<MediaEditCommand, { kind: "set-node-transform" }> {
  return {
    schemaVersion: 0,
    source: "compose.media.ts",
    kind: "set-node-transform",
    target: {
      nodeId: "intro::title",
      xBindingId: "intro::title#initial.transform.x",
      yBindingId: "intro::title#initial.transform.y",
    },
    value: { x: 100, y: 200 },
    expected: {
      intentHash: "intent-abc",
      sourceHashes: { "compose.media.ts": "hash-src-1" },
    },
    ...overrides,
  };
}

function sampleTrimOp(
  overrides: Partial<Extract<MediaEditCommand, { kind: "trim-scene-end" }>> = {},
): Extract<MediaEditCommand, { kind: "trim-scene-end" }> {
  return {
    schemaVersion: 0,
    source: "compose.media.ts",
    kind: "trim-scene-end",
    target: {
      sceneId: "intro",
      durationBindingId: "intro#duration",
    },
    mode: "ripple",
    end: { space: "global", frame: 90 },
    expected: {
      intentHash: "intent-abc",
      sourceHashes: { "compose.media.ts": "hash-src-1" },
    },
    ...overrides,
  };
}

function sampleManifest(): EditManifest {
  return {
    schemaVersion: 0,
    coordinates: {
      sourceId: "editable-compose",
      variantId: "default",
      editionId: "default",
    },
    intentHash: "intent-abc",
    summary: {
      exactBindingCount: 2,
      inspectOnlyCount: 1,
      opaqueCount: 0,
    },
    bindings: [
      {
        schemaVersion: 0,
        bindingId: "intro::title#initial.transform.x",
        targetId: "intro::title",
        propertyPath: "initial.transform.x",
        capability: "exact",
        value: 80,
        source: {
          relativePath: "compose.media.ts",
          sourceHash: "hash-src-1",
          startByte: 10,
          endByte: 12,
          syntaxKind: "number-literal",
        },
      },
      {
        schemaVersion: 0,
        bindingId: "intro#duration",
        targetId: "intro",
        propertyPath: "duration",
        capability: "exact",
        value: "90f",
        source: {
          relativePath: "compose.media.ts",
          sourceHash: "hash-src-1",
          startByte: 40,
          endByte: 45,
          syntaxKind: "string-duration",
        },
      },
      {
        schemaVersion: 0,
        bindingId: "intro::badge#initial.transform.x",
        targetId: "intro::badge",
        propertyPath: "initial.transform.x",
        capability: "inspect-only",
        reason: "expression-binding",
      },
    ],
  };
}

function emptyDiff(overrides: Partial<MediaIRDiff> = {}): MediaIRDiff {
  return {
    schemaVersion: 0,
    result: "mediaAffecting",
    sourceOnly: false,
    pixelVerificationRequired: false,
    changes: [
      {
        id: "c1",
        category: "motion",
        confidence: "canonical",
        message: "node transform",
        affected: [{ startFrame: 0, endFrame: 90 }],
        pixelVerificationRequired: false,
      },
    ],
    affectedFrames: [{ startFrame: 0, endFrame: 90 }],
    identity: { added: [], removed: [], modified: ["intro::title"] },
    ...overrides,
  };
}

function minimalIr(partial: {
  scenes: MediaIR["scenes"];
  fps?: number;
  width?: number;
  height?: number;
}): MediaIR {
  return {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: { sourceId: "t", variantId: "default", editionId: "default" },
    medium: "html",
    animated: true,
    canvas: { width: partial.width ?? 1920, height: partial.height ?? 1080 },
    renderConfig: {
      fonts: [],
      inlineCss: [],
      stylesheets: [],
      tailwind: false,
      background: null,
      watermark: null,
      readiness: null,
      mode: "frame",
    },
    clock: {
      fps: partial.fps ?? 30,
      durationSeconds: 10,
      totalFrames: 300,
    },
    capabilities: {
      temporal: "canonical",
      motion: "declarative",
      visual: "opaque-html",
      portability: "self-contained",
      determinism: "verified",
      issues: [],
    },
    provenance: {
      programHash: "p",
      sourceId: "t",
      compiler: "superimg",
      compilerVersion: 0,
    },
    scenes: partial.scenes,
    tracks: [],
    motions: [],
    assets: [],
    observations: {
      markupRuns: [],
      sceneRuns: [],
    },
    hashes: {
      intentHash: "i",
      markupHash: "m",
      programHash: "p",
    },
    extensions: {},
  };
}

describe("edit frames", () => {
  it("rejects fractional, negative, non-finite frames", () => {
    expect(() => assertEditFrame(1.5)).toThrow(EditError);
    expect(() => assertEditFrame(-1)).toThrow(EditError);
    expect(() => assertEditFrame(Number.NaN)).toThrow(EditError);
    expect(() => assertEditFrame(Number.POSITIVE_INFINITY)).toThrow(EditError);
  });

  it("preserves half-open ranges", () => {
    expect(() => assertEditFrameRange({ startFrame: 0, endFrame: 0 })).not.toThrow();
    expect(() => assertEditFrameRange({ startFrame: 10, endFrame: 10 })).not.toThrow();
    expect(() => assertEditFrameRange({ startFrame: 5, endFrame: 4 })).toThrow(
      EditError,
    );
  });

  it("converts scene/global at first and last frame boundaries", () => {
    const sceneRange = { startFrame: 30, endFrame: 120 };
    expect(sceneFrameToGlobal(0, sceneRange)).toBe(30);
    expect(sceneFrameToGlobal(89, sceneRange)).toBe(119);
    expect(globalFrameToScene(30, sceneRange)).toBe(0);
    expect(globalFrameToScene(119, sceneRange)).toBe(89);

    const g = convertEditFramePoint(
      { space: "scene", frame: 0, ownerId: "intro" },
      "global",
      sceneRange,
    );
    expect(g).toEqual({ space: "global", frame: 30, ownerId: "intro" });

    const s = convertEditFramePoint(
      { space: "global", frame: 119 },
      "scene",
      sceneRange,
    );
    expect(s).toEqual({ space: "scene", frame: 89 });

    const range = convertEditFrameRange(
      { space: "scene", startFrame: 0, endFrame: 90 },
      "global",
      sceneRange,
    );
    expect(range).toEqual({
      space: "global",
      startFrame: 30,
      endFrame: 120,
    });
  });

  it("rejects reserved time spaces", () => {
    expect(isP0TimeSpace("source")).toBe(false);
    expect(() =>
      convertEditFramePoint(
        { space: "clip", frame: 0 },
        "global",
        { startFrame: 0, endFrame: 10 },
      ),
    ).toThrow(/not implemented/);
  });
});

describe("edit operation validation", () => {
  it("round-trips both P0 operations through JSON", () => {
    const a = roundTripMediaEditCommand(sampleTransformOp());
    expect(a.kind).toBe("set-node-transform");
    if (a.kind === "set-node-transform") {
      expect(a.value).toEqual({ x: 100, y: 200 });
    }

    const b = roundTripMediaEditCommand(sampleTrimOp());
    expect(b.kind).toBe("trim-scene-end");
    if (b.kind === "trim-scene-end") {
      expect(b.mode).toBe("ripple");
      expect(b.end.frame).toBe(90);
    }
  });

  it("rejects unsupported schema versions and kinds", () => {
    expect(() =>
      validateMediaEditCommand({ ...sampleTransformOp(), schemaVersion: 2 }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validateMediaEditCommand({ ...sampleTransformOp(), kind: "set-property" }),
    ).toThrow(/unsupported operation kind/);
  });

  it("rejects non-ripple trim and sub-frame end", () => {
    expect(() =>
      validateMediaEditCommand({ ...sampleTrimOp(), mode: "non-ripple" }),
    ).toThrow(/ripple/);
    expect(() =>
      validateMediaEditCommand({
        ...sampleTrimOp(),
        end: { space: "global", frame: 0 },
      }),
    ).toThrow(/>= 1/);
    expect(() =>
      validateMediaEditCommand({
        ...sampleTrimOp(),
        end: { space: "global", frame: 1.5 },
      }),
    ).toThrow(/integer/);
  });

  it("round-trips manifest and rejects absolute paths", () => {
    const m = roundTripEditManifest(sampleManifest());
    expect(m.summary.exactBindingCount).toBe(2);

    expect(() =>
      validateEditManifest({
        ...sampleManifest(),
        bindings: [
          {
            ...sampleManifest().bindings[0],
            source: {
              ...sampleManifest().bindings[0]!.source!,
              relativePath: "/abs/path.ts",
            },
          },
        ],
      }),
    ).toThrow(/absolute/);
  });
});

describe("binding ids", () => {
  it("builds and parses stable scene-scoped ids", () => {
    const id = makePropertyBindingId(
      "intro",
      "title",
      "initial.transform.x",
    );
    expect(id).toBe("intro::title#initial.transform.x");
    expect(parsePropertyBindingId(id)).toEqual({
      sceneId: "intro",
      localNodeId: "title",
      propertyPath: "initial.transform.x",
    });
    expect(makeDurationBindingId("intro")).toBe("intro#duration");
    expect(parseDurationBindingId("intro#duration")).toEqual({
      sceneId: "intro",
    });
    expect(makeCompositionHoldBindingId("chapter/card")).toBe("chapter/card#hold");
    expect(parseCompositionHoldBindingId("chapter/card#hold")).toEqual({ occurrencePath: "chapter/card" });
  });
});

describe("capability UI mapping", () => {
  it("maps reserved modes to inspect-only", () => {
    expect(toEditUiState("exact")).toBe("editable");
    expect(toEditUiState("opaque")).toBe("opaque");
    expect(toEditUiState("inspect-only")).toBe("inspect-only");
    expect(visualCapabilityToEdit("opaque-html")).toBe("opaque");
    expect(visualCapabilityToEdit("opaque-svg")).toBe("opaque");
    expect(visualCapabilityToEdit("tree")).toBe("inspect-only");
    expect(visualCapabilityToEdit("structured")).toBeNull();
  });
});

describe("inverse operations", () => {
  it("inverts transform and trim", () => {
    const inv = invertSetNodeTransform(
      sampleTransformOp(),
      { x: 80, y: 120 },
    );
    expect(inv.kind).toBe("set-node-transform");
    if (inv.kind === "set-node-transform") {
      expect(inv.value).toEqual({ x: 80, y: 120 });
    }

    const invT = invertTrimSceneEnd(sampleTrimOp(), 60);
    expect(invT.kind).toBe("trim-scene-end");
    if (invT.kind === "trim-scene-end") {
      expect(invT.end.frame).toBe(60);
    }

    const via = invertOperation(
      sampleTransformOp(),
      { kind: "set-node-transform", x: 1, y: 2 },
    );
    expect(via.kind).toBe("set-node-transform");
  });
});

describe("effect policy skeleton", () => {
  it("accepts motion-only spatial diffs", () => {
    const r = validateSpatialEffectPolicy(sampleTransformOp(), emptyDiff());
    expect(r.ok).toBe(true);
  });

  it("rejects canvas/duration changes on spatial edit", () => {
    const r = validateSpatialEffectPolicy(
      sampleTransformOp(),
      emptyDiff({
        changes: [
          {
            id: "c",
            category: "canvas",
            confidence: "canonical",
            message: "bad",
            affected: [],
            pixelVerificationRequired: false,
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.code).toBe("forbidden_category");
  });

  it("validates temporal scene end and forbids fps change", () => {
    const before = minimalIr({
      scenes: [
        {
          id: "intro",
          index: 0,
          range: { startFrame: 0, endFrame: 60 },
          phases: [],
          markers: [],
          transitions: [],
        },
        {
          id: "demo",
          index: 1,
          range: { startFrame: 60, endFrame: 150 },
          phases: [],
          markers: [],
          transitions: [],
        },
      ],
    });
    const after = minimalIr({
      scenes: [
        {
          id: "intro",
          index: 0,
          range: { startFrame: 0, endFrame: 90 },
          phases: [],
          markers: [],
          transitions: [],
        },
        {
          id: "demo",
          index: 1,
          range: { startFrame: 90, endFrame: 180 },
          phases: [],
          markers: [],
          transitions: [],
        },
      ],
    });
    const ok = validateTemporalEffectPolicy(
      sampleTrimOp({ end: { space: "global", frame: 90 } }),
      emptyDiff({
        changes: [
          {
            id: "d",
            category: "duration",
            confidence: "canonical",
            message: "trim",
            affected: [{ startFrame: 0, endFrame: 180 }],
            pixelVerificationRequired: false,
          },
        ],
      }),
      before,
      after,
    );
    expect(ok.ok).toBe(true);

    const badFps = validateTemporalEffectPolicy(
      sampleTrimOp(),
      emptyDiff({
        changes: [
          {
            id: "f",
            category: "fps",
            confidence: "canonical",
            message: "fps",
            affected: [],
            pixelVerificationRequired: false,
          },
        ],
      }),
      before,
      { ...after, clock: { ...after.clock, fps: 24 } },
    );
    expect(badFps.ok).toBe(false);
  });
});

describe("verification frame sampling for edits", () => {
  it("caps at 9 and uses start/mid/end samples", () => {
    const diff = emptyDiff({
      affectedFrames: [
        { startFrame: 0, endFrame: 100 },
        { startFrame: 200, endFrame: 300 },
      ],
      changes: [],
    });
    const frames = selectVerificationFrames(diff, { limit: 9 });
    expect(frames.length).toBeLessThanOrEqual(9);
    expect(frames[0]).toBe(0);
    expect(frames).toContain(99);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
    expect(new Set(frames).size).toBe(frames.length);
  });
});
