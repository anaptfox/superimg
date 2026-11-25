import { mediaTrackId, selectMediaTrack } from "@superimg/types";
import type { NodeMediaInput } from "./owned-media-input.js";
import { ensureServerCodecs, inspectLoadedMedia, loadInput } from "./media.js";

type Progress = (completed: number, total: number) => void | Promise<void>;
type Common = { trackId: string; signal?: AbortSignal; onProgress?: Progress; fetch?: typeof fetch };

async function open(input: NodeMediaInput, options: Common, kind: "audio" | "video") {
  options.signal?.throwIfAborted();
  const fetcher = options.fetch ?? fetch;
  // Own input bytes once so inspection identity and decoding refer to the same subject.
  const loaded = await loadInput(input, fetcher, options.signal);
  try {
    const inspection = await inspectLoadedMedia(loaded, options.signal);
    const info = selectMediaTrack(inspection, options.trackId, kind);
    const track = (await loaded.input.getTracks()).find(t => t.type === kind && mediaTrackId(kind, t.number) === info?.id);
    if (!track || !info) throw new TypeError(`Unknown ${kind} track ${JSON.stringify(options.trackId)}`);
    await ensureServerCodecs();
    options.signal?.throwIfAborted();
    return { loaded, inspection, info, track };
  } catch (error) { await loaded.release(); throw error; }
}

export async function extractFrames(input: NodeMediaInput, options: Common & { timesSeconds: readonly number[]; width: number; height: number }) {
  if (!Array.isArray(options.timesSeconds) || options.timesSeconds.length === 0 || options.timesSeconds.length > 512) throw new RangeError("Frame request exceeds limits");
  const request = { ...options, timesSeconds: [...options.timesSeconds] };
  const { timesSeconds, width, height, signal } = request;
  if (!timesSeconds.length || timesSeconds.length > 512 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 4096 * 4096 || width * height * timesSeconds.length > 128 * 1024 * 1024) throw new RangeError("Frame request exceeds limits");
  const context = await open(input, request, "video");
  try {
    if (!context.track.isVideoTrack()) throw new TypeError("Expected video track");
    const first = await context.track.getFirstTimestamp();
    const duration = context.info.durationSeconds;
    if (duration === undefined) throw new TypeError("Selected track duration unavailable");
    if (timesSeconds.some(t => !Number.isFinite(t) || t < first || t >= duration)) throw new RangeError("Frame timestamp outside selected track");
    const media = await import("mediabunny");
    const sharp = (await import("sharp")).default;
    const sink = new media.VideoSampleSink(context.track);
    const frames: { requestedSeconds: number; timestampSeconds: number; durationSeconds: number; png: Uint8Array }[] = [];
    for (const [i, t] of timesSeconds.entries()) {
      signal?.throwIfAborted();
      const sample = await sink.getSample(t);
      if (!sample) throw new RangeError("No frame at requested timestamp");
      try {
        if (sample.codedWidth * sample.codedHeight > 4096 * 4096) throw new RangeError("Unsupported frame geometry");
        // The native transformer resolves display geometry and supplies a native
        // conversion path for planar decoder formats such as ProRes I422P10.
        const transformed = await sample.transform({ width, height, fit: "fill" });
        try {
          signal?.throwIfAborted();
          const rgba = new Uint8Array(width * height * 4);
          await transformed.copyTo(rgba, { format: "RGBA", layout: [{ offset: 0, stride: width * 4 }] });
          signal?.throwIfAborted();
          const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
          frames.push({ requestedSeconds: t, timestampSeconds: sample.timestamp, durationSeconds: sample.duration, png: new Uint8Array(png) });
        } finally { transformed.close(); }
      } finally { sample.close(); }
      signal?.throwIfAborted();
      await request.onProgress?.(i + 1, timesSeconds.length);
      signal?.throwIfAborted();
    }
    let disposed = false;
    return { sourceSha256: context.inspection.sha256, trackId: request.trackId, get frames() { if (disposed) throw new Error("Frames disposed"); return frames; }, dispose() { if (!disposed) { for (const frame of frames) frame.png.fill(0); frames.length = 0; disposed = true; } } };
  } finally { await context.loaded.release(); }
}

export interface WaveformBin { startSeconds: number; endSeconds: number; peak: number; rms: number; samples: number; complete: boolean }
export async function extractWaveform(input: NodeMediaInput, inputOptions: Common & { bins: number; startSeconds?: number; endSeconds?: number }) {
  const options = { ...inputOptions };
  if (!Number.isSafeInteger(options.bins) || options.bins < 1 || options.bins > 100_000) throw new RangeError("Invalid waveform bin count");
  const context = await open(input, options, "audio");
  try {
    if (!context.track.isAudioTrack()) throw new TypeError("Expected audio track");
    const first = await context.track.getFirstTimestamp();
    if (context.info.durationSeconds === undefined) throw new TypeError("Selected track duration unavailable");
    const start = options.startSeconds ?? first, end = options.endSeconds ?? context.info.durationSeconds;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < first || end > context.info.durationSeconds || end <= start || end - start > 3600) throw new RangeError("Invalid waveform range");
    const bins: WaveformBin[] = Array.from({ length: options.bins }, (_, i) => ({ startSeconds: start + (end-start)*i/options.bins, endSeconds: start + (end-start)*(i+1)/options.bins, peak: 0, rms: 0, samples: 0, complete: false }));
    const coverage = bins.map(() => ({ first: Infinity, end: -Infinity, gap: false, rate: 0 }));
    const media = await import("mediabunny");
    for await (const sample of new media.AudioSampleSink(context.track).samples(start, end)) {
      try {
        options.signal?.throwIfAborted();
        const pcm = new Float32Array(sample.numberOfFrames * sample.numberOfChannels);
        sample.copyTo(pcm, { format: "f32", planeIndex: 0 });
        for (let frame = 0; frame < sample.numberOfFrames; frame++) {
          const t = sample.timestamp + frame / sample.sampleRate;
          if (t < start || t >= end) continue;
          const index = Math.min(options.bins - 1, Math.floor((t - start) / (end - start) * options.bins));
          const bin = bins[index]!;
          const cover = coverage[index]!;
          if (cover.rate && cover.rate !== sample.sampleRate) cover.gap = true;
          if (cover.end !== -Infinity && Math.abs(t - cover.end) > 0.5 / sample.sampleRate) cover.gap = true;
          cover.rate = sample.sampleRate;
          cover.first = Math.min(cover.first, t);
          cover.end = t + 1 / sample.sampleRate;
          for (let channel = 0; channel < sample.numberOfChannels; channel++) {
            const value = pcm[frame * sample.numberOfChannels + channel]!;
            bin.peak = Math.max(bin.peak, Math.abs(value)); bin.rms += value * value; bin.samples++;
          }
        }
        await options.onProgress?.(Math.min(end-start, Math.max(0, sample.timestamp + sample.duration - start)), end-start);
      } finally { sample.close(); }
    }
    options.signal?.throwIfAborted();
    for (const [i, bin] of bins.entries()) {
      const cover = coverage[i]!;
      bin.rms = bin.samples ? Math.sqrt(bin.rms / bin.samples) : 0;
      bin.complete = cover.rate > 0 && !cover.gap && cover.first <= bin.startSeconds + 1 / cover.rate + 1e-9 && cover.end >= bin.endSeconds - 1e-9;
    }
    return { sourceSha256: context.inspection.sha256, trackId: options.trackId, startSeconds: start, endSeconds: end, bins };
  } finally { await context.loaded.release(); }
}

export function detectSilence(waveform: Awaited<ReturnType<typeof extractWaveform>>, options: { threshold: number; minDurationSeconds: number }) {
  if (!Number.isFinite(options.threshold) || options.threshold < 0 || !Number.isFinite(options.minDurationSeconds) || options.minDurationSeconds <= 0) throw new RangeError("Invalid silence parameters");
  if (!waveform || !Array.isArray(waveform.bins) || !Number.isFinite(waveform.startSeconds) || !Number.isFinite(waveform.endSeconds) || waveform.endSeconds <= waveform.startSeconds) throw new TypeError("Invalid waveform");
  let previousEnd = waveform.startSeconds;
  for (const bin of waveform.bins) {
    if (!bin || !Number.isFinite(bin.startSeconds) || !Number.isFinite(bin.endSeconds) || bin.endSeconds <= bin.startSeconds || bin.startSeconds !== previousEnd || bin.endSeconds > waveform.endSeconds || !Number.isFinite(bin.peak) || bin.peak < 0 || !Number.isFinite(bin.rms) || bin.rms < 0 || !Number.isSafeInteger(bin.samples) || bin.samples < 0 || typeof bin.complete !== "boolean") throw new TypeError("Invalid or noncontiguous waveform bins");
    previousEnd = bin.endSeconds;
  }
  if (previousEnd !== waveform.endSeconds) throw new TypeError("Invalid or noncontiguous waveform bins");
  const intervals: { startSeconds: number; endSeconds: number; maxPeak: number }[] = [];
  let current: { startSeconds: number; endSeconds: number; maxPeak: number } | undefined;
  const finish = () => { if (current && current.endSeconds - current.startSeconds >= options.minDurationSeconds) intervals.push(current); current = undefined; };
  for (const bin of waveform.bins) {
    if (bin.complete && bin.samples && bin.peak <= options.threshold) {
      if (!current) current = { startSeconds: bin.startSeconds, endSeconds: bin.endSeconds, maxPeak: bin.peak };
      else { current.endSeconds = bin.endSeconds; current.maxPeak = Math.max(current.maxPeak, bin.peak); }
    } else finish();
  }
  finish();
  return { sourceSha256: waveform.sourceSha256, trackId: waveform.trackId, threshold: options.threshold, minDurationSeconds: options.minDurationSeconds, intervals };
}
