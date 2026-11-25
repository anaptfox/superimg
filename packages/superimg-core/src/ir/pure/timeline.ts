//! Pure MediaIR → multi-track timeline projection (browser-safe, no DOM).

import type { MediaIR, MediaIRFrameRange } from "@superimg/types";
import { frameInRange } from "./ranges.js";

export type TimelineLaneKind =
  | "scene"
  | "phase"
  | "marker"
  | "audio"
  | "transcript"
  | "video-sync"
  | "author-track"
  | "motion"
  | "opaque";

export type TimelineCapability = "canonical" | "sampled" | "opaque";

export interface TimelineLaneItem {
  id: string;
  label: string;
  range: MediaIRFrameRange;
  kind: TimelineLaneKind;
  /** Capability / confidence for non-color indicators. */
  capability?: TimelineCapability;
  meta?: Record<string, unknown>;
}

export interface TimelineLane {
  id: string;
  kind: TimelineLaneKind;
  label: string;
  items: TimelineLaneItem[];
}

export interface MultiTrackTimeline {
  totalFrames: number;
  fps: number;
  durationSeconds: number;
  lanes: TimelineLane[];
}

export interface TimelineProjectionOptions {
  /** Keep one audio lane by default, or group lanes by authored audio role. */
  audioLanes?: "combined" | "role";
  /** Include clips marked showInTimeline: false; defaults to true. */
  includeHiddenAudio?: boolean;
}

export function timelineFromMediaIR(ir: MediaIR, options: TimelineProjectionOptions = {}): MultiTrackTimeline {
  const lanes: TimelineLane[] = [];

  const multiScene = ir.scenes.length > 1;
  lanes.push({
    id: "scenes",
    kind: "scene",
    label: "Scenes",
    items: ir.scenes.map((s) => ({
      id: s.id,
      label: s.label ?? s.id,
      range: s.range,
      kind: "scene",
      capability: "canonical",
      meta: {
        sourceId: s.sourceId ?? null,
        composed: multiScene,
        sceneIndex: s.index,
      },
    })),
  });

  const phaseItems: TimelineLaneItem[] = [];
  for (const s of ir.scenes) {
    for (const p of s.phases) {
      const startFrame =
        s.range.startFrame + Math.floor(p.start * (s.range.endFrame - s.range.startFrame));
      const endFrame =
        s.range.startFrame + Math.ceil(p.end * (s.range.endFrame - s.range.startFrame));
      phaseItems.push({
        id: `${s.id}::phase::${p.name}`,
        label: p.name,
        range: {
          startFrame,
          endFrame: Math.max(startFrame + 1, endFrame),
        },
        kind: "phase",
        capability: "canonical",
      });
    }
  }
  if (phaseItems.length) {
    lanes.push({ id: "phases", kind: "phase", label: "Phases", items: phaseItems });
  }

  const markerItems: TimelineLaneItem[] = [];
  for (const s of ir.scenes) {
    for (const m of s.markers) {
      markerItems.push({
        id: `${s.id}::marker::${m.id}`,
        label: m.label ?? m.id,
        range: {
          startFrame: m.frame,
          endFrame: Math.min(ir.clock.totalFrames, m.frame + 1),
        },
        kind: "marker",
        capability: "canonical",
      });
    }
  }
  if (markerItems.length) {
    lanes.push({ id: "markers", kind: "marker", label: "Markers", items: markerItems });
  }

  // Dedicated lanes per track kind when present; fall back to a single Tracks row.
  const byKind = new Map<TimelineLaneKind, TimelineLaneItem[]>();
  for (const t of ir.tracks) {
    if (t.kind === "audio" && options.includeHiddenAudio === false && t.meta?.showInTimeline === false) continue;
    const kind: TimelineLaneKind =
      t.kind === "markers"
        ? "marker"
        : t.kind === "audio" ||
            t.kind === "transcript" ||
            t.kind === "video-sync" ||
            t.kind === "author-track"
          ? t.kind
          : "author-track";
    const item: TimelineLaneItem = {
      id: t.id,
      label: t.label ?? t.id,
      range: t.range,
      kind,
      capability: "canonical",
      meta: {
        ...(t.meta ?? {}),
        trackKind: t.kind,
        ...(t.role === undefined ? {} : { role: t.role }),
        ...(t.src === undefined ? {} : { src: t.src }),
      },
    };
    const list = byKind.get(kind) ?? [];
    list.push(item);
    byKind.set(kind, list);
  }
  const trackLaneOrder: Array<{ kind: TimelineLaneKind; id: string; label: string }> = [
    { kind: "audio", id: "audio", label: "Audio" },
    { kind: "transcript", id: "transcript", label: "Transcript" },
    { kind: "video-sync", id: "video-sync", label: "Video sync" },
    { kind: "author-track", id: "tracks", label: "Tracks" },
    { kind: "marker", id: "track-markers", label: "Track markers" },
  ];
  for (const def of trackLaneOrder) {
    const items = byKind.get(def.kind);
    if (items?.length && def.kind === "audio" && options.audioLanes === "role") {
      const grouped = new Map<string, TimelineLaneItem[]>();
      for (const item of items) {
        const role = typeof item.meta?.role === "string" && item.meta.role ? item.meta.role : "unclassified";
        const group = grouped.get(role) ?? [];
        group.push(item);
        grouped.set(role, group);
      }
      const preferred = ["music", "voice", "sfx", "ambient"];
      const roles = [...grouped.keys()].sort((a, b) => {
        const aIndex = preferred.indexOf(a), bIndex = preferred.indexOf(b);
        return (aIndex < 0 ? preferred.length : aIndex) - (bIndex < 0 ? preferred.length : bIndex) || (a < b ? -1 : a > b ? 1 : 0);
      });
      for (const role of roles) {
        const label = role === "sfx" ? "SFX" : role.charAt(0).toUpperCase() + role.slice(1);
        lanes.push({ id: `audio-${role}`, kind: "audio", label, items: grouped.get(role)! });
      }
    } else if (items?.length) {
      lanes.push({ id: def.id, kind: def.kind, label: def.label, items });
    }
  }

  if (ir.motions.length) {
    const motionItems: TimelineLaneItem[] = [];
    for (const m of ir.motions) {
      const cap: TimelineCapability = m.kind === "sampled" ? "sampled" : "canonical";
      motionItems.push({
        id: m.id,
        label: m.localId,
        range: m.enter,
        kind: "motion",
        capability: cap,
        meta: { phase: "enter" },
      });
      if (m.exit) {
        motionItems.push({
          id: `${m.id}::exit`,
          label: `${m.localId} (exit)`,
          range: m.exit,
          kind: "motion",
          capability: cap,
          meta: { phase: "exit", motionId: m.id },
        });
      }
    }
    lanes.push({
      id: "motions",
      kind: "motion",
      label: "Motions",
      items: motionItems,
    });
  }

  if (ir.observations.markupRuns.length) {
    lanes.push({
      id: "opaque",
      kind: "opaque",
      label: "Opaque markup",
      items: ir.observations.markupRuns.map((run, i) => ({
        id: `opaque-${i}`,
        label: "html",
        range: run.range,
        kind: "opaque",
        capability: "opaque",
      })),
    });
  }

  return {
    totalFrames: ir.clock.totalFrames,
    fps: ir.clock.fps,
    durationSeconds: ir.clock.durationSeconds,
    lanes,
  };
}

/** Seek target for clicking an interval: first frame of half-open range. */
export function seekFrameForTimelineItem(item: TimelineLaneItem): number {
  return item.range.startFrame;
}

/** Items whose half-open range contains `frame`. */
export function itemsAtFrame(
  timeline: MultiTrackTimeline,
  frame: number,
): Array<{ lane: TimelineLane; item: TimelineLaneItem }> {
  const out: Array<{ lane: TimelineLane; item: TimelineLaneItem }> = [];
  for (const lane of timeline.lanes) {
    for (const item of lane.items) {
      if (frameInRange(frame, item.range)) {
        out.push({ lane, item });
      }
    }
  }
  return out;
}

/** Format seconds as a view over frame / fps (internal timebase is frames). */
export function formatFrameAsSeconds(frame: number, fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) return "0.00s";
  return `${(frame / fps).toFixed(2)}s`;
}

export function formatLaneItemHover(
  item: TimelineLaneItem,
  fps: number,
): string {
  const t0 = formatFrameAsSeconds(item.range.startFrame, fps);
  const t1 = formatFrameAsSeconds(item.range.endFrame, fps);
  const cap = item.capability ?? "canonical";
  return `${item.label} · f${item.range.startFrame}–${item.range.endFrame} · ${t0}–${t1} · ${cap}`;
}

/**
 * Clamp a playhead frame into a new clock after IR replacement.
 * Returns a valid index in [0, totalFrames-1].
 */
export function clampPlayheadFrame(
  frame: number,
  totalFrames: number,
): number {
  const max = Math.max(0, Math.floor(totalFrames) - 1);
  if (!Number.isFinite(frame)) return 0;
  return Math.max(0, Math.min(max, Math.floor(frame)));
}
