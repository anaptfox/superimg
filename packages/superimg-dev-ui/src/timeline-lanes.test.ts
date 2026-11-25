import { describe, it, expect } from "vitest";
import type { MediaIR } from "@superimg/types";
import {
  timelineFromMediaIR,
  seekFrameForTimelineItem,
  itemsAtFrame,
  formatLaneItemHover,
} from "./timeline-lanes.js";

function ir(): MediaIR {
  return {
    kind: "@foxworth/superimg/media-ir",
    schemaVersion: 0,
    identity: { sourceId: "t", variantId: "default", editionId: "default" },
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
    clock: { fps: 10, durationSeconds: 1, totalFrames: 10 },
    capabilities: {
      temporal: "canonical",
      motion: "declarative",
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
        range: { startFrame: 0, endFrame: 10 },
        phases: [
          { name: "enter", start: 0, end: 0.3 },
          { name: "hold", start: 0.3, end: 0.8 },
        ],
        markers: [],
        transitions: [],
      },
    ],
    tracks: [],
    motions: [
      {
        id: "default::title.enter",
        localId: "title.enter",
        sceneId: "default",
        kind: "motion",
        enter: { startFrame: 0, endFrame: 3 },
      },
    ],
    assets: [],
    observations: {
      markupRuns: [{ range: { startFrame: 0, endFrame: 10 }, hash: "b".repeat(64) }],
      sceneRuns: [{ range: { startFrame: 0, endFrame: 10 }, hash: "c".repeat(64) }],
    },
    hashes: {
      intentHash: "d".repeat(64),
      markupHash: "e".repeat(64),
      programHash: "a".repeat(64),
    },
    extensions: {},
  };
}

describe("timelineFromMediaIR (shared re-export)", () => {
  it("builds passive scene, phase, motion, and opaque lanes", () => {
    const tl = timelineFromMediaIR(ir());
    expect(tl.lanes.map((l) => l.kind)).toEqual(
      expect.arrayContaining(["scene", "phase", "motion", "opaque"]),
    );
    const motion = tl.lanes.find((l) => l.kind === "motion")!.items[0]!;
    expect(seekFrameForTimelineItem(motion)).toBe(0);
    expect(formatLaneItemHover(motion, 10)).toContain("canonical");
    expect(formatLaneItemHover(motion, 10)).toContain("title.enter");
    expect(itemsAtFrame(tl, 1).some((x) => x.item.id === motion.id)).toBe(true);
  });

  it("marks opaque lane capability for a11y non-color indicator", () => {
    const tl = timelineFromMediaIR(ir());
    const opaque = tl.lanes.find((l) => l.kind === "opaque")!;
    expect(opaque.items[0]!.capability).toBe("opaque");
  });

  it("projects scene.markers into a marker lane", () => {
    const base = ir();
    base.scenes[0]!.markers = [
      { id: "hook", label: "Hook", frame: 3 },
      { id: "cta", frame: 8 },
    ];
    const tl = timelineFromMediaIR(base);
    const markers = tl.lanes.find((l) => l.kind === "marker");
    expect(markers).toBeTruthy();
    expect(markers!.items).toHaveLength(2);
    expect(markers!.items[0]!.range).toEqual({ startFrame: 3, endFrame: 4 });
    expect(markers!.items[0]!.label).toBe("Hook");
  });

  it("preserves author-track kind in track meta", () => {
    const base = ir();
    base.tracks = [
      {
        id: "default::voiceover",
        kind: "author-track",
        sceneId: "default",
        range: { startFrame: 0, endFrame: 10 },
        meta: { wordCount: 3 },
      },
    ];
    const tl = timelineFromMediaIR(base);
    const tracks = tl.lanes.find((l) => l.id === "tracks");
    expect(tracks).toBeTruthy();
    expect(tracks!.items[0]!.kind).toBe("author-track");
    expect(tracks!.items[0]!.meta?.trackKind).toBe("author-track");
  });

});
