//! Operation-specific Media IR diff effect policies (P0 skeleton).

import type {
  MediaEditCommand,
  MediaIRDiff,
  MediaIRDiffCategory,
  MediaIRFrameRange,
  MediaIR,
} from "@superimg/types";
import { EditError } from "./errors.js";

const SPATIAL_FORBIDDEN: ReadonlySet<MediaIRDiffCategory> = new Set([
  "canvas",
  "duration",
  "fps",
  "scene",
  "asset",
]);

const SPATIAL_ALLOWED: ReadonlySet<MediaIRDiffCategory> = new Set([
  "motion",
  "opaque-markup",
  "program",
  "intent",
  "render-config",
]);

const TEMPORAL_FORBIDDEN: ReadonlySet<MediaIRDiffCategory> = new Set([
  "fps",
  "asset",
  "canvas",
]);

export interface EffectPolicyResult {
  ok: boolean;
  violations: Array<{ code: string; message: string; category?: string }>;
}

function collectCategories(diff: MediaIRDiff): MediaIRDiffCategory[] {
  return diff.changes.map((c) => c.category);
}

/**
 * Expected affected envelope for set-node-transform: union of the target
 * node's lifetimes (when present in before IR). Empty when node unknown.
 */
export function expectedSpatialAffectedRanges(
  _before: MediaIR,
  _nodeId: string,
): MediaIRFrameRange[] {
  return [];
}

/**
 * Validate a post-edit Media IR diff against set-node-transform rules.
 * Does not yet prove pixel identity — only structural containment.
 */
export function validateSpatialEffectPolicy(
  op: Extract<MediaEditCommand, { kind: "set-node-transform" | "set-node-text" | "set-node-property" }>,
  diff: MediaIRDiff,
  options?: { expectedRanges?: MediaIRFrameRange[] },
): EffectPolicyResult {
  const violations: EffectPolicyResult["violations"] = [];

  for (const cat of collectCategories(diff)) {
    if (SPATIAL_FORBIDDEN.has(cat) && !(op.kind === "set-node-property" && op.target.property === "src" && cat === "asset")) {
      violations.push({
        code: "forbidden_category",
        message: `${op.kind} must not change category "${cat}"`,
        category: cat,
      });
    } else if (!SPATIAL_ALLOWED.has(cat) && !(op.kind === "set-node-property" && op.target.property === "src" && cat === "asset")) {
      // phases/markers/audio/track etc. — treat as violation for P0 strictness
      violations.push({
        code: "unexpected_category",
        message: `${op.kind} unexpected diff category "${cat}"`,
        category: cat,
      });
    }
  }

  // Identity: no scene/asset add/remove for pure transform
  if (diff.identity.added.length > 0 || diff.identity.removed.length > 0) {
    // Allow modified only — added/removed are suspicious for transform
    const suspicious = [...diff.identity.added, ...diff.identity.removed].filter(
      (id) => id !== op.target.nodeId && !(op.kind === "set-node-property" && op.target.property === "src" && id.startsWith("asset:")),
    );
    if (suspicious.length > 0) {
      violations.push({
        code: "identity_churn",
        message: `${op.kind} changed unrelated identities: ${suspicious.slice(0, 5).join(", ")}`,
      });
    }
  }

  if (options?.expectedRanges && options.expectedRanges.length > 0) {
    for (const affected of diff.affectedFrames) {
      const contained = options.expectedRanges.some(
        (r) =>
          affected.startFrame >= r.startFrame && affected.endFrame <= r.endFrame,
      );
      // Allow empty / source-only
      if (diff.result === "mediaAffecting" && !contained) {
        // Soft: affected ranges may be a subset or union of lifetimes
        const overlaps = options.expectedRanges.some(
          (r) =>
            affected.startFrame < r.endFrame && r.startFrame < affected.endFrame,
        );
        if (!overlaps) {
          violations.push({
            code: "affected_outside_lifetime",
            message: `affected [${affected.startFrame},${affected.endFrame}) outside node lifetimes`,
          });
        }
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Validate trim-scene-end ripple: duration/scene/program changes expected;
 * FPS and canvas must not change; scene order/ids preserved is checked via
 * before/after IR when provided.
 */
export function validateTemporalEffectPolicy(
  op: Extract<MediaEditCommand, { kind: "trim-scene-end" }>,
  diff: MediaIRDiff,
  before?: MediaIR,
  after?: MediaIR,
): EffectPolicyResult {
  const violations: EffectPolicyResult["violations"] = [];

  for (const cat of collectCategories(diff)) {
    if (TEMPORAL_FORBIDDEN.has(cat)) {
      violations.push({
        code: "forbidden_category",
        message: `trim-scene-end must not change category "${cat}"`,
        category: cat,
      });
    }
  }

  if (before && after) {
    if (before.clock.fps !== after.clock.fps) {
      violations.push({
        code: "fps_changed",
        message: "trim-scene-end must not change resolved FPS",
      });
    }
    if (
      before.canvas.width !== after.canvas.width ||
      before.canvas.height !== after.canvas.height
    ) {
      violations.push({
        code: "canvas_changed",
        message: "trim-scene-end must not change canvas size",
      });
    }

    const beforeIds = before.scenes.map((s) => s.id);
    const afterIds = after.scenes.map((s) => s.id);
    if (beforeIds.join("\0") !== afterIds.join("\0")) {
      violations.push({
        code: "scene_order",
        message: "trim-scene-end must preserve scene order and stable IDs",
      });
    }

    const edited = after.scenes.find((s) => s.id === op.target.sceneId);
    if (!edited) {
      violations.push({
        code: "missing_scene",
        message: `edited scene "${op.target.sceneId}" missing after trim`,
      });
    } else {
      const len = edited.range.endFrame - edited.range.startFrame;
      // end frame is exclusive global end of scene; op.end.frame is the new exclusive end
      // when scene starts at edited.range.startFrame, length should equal end - start
      const expectedLen = op.end.frame - edited.range.startFrame;
      if (len !== expectedLen && op.end.frame === edited.range.endFrame) {
        // lengths match via end frame equality — ok
      } else if (edited.range.endFrame !== op.end.frame) {
        violations.push({
          code: "scene_end_mismatch",
          message: `scene end ${edited.range.endFrame} !== requested ${op.end.frame}`,
        });
      }
      if (len < 1) {
        violations.push({
          code: "empty_scene",
          message: "scene range must be at least one frame",
        });
      }
    }

    // No empty or inverted ranges
    for (const s of after.scenes) {
      if (s.range.endFrame <= s.range.startFrame) {
        violations.push({
          code: "empty_or_inverted",
          message: `scene "${s.id}" has empty/inverted range`,
        });
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Phase rebalance: allow phase/timing categories; forbid canvas/fps changes.
 * Scene duration should stay the same (zero-sum).
 */
export function validatePhaseBoundaryEffectPolicy(
  op: Extract<MediaEditCommand, { kind: "set-phase-boundary" }>,
  diff: MediaIRDiff,
  before?: MediaIR,
  after?: MediaIR,
): EffectPolicyResult {
  const violations: EffectPolicyResult["violations"] = [];
  const forbidden = new Set([
    "canvas",
    "fps",
    "audio",
    "asset",
  ]);
  for (const cat of collectCategories(diff)) {
    if (forbidden.has(cat)) {
      violations.push({
        code: "forbidden_category",
        message: `set-phase-boundary must not change category "${cat}"`,
        category: cat,
      });
    }
  }
  if (before && after) {
    if (before.clock.fps !== after.clock.fps) {
      violations.push({
        code: "fps_changed",
        message: "set-phase-boundary must not change FPS",
      });
    }
    if (before.clock.totalFrames !== after.clock.totalFrames) {
      violations.push({
        code: "duration_changed",
        message: "set-phase-boundary must keep program duration (zero-sum)",
      });
    }
    const bScene = before.scenes.find((s) => s.id === op.target.sceneId);
    const aScene = after.scenes.find((s) => s.id === op.target.sceneId);
    if (bScene && aScene) {
      const bLen = bScene.range.endFrame - bScene.range.startFrame;
      const aLen = aScene.range.endFrame - aScene.range.startFrame;
      if (bLen !== aLen) {
        violations.push({
          code: "scene_duration_changed",
          message: "set-phase-boundary must keep scene duration",
        });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/** A retained still hold may ripple its selected schedule, but not alter the canvas, FPS, or assets. */
export function validateCompositionHoldEffectPolicy(
  _op: Extract<MediaEditCommand, { kind: "set-composition-hold" }>,
  diff: MediaIRDiff,
  before?: MediaIR,
  after?: MediaIR,
): EffectPolicyResult {
  const violations: EffectPolicyResult["violations"] = [];
  for (const category of collectCategories(diff)) {
    if (TEMPORAL_FORBIDDEN.has(category)) {
      violations.push({
        code: "forbidden_category",
        message: `set-composition-hold must not change category "${category}"`,
        category,
      });
    }
  }
  if (before && after) {
    if (before.clock.fps !== after.clock.fps) {
      violations.push({ code: "fps_changed", message: "set-composition-hold must not change FPS" });
    }
    if (before.canvas.width !== after.canvas.width || before.canvas.height !== after.canvas.height) {
      violations.push({ code: "canvas_changed", message: "set-composition-hold must not change canvas size" });
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Placement may move its audio track, but cannot alter the program clock or unrelated tracks. */
function validateAudioPlacement(op: Extract<MediaEditCommand, { kind: "set-audio-clip-placement" }>, diff: MediaIRDiff, before?: MediaIR, after?: MediaIR): EffectPolicyResult {
  const violations: EffectPolicyResult["violations"] = [];
  const allowed = new Set(["audio", "program", "intent", "opaque-markup"]);
  for (const category of collectCategories(diff)) if (!allowed.has(category)) violations.push({ code: "forbidden_category", message: `audio placement changed ${category}`, category });
  if (!before || !after) violations.push({ code: "missing_media", message: "audio placement requires before and after IR" });
  else {
    const id = `audio::${op.target.clipId}`;
    const b = before.tracks.filter((track) => track.id === id && track.kind === "audio");
    const a = after.tracks.filter((track) => track.id === id && track.kind === "audio");
    if (b.length !== 1 || a.length !== 1 || a[0]?.meta?.startSeconds !== op.value.atSeconds || op.value.atSeconds >= after.clock.durationSeconds) violations.push({ code: "placement_mismatch", message: "resolved audio placement does not match requested seconds" });
    if (b[0] && a[0]) {
      const stable = (track: MediaIR["tracks"][number]) => {
        const { startSeconds, endSeconds, ...meta } = track.meta ?? {};
        return { role: track.role, src: track.src, label: track.label, meta, duration: typeof startSeconds === "number" && typeof endSeconds === "number" ? endSeconds - startSeconds : null };
      };
      const x = stable(b[0]);
      const y = stable(a[0]);
      if (x.duration === null || y.duration === null || Math.abs(x.duration - y.duration) > 1e-9 || JSON.stringify({ ...x, duration: 0 }) !== JSON.stringify({ ...y, duration: 0 })) violations.push({ code: "clip_changed", message: "audio placement changed clip source, mix, or duration" });
    }
    if (JSON.stringify(before.tracks.filter((track) => track.id !== id)) !== JSON.stringify(after.tracks.filter((track) => track.id !== id))) violations.push({ code: "other_tracks_changed", message: "audio placement changed another track" });
  }
  return { ok: violations.length === 0, violations };
}

/** Dispatch effect policy for any P0 operation; throws EditError on failure. */
export function assertEffectPolicy(
  op: MediaEditCommand,
  diff: MediaIRDiff,
  ctx?: {
    before?: MediaIR;
    after?: MediaIR;
    expectedRanges?: MediaIRFrameRange[];
  },
): void {
  const result =
    op.kind === "set-audio-clip-placement" ? validateAudioPlacement(op, diff, ctx?.before, ctx?.after) :
    op.kind === "set-node-transform" || op.kind === "set-node-text" || op.kind === "set-node-property"
      ? validateSpatialEffectPolicy(op, diff, {
          ...(ctx?.expectedRanges !== undefined
            ? { expectedRanges: ctx.expectedRanges }
            : {}),
        })
      : op.kind === "set-phase-boundary"
        ? validatePhaseBoundaryEffectPolicy(
            op,
            diff,
            ctx?.before,
            ctx?.after,
          )
        : op.kind === "set-composition-hold"
          ? validateCompositionHoldEffectPolicy(op, diff, ctx?.before, ctx?.after)
          : validateTemporalEffectPolicy(op, diff, ctx?.before, ctx?.after);

  if (!result.ok) {
    throw new EditError(
      "effect_policy",
      result.violations.map((v) => v.message).join("; "),
      { violations: result.violations },
    );
  }
}
