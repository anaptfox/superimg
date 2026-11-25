/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import type { MediaIR } from "@superimg/types";
import type { RuntimeStore } from "@superimg/player";
import { createMultiTrackTimeline } from "./multi-track-timeline.js";
import { timelineFromMediaIR, seekFrameForTimelineItem } from "./timeline-lanes.js";

function sampleIR(): MediaIR {
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
        phases: [{ name: "enter", start: 0, end: 0.3 }],
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

function mockStore(frame = 0): RuntimeStore {
  let currentFrame = frame;
  const listeners = new Set<() => void>();
  return {
    getState: () => ({
      currentFrame,
      totalFrames: 10,
      fps: 10,
      isPlaying: false,
      setFrame: (f: number) => {
        currentFrame = f;
        for (const l of listeners) l();
      },
    }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  } as unknown as RuntimeStore;
}

describe("createMultiTrackTimeline DOM", () => {
  it("renders lanes with accessible names and opaque distinction", () => {
    const onSeek = vi.fn();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const ctrl = createMultiTrackTimeline(mockStore(), { onSeekFrame: onSeek });
    ctrl.mount(root);
    ctrl.setMediaIR(sampleIR());

    expect(root.querySelector(".mt-lanes")).toBeTruthy();
    expect(root.querySelector('[aria-label="Media IR timeline lanes"]')).toBeTruthy();
    expect(root.querySelector(".mt-legend")).toBeTruthy();
    expect(root.textContent).toContain("canonical");
    expect(root.textContent).toContain("opaque");

    const opaque = root.querySelector(".mt-lane-item--opaque") as HTMLButtonElement | null;
    expect(opaque).toBeTruthy();
    expect(opaque!.dataset.capability).toBe("opaque");
    // Hatch class present (non-color-only)
    expect(opaque!.className).toContain("opaque");
    expect(opaque!.getAttribute("aria-label")).toMatch(/opaque/i);

    const motion = root.querySelector(
      '[data-item-id="default::title.enter"]',
    ) as HTMLButtonElement;
    expect(motion).toBeTruthy();
    motion.click();
    expect(onSeek).toHaveBeenCalledWith(0);

    ctrl.destroy();
    root.remove();
  });

  it("seekFrameForTimelineItem returns range start (wired by click)", () => {
    const ir = sampleIR();
    const model = timelineFromMediaIR(ir);
    const motionLane = model.lanes.find((l) => l.kind === "motion")!;
    expect(seekFrameForTimelineItem(motionLane.items[0]!)).toBe(0);
  });

  it("hides when IR is cleared", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const ctrl = createMultiTrackTimeline(mockStore(), { onSeekFrame: () => {} });
    ctrl.mount(root);
    ctrl.setMediaIR(sampleIR());
    expect(root.hidden).toBe(false);
    ctrl.setMediaIR(null);
    expect(root.hidden).toBe(true);
    ctrl.destroy();
    root.remove();
  });

  it("selects lane item and keeps stale timeline on compile error", () => {
    const onSeek = vi.fn();
    const onSel = vi.fn();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const ctrl = createMultiTrackTimeline(mockStore(), {
      onSeekFrame: onSeek,
      onSelectionChange: onSel,
    });
    ctrl.mount(root);
    ctrl.setMediaIR(sampleIR());

    const motion = root.querySelector(
      '[data-item-id="default::title.enter"]',
    ) as HTMLButtonElement;
    motion.click();
    expect(onSeek).toHaveBeenCalledWith(0);
    expect(ctrl.getSelection().itemId).toBe("default::title.enter");
    expect(onSel).toHaveBeenCalled();

    // Compile error: keep last valid lanes, mark stale
    ctrl.setStale(true, "syntax error");
    expect(root.classList.contains("mt-root--stale")).toBe(true);
    expect(root.querySelector('[data-item-id="default::title.enter"]')).toBeTruthy();
    // setMediaIR(null) while stale must not blank
    ctrl.setMediaIR(null);
    expect(root.querySelector('[data-item-id="default::title.enter"]')).toBeTruthy();

    ctrl.destroy();
    root.remove();
  });

  it("seeks every lane kind to half-open range start", () => {
    const ir = sampleIR();
    const model = timelineFromMediaIR(ir);
    for (const lane of model.lanes) {
      for (const item of lane.items) {
        expect(seekFrameForTimelineItem(item)).toBe(item.range.startFrame);
      }
    }
  });
});
