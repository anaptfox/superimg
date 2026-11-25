import { createKeptRangeMap, type KeptRangeMap, type SecondsRange, type TranscriptSource } from "@superimg/stdlib/cue";
import { mediaTrackId, selectMediaTrack } from "@superimg/types";
import type { NodeMediaInput } from "./owned-media-input.js";
import { inspectLoadedMedia, loadInput } from "./media.js";

export type CutQuantization = "nearest" | "inward" | "outward";
export interface PreparedCutPlan {
  readonly source: TranscriptSource;
  readonly videoTrackId?: string;
  readonly audioTrackId?: string;
  readonly quantization: CutQuantization;
  readonly clock: Readonly<{ kind: "audio-samples" | "video-microseconds"; originSeconds: number; ticksPerSecond: number }>;
  readonly requestedRanges: readonly SecondsRange[];
  readonly acceptedMap: KeptRangeMap;
  readonly adjustments: readonly Readonly<{ startSeconds: number; endSeconds: number }>[];
}
export interface PrepareCutsOptions {
  readonly source: TranscriptSource;
  readonly ranges: readonly SecondsRange[];
  readonly videoTrackId?: string;
  readonly audioTrackId?: string;
  readonly quantization: CutQuantization;
  readonly signal?: AbortSignal;
  readonly fetch?: typeof fetch;
}
const issued = new WeakSet<PreparedCutPlan>();
export function assertPreparedCutPlan(plan: PreparedCutPlan): void {
  if (!plan || !issued.has(plan)) throw new TypeError("Invalid or forged cut plan");
}
/** Quantize once before projecting captions or exporting media. */
export async function prepareCuts(input: NodeMediaInput, options: PrepareCutsOptions): Promise<PreparedCutPlan> {
  if (!options || !["nearest", "inward", "outward"].includes(options.quantization)) throw new TypeError("Explicit cut quantization required");
  if (!options.videoTrackId && !options.audioTrackId) throw new TypeError("Select at least one audio or video track");
  if (!Array.isArray(options.ranges) || !options.ranges.length || options.ranges.length > 1000) throw new TypeError("Cut requires bounded retained ranges");
  const requested = createKeptRangeMap(options.source, options.ranges);
  const videoId = options.videoTrackId, audioId = options.audioTrackId, quantization = options.quantization, signal = options.signal;
  const loaded = await loadInput(input, options.fetch ?? fetch, signal);
  let plan: PreparedCutPlan;
  try {
    const info = await inspectLoadedMedia(loaded, signal);
    if (info.sha256 !== requested.source.mediaSha256) throw new TypeError("Cut source identity mismatch");
    const video = videoId ? selectMediaTrack(info, videoId, "video") : undefined;
    const audio = audioId ? selectMediaTrack(info, audioId, "audio") : undefined;
    if ((videoId && !video) || (audioId && !audio)) throw new TypeError("Selected cut track unavailable");
    const identity = audio ?? video;
    if (!identity || selectMediaTrack(info, requested.source.trackId, identity.kind) !== identity || requested.source.durationSeconds !== identity.durationSeconds) throw new TypeError("Cut source track or duration mismatch");
    const tracks = await loaded.input.getTracks();
    const selected = tracks.filter(t => t.type !== "subtitle" && mediaTrackId(t.type, t.number) === (t.type === "video" ? video?.id : audio?.id));
    const clockTrack = selected.find(t => audioId ? t.type === "audio" : t.type === "video");
    if (!clockTrack || selected.length !== Number(!!videoId) + Number(!!audioId)) throw new TypeError("Selected cut tracks unavailable");
    const originSeconds = await clockTrack.getFirstTimestamp();
    const rate = clockTrack.isAudioTrack() ? await clockTrack.getSampleRate() : 1_000_000;
    const earliest = Math.max(...await Promise.all(selected.map(t => t.getFirstTimestamp())));
    const latest = Math.min(...[video, audio].filter(t => t !== undefined).map(t => t.durationSeconds ?? 0));
    const quantize = (value: number, side: "start" | "end") => {
      const x = (value - originSeconds) * rate;
      const snap = Math.abs(x - Math.round(x)) < 1e-7 ? Math.round(x) : x;
      const n = quantization === "nearest" ? Math.round(snap) : quantization === "inward" ? (side === "start" ? Math.ceil(snap) : Math.floor(snap)) : (side === "start" ? Math.floor(snap) : Math.ceil(snap));
      if (!Number.isSafeInteger(n)) throw new RangeError("Cut clock exceeds safe integer precision");
      return originSeconds + n / rate;
    };
    let previous = -Infinity;
    const accepted = requested.ranges.map(r => {
      const startSeconds = quantize(r.startSeconds, "start"), endSeconds = quantize(r.endSeconds, "end");
      if (startSeconds < earliest || endSeconds > latest || endSeconds <= startSeconds || startSeconds < previous) throw new RangeError("Quantized cut is empty, overlapping, or outside selected tracks");
      previous = endSeconds; return Object.freeze({ startSeconds, endSeconds });
    });
    const map = createKeptRangeMap(requested.source, accepted);
    Object.freeze(map.source); for (const range of map.ranges) Object.freeze(range); Object.freeze(map.ranges); Object.freeze(map);
    plan = Object.freeze({ source: map.source, ...(videoId ? { videoTrackId: videoId } : {}), ...(audioId ? { audioTrackId: audioId } : {}), quantization, clock: Object.freeze({ kind: audio ? "audio-samples" as const : "video-microseconds" as const, originSeconds, ticksPerSecond: rate }), requestedRanges: Object.freeze(requested.ranges.map(r => Object.freeze({ ...r }))), acceptedMap: map, adjustments: Object.freeze(accepted.map((r, i) => Object.freeze({ startSeconds: r.startSeconds - requested.ranges[i]!.startSeconds, endSeconds: r.endSeconds - requested.ranges[i]!.endSeconds }))) });
  } finally { await loaded.release(); }
  signal?.throwIfAborted();
  issued.add(plan); return plan;
}
