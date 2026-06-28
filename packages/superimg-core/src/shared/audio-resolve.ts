//! Resolve AudioValue → placement-ready clips for mix + timeline model

import type {
  AudioClip,
  AudioMixOptions,
  AudioRole,
  AudioTimeline,
  AudioValue,
  ResolvedAudioClip,
  ResolvedAudioMix,
  ResolvedAudioTimeline,
  ResolvedScene,
  TranscriptWord,
} from "@superimg/types";
import { parseDuration } from "./utils.js";

export interface SceneBoundary {
  id: string;
  startSeconds: number;
  endSeconds: number;
}

export interface ResolveAudioContext {
  fps: number;
  videoDurationSeconds: number;
  scenes?: SceneBoundary[];
}

const ROLE_DEFAULTS: Record<AudioRole, { volume: number; loop: boolean }> = {
  music: { volume: 0.35, loop: true },
  voice: { volume: 1, loop: false },
  sfx: { volume: 0.8, loop: false },
  ambient: { volume: 0.5, loop: true },
};

const ROLE_PATTERNS: Array<{ role: AudioRole; pattern: RegExp }> = [
  { role: "voice", pattern: /vo|voice|narrat|speech|dialog/i },
  { role: "sfx", pattern: /sfx|effect|foley|hit|whoosh/i },
  { role: "ambient", pattern: /ambient|atmo|room/i },
  { role: "music", pattern: /music|bed|bgm|score|lofi/i },
];

export function normalizeAudioInput(value: AudioValue): AudioTimeline {
  if (Array.isArray(value)) {
    return { clips: value };
  }
  if ("clips" in value) {
    return value;
  }
  return { clips: [value] };
}

export function ensureClipIds(clips: AudioClip[]): { clips: AudioClip[]; warnings: string[] } {
  const warnings: string[] = [];
  const result = clips.map((clip, index) => {
    if (clip.id) return clip;
    const id = `${clip.role ?? "clip"}-${index}`;
    warnings.push(
      `Clip at index ${index} has no id — set id for editor round-trip (auto: "${id}")`,
    );
    return { ...clip, id };
  });
  return { clips: result, warnings };
}

export function inferAudioRole(clip: AudioClip): AudioRole {
  if (clip.role) return clip.role;
  const basename = clip.src.split(/[/\\]/).pop() ?? clip.src;
  for (const { role, pattern } of ROLE_PATTERNS) {
    if (pattern.test(basename)) return role;
  }
  return "music";
}

function parseClipDuration(
  d: string | number | undefined,
  fieldName: string,
  fps: number,
  fallback?: number,
): number | undefined {
  if (d === undefined) return fallback;
  return parseDuration(d, fieldName, fps);
}

function offsetTranscript(
  words: TranscriptWord[],
  offsetSeconds: number,
): TranscriptWord[] {
  return words.map((w) => ({
    ...w,
    start: w.start + offsetSeconds,
    end: w.end + offsetSeconds,
  }));
}

function resolveAtSeconds(
  clip: AudioClip,
  scenes: SceneBoundary[] | undefined,
  fps: number,
): number {
  if (clip.at !== undefined) {
    return parseDuration(clip.at, `clip "${clip.id}".at`, fps);
  }
  if (clip.atScene) {
    const scene = scenes?.find((s) => s.id === clip.atScene);
    if (!scene) {
      throw new Error(
        `Audio clip "${clip.id}" references unknown atScene "${clip.atScene}"`,
      );
    }
    return scene.startSeconds;
  }
  return 0;
}

function assertRenderableSource(clip: AudioClip): void {
  const source = clip.source;
  if (!source || source.kind === "file") return;
  throw new Error(
    `Clip "${clip.id}" uses source.kind "${source.kind}". ` +
      `Run speech synthesis or set src to a local file. ` +
      `(Speech integration not yet available.)`,
  );
}

export function resolveAudioTimeline(
  input: AudioValue | undefined,
  ctx: ResolveAudioContext,
): ResolvedAudioTimeline | null {
  if (!input) return null;

  const timeline = normalizeAudioInput(input);
  const { clips: idClips, warnings } = ensureClipIds(timeline.clips);
  for (const w of warnings) {
    console.warn(`[audio] ${w}`);
  }

  const mix = resolveMix(timeline.mix);
  const resolved: ResolvedAudioClip[] = [];

  for (const clip of idClips) {
    assertRenderableSource(clip);
    const role = inferAudioRole(clip);
    const defaults = ROLE_DEFAULTS[role];
    const atSeconds = resolveAtSeconds(clip, ctx.scenes, ctx.fps);
    const trimInSeconds = parseClipDuration(clip.trim?.in, `clip "${clip.id}".trim.in`, ctx.fps, 0) ?? 0;
    const trimOutSeconds = parseClipDuration(
      clip.trim?.out,
      `clip "${clip.id}".trim.out`,
      ctx.fps,
    ) ?? null;

    const placementDurationSeconds =
      parseClipDuration(clip.duration, `clip "${clip.id}".duration`, ctx.fps) ??
      ctx.videoDurationSeconds - atSeconds;

    const fadeInSeconds =
      parseClipDuration(clip.fadeIn, `clip "${clip.id}".fadeIn`, ctx.fps, 0) ?? 0;
    const fadeOutSeconds =
      parseClipDuration(clip.fadeOut, `clip "${clip.id}".fadeOut`, ctx.fps, 0) ?? 0;

    resolved.push({
      id: clip.id!,
      ...(clip.label !== undefined ? { label: clip.label } : {}),
      showInTimeline: clip.showInTimeline ?? true,
      src: clip.src,
      role,
      atSeconds,
      placementDurationSeconds: Math.max(0, placementDurationSeconds),
      trimInSeconds,
      trimOutSeconds,
      loop: clip.loop ?? defaults.loop,
      volume: clip.volume ?? defaults.volume,
      fadeInSeconds,
      fadeOutSeconds,
      ...(clip.transcript
        ? { transcript: offsetTranscript(clip.transcript, atSeconds) }
        : {}),
    });
  }

  return {
    clips: resolved,
    mix,
    videoDurationSeconds: ctx.videoDurationSeconds,
  };
}

function resolveMix(options?: AudioMixOptions): ResolvedAudioMix {
  return {
    master: options?.master ?? 1,
    ducking: options?.ducking ?? true,
    duckingLevel: options?.duckingLevel ?? 0.25,
    duckingAttack: options?.duckingAttack ?? 0.15,
    duckingRelease: options?.duckingRelease ?? 0.3,
  };
}

export function sceneBoundariesFromResolved(
  scenes: readonly ResolvedScene[],
  fps: number,
): SceneBoundary[] {
  return scenes.map((s) => ({
    id: s.id,
    startSeconds: s.startFrame / fps,
    endSeconds: s.endFrame / fps,
  }));
}