//! Lift authored child audio onto a retained composition's root clock.

import type { AudioClip, AudioMixOptions, AudioTimeline, AudioValue } from "@superimg/types";
import { normalizeAudioInput } from "../shared/audio-resolve.js";
import { parseDuration } from "../shared/utils.js";
import type { CompositionPlan, PlannedLeaf } from "./plan.js";

function fail(message: string): never {
  throw new TypeError(`composition: ${message}`);
}

function authoredEndFrame(leaf: PlannedLeaf): number {
  return leaf.contentEndFrame ?? leaf.endFrame;
}

function authoredDurationSeconds(leaf: PlannedLeaf, fps: number): number {
  const frames = authoredEndFrame(leaf) - leaf.startFrame;
  if (!Number.isSafeInteger(frames) || frames <= 0) {
    fail(`${leaf.path}: audio requires a positive authored leaf duration`);
  }
  // Mixed-fps output may round the visual interval up by one output frame.
  // Audio retains the child's exact authored duration.
  const authored = leaf.content.config?.duration;
  return leaf.fps && authored !== undefined
    ? Math.min(parseDuration(authored, `${leaf.path}.duration`, leaf.fps), frames / fps)
    : frames / fps;
}

function clipName(clip: AudioClip, index: number): string {
  return clip.id && clip.id.length > 0 ? clip.id : `clip-${index}`;
}

function assertPortableSource(clip: AudioClip, leaf: PlannedLeaf, index: number): void {
  // A child module's relative path is meaningful only beside that module. The
  // retained root can be compiled elsewhere, so it must not inherit that
  // hidden import location.
  if (/^(?:data:|https?:|file:)/i.test(clip.src) || clip.src.startsWith("/") || /^[A-Za-z]:[\\/]/.test(clip.src)) {
    return;
  }
  fail(`${leaf.path}: audio clip "${clipName(clip, index)}" has a relative src; pass it through prepareComposition with an explicit sourceBase for this occurrence, or use data:, HTTP(S), or an absolute file path`);
}

function localAtSeconds(clip: AudioClip, leaf: PlannedLeaf, index: number, fps: number): number {
  if (clip.atScene !== undefined) {
    fail(`${leaf.path}: audio clip "${clipName(clip, index)}" uses atScene; child scene references cannot be lifted to the root clock`);
  }
  if (clip.at === undefined) return 0;
  const seconds = parseDuration(clip.at, `${leaf.path}.audio[${index}].at`, fps);
  if (!Number.isFinite(seconds) || seconds < 0) {
    fail(`${leaf.path}: audio clip "${clipName(clip, index)}" has an invalid at`);
  }
  return seconds;
}

function canonicalMix(mix: AudioMixOptions): AudioMixOptions {
  return Object.fromEntries(
    Object.entries(mix).filter(([, value]) => value !== undefined),
  ) as AudioMixOptions;
}

function mixesMatch(left: AudioMixOptions, right: AudioMixOptions): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => right[key as keyof AudioMixOptions] === value);
}

/**
 * Lift selected child audio onto the root composition clock.
 *
 * Every clip receives an occurrence-qualified id and an absolute `at`. Its
 * placement duration is clamped to the authored child interval, excluding a
 * parent `together({ end: "hold" })` extension. Concurrent leaves therefore
 * mix naturally when they share a start frame.
 *
 * Child timelines may declare mix options only when every declaration is
 * identical after undefined fields are removed. Child `atScene` is rejected:
 * a retained child has no root scene namespace to resolve it against.
 */
export function liftCompositionAudio(
  plan: CompositionPlan,
  rootAudio?: AudioValue,
): AudioTimeline | undefined {
  if (!Number.isSafeInteger(plan.fps) || plan.fps <= 0) {
    fail("audio requires a positive integer plan fps");
  }

  const clips: AudioClip[] = [];
  let declaredMix: AudioMixOptions | undefined;

  if (rootAudio !== undefined) {
    const rootTimeline = normalizeAudioInput(rootAudio);
    if (rootTimeline.mix !== undefined) {
      declaredMix = canonicalMix(rootTimeline.mix);
    }
    const leafByPath = new Map(plan.leaves.map((leaf) => [leaf.path, leaf]));
    for (const [index, clip] of rootTimeline.clips.entries()) {
      let placedAt: number | undefined;
      if (clip.atScene !== undefined) {
        const target = leafByPath.get(clip.atScene);
        if (!target) {
          fail(`audio clip "${clipName(clip, index)}" references unknown scene "${clip.atScene}"`);
        }
        const offset =
          clip.at === undefined
            ? 0
            : parseDuration(clip.at, `audio[${index}].at`, plan.fps);
        if (!Number.isFinite(offset) || offset < 0) {
          fail(`audio clip "${clipName(clip, index)}" has an invalid at`);
        }
        placedAt = target.startFrame / plan.fps + offset;
      }
      const { atScene: _atScene, ...preserved } = clip;
      clips.push({
        ...preserved,
        ...(placedAt !== undefined ? { at: placedAt } : {}),
      });
    }
  }

  for (const leaf of plan.leaves) {
    const audio = leaf.content.config?.audio;
    if (audio === undefined) continue;

    const timeline = normalizeAudioInput(audio);
    if (timeline.mix !== undefined) {
      const mix = canonicalMix(timeline.mix);
      if (declaredMix !== undefined && !mixesMatch(declaredMix, mix)) {
        fail(`${leaf.path}: child audio mix conflicts with another selected child`);
      }
      declaredMix ??= mix;
    }

    const leafDuration = authoredDurationSeconds(leaf, plan.fps);
    const leafStart = leaf.startFrame / plan.fps;
    const leafTrimIn = leaf.trimInFrames !== undefined ? leaf.trimInFrames / (leaf.fps ?? plan.fps) : 0;
    for (const [index, clip] of timeline.clips.entries()) {
      assertPortableSource(clip, leaf, index);
      const childFps = leaf.fps ?? plan.fps;
      const localAt = localAtSeconds(clip, leaf, index, childFps);
      if (leafTrimIn === 0 && localAt >= leafDuration) {
        fail(`${leaf.path}: audio clip "${clipName(clip, index)}" starts outside its authored leaf duration`);
      }
      const requestedDuration = clip.duration === undefined
        ? Math.max(0, leafDuration - Math.max(0, localAt - leafTrimIn))
        : parseDuration(clip.duration, `${leaf.path}.audio[${index}].duration`, childFps);
      if (!Number.isFinite(requestedDuration) || requestedDuration < 0) {
        fail(`${leaf.path}: audio clip "${clipName(clip, index)}" has an invalid duration`);
      }
      const shiftedAt = localAt - leafTrimIn;
      const clipSkip = shiftedAt < 0 ? -shiftedAt : 0;
      const placedLocalAt = Math.max(0, shiftedAt);
      const remainingFromClip = requestedDuration - clipSkip;
      if (leafTrimIn > 0 && (placedLocalAt >= leafDuration || remainingFromClip <= 0)) {
        continue;
      }
      const existingTrimIn =
        clip.trim?.in === undefined
          ? 0
          : parseDuration(clip.trim.in, `${leaf.path}.audio[${index}].trim.in`, childFps);
      const nextTrim =
        clipSkip > 0
          ? { ...(clip.trim ?? {}), in: existingTrimIn + clipSkip }
          : clip.trim;
      const { at: _at, atScene: _atScene, duration: _duration, trim: _trim, ...preserved } = clip;
      clips.push({
        ...preserved,
        ...(nextTrim !== undefined ? { trim: nextTrim } : {}),
        id: `${leaf.path}/${clipName(clip, index)}`,
        at: leafStart + placedLocalAt,
        duration: Math.min(remainingFromClip, leafDuration - placedLocalAt),
      });
    }
  }

  if (clips.length === 0) return undefined;
  return Object.freeze({
    clips,
    ...(declaredMix !== undefined ? { mix: Object.freeze({ ...declaredMix }) } : {}),
  });
}
