import { describe, it, expect } from "vitest";
import type { ResolvedAudioClip, ResolvedAudioMix } from "@superimg/types";
import {
  mixAudioClips,
  resampleChannels,
  toStereo,
  interleaveStereo,
  TARGET_SAMPLE_RATE,
  type DecodedAudioClip,
  type MixClipInput,
} from "../shared/audio-dsp.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/** A decoded clip filled with a constant sample value at the target rate. */
function constClip(value: number, durationSeconds: number): DecodedAudioClip {
  const len = Math.max(1, Math.round(durationSeconds * TARGET_SAMPLE_RATE));
  const ch = new Float32Array(len).fill(value);
  return { channels: [ch], sampleRate: TARGET_SAMPLE_RATE, sourceDurationSeconds: durationSeconds };
}

function clip(overrides: Partial<ResolvedAudioClip>): ResolvedAudioClip {
  return {
    id: "c",
    showInTimeline: true,
    src: "x.wav",
    role: "music",
    atSeconds: 0,
    placementDurationSeconds: 1,
    trimInSeconds: 0,
    trimOutSeconds: null,
    loop: false,
    volume: 1,
    fadeInSeconds: 0,
    fadeOutSeconds: 0,
    ...overrides,
  };
}

function mix(overrides: Partial<ResolvedAudioMix> = {}): ResolvedAudioMix {
  return {
    master: 1,
    ducking: true,
    duckingLevel: 0.25,
    // Fast envelope so it settles well within the assertion windows.
    duckingAttack: 0.005,
    duckingRelease: 0.005,
    ...overrides,
  };
}

const at = (left: Float32Array, seconds: number) =>
  left[Math.floor(seconds * TARGET_SAMPLE_RATE)] ?? 0;

// ── DSP primitives ───────────────────────────────────────────────────────────

describe("audio-dsp primitives", () => {
  it("resampleChannels stretches length by the rate ratio", () => {
    const src = [new Float32Array([0, 1, 0, -1])];
    const out = resampleChannels(src, 24_000, 48_000);
    expect(out[0]!.length).toBe(8);
  });

  it("resampleChannels is a no-op at matching rate", () => {
    const src = [new Float32Array([0.5, 0.5])];
    expect(resampleChannels(src, 48_000, 48_000)).toBe(src);
  });

  it("toStereo duplicates mono into both channels", () => {
    const m = new Float32Array([0.3, 0.6]);
    const [l, r] = toStereo([m]);
    expect(l).toBe(m);
    expect(r).toBe(m);
  });

  it("interleaveStereo writes planar [L…][R…] layout", () => {
    const l = new Float32Array([1, 2]);
    const r = new Float32Array([3, 4]);
    expect(Array.from(interleaveStereo(l, r))).toEqual([1, 2, 3, 4]);
  });

  it("hard-clips summed clips to [-1, 1]", () => {
    const inputs: MixClipInput[] = [
      { decoded: constClip(0.8, 1), resolved: clip({ id: "a", placementDurationSeconds: 1, loop: true }) },
      { decoded: constClip(0.8, 1), resolved: clip({ id: "b", placementDurationSeconds: 1, loop: true }) },
    ];
    const { left } = mixAudioClips(inputs, 1, mix({ ducking: false }));
    expect(at(left, 0.5)).toBeCloseTo(1, 5); // 0.8 + 0.8 clamped to 1
  });
});

// ── bug #1: ducking must stop when the voiceover actually ends ────────────────

describe("ducking window tracks the voiceover's real length", () => {
  // Voice at volume 0 so it never adds to the sum — it only drives ducking.
  // Music is a steady loop so any change in level is purely the duck envelope.
  const inputs: MixClipInput[] = [
    { decoded: constClip(1, 1), resolved: clip({ id: "music", role: "music", loop: true, placementDurationSeconds: 4 }) },
    { decoded: constClip(1, 1), resolved: clip({ id: "vo", role: "voice", loop: false, volume: 0, placementDurationSeconds: 4 }) },
  ];

  it("ducks the music while the voice is audible", () => {
    const { left } = mixAudioClips(inputs, 4, mix());
    // t=0.5s, voice (1s long) still playing → music at duckingLevel.
    expect(at(left, 0.5)).toBeCloseTo(0.25, 2);
  });

  it("restores the music after the voice ends (regression: stayed ducked)", () => {
    const { left } = mixAudioClips(inputs, 4, mix());
    // t=2s, voice ended at 1s → music back to full volume.
    expect(at(left, 2)).toBeCloseTo(1, 2);
  });
});

// ── bug #2: fade-out keys off the audible end, not fill-to-end placement ──────

describe("fade-out on a one-shot clip shorter than its placement", () => {
  // 1s voice clip, placement defaults to the whole 4s video, fadeOut 0.2s.
  const inputs: MixClipInput[] = [
    {
      decoded: constClip(1, 1),
      resolved: clip({
        id: "vo",
        role: "voice",
        loop: false,
        placementDurationSeconds: 4,
        fadeOutSeconds: 0.2,
      }),
    },
  ];

  it("fades against the clip's own 1s end", () => {
    const { left } = mixAudioClips(inputs, 4, mix({ ducking: false }));
    // 0.1s before the audible end (t=0.9s) → halfway through the 0.2s fade.
    expect(at(left, 0.9)).toBeCloseTo(0.5, 1);
  });

  it("is silent after the clip ends and never fades the empty tail", () => {
    const { left } = mixAudioClips(inputs, 4, mix({ ducking: false }));
    expect(at(left, 1.5)).toBe(0);
    expect(at(left, 3.99)).toBe(0);
  });
});

// ── bug #3: ambient ducks under voice too ────────────────────────────────────

describe("ambient role ducks under voice", () => {
  const inputs: MixClipInput[] = [
    { decoded: constClip(1, 1), resolved: clip({ id: "amb", role: "ambient", loop: true, placementDurationSeconds: 3 }) },
    { decoded: constClip(1, 1), resolved: clip({ id: "vo", role: "voice", loop: false, volume: 0, placementDurationSeconds: 3 }) },
  ];

  it("dips while the voice plays and recovers after", () => {
    const { left } = mixAudioClips(inputs, 3, mix());
    expect(at(left, 0.5)).toBeCloseTo(0.25, 2); // ducked
    expect(at(left, 2)).toBeCloseTo(1, 2); // recovered
  });
});

// ── placement + trim sanity ──────────────────────────────────────────────────

describe("placement and trim", () => {
  it("places a clip at its atSeconds offset", () => {
    const inputs: MixClipInput[] = [
      { decoded: constClip(1, 1), resolved: clip({ id: "sfx", role: "sfx", loop: false, atSeconds: 2, placementDurationSeconds: 1 }) },
    ];
    const { left } = mixAudioClips(inputs, 4, mix({ ducking: false }));
    expect(at(left, 1)).toBe(0); // before placement
    expect(at(left, 2.5)).toBeCloseTo(1, 5); // during
    expect(at(left, 3.5)).toBe(0); // after
  });
});
