//! WebAudio preview controller synchronized with Player play/pause/seek.
//! Loaded lazily only when a media definition declares `config.audio`.

import { resolveAudioTimeline } from "@superimg/core/player-core";
import type { AudioValue, ResolvedAudioClip, ResolvedAudioTimeline } from "@superimg/types";

export interface PlayerAudioController {
  play(atSeconds: number): void;
  pause(): void;
  seek(atSeconds: number, playing: boolean): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  dispose(): void;
}

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

function getAudioContextCtor(): (typeof AudioContext) | undefined {
  const scope = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

export function createPlayerAudioController(options: {
  audio: AudioValue;
  fps: number;
  durationSeconds: number;
  assetResolver?: (filename: string) => string;
  muted: boolean;
  volume: number;
}): PlayerAudioController | null {
  const AudioCtx = getAudioContextCtor();
  if (typeof AudioCtx !== "function") return null;

  const timeline = resolveAudioTimeline(options.audio, {
    fps: options.fps,
    videoDurationSeconds: options.durationSeconds,
  });
  if (!timeline || timeline.clips.length === 0) return null;

  const resolvedTimeline: ResolvedAudioTimeline = {
    ...timeline,
    clips: timeline.clips.map((clip) => ({
      ...clip,
      src: options.assetResolver ? options.assetResolver(clip.src) : clip.src,
    })),
  };

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let muted = options.muted;
  let volume = Math.max(0, Math.min(1, options.volume));
  let disposed = false;
  let playing = false;
  let playGeneration = 0;
  let activeVoices: ActiveVoice[] = [];
  const decoded = new Map<string, Promise<AudioBuffer | null>>();

  function ensureContext(): AudioContext | null {
    if (disposed) return null;
    if (!ctx) {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume * resolvedTimeline.mix.master;
      masterGain.connect(ctx.destination);
    }
    return ctx;
  }

  function loadBuffer(audioCtx: AudioContext, src: string): Promise<AudioBuffer | null> {
    let pending = decoded.get(src);
    if (!pending) {
      pending = (async () => {
        try {
          const response = await fetch(src);
          if (!response.ok) return null;
          const bytes = await response.arrayBuffer();
          if (disposed) return null;
          return await audioCtx.decodeAudioData(bytes);
        } catch {
          return null;
        }
      })();
      decoded.set(src, pending);
    }
    return pending;
  }

  function stopVoices(): void {
    for (const voice of activeVoices) {
      try {
        voice.source.stop();
      } catch {
        // Already ended.
      }
      try {
        voice.source.disconnect();
        voice.gain.disconnect();
      } catch {
        // Ignore teardown races.
      }
    }
    activeVoices = [];
  }

  function applyMasterGain(): void {
    if (!masterGain || !ctx) return;
    const target = muted ? 0 : volume * resolvedTimeline.mix.master;
    masterGain.gain.setValueAtTime(target, ctx.currentTime);
  }

  function scheduleClip(
    audioCtx: AudioContext,
    destination: GainNode,
    clip: ResolvedAudioClip,
    buffer: AudioBuffer,
    playheadSeconds: number,
    baseCtxTime: number,
    voiceIntervals: readonly { start: number; end: number }[],
  ): void {
    const clipStart = clip.atSeconds;
    const clipEnd = clip.atSeconds + clip.placementDurationSeconds;
    if (playheadSeconds >= clipEnd) return;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const clipGain = audioCtx.createGain();
    clipGain.gain.setValueAtTime(clip.volume, baseCtxTime);

    const startsInFuture = clipStart > playheadSeconds;
    const startWhen = startsInFuture ? baseCtxTime + (clipStart - playheadSeconds) : baseCtxTime;
    const elapsedInClip = startsInFuture ? 0 : playheadSeconds - clipStart;
    const remainingPlacement = clipEnd - Math.max(playheadSeconds, clipStart);
    if (remainingPlacement <= 0) return;

    const trimIn = clip.trimInSeconds;
    const trimEnd = clip.trimOutSeconds ?? buffer.duration;
    const usableSpan = Math.max(0.001, trimEnd - trimIn);

    if (clip.loop) {
      source.loop = true;
      source.loopStart = trimIn;
      source.loopEnd = Math.min(buffer.duration, trimEnd);
      const offset = trimIn + (elapsedInClip % usableSpan);
      source.start(startWhen, offset, remainingPlacement);
    } else {
      const offset = trimIn + elapsedInClip;
      if (offset >= trimEnd) return;
      const playDuration = Math.min(remainingPlacement, trimEnd - offset);
      if (playDuration <= 0) return;
      source.start(startWhen, offset, playDuration);
    }

    // Apply fade-in / fade-out envelopes.
    if (clip.fadeInSeconds > 0 && elapsedInClip < clip.fadeInSeconds) {
      const fadeEnd = baseCtxTime + (clipStart + clip.fadeInSeconds - playheadSeconds);
      const startFraction = elapsedInClip / clip.fadeInSeconds;
      clipGain.gain.setValueAtTime(clip.volume * startFraction, startWhen);
      clipGain.gain.linearRampToValueAtTime(clip.volume, Math.max(startWhen, fadeEnd));
    }
    if (clip.fadeOutSeconds > 0) {
      const fadeStartTimeline = clipEnd - clip.fadeOutSeconds;
      const fadeStartCtx = baseCtxTime + (fadeStartTimeline - playheadSeconds);
      const fadeEndCtx = baseCtxTime + (clipEnd - playheadSeconds);
      if (fadeEndCtx > startWhen) {
        if (fadeStartCtx > startWhen) {
          clipGain.gain.setValueAtTime(clip.volume, fadeStartCtx);
          clipGain.gain.linearRampToValueAtTime(0, fadeEndCtx);
        } else {
          const frac = Math.max(0, (clipEnd - playheadSeconds) / clip.fadeOutSeconds);
          clipGain.gain.setValueAtTime(clip.volume * frac, startWhen);
          clipGain.gain.linearRampToValueAtTime(0, fadeEndCtx);
        }
      }
    }

    // Apply simple ducking envelope on music beds during voice clips.
    if (resolvedTimeline.mix.ducking && clip.role === "music" && voiceIntervals.length > 0) {
      const ducked = clip.volume * resolvedTimeline.mix.duckingLevel;
      const attack = resolvedTimeline.mix.duckingAttack;
      const release = resolvedTimeline.mix.duckingRelease;
      for (const interval of voiceIntervals) {
        if (interval.end <= playheadSeconds || interval.start >= clipEnd) continue;
        const downStart = Math.max(startWhen, baseCtxTime + (interval.start - playheadSeconds));
        const downEnd = Math.max(downStart, baseCtxTime + (interval.start + attack - playheadSeconds));
        const upStart = Math.max(downEnd, baseCtxTime + (interval.end - playheadSeconds));
        const upEnd = Math.max(upStart, baseCtxTime + (interval.end + release - playheadSeconds));
        clipGain.gain.setValueAtTime(clip.volume, downStart);
        clipGain.gain.linearRampToValueAtTime(ducked, downEnd);
        clipGain.gain.setValueAtTime(ducked, upStart);
        clipGain.gain.linearRampToValueAtTime(clip.volume, upEnd);
      }
    }

    source.connect(clipGain);
    clipGain.connect(destination);
    activeVoices.push({ source, gain: clipGain });
  }

  function startFrom(atSeconds: number): void {
    if (disposed) return;
    const audioCtx = ensureContext();
    if (!audioCtx || !masterGain) return;
    stopVoices();
    const gen = ++playGeneration;
    playing = true;
    const destination = masterGain;
    const voiceIntervals = resolvedTimeline.clips
      .filter((clip) => clip.role === "voice")
      .map((clip) => ({ start: clip.atSeconds, end: clip.atSeconds + clip.placementDurationSeconds }));

    void (async () => {
      if (audioCtx.state === "suspended") {
        await audioCtx.resume().catch(() => {});
      }
      const buffers = await Promise.all(
        resolvedTimeline.clips.map((clip) => loadBuffer(audioCtx, clip.src)),
      );
      if (disposed || !playing || gen !== playGeneration) return;
      const now = audioCtx.currentTime;
      for (let i = 0; i < resolvedTimeline.clips.length; i += 1) {
        const buffer = buffers[i];
        if (!buffer) continue;
        scheduleClip(audioCtx, destination, resolvedTimeline.clips[i]!, buffer, atSeconds, now, voiceIntervals);
      }
    })();
  }

  return {
    play(atSeconds: number) {
      startFrom(Math.max(0, atSeconds));
    },
    pause() {
      playing = false;
      playGeneration += 1;
      stopVoices();
    },
    seek(atSeconds: number, isPlaying: boolean) {
      if (isPlaying) {
        startFrom(Math.max(0, atSeconds));
      } else {
        playing = false;
        playGeneration += 1;
        stopVoices();
      }
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      applyMasterGain();
    },
    setVolume(nextVolume: number) {
      volume = Math.max(0, Math.min(1, nextVolume));
      applyMasterGain();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      playGeneration += 1;
      stopVoices();
      decoded.clear();
      if (ctx) {
        void ctx.close().catch(() => {});
        ctx = null;
      }
      masterGain = null;
    },
  };
}
