# Server media preparation

The Node package prepares selected tracks from an existing media input. It does not choose a transcript provider, approve cuts, save files, or publish artifacts. Install `@foxworth/superimg-node` alongside `@foxworth/superimg`.

```ts
import { inspectFile } from "@foxworth/superimg/runtime";
import { projectMappedCaptions } from "@foxworth/superimg/transcript";
import { extractFrames, extractWaveform, detectSilence, prepareCuts, exportCuts } from "@foxworth/superimg-node/media-preparation";

const input = { kind: "bytes" as const, bytes: clipBytes };
const info = await inspectFile(input);
const video = info.tracks.find((track) => track.kind === "video");
const audio = info.tracks.find((track) => track.kind === "audio");
if (!video || !audio || audio.durationSeconds === undefined) throw new Error("Select video and audio tracks with known duration");

const frames = await extractFrames(input, {
  trackId: video.id, timesSeconds: [0.2, 1.2], width: 320, height: 180,
});
try {
  // Each frame has requestedSeconds, timestampSeconds, durationSeconds and png bytes.
  await savePreview(frames.frames[0]!.png);
} finally {
  frames.dispose();
}

const waveform = await extractWaveform(input, { trackId: audio.id, bins: 256 });
const candidates = detectSilence(waveform, { threshold: 0.01, minDurationSeconds: 0.5 });
// The host reviews candidates and chooses the kept intervals.
const plan = await prepareCuts(input, {
  source: { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds },
  ranges: [{ startSeconds: 0, endSeconds: 1 }, { startSeconds: 2, endSeconds: 3 }],
  audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest",
});
const captions = projectMappedCaptions(transcript, plan.acceptedMap);
const { artifact, ranges } = await exportCuts(input, { plan });
try {
  // ranges is the accepted source-to-output mapping; the artifact reports observed output bounds.
  await saveStream(artifact.open());
} finally {
  await artifact.dispose();
}
```

`savePreview`, `saveStream`, and `transcript` represent host values. Choose ranges within all selected tracks; this example requires media long enough for them. The source identity uses the selected audio track when audio is present, otherwise the video track. Ranges are ordered, non-overlapping, half-open seconds at 1× speed. `prepareCuts` exposes the original request, adjustments, clock, and the accepted map. `nearest` rounds to the nearest clock tick (ties toward positive infinity), `inward` rounds the start up and end down, and `outward` does the reverse; empty, overlapping, or out-of-bounds results are rejected. To account for floating-point representation, a value within `1e-7` tick of an integer is first snapped to that integer; the reported adjustments include this tolerance, so inward and outward can differ from strict containment by at most that amount. Both preparation and export strictly reject an accepted start before any selected track's first timestamp. The clock is the audio sample rate when audio is selected, or microseconds for video-only. Project captions with `plan.acceptedMap` and pass that same plan to `exportCuts`. Plans are immutable and process-local; prepare a new plan after serialization or process restart. Export verifies the source identity and clock and rejects track gaps. Select either or both tracks. The `encoding` option uses the existing encoding vocabulary and supports MP4, MOV, WebM and MKV subject to available encoders and compatible codecs. Returned ranges describe the accepted mapping; `artifact.durationSeconds` and `artifact.tracks` describe observed output, which can differ due to encoding and container timing.

Frame extraction returns owned PNG byte arrays with actual decoded presentation timestamps. Call `frames.dispose()` when finished; it clears the owned arrays. Rotation, flip and pixel aspect ratio are applied to the returned pixels. Waveform bins contain peak, RMS, sample count, and a `complete` coverage flag. Silence candidates are based only on complete bins, the caller's explicit peak threshold and minimum duration, so their precision is limited by bin boundaries. Missing or discontinuous coverage is not silence. `detectSilence` rejects malformed or noncontiguous bins.

For repeated operations, `prepareMediaInput(input, { signal, fetch, maxInputBytes })` creates one immutable, privately owned file snapshot, incrementally fetching a URL once. Call `await prepared.inspect()` and pass `prepared` to frame, waveform and cut operations, then `await prepared.dispose()`. Disposal rejects new operations and waits for in-flight operations to finish. Do not await disposal inside an operation's progress callback: that operation cannot finish until the callback returns. Use its abort signal to stop work first. The default input limit is 512 MiB; `maxInputBytes` sets the limit for a prepared input. Ordinary byte and URL inputs use the default limit. The limit bounds input bytes, not native decoder memory. Byte inputs are copied to preserve their snapshot semantics.

The functions accept an `AbortSignal`, optional progress callback, and optional fetch implementation. Frame and waveform outputs are bounded by their request limits. Native conversion and cut files have a 512 MiB output-file limit, enforced while writing. This does not bound native codec or muxer memory. Conversion artifacts can be opened repeatedly until disposal; disposal closes active readers and makes later opens fail, independently of runtime disposal. The host owns admission, persistence, remote effects and any retry or reconciliation decisions.

Cut audio is decoded sequentially from the track start through the end of the last retained range and selected by sample index, so coarse container timestamps cannot shift each cut independently. Raw packet timing is checked before decoding because a decoder can smooth over packet gaps. Continuity is checked throughout that prefix, including discarded portions; an observable gap or overlap there rejects a later cut. The check uses one track timestamp tick plus half a sample and a small floating-point allowance; discrepancies within that uncertainty cannot be distinguished from timestamp rounding. PCM packet duration is derived from its sample count. AAC frame duration comes from its codec configuration and must agree with packet timing; missing or ambiguous timing is rejected, as are source audio codecs without qualified packet continuity evidence. This conservative check does not infer continuity from codec priming or discard metadata. Long sources can require substantial decoding even for a late cut, and a discarded prefix does not generate retained-work progress.

`startConversion` schedules work asynchronously. Keep its request and any supplied byte arrays unchanged until the job completes; starting a job does not snapshot them at invocation or expose an ingestion-complete signal. Prepared input snapshots apply to the Node preparation functions shown here, not to `startConversion` requests. Aborting preparation during metadata inspection is observed after that inspection returns.

## Host-supplied extensions

Cutout and semantic search can remain ordinary host functions; SuperImg does not discover models or download them. For example, a host can define explicit asset and observation values:

```ts
type Asset = { mimeType: string; bytes: Uint8Array };
type Observation = { sourceSha256: string; trackId: string; startSeconds: number; endSeconds: number; label: string };
type Cutout = (frame: Asset) => Promise<Asset>;
type SearchFootage = (query: string, frames: readonly Asset[]) => Promise<readonly Observation[]>;

// The application supplies implementations and decides when to execute them.
async function prepareSubject(cutout: Cutout, frame: Asset): Promise<Asset> {
  return cutout(frame);
}
async function findMoments(search: SearchFootage, query: string, frames: readonly Asset[]) {
  return search(query, frames);
}
```

These examples define host contracts, not built-in SuperImg functions. The host validates and persists returned assets or observations and owns provider credentials and effects.
