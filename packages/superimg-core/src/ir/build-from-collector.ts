//! Build Media IR motions / tracks / scenes from an IrCollector after a frame pass.

import type {
  MediaIRCapabilityIssue,
  MediaIRMotion,
  MediaIRScene,
  MediaIRTrack,
} from "@superimg/types";
import { canonicalizeToJson } from "./pure/canonicalize.js";
import { progressWindowToRange, type IrCollector } from "./instrument.js";

export interface GlobalMarker {
  id: string;
  label?: string;
  frame: number;
}

/** Collapse motion instrument events into MediaIRMotion + capability issues. */
export function buildMotionsFromCollector(
  collector: IrCollector,
  totalFrames: number,
): { motions: Map<string, MediaIRMotion>; issues: MediaIRCapabilityIssue[] } {
  const motions = new Map<string, MediaIRMotion>();
  const issues: MediaIRCapabilityIssue[] = [];

  for (const [qid, events] of collector.motions) {
    const e0 = events[0]!;
    const localTotal = e0.totalFrames || totalFrames;
    const motionDecl = (e: typeof e0) => {
      const o: Record<string, unknown> = {
        kind: e.kind,
        enterStart: e.enterStart,
        enterEnd: e.enterEnd,
      };
      if (e.target !== undefined) o.target = e.target;
      if (e.property !== undefined) o.property = e.property;
      if (e.exitStart !== undefined) o.exitStart = e.exitStart;
      if (e.exitEnd !== undefined) o.exitEnd = e.exitEnd;
      if (e.from !== undefined) o.from = e.from;
      if (e.to !== undefined) o.to = e.to;
      if (e.exitTo !== undefined) o.exitTo = e.exitTo;
      if (e.easing !== undefined) o.easing = e.easing;
      if (e.exitEasing !== undefined) o.exitEasing = e.exitEasing;
      if (e.pattern !== undefined) o.pattern = e.pattern;
      return canonicalizeToJson(o);
    };
    const declKey = motionDecl(e0);
    for (let i = 1; i < events.length; i++) {
      const ei = events[i]!;
      if (motionDecl(ei) !== declKey) {
        issues.push({
          code: "inconsistent_motion",
          message: `Motion ${qid} declaration changed across frames (first diverge at frame ${ei.frame})`,
          id: qid,
          sceneId: e0.sceneId,
          frame: ei.frame,
        });
        break;
      }
    }
    const enter = progressWindowToRange(
      e0.enterStart,
      e0.enterEnd,
      localTotal,
      e0.sceneStartFrame,
    );
    const motion: MediaIRMotion = {
      id: qid,
      localId: e0.localId,
      sceneId: e0.sceneId,
      kind: e0.kind === "tween" ? "tween" : e0.kind === "value" ? "value" : "motion",
      enter,
      ...(e0.target ? { target: e0.target } : {}),
      ...(e0.property ? { property: e0.property } : {}),
      ...(e0.from ? { from: e0.from } : {}),
      ...(e0.to ? { to: e0.to } : {}),
      ...(e0.exitTo ? { exitTo: e0.exitTo } : {}),
      ...(e0.easing ? { easing: e0.easing } : {}),
      ...(e0.exitEasing ? { exitEasing: e0.exitEasing } : {}),
      ...(e0.pattern ? { pattern: e0.pattern } : {}),
    };
    if (e0.exitStart !== undefined && e0.exitEnd !== undefined) {
      motion.exit = progressWindowToRange(
        e0.exitStart,
        e0.exitEnd,
        localTotal,
        e0.sceneStartFrame,
      );
    }
    const isCustom = (e?: { kind: string; name?: string }) =>
      e?.kind === "named" && (e.name === "custom-function" || e.name?.startsWith("pattern:"));
    if (
      isCustom(e0.easing as { kind: string; name?: string } | undefined) ||
      isCustom(e0.exitEasing as { kind: string; name?: string } | undefined) ||
      (e0.pattern && e0.pattern !== "linear")
    ) {
      motion.kind = "sampled";
      issues.push({
        code: "sampled_easing",
        message: `Motion ${qid} uses non-declarative easing/pattern (sampled)`,
        id: qid,
        sceneId: e0.sceneId,
      });
    }
    motions.set(qid, motion);
  }

  return { motions, issues };
}

/** Collapse track / stack / carousel / video-sync events into MediaIRTrack[]. */
export function buildTracksFromCollector(
  collector: IrCollector,
  totalFrames: number,
): Map<string, MediaIRTrack> {
  const tracks = new Map<string, MediaIRTrack>();

  for (const [qid, events] of collector.tracks) {
    const e0 = events[0]!;
    tracks.set(qid, {
      id: qid,
      kind: e0.kind,
      sceneId: e0.sceneId,
      range: {
        startFrame: e0.sceneStartFrame,
        endFrame: e0.sceneStartFrame + (e0.totalFrames || totalFrames),
      },
      meta: {
        wordCount: e0.wordCount ?? 0,
        markerCount: e0.markerCount ?? 0,
      },
    });
  }

  for (const [qid, events] of collector.videoSyncs) {
    const e0 = events[0]!;
    tracks.set(qid, {
      id: qid,
      kind: "video-sync",
      sceneId: e0.sceneId,
      range: {
        startFrame: e0.sceneStartFrame,
        endFrame: e0.sceneStartFrame + (e0.totalFrames || totalFrames),
      },
      src: e0.src,
      meta: { mediaTime: e0.mediaTime },
    });
  }

  for (const [qid, events] of collector.stacks) {
    const e0 = events[0]!;
    tracks.set(qid, {
      id: qid,
      kind: "author-track",
      sceneId: e0.sceneId,
      range: {
        startFrame: e0.sceneStartFrame,
        endFrame: e0.sceneStartFrame + (e0.totalFrames || totalFrames),
      },
      meta: { helper: "stack", itemIds: e0.itemIds },
    });
  }

  for (const [qid, events] of collector.carousels) {
    const e0 = events[0]!;
    tracks.set(qid, {
      id: qid,
      kind: "author-track",
      sceneId: e0.sceneId,
      range: {
        startFrame: e0.sceneStartFrame,
        endFrame: e0.sceneStartFrame + (e0.totalFrames || totalFrames),
      },
      meta: { helper: "carousel", itemIds: e0.itemIds },
    });
  }

  return tracks;
}

/** Build scene list (composed or single default) with phases, markers, transitions. */
function canonicalPhaseBounds(
  phases: MediaIRScene["phases"],
): MediaIRScene["phases"] {
  const snapUnit = (value: number) => {
    if (Math.abs(value) < 1e-12) return 0;
    if (Math.abs(value - 1) < 1e-12) return 1;
    return value;
  };
  return phases.map((phase) => ({
    ...phase,
    start: snapUnit(phase.start),
    end: snapUnit(phase.end),
  }));
}

export function buildScenesFromCollector(
  collector: IrCollector,
  totalFrames: number,
  globalMarkers: GlobalMarker[],
): MediaIRScene[] {
  const bounds = new Map<string, { startFrame: number; totalFrames: number }>();
  const record = (event: { sceneId: string; sceneStartFrame: number; totalFrames: number }) => {
    if (!bounds.has(event.sceneId)) {
      bounds.set(event.sceneId, {
        startFrame: event.sceneStartFrame,
        totalFrames: event.totalFrames || totalFrames,
      });
    }
  };
  for (const event of collector.directors) record(event);
  for (const events of collector.motions.values()) if (events[0]) record(events[0]);
  for (const events of collector.tracks.values()) if (events[0]) record(events[0]);
  for (const events of collector.stacks.values()) if (events[0]) record(events[0]);
  for (const events of collector.carousels.values()) if (events[0]) record(events[0]);
  for (const events of collector.videoSyncs.values()) if (events[0]) record(events[0]);
  if (bounds.size === 0) {
    bounds.set("default", { startFrame: 0, totalFrames });
  }

  return [...bounds.entries()]
    .sort((a, b) => a[1].startFrame - b[1].startFrame || a[0].localeCompare(b[0]))
    .map(([id, bound], index) => {
      const endFrame = Math.min(totalFrames, bound.startFrame + bound.totalFrames);
      return {
        id,
        index,
        range: { startFrame: bound.startFrame, endFrame },
        phases: canonicalPhaseBounds(
          collector.directors.filter((event) => event.sceneId === id).at(-1)?.phases ?? [],
        ),
        markers: globalMarkers.filter(
          (marker) => marker.frame >= bound.startFrame && marker.frame < endFrame,
        ),
        transitions: [],
      };
    });
}

/** Map resolve() markers (seconds) to global frame markers. */
export function mapResolveMarkers(
  resolveMarkers: { id: string; label?: string; at: string | number }[],
  fps: number,
  totalFrames: number,
): GlobalMarker[] {
  return resolveMarkers.map((m) => {
    let atSec = 0;
    if (typeof m.at === "number") atSec = m.at;
    else if (typeof m.at === "string") {
      const s = m.at.trim();
      if (s.endsWith("ms")) atSec = parseFloat(s) / 1000;
      else if (s.endsWith("s")) atSec = parseFloat(s);
      else atSec = parseFloat(s) || 0;
    }
    const marker: GlobalMarker = {
      id: m.id,
      frame: Math.max(0, Math.min(totalFrames - 1, Math.round(atSec * fps))),
    };
    if (m.label !== undefined) marker.label = m.label;
    return marker;
  });
}
