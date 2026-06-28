//! Shared audio DSP — resample, duck, mix to stereo output

import type { ResolvedAudioClip, ResolvedAudioMix } from "@superimg/types";

export const TARGET_SAMPLE_RATE = 48_000;
export const TARGET_CHANNELS = 2;

export interface DecodedAudioClip {
  channels: Float32Array[];
  sampleRate: number;
  sourceDurationSeconds: number;
}

export interface MixClipInput {
  decoded: DecodedAudioClip;
  resolved: ResolvedAudioClip;
}

/** Linear resample mono/stereo planar channels to target rate */
export function resampleChannels(
  channels: Float32Array[],
  sourceRate: number,
  targetRate: number,
): Float32Array[] {
  if (sourceRate === targetRate) return channels;
  const ratio = targetRate / sourceRate;
  const first = channels[0];
  if (!first) return channels;
  const outLen = Math.max(1, Math.ceil(first.length * ratio));
  return channels.map((ch) => {
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcPos = i / ratio;
      const idx = Math.min(Math.floor(srcPos), ch.length - 1);
      const frac = srcPos - idx;
      const a = ch[idx] ?? 0;
      const b = ch[Math.min(idx + 1, ch.length - 1)] ?? a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  });
}

/** Up/down-mix to stereo planar */
export function toStereo(channels: Float32Array[]): [Float32Array, Float32Array] {
  if (channels.length === 0) {
    return [new Float32Array(0), new Float32Array(0)];
  }
  if (channels.length === 1) {
    const m = channels[0]!;
    return [m, m];
  }
  const left = channels[0]!;
  const right = channels[1] ?? channels[0]!;
  return [left, right];
}

/** A clip resampled to the mix rate, with its effective audible window precomputed. */
interface PreparedClip {
  resolved: ResolvedAudioClip;
  srcL: Float32Array;
  srcR: Float32Array;
  srcDuration: number;
  /**
   * Length in seconds (local to the clip) during which the clip actually
   * produces sound. For looping clips this is the full placement window; for
   * one-shot clips it is clamped to the trimmed source length, so a 3s voice
   * clip dropped onto a 60s timeline is only "audible" for 3s — which is what
   * both ducking and fade-out must key off, not the fill-to-end placement.
   */
  audibleSeconds: number;
}

function prepareClip({ decoded, resolved }: MixClipInput): PreparedClip {
  const resampled = resampleChannels(decoded.channels, decoded.sampleRate, TARGET_SAMPLE_RATE);
  const [srcL, srcR] = toStereo(resampled);
  const srcDuration = decoded.sourceDurationSeconds;
  const trimEnd = resolved.trimOutSeconds ?? srcDuration;
  const trimmedSourceSeconds = Math.max(0, trimEnd - resolved.trimInSeconds);
  const audibleSeconds = resolved.loop
    ? resolved.placementDurationSeconds
    : Math.min(resolved.placementDurationSeconds, trimmedSourceSeconds);
  return { resolved, srcL, srcR, srcDuration, audibleSeconds };
}

/** True while any voice clip is actually producing sound at time t. */
function voiceActiveAt(clips: PreparedClip[], t: number): boolean {
  for (const { resolved, audibleSeconds } of clips) {
    if (resolved.role !== "voice") continue;
    const local = t - resolved.atSeconds;
    if (local >= 0 && local < audibleSeconds) return true;
  }
  return false;
}

/**
 * Mix decoded clips into stereo f32-planar buffers at TARGET_SAMPLE_RATE.
 */
export function mixAudioClips(
  inputs: MixClipInput[],
  videoDurationSeconds: number,
  mix: ResolvedAudioMix,
): { left: Float32Array<ArrayBuffer>; right: Float32Array<ArrayBuffer>; sampleRate: number } {
  const totalFrames = Math.max(1, Math.ceil(videoDurationSeconds * TARGET_SAMPLE_RATE));
  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);

  const prepared = inputs.map(prepareClip);

  // Ducking envelope: a one-pole follower toward 1 while any voice is audible,
  // back toward 0 when it stops. Must be a full sequential pass so the
  // attack/release smoothing is continuous.
  const duckEnvelope = new Float32Array(totalFrames);
  const hasVoice = prepared.some((p) => p.resolved.role === "voice");
  if (mix.ducking && hasVoice) {
    const dt = 1 / TARGET_SAMPLE_RATE;
    for (let i = 0; i < totalFrames; i++) {
      const target = voiceActiveAt(prepared, i / TARGET_SAMPLE_RATE) ? 1 : 0;
      const prev = i > 0 ? (duckEnvelope[i - 1] ?? 0) : 0;
      const rate = target > prev ? mix.duckingAttack : mix.duckingRelease;
      const alpha = rate <= 0 ? 1 : Math.min(1, dt / rate);
      duckEnvelope[i] = prev + (target - prev) * alpha;
    }
  }

  for (const { resolved, srcL, srcR, srcDuration, audibleSeconds } of prepared) {
    if (srcL.length === 0 || audibleSeconds <= 0) continue;
    const ducks = mix.ducking && (resolved.role === "music" || resolved.role === "ambient");

    // Only iterate the frames this clip can actually be heard in.
    const startFrame = Math.max(0, Math.ceil(resolved.atSeconds * TARGET_SAMPLE_RATE));
    const endFrame = Math.min(
      totalFrames,
      Math.ceil((resolved.atSeconds + audibleSeconds) * TARGET_SAMPLE_RATE),
    );

    for (let i = startFrame; i < endFrame; i++) {
      const local = i / TARGET_SAMPLE_RATE - resolved.atSeconds;
      if (local < 0 || local >= audibleSeconds) continue;

      const sourceTime = resolved.trimInSeconds + local;
      let gain = resolved.volume * mix.master;

      if (ducks) {
        const duck = duckEnvelope[i] ?? 0;
        gain *= 1 - duck * (1 - mix.duckingLevel);
      }

      // Fades are relative to the audible window, so a one-shot clip shorter
      // than its placement still fades against its own end, not the video's.
      if (resolved.fadeInSeconds > 0 && local < resolved.fadeInSeconds) {
        gain *= local / resolved.fadeInSeconds;
      }
      if (resolved.fadeOutSeconds > 0 && local > audibleSeconds - resolved.fadeOutSeconds) {
        gain *= Math.max(0, (audibleSeconds - local) / resolved.fadeOutSeconds);
      }

      const srcIdx =
        resolved.loop && srcDuration > 0
          ? Math.floor(((sourceTime % srcDuration) / srcDuration) * srcL.length) % srcL.length
          : Math.min(Math.floor(sourceTime * TARGET_SAMPLE_RATE), srcL.length - 1);

      left[i] = (left[i] ?? 0) + (srcL[srcIdx] ?? 0) * gain;
      right[i] = (right[i] ?? 0) + (srcR[srcIdx] ?? 0) * gain;
    }
  }

  hardClip(left);
  hardClip(right);

  return { left, right, sampleRate: TARGET_SAMPLE_RATE };
}

function hardClip(buf: Float32Array): void {
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i] ?? 0;
    buf[i] = Math.max(-1, Math.min(1, v));
  }
}

/** Interleave stereo planar for encoder consumption */
export function interleaveStereo(left: Float32Array, right: Float32Array): Float32Array {
  const combined = new Float32Array(left.length * TARGET_CHANNELS);
  for (let i = 0; i < left.length; i++) {
    combined[i] = left[i] ?? 0;
    combined[i + left.length] = right[i] ?? 0;
  }
  return combined;
}