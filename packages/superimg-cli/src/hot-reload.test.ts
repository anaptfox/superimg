import { describe, it, expect } from "vitest";
import type { MediaIR } from "@superimg/types";
import { classifyHotReload, remapSelection } from "./hot-reload.js";

function ir(over: Partial<MediaIR> = {}): MediaIR {
  const base: MediaIR = {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: {
      sourceId: "t",
      variantId: "default",
      editionId: "default",
    },
    medium: "html",
    animated: true,
    canvas: { width: 100, height: 100 },
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
    clock: { fps: 30, durationSeconds: 1, totalFrames: 30 },
    capabilities: {
      temporal: "canonical",
      motion: "none",
      visual: "opaque-html",
      portability: "self-contained",
      determinism: "unverified",
      issues: [],
    },
    provenance: {
      programHash: "a".repeat(64),
      sourceId: "t",
      compiler: "superimg",
      compilerVersion: 0,
    },
    scenes: [
      {
        id: "default",
        index: 0,
        range: { startFrame: 0, endFrame: 30 },
        phases: [],
        markers: [],
        transitions: [],
      },
    ],
    tracks: [],
    extensions: {},
    motions: [],
    assets: [],
    observations: {
      markupRuns: [{ range: { startFrame: 0, endFrame: 30 }, hash: "b".repeat(64) }],
      sceneRuns: [{ range: { startFrame: 0, endFrame: 30 }, hash: "c".repeat(64) }],
    },
    hashes: {
      intentHash: "i".repeat(64),
      markupHash: "m".repeat(64),
      programHash: "a".repeat(64),
    },
  };
  return { ...base, ...over, hashes: { ...base.hashes, ...(over.hashes ?? {}) } };
}

describe("classifyHotReload", () => {
  it("no-change when hashes equal", () => {
    const a = ir();
    const d = classifyHotReload({ prev: a, next: a, playheadFrame: 5 });
    expect(d.class).toBe("no-change");
    expect(d.keepStalePreview).toBe(false);
  });

  it("markup-update preserves playhead", () => {
    const prev = ir();
    const next = ir({
      hashes: { ...prev.hashes, markupHash: "x".repeat(64) },
    });
    const d = classifyHotReload({ prev, next, playheadFrame: 12 });
    expect(d.class).toBe("markup-update");
    expect(d.nextPlayheadFrame).toBe(12);
    expect(d.preserveSelectionById).toBe(true);
  });

  it("intent-compatible when clock unchanged", () => {
    const prev = ir();
    const next = ir({
      hashes: { ...prev.hashes, intentHash: "z".repeat(64) },
    });
    const d = classifyHotReload({ prev, next, playheadFrame: 8 });
    expect(d.class).toBe("intent-compatible");
    expect(d.clampPlayhead).toBe(false);
  });

  it("clock-change clamps playhead", () => {
    const prev = ir();
    const next = ir({
      clock: { fps: 30, durationSeconds: 0.5, totalFrames: 15 },
      hashes: { ...prev.hashes, intentHash: "z".repeat(64) },
    });
    const d = classifyHotReload({ prev, next, playheadFrame: 40 });
    expect(d.class).toBe("clock-change");
    expect(d.clampPlayhead).toBe(true);
    expect(d.nextPlayheadFrame).toBe(14);
  });

  it("compile-error keeps stale preview", () => {
    const prev = ir();
    const d = classifyHotReload({
      prev,
      next: null,
      compileError: true,
      playheadFrame: 3,
    });
    expect(d.class).toBe("compile-error");
    expect(d.keepStalePreview).toBe(true);
  });
});

describe("remapSelection", () => {
  it("keeps item id when still present", () => {
    const next = ir();
    const sel = remapSelection({
      selection: { frame: 50, itemId: "default::title", laneId: "semantic" },
      next,
      nextItemIds: new Set(["default::title"]),
    });
    expect(sel.itemId).toBe("default::title");
    expect(sel.frame).toBe(29);
  });

  it("drops missing item id", () => {
    const next = ir();
    const sel = remapSelection({
      selection: { frame: 5, itemId: "gone", laneId: "semantic" },
      next,
      nextItemIds: new Set(["default::title"]),
    });
    expect(sel.itemId).toBeUndefined();
    expect(sel.frame).toBe(5);
  });
});
