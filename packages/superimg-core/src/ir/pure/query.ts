//! Query MediaIR by stable ids / frames / tags.

import type { MediaIRQuery, MediaIRQueryResult, MediaIR } from "@superimg/types";
import { frameInRange } from "./ranges.js";

export function queryMediaIR(ir: MediaIR, query: MediaIRQuery): MediaIRQueryResult {
  let scenes = ir.scenes;
  if (query.sceneId) {
    scenes = scenes.filter((s) => s.id === query.sceneId);
  }
  if (query.frame !== undefined) {
    scenes = scenes.filter((s) => frameInRange(query.frame!, s.range));
  }
  if (query.range) {
    const r = query.range;
    scenes = scenes.filter(
      (s) => s.range.startFrame < r.endFrame && r.startFrame < s.range.endFrame,
    );
  }

  let motions = ir.motions;
  if (query.motionId) {
    motions = motions.filter((m) => m.id === query.motionId || m.localId === query.motionId);
  }
  if (query.sceneId) {
    motions = motions.filter((m) => m.sceneId === query.sceneId);
  }
  if (query.frame !== undefined) {
    motions = motions.filter(
      (m) =>
        frameInRange(query.frame!, m.enter) ||
        (m.exit !== undefined && frameInRange(query.frame!, m.exit)),
    );
  }

  let tracks = ir.tracks;
  if (query.trackId) {
    tracks = tracks.filter((t) => t.id === query.trackId);
  }
  if (query.sceneId) {
    tracks = tracks.filter((t) => t.sceneId === query.sceneId);
  }
  if (query.frame !== undefined) {
    tracks = tracks.filter((t) => frameInRange(query.frame!, t.range));
  }

  const result: MediaIRQueryResult = {
    scenes,
    motions,
    tracks,
  };
  if (query.frame !== undefined) {
    result.frame = query.frame;
  }
  return result;
}
