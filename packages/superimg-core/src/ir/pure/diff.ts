//! Cross-revision MediaIR diff.

import type {
  MediaIRDiff,
  MediaIRDiffChange,
  MediaIRFrameRange,
  MediaIR,
  JsonValue,
} from "@superimg/types";
import { mergeRanges } from "./ranges.js";
import { canonicalize, canonicalizeToJson } from "./canonicalize.js";

function rangeAll(ir: MediaIR): MediaIRFrameRange {
  return { startFrame: 0, endFrame: ir.clock.totalFrames };
}

function pushChange(
  changes: MediaIRDiffChange[],
  change: Omit<MediaIRDiffChange, "before" | "after"> & {
    before?: unknown;
    after?: unknown;
  },
): void {
  const { before, after, ...required } = change;
  changes.push({
    ...required,
    ...(before !== undefined
      ? { before: canonicalize(before) as JsonValue }
      : {}),
    ...(after !== undefined
      ? { after: canonicalize(after) as JsonValue }
      : {}),
  });
}

function trackCategory(
  kind: MediaIR["tracks"][number]["kind"],
): MediaIRDiffChange["category"] {
  if (kind === "audio") return "audio";
  if (kind === "markers") return "marker";
  return "track";
}

export function diffMediaIR(before: MediaIR, after: MediaIR): MediaIRDiff {
  const changes: MediaIRDiffChange[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  if (
    canonicalizeToJson(before.identity) !== canonicalizeToJson(after.identity)
  ) {
    pushChange(changes, {
      id: "identity",
      category: "intent",
      confidence: "canonical",
      message: "media coordinates changed",
      before: before.identity,
      after: after.identity,
      affected: [rangeAll(after)],
      pixelVerificationRequired: false,
    });
    modified.push("identity");
  }

  if (
    before.medium !== after.medium ||
    before.animated !== after.animated
  ) {
    pushChange(changes, {
      id: "media-kind",
      category: "intent",
      confidence: "canonical",
      message: `media kind ${before.medium}/${before.animated ? "animated" : "static"} → ${after.medium}/${after.animated ? "animated" : "static"}`,
      before: { medium: before.medium, animated: before.animated },
      after: { medium: after.medium, animated: after.animated },
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("media-kind");
  }

  const beforeIntentCapabilities = {
    temporal: before.capabilities.temporal,
    motion: before.capabilities.motion,
    visual: before.capabilities.visual,
    portability: before.capabilities.portability,
  };
  const afterIntentCapabilities = {
    temporal: after.capabilities.temporal,
    motion: after.capabilities.motion,
    visual: after.capabilities.visual,
    portability: after.capabilities.portability,
  };
  if (
    canonicalizeToJson(beforeIntentCapabilities) !==
    canonicalizeToJson(afterIntentCapabilities)
  ) {
    pushChange(changes, {
      id: "capabilities",
      category: "intent",
      confidence: "canonical",
      message: "IR capability classification changed",
      before: beforeIntentCapabilities,
      after: afterIntentCapabilities,
      affected: [rangeAll(after)],
      pixelVerificationRequired: false,
    });
    modified.push("capabilities");
  }

  if (before.canvas.width !== after.canvas.width || before.canvas.height !== after.canvas.height) {
    pushChange(changes, {
      id: "canvas",
      category: "canvas",
      confidence: "canonical",
      message: `canvas ${before.canvas.width}x${before.canvas.height} → ${after.canvas.width}x${after.canvas.height}`,
      before: before.canvas,
      after: after.canvas,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("canvas");
  }

  if (
    canonicalizeToJson(before.renderConfig) !==
    canonicalizeToJson(after.renderConfig)
  ) {
    pushChange(changes, {
      id: "render-config",
      category: "render-config",
      confidence: "canonical",
      message: "render-affecting configuration changed",
      before: before.renderConfig,
      after: after.renderConfig,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("render-config");
  }

  if (before.clock.durationSeconds !== after.clock.durationSeconds) {
    pushChange(changes, {
      id: "duration",
      category: "duration",
      confidence: "canonical",
      message: `durationSeconds ${before.clock.durationSeconds} → ${after.clock.durationSeconds}`,
      before: before.clock.durationSeconds,
      after: after.clock.durationSeconds,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("duration");
  }

  if (before.clock.fps !== after.clock.fps) {
    pushChange(changes, {
      id: "fps",
      category: "fps",
      confidence: "canonical",
      message: `fps ${before.clock.fps} → ${after.clock.fps}`,
      before: before.clock.fps,
      after: after.clock.fps,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("fps");
  }
  if (
    before.clock.totalFrames !== after.clock.totalFrames &&
    before.clock.durationSeconds === after.clock.durationSeconds &&
    before.clock.fps === after.clock.fps
  ) {
    pushChange(changes, {
      id: "total-frames",
      category: "duration",
      confidence: "canonical",
      message: `totalFrames ${before.clock.totalFrames} → ${after.clock.totalFrames}`,
      before: before.clock.totalFrames,
      after: after.clock.totalFrames,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("total-frames");
  }

  // Scenes
  const bScenes = new Map(before.scenes.map((s) => [s.id, s]));
  const aScenes = new Map(after.scenes.map((s) => [s.id, s]));
  for (const id of aScenes.keys()) {
    if (!bScenes.has(id)) {
      added.push(`scene:${id}`);
      const s = aScenes.get(id)!;
      pushChange(changes, {
        id: `scene/${id}`,
        category: "scene",
        confidence: "canonical",
        message: `scene added: ${id}`,
        after: s.range,
        affected: [s.range],
        pixelVerificationRequired: true,
      });
    }
  }
  for (const id of bScenes.keys()) {
    if (!aScenes.has(id)) {
      removed.push(`scene:${id}`);
      const s = bScenes.get(id)!;
      pushChange(changes, {
        id: `scene/${id}`,
        category: "scene",
        confidence: "canonical",
        message: `scene removed: ${id}`,
        before: s.range,
        affected: [s.range],
        pixelVerificationRequired: true,
      });
    }
  }
  for (const [id, a] of aScenes) {
    const b = bScenes.get(id);
    if (!b) continue;
    if (b.range.startFrame !== a.range.startFrame || b.range.endFrame !== a.range.endFrame) {
      modified.push(`scene:${id}`);
      pushChange(changes, {
        id: `scene/${id}`,
        category: "scene",
        confidence: "canonical",
        message: `scene/${id}: endFrame ${b.range.endFrame} → ${a.range.endFrame}`,
        before: b.range,
        after: a.range,
        affected: [mergeRanges([b.range, a.range])[0]!],
        pixelVerificationRequired: true,
      });
    }
    if (canonicalizeToJson(b.phases) !== canonicalizeToJson(a.phases)) {
      modified.push(`phase:${id}`);
      pushChange(changes, {
        id: `phase/${id}`,
        category: "phase",
        confidence: "canonical",
        message: `phases changed in scene ${id}`,
        before: b.phases,
        after: a.phases,
        affected: [a.range],
        pixelVerificationRequired: false,
      });
    }
    const beforeSceneMetadata = {
      label: b.label ?? null,
      index: b.index,
      transitions: b.transitions,
    };
    const afterSceneMetadata = {
      label: a.label ?? null,
      index: a.index,
      transitions: a.transitions,
    };
    if (
      canonicalizeToJson(beforeSceneMetadata) !==
      canonicalizeToJson(afterSceneMetadata)
    ) {
      modified.push(`scene-meta:${id}`);
      pushChange(changes, {
        id: `scene-meta/${id}`,
        category: "scene",
        confidence: "canonical",
        message: `scene metadata/transitions changed: ${id}`,
        before: beforeSceneMetadata,
        after: afterSceneMetadata,
        affected: mergeRanges([b.range, a.range]),
        pixelVerificationRequired: true,
      });
    }
  }

  // Motions
  const bMot = new Map(before.motions.map((m) => [m.id, m]));
  const aMot = new Map(after.motions.map((m) => [m.id, m]));
  for (const id of aMot.keys()) {
    if (!bMot.has(id)) {
      added.push(`motion:${id}`);
      const m = aMot.get(id)!;
      pushChange(changes, {
        id: `motion/${id}`,
        category: "motion",
        confidence: m.kind === "sampled" ? "sampled" : "canonical",
        message: `motion added: ${id}`,
        after: m,
        affected: [m.enter, ...(m.exit ? [m.exit] : [])],
        pixelVerificationRequired: true,
      });
    }
  }
  for (const id of bMot.keys()) {
    if (!aMot.has(id)) {
      removed.push(`motion:${id}`);
      const m = bMot.get(id)!;
      pushChange(changes, {
        id: `motion/${id}`,
        category: "motion",
        confidence: "canonical",
        message: `motion removed: ${id}`,
        before: m,
        affected: [m.enter, ...(m.exit ? [m.exit] : [])],
        pixelVerificationRequired: true,
      });
    }
  }
  for (const [id, a] of aMot) {
    const b = bMot.get(id);
    if (!b) continue;
    if (canonicalizeToJson(b) !== canonicalizeToJson(a)) {
      modified.push(`motion:${id}`);
      pushChange(changes, {
        id: `motion/${id}`,
        category: "motion",
        confidence: a.kind === "sampled" ? "sampled" : "canonical",
        message: `motion changed: ${id}`,
        before: b,
        after: a,
        affected: mergeRanges([
          b.enter,
          a.enter,
          ...(b.exit ? [b.exit] : []),
          ...(a.exit ? [a.exit] : []),
        ]),
        pixelVerificationRequired: true,
      });
    }
  }

  // Tracks (included in intentHash — must appear in diff)
  const bTracks = new Map(before.tracks.map((t) => [t.id, t]));
  const aTracks = new Map(after.tracks.map((t) => [t.id, t]));
  for (const id of aTracks.keys()) {
    if (!bTracks.has(id)) {
      added.push(`track:${id}`);
      const t = aTracks.get(id)!;
      pushChange(changes, {
        id: `track/${id}`,
        category: trackCategory(t.kind),
        confidence: "canonical",
        message: `track added: ${id}`,
        after: t.range,
        affected: [t.range],
        pixelVerificationRequired: false,
      });
    }
  }
  for (const id of bTracks.keys()) {
    if (!aTracks.has(id)) {
      removed.push(`track:${id}`);
      const t = bTracks.get(id)!;
      pushChange(changes, {
        id: `track/${id}`,
        category: trackCategory(t.kind),
        confidence: "canonical",
        message: `track removed: ${id}`,
        before: t.range,
        affected: [t.range],
        pixelVerificationRequired: false,
      });
    }
  }
  for (const [id, a] of aTracks) {
    const b = bTracks.get(id);
    if (!b) continue;
    if (canonicalizeToJson(b) !== canonicalizeToJson(a)) {
      modified.push(`track:${id}`);
      pushChange(changes, {
        id: `track/${id}`,
        category: trackCategory(a.kind),
        confidence: "canonical",
        message: `track changed: ${id}`,
        before: b,
        after: a,
        affected: mergeRanges([b.range, a.range]),
        pixelVerificationRequired: false,
      });
    }
  }

  // Markers on scenes
  for (const aScene of after.scenes) {
    const bScene = before.scenes.find((s) => s.id === aScene.id);
    if (!bScene) continue;
    if (canonicalizeToJson(bScene.markers) !== canonicalizeToJson(aScene.markers)) {
      modified.push(`marker:${aScene.id}`);
      pushChange(changes, {
        id: `marker/${aScene.id}`,
        category: "marker",
        confidence: "canonical",
        message: `markers changed in scene ${aScene.id}`,
        before: bScene.markers,
        after: aScene.markers,
        affected: [aScene.range],
        pixelVerificationRequired: false,
      });
    }
  }

  // Assets
  const bAssets = new Map(before.assets.map((a) => [a.id, a]));
  const aAssets = new Map(after.assets.map((a) => [a.id, a]));
  for (const id of aAssets.keys()) {
    if (!bAssets.has(id)) {
      added.push(`asset:${id}`);
      pushChange(changes, {
        id: `asset/${id}`,
        category: "asset",
        confidence: "canonical",
        message: `asset added: ${id}`,
        after: aAssets.get(id),
        affected: [rangeAll(after)],
        pixelVerificationRequired: true,
      });
    } else if (canonicalizeToJson(bAssets.get(id)) !== canonicalizeToJson(aAssets.get(id))) {
      modified.push(`asset:${id}`);
      pushChange(changes, {
        id: `asset/${id}`,
        category: "asset",
        confidence: "canonical",
        message: `asset changed: ${id}`,
        before: bAssets.get(id),
        after: aAssets.get(id),
        affected: [rangeAll(after)],
        pixelVerificationRequired: true,
      });
    }
  }
  for (const id of bAssets.keys()) {
    if (!aAssets.has(id)) {
      removed.push(`asset:${id}`);
      pushChange(changes, {
        id: `asset/${id}`,
        category: "asset",
        confidence: "canonical",
        message: `asset removed: ${id}`,
        before: bAssets.get(id),
        affected: [rangeAll(before)],
        pixelVerificationRequired: true,
      });
    }
  }

  // Opaque markup runs
  if (before.hashes.markupHash !== after.hashes.markupHash) {
    const affected = diffHashRuns(before.observations.markupRuns, after.observations.markupRuns);
    pushChange(changes, {
      id: "opaque-markup",
      category: "opaque-markup",
      confidence: "opaque",
      message: `opaque markup changed: ${formatRanges(affected)}`,
      before: before.hashes.markupHash,
      after: after.hashes.markupHash,
      affected,
      pixelVerificationRequired: true,
    });
    modified.push("opaque-markup");
  }

  // Program-only
  const intentSame = before.hashes.intentHash === after.hashes.intentHash;
  const markupSame = before.hashes.markupHash === after.hashes.markupHash;
  const programSame = before.hashes.programHash === after.hashes.programHash;

  if (changes.length === 0 && !intentSame) {
    pushChange(changes, {
      id: "intent",
      category: "intent",
      confidence: "opaque",
      message: "intentHash changed in an unclassified field",
      before: before.hashes.intentHash,
      after: after.hashes.intentHash,
      affected: [rangeAll(after)],
      pixelVerificationRequired: true,
    });
    modified.push("intent");
  }

  if (intentSame && markupSame && !programSame) {
    pushChange(changes, {
      id: "program",
      category: "program",
      confidence: "canonical",
      message: "programHash changed (source-only refactor)",
      before: before.hashes.programHash,
      after: after.hashes.programHash,
      affected: [],
      pixelVerificationRequired: false,
    });
  }

  const mediaChanges = changes.filter((c) => c.category !== "program");
  const affectedFrames = mergeRanges(mediaChanges.flatMap((c) => c.affected));
  const pixelVerificationRequired = mediaChanges.some((c) => c.pixelVerificationRequired);

  let result: MediaIRDiff["result"] = "unchanged";
  let sourceOnly = false;
  if (mediaChanges.length === 0 && !programSame) {
    result = "sourceOnly";
    sourceOnly = true;
  } else if (mediaChanges.length === 0 && programSame) {
    result = "unchanged";
  } else {
    result = "mediaAffecting";
  }

  return {
    schemaVersion: 0,
    result,
    sourceOnly,
    pixelVerificationRequired,
    changes,
    affectedFrames,
    identity: { added, removed, modified },
  };
}

function formatRanges(ranges: MediaIRFrameRange[]): string {
  return ranges.map((r) => `[${r.startFrame}, ${r.endFrame})`).join(", ");
}

function expandRuns(
  runs: MediaIR["observations"]["markupRuns"],
): Map<number, string> {
  const m = new Map<number, string>();
  for (const run of runs) {
    for (let f = run.range.startFrame; f < run.range.endFrame; f++) {
      m.set(f, run.hash);
    }
  }
  return m;
}

function diffHashRuns(
  before: MediaIR["observations"]["markupRuns"],
  after: MediaIR["observations"]["markupRuns"],
): MediaIRFrameRange[] {
  const b = expandRuns(before);
  const a = expandRuns(after);
  const frames = new Set<number>([...b.keys(), ...a.keys()]);
  const changed: number[] = [];
  for (const f of frames) {
    if (b.get(f) !== a.get(f)) changed.push(f);
  }
  changed.sort((x, y) => x - y);
  if (changed.length === 0) {
    // hashes differ but runs empty — whole timeline opaque
    const max = Math.max(
      ...before.map((r) => r.range.endFrame),
      ...after.map((r) => r.range.endFrame),
      1,
    );
    return [{ startFrame: 0, endFrame: max }];
  }
  const ranges: MediaIRFrameRange[] = [];
  let start = changed[0]!;
  let prev = start;
  for (let i = 1; i < changed.length; i++) {
    const f = changed[i]!;
    if (f === prev + 1) {
      prev = f;
    } else {
      ranges.push({ startFrame: start, endFrame: prev + 1 });
      start = f;
      prev = f;
    }
  }
  ranges.push({ startFrame: start, endFrame: prev + 1 });
  return mergeRanges(ranges);
}
