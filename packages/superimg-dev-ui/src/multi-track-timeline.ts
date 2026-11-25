//! Read-only multi-track timeline DOM for superimg dev (IR-driven).

import type { MediaIR } from "@superimg/types";
import type { RuntimeStore } from "@superimg/player";
import {
  timelineFromMediaIR,
  seekFrameForTimelineItem,
  formatLaneItemHover,
  itemsAtFrame,
  type MultiTrackTimeline,
  type TimelineLane,
  type TimelineLaneItem,
} from "./timeline-lanes.js";

const CAPABILITY_LABEL: Record<string, string> = {
  canonical: "canonical",
  sampled: "sampled",
  opaque: "opaque",
};

/** Shared Studio selection (frame + optional lane/item identity). */
export interface StudioSelection {
  frame: number;
  laneId?: string;
  itemId?: string;
  range?: { startFrame: number; endFrame: number };
  sceneId?: string;
  motionId?: string;
}

export interface MultiTrackTimelineController {
  mount(root: HTMLElement): void;
  setMediaIR(ir: MediaIR | null): void;
  getSelection(): StudioSelection;
  setSelection(sel: Partial<StudioSelection>): void;
  getTimeline(): MultiTrackTimeline | null;
  /** Mark timeline as stale (compile error) without blanking lanes. */
  setStale(stale: boolean, message?: string): void;
  destroy(): void;
}

/**
 * Renders IR lanes under the primary scrub bar.
 * - Click interval → seek to first frame + select
 * - Hover → tooltip with frame/time/id/capability
 * - Playhead synced from store (≤1 frame with player)
 * - Opaque ranges use hatch pattern + text badge (not color-only)
 * - Keyboard: ArrowLeft/Right step when focused in root
 */
export function createMultiTrackTimeline(
  store: RuntimeStore,
  options: {
    onSeekFrame: (frame: number) => void;
    onSelectionChange?: (sel: StudioSelection) => void;
  },
): MultiTrackTimelineController {
  let root: HTMLElement | null = null;
  let lanesEl: HTMLElement | null = null;
  let playheadEl: HTMLElement | null = null;
  let hoverEl: HTMLElement | null = null;
  let statusEl: HTMLElement | null = null;
  let timeline: MultiTrackTimeline | null = null;
  let unsub: (() => void) | null = null;
  let selection: StudioSelection = { frame: 0 };
  let stale = false;
  let staleMessage = "";

  /** Match scrub/playhead: frame/(totalFrames-1) for N>1. */
  function pct(frame: number, total: number): number {
    if (total <= 1) return 0;
    return (frame / Math.max(1, total - 1)) * 100;
  }

  function renderLanes() {
    if (!lanesEl || !timeline) {
      if (lanesEl) lanesEl.innerHTML = "";
      return;
    }
    const total = timeline.totalFrames;
    const fps = timeline.fps;
    lanesEl.innerHTML = "";
    lanesEl.setAttribute("role", "list");
    lanesEl.setAttribute("aria-label", "Media IR timeline lanes");

    for (const lane of timeline.lanes) {
      const row = document.createElement("div");
      row.className = "mt-lane";
      row.setAttribute("role", "listitem");
      row.dataset.laneKind = lane.kind;

      const label = document.createElement("div");
      label.className = "mt-lane-label";
      label.textContent = lane.label;
      label.id = `mt-lane-label-${lane.id}`;

      const track = document.createElement("div");
      track.className = "mt-lane-track";
      track.setAttribute("role", "group");
      track.setAttribute("aria-labelledby", label.id);

      for (const item of lane.items) {
        track.appendChild(renderItem(lane, item, total, fps));
      }

      row.appendChild(label);
      row.appendChild(track);
      lanesEl.appendChild(row);
    }
  }

  function emitSelection(next: StudioSelection) {
    selection = next;
    options.onSelectionChange?.(selection);
    // Update selected styling without full rebuild when possible
    if (lanesEl) {
      for (const el of lanesEl.querySelectorAll<HTMLElement>(".mt-lane-item")) {
        const selected = el.dataset.itemId === selection.itemId;
        el.classList.toggle("mt-lane-item--selected", selected);
        el.setAttribute("aria-pressed", String(selected));
      }
      for (const el of lanesEl.querySelectorAll<HTMLElement>(".mt-lane-item")) {
        const id = el.dataset.itemId;
        const item = findItem(id);
        if (!item || !timeline) continue;
        const active = itemsAtFrame(timeline, selection.frame).some(
          (x) => x.item.id === id,
        );
        el.classList.toggle("mt-lane-item--active", active);
      }
    }
    if (statusEl) {
      const cap = selection.itemId
        ? `selected ${selection.itemId}`
        : `frame ${selection.frame}`;
      statusEl.textContent = stale
        ? `Stale preview · ${staleMessage || "compile error"} · ${cap}`
        : cap;
    }
  }

  function findItem(id: string | undefined): TimelineLaneItem | null {
    if (!id || !timeline) return null;
    for (const lane of timeline.lanes) {
      const found = lane.items.find((i) => i.id === id);
      if (found) return found;
    }
    return null;
  }

  function selectAndSeek(lane: TimelineLane, item: TimelineLaneItem) {
    const frame = seekFrameForTimelineItem(item);
    options.onSeekFrame(frame);
    const next: StudioSelection = {
      frame,
      laneId: lane.id,
      itemId: item.id,
      range: { ...item.range },
    };
    if (item.kind === "scene") next.sceneId = item.id;
    if (item.kind === "motion") {
      next.motionId = String(item.meta?.motionId ?? item.id);
    }
    emitSelection(next);
  }

  function renderItem(
    lane: TimelineLane,
    item: TimelineLaneItem,
    total: number,
    fps: number,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mt-lane-item";
    if (item.capability === "opaque") btn.classList.add("mt-lane-item--opaque");
    if (item.capability === "sampled") btn.classList.add("mt-lane-item--sampled");
    if (item.kind === "motion") btn.classList.add("mt-lane-item--motion");
    if (item.kind === "phase") btn.classList.add("mt-lane-item--phase");
    if (item.kind === "scene") btn.classList.add("mt-lane-item--scene");
    if (selection.itemId === item.id) btn.classList.add("mt-lane-item--selected");

    const startPct = pct(item.range.startFrame, total);
    const widthPct = Math.max(
      0.4,
      pct(item.range.endFrame, total) - startPct,
    );
    btn.style.left = `${startPct}%`;
    btn.style.width = `${widthPct}%`;

    const cap = CAPABILITY_LABEL[item.capability ?? "canonical"] ?? "canonical";
    // Never present opaque as canonical in accessible name
    const capLabel = item.capability === "opaque" ? "opaque" : cap;
    btn.setAttribute(
      "aria-label",
      `${item.label}, frames ${item.range.startFrame} to ${item.range.endFrame}, ${capLabel}`,
    );
    btn.setAttribute("aria-pressed", String(selection.itemId === item.id));
    btn.title = formatLaneItemHover(item, fps);
    btn.dataset.itemId = item.id;
    btn.dataset.laneId = lane.id;
    btn.dataset.capability = capLabel;

    // Non-color capability badge (text) for a11y
    const badge = document.createElement("span");
    badge.className = "mt-cap-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent =
      capLabel === "opaque" ? "◐" : capLabel === "sampled" ? "◇" : "●";
    btn.appendChild(badge);

    const text = document.createElement("span");
    text.className = "mt-item-text";
    text.textContent = item.label;
    btn.appendChild(text);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      selectAndSeek(lane, item);
    });

    btn.addEventListener("mouseenter", () => showHover(btn, item, fps));
    btn.addEventListener("mouseleave", hideHover);
    btn.addEventListener("focus", () => showHover(btn, item, fps));
    btn.addEventListener("blur", hideHover);

    return btn;
  }

  function showHover(anchor: HTMLElement, item: TimelineLaneItem, fps: number) {
    if (!hoverEl || !root) return;
    hoverEl.hidden = false;
    hoverEl.textContent = formatLaneItemHover(item, fps);
    const r = anchor.getBoundingClientRect();
    const rootR = root.getBoundingClientRect();
    hoverEl.style.left = `${Math.max(0, r.left - rootR.left)}px`;
    hoverEl.style.top = `${r.bottom - rootR.top + 4}px`;
  }

  function hideHover() {
    if (hoverEl) hoverEl.hidden = true;
  }

  function syncPlayhead() {
    if (!playheadEl || !timeline) return;
    const state = store.getState();
    const total = Math.max(1, state.totalFrames);
    const frame = state.currentFrame;
    // Keep selection frame within 1 of player store
    if (Math.abs(selection.frame - frame) > 1) {
      selection = { ...selection, frame };
    } else {
      selection = { ...selection, frame };
    }
    const p = frame / Math.max(1, total - 1 || 1);
    playheadEl.style.left = `${p * 100}%`;
    if (lanesEl) {
      for (const el of lanesEl.querySelectorAll<HTMLElement>(".mt-lane-item")) {
        const id = el.dataset.itemId;
        const active = itemsAtFrame(timeline, frame).some((x) => x.item.id === id);
        el.classList.toggle("mt-lane-item--active", active);
      }
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!root || document.activeElement !== root && !root.contains(document.activeElement)) {
      // Allow when root itself is focused
      if (document.activeElement !== root) return;
    }
    const state = store.getState();
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (state.isPlaying) return;
      const frame = Math.max(0, state.currentFrame - (e.shiftKey ? 10 : 1));
      options.onSeekFrame(frame);
      emitSelection({ ...selection, frame });
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (state.isPlaying) return;
      const frame = Math.min(
        state.totalFrames - 1,
        state.currentFrame + (e.shiftKey ? 10 : 1),
      );
      options.onSeekFrame(frame);
      emitSelection({ ...selection, frame });
    }
  }

  return {
    mount(mountRoot: HTMLElement) {
      root = mountRoot;
      root.classList.add("mt-root");
      root.tabIndex = 0;
      root.setAttribute("role", "region");
      root.setAttribute("aria-label", "Media IR multi-track timeline");
      root.innerHTML = `
        <div class="mt-header">
          <span class="mt-title">Timeline</span>
          <span class="mt-status" data-mt-status></span>
          <span class="mt-legend" aria-label="Capability legend">
            <span class="mt-legend-item"><span class="mt-cap-badge" aria-hidden="true">●</span> canonical</span>
            <span class="mt-legend-item"><span class="mt-cap-badge" aria-hidden="true">◇</span> sampled</span>
            <span class="mt-legend-item mt-legend-item--opaque"><span class="mt-cap-badge" aria-hidden="true">◐</span> opaque</span>
          </span>
        </div>
        <div class="mt-body">
          <div class="mt-lanes"></div>
          <div class="mt-rail" aria-hidden="true">
            <div class="mt-playhead"></div>
          </div>
        </div>
        <div class="mt-hover" role="tooltip" hidden></div>
      `;
      lanesEl = root.querySelector(".mt-lanes");
      playheadEl = root.querySelector(".mt-playhead");
      hoverEl = root.querySelector(".mt-hover");
      statusEl = root.querySelector("[data-mt-status]");
      root.addEventListener("keydown", onKeyDown);
      unsub = store.subscribe(() => syncPlayhead());
      syncPlayhead();
      renderLanes();
    },

    setMediaIR(ir: MediaIR | null) {
      // Keep last valid timeline on null only if stale; otherwise clear
      if (ir) {
        timeline = timelineFromMediaIR(ir);
        stale = false;
        staleMessage = "";
        if (selection.itemId && !findItem(selection.itemId)) {
          selection = { frame: selection.frame };
        }
        if (root) root.classList.remove("mt-root--stale");
      } else if (!stale) {
        timeline = null;
      }
      renderLanes();
      syncPlayhead();
      if (root) {
        root.hidden = !timeline || timeline.lanes.length === 0;
      }
    },

    getSelection() {
      return { ...selection };
    },

    setSelection(sel: Partial<StudioSelection>) {
      emitSelection({ ...selection, ...sel });
    },

    getTimeline() {
      return timeline;
    },

    setStale(nextStale: boolean, message?: string) {
      stale = nextStale;
      staleMessage = message ?? "";
      if (root) {
        root.classList.toggle("mt-root--stale", stale);
      }
      emitSelection(selection);
    },

    destroy() {
      unsub?.();
      unsub = null;
      root?.removeEventListener("keydown", onKeyDown);
      if (root) root.innerHTML = "";
      root = null;
      lanesEl = null;
      playheadEl = null;
      hoverEl = null;
      statusEl = null;
      timeline = null;
    },
  };
}

/** Unit-test helper: build DOM fragment for a single lane (structure checks). */
export function buildLaneFragmentForTest(lane: TimelineLane, totalFrames: number, fps: number): HTMLElement {
  const wrap = document.createElement("div");
  const ctrl = createMultiTrackTimeline(
    {
      getState: () => ({ currentFrame: 0, totalFrames, fps, isPlaying: false }),
      subscribe: () => () => {},
    } as unknown as RuntimeStore,
    { onSeekFrame: () => {} },
  );
  // Manual item render via multiTrack path
  const fakeRoot = document.createElement("div");
  ctrl.mount(fakeRoot);
  ctrl.setMediaIR({
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
    clock: { fps, durationSeconds: totalFrames / fps, totalFrames },
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
    scenes:
      lane.kind === "scene"
        ? lane.items.map((it, i) => ({
            id: it.id,
            index: i,
            range: it.range,
            phases: [],
            markers: [],
            transitions: [],
          }))
        : [
            {
              id: "default",
              index: 0,
              range: { startFrame: 0, endFrame: totalFrames },
              phases: [],
              markers: [],
              transitions: [],
            },
          ],
    tracks: [],
    motions:
      lane.kind === "motion"
        ? lane.items.map((it) => ({
            id: it.id,
            localId: it.label,
            sceneId: "default",
            kind: "motion" as const,
            enter: it.range,
          }))
        : [],
    assets: [],
    observations: {
      markupRuns:
        lane.kind === "opaque"
          ? lane.items.map((it) => ({ range: it.range, hash: "b".repeat(64) }))
          : [],
      sceneRuns: [],
    },
    hashes: {
      intentHash: "c".repeat(64),
      markupHash: "d".repeat(64),
      programHash: "a".repeat(64),
    },
    extensions: {},
  });
  wrap.appendChild(fakeRoot);
  return wrap;
}
