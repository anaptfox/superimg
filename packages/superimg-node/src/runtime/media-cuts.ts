import { createConversionArtifact } from "@superimg/core/runtime";
import { mediaTrackId, selectMediaTrack, type ConversionArtifact, type EncodingOptions } from "@superimg/types";
import type { NodeMediaInput } from "./owned-media-input.js";
import type { SecondsRange } from "@superimg/stdlib/cue";
import { audioOptions, conversionFormat, ensureServerCodecs, inspectLoadedMedia, loadInput, videoOptions } from "./media.js";
import { allocateMediaTarget } from "./artifact-storage.js";
import { assertPreparedCutPlan, type PreparedCutPlan } from "./cut-plan.js";

export interface ExportCutsOptions {
  readonly plan: PreparedCutPlan;
  readonly encoding?: EncodingOptions;
  readonly signal?: AbortSignal;
  readonly onProgress?: (completed: number, total: number) => void | Promise<void>;
  readonly fetch?: typeof fetch;
}
export interface ExportCutsResult {
  readonly artifact: ConversionArtifact;
  readonly ranges: readonly { readonly source: SecondsRange; readonly output: SecondsRange }[];
}

/** Transcode accepted, ordered half-open ranges on their shared audio/video clock. */
export async function exportCuts(input: NodeMediaInput, options: ExportCutsOptions): Promise<ExportCutsResult> {
  const { signal, onProgress } = options;
  assertPreparedCutPlan(options.plan);
  const plan = options.plan, map = plan.acceptedMap, videoTrackId = plan.videoTrackId, audioTrackId = plan.audioTrackId;
  const encoding = options.encoding === undefined ? undefined : structuredClone(options.encoding);
  signal?.throwIfAborted();
  const fetcher = options.fetch ?? fetch;
  const loaded = await loadInput(input, fetcher, signal);
  let output: import("mediabunny").Output | undefined;
  let finished = false;
  let failed = false;
  let primaryFailure: unknown;
  let cancellation: Promise<void> | undefined;
  let outputStorage: Awaited<ReturnType<typeof allocateMediaTarget>> | undefined;
  let artifact: ConversionArtifact | undefined;
  const cancel = () => cancellation ??= output ? output.cancel().catch(() => {}) : Promise.resolve();
  const abort = () => { void cancel(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const inspection = await inspectLoadedMedia(loaded, signal);
    if (!map || !map.source || map.source.mediaSha256 !== inspection.sha256) throw new TypeError("Cut source identity mismatch");
    const audioInfo = audioTrackId ? selectMediaTrack(inspection, audioTrackId, "audio") : undefined;
    const videoInfo = videoTrackId ? selectMediaTrack(inspection, videoTrackId, "video") : undefined;
    if ((audioTrackId && !audioInfo) || (videoTrackId && !videoInfo)) throw new TypeError("Selected cut tracks unavailable");
    if ((audioInfo ?? videoInfo)?.durationSeconds !== map.source.durationSeconds) throw new TypeError("Cut source duration mismatch");
    if (!Array.isArray(map.ranges) || !map.ranges.length || map.ranges.length > 1000) throw new TypeError("Cut requires bounded retained ranges");
    let previous = 0, total = 0;
    const ranges = map.ranges.map((range, index) => {
      if (!Number.isFinite(range.startSeconds) || !Number.isFinite(range.endSeconds) || range.startSeconds < 0 || range.endSeconds <= range.startSeconds || (audioInfo && range.endSeconds > audioInfo.durationSeconds!) || (videoInfo && range.endSeconds > videoInfo.durationSeconds!) || (index > 0 && range.startSeconds < previous)) throw new TypeError("Invalid retained ranges");
      previous = range.endSeconds;
      const start = total; total += range.endSeconds - range.startSeconds;
      return { source: { ...range }, output: { startSeconds: start, endSeconds: total } };
    });
    if (Math.abs(total - map.durationSeconds) > 1e-9) throw new TypeError("Cut duration mismatch");
    await ensureServerCodecs();
    const media = await import("mediabunny");
    const tracks = await loaded.input.getTracks();
    const video = tracks.find(t => t.isVideoTrack() && mediaTrackId("video", t.number) === videoInfo?.id);
    const audio = tracks.find(t => t.isAudioTrack() && mediaTrackId("audio", t.number) === audioInfo?.id);
    if ((videoTrackId && !video?.isVideoTrack()) || (audioTrackId && !audio?.isAudioTrack())) throw new TypeError("Selected tracks unavailable");
    const videoFirst = video?.isVideoTrack() ? await video.getFirstTimestamp() : -Infinity, audioFirst = audio?.isAudioTrack() ? await audio.getFirstTimestamp() : -Infinity;
    const rate = audio?.isAudioTrack() ? await audio.getSampleRate() : undefined;
    if ((audio ? audioFirst : videoFirst) !== plan.clock.originSeconds || (rate ?? 1_000_000) !== plan.clock.ticksPerSecond) throw new TypeError("Cut source clock changed");
    for (const { source } of ranges) {
      if (source.startSeconds < videoFirst || source.startSeconds < audioFirst) throw new TypeError("Cut range begins before selected track");
      if (rate !== undefined) for (const t of [source.startSeconds, source.endSeconds]) if (Math.abs((t - audioFirst) * rate - Math.round((t - audioFirst) * rate)) > 1e-5) throw new TypeError("Cut boundaries must align to audio samples");
    }
    if (audio?.isAudioTrack() && rate !== undefined) await verifyAudioPacketContinuity(media, audio, ranges.at(-1)!.source.endSeconds, rate, signal);
    const outputFormat = encoding?.format ?? "mp4";
    if (!["mp4", "mov", "webm", "mkv"].includes(outputFormat)) throw new TypeError("Unsupported cut output format");
    if ((!video && encoding?.video) || (!audio && encoding?.audio)) throw new TypeError("Encoding requested for an unselected track");
    const request = { format: outputFormat as "mp4" | "mov" | "webm" | "mkv", copy: false as const, ...(encoding ? { encoding } : {}), ...(videoInfo?.displayWidth !== undefined && videoInfo.displayHeight !== undefined ? { resize: { width: videoInfo.displayWidth, height: videoInfo.displayHeight } } : {}) };
    const format = conversionFormat(media, request);
    const vopts = video ? await videoOptions(media, format, request, video) : undefined;
    const aopts = audio ? await audioOptions(media, format, request, audio) : undefined;
    if ((video && !vopts?.codec) || (audio && !aopts?.codec)) throw new TypeError("No encoder available for selected track");
    outputStorage = await allocateMediaTarget(media, outputFormat);
    const { target, path, storage } = outputStorage;
    output = new media.Output({ format, target });
    const vout = vopts?.codec ? new media.VideoSampleSource({ codec: vopts.codec, quality: vopts.quality ?? new media.Quality("high"), ...(vopts.alpha !== undefined ? { alpha: vopts.alpha } : {}), ...(vopts.keyFrameInterval !== undefined ? { keyFrameInterval: vopts.keyFrameInterval } : {}), ...(vopts.hardwareAcceleration !== undefined ? { hardwareAcceleration: vopts.hardwareAcceleration } : {}), ...(encoding?.video?.latencyMode !== undefined ? { latencyMode: encoding.video.latencyMode } : {}) }) : undefined;
    const aout = aopts?.codec ? new media.AudioSampleSource({ codec: aopts.codec, quality: aopts.quality ?? new media.Quality("high") }) : undefined;
    if (vout) output.addVideoTrack(vout); if (aout) output.addAudioTrack(aout);
    signal?.throwIfAborted();
    await output.start();
    let videoProgress = video ? 0 : total, audioProgress = audio ? 0 : total;
    let progressChain: Promise<void> = Promise.resolve();
    const progress = (kind: "video" | "audio", value: number) => {
      if (kind === "video") videoProgress = Math.max(videoProgress, value);
      else audioProgress = Math.max(audioProgress, value);
      const complete = Math.min(total, videoProgress, audioProgress);
      progressChain = progressChain.then(async () => { signal?.throwIfAborted(); await onProgress?.(complete, total); signal?.throwIfAborted(); });
      return progressChain;
    };
    const videoWork = async () => {
      if (!video?.isVideoTrack() || !vout) return;
      const sink = new media.VideoSampleSink(video);
      for (const entry of ranges) {
        let covered = entry.source.startSeconds;
        for await (const sample of sink.samples(entry.source.startSeconds, entry.source.endSeconds)) {
          try {
            signal?.throwIfAborted();
            const start = Math.max(entry.source.startSeconds, sample.timestamp), end = Math.min(entry.source.endSeconds, sample.timestamp + sample.duration);
            if (end <= start) continue;
            if (Math.abs(start - covered) > 0.000002) throw new TypeError("Video coverage gap or overlap in cut");
            sample.setTimestamp(entry.output.startSeconds + start - entry.source.startSeconds);
            sample.setDuration(end - start);
            if (sample.rotation || sample.flip || sample.displayWidth !== sample.codedWidth || sample.displayHeight !== sample.codedHeight) {
              const transformed = await sample.transform({ width: sample.displayWidth, height: sample.displayHeight, fit: "fill" });
              try { await vout.add(transformed); } finally { transformed.close(); }
            } else await vout.add(sample);
            covered = Math.max(covered, end);
            await progress("video", entry.output.startSeconds + covered - entry.source.startSeconds);
            signal?.throwIfAborted();
          } finally { sample.close(); }
        }
        if (covered < entry.source.endSeconds - 0.000002) throw new TypeError("Video coverage gap in cut");
      }
    };
    const audioWork = async () => {
      if (!audio?.isAudioTrack() || !aout || rate === undefined) return;
      const resolution = await audio.getTimeResolution();
      if (!Number.isFinite(resolution) || resolution <= 0) throw new TypeError("Audio timestamp resolution unavailable");
      // Decode sequentially so coarse packet timestamps do not shift individual
      // range starts by several samples. Timestamps still detect observable gaps.
      const tickRanges = ranges.map(entry => ({ ...entry, startTick: Math.round((entry.source.startSeconds - audioFirst) * rate), endTick: Math.round((entry.source.endSeconds - audioFirst) * rate) }));
      let cursor: number | undefined, index = 0, covered = tickRanges[0]!.startTick;
      const tolerance = 1 / resolution + 0.5 / rate + 1e-7;
      for await (const sample of new media.AudioSampleSink(audio).samples()) {
        try {
          signal?.throwIfAborted();
          if (sample.sampleRate !== rate) throw new TypeError("Audio sample rate changed during cut");
          if (cursor === undefined) cursor = Math.round((sample.timestamp - audioFirst) * rate);
          if (Math.abs(sample.timestamp - (audioFirst + cursor / rate)) > tolerance) throw new TypeError("Audio coverage gap or overlap in cut");
          const sampleStart = cursor, sampleEnd = cursor + sample.numberOfFrames;
          while (index < tickRanges.length) {
            const entry = tickRanges[index]!;
            if (sampleEnd <= entry.startTick) break;
            const begin = Math.max(sampleStart, entry.startTick), end = Math.min(sampleEnd, entry.endTick);
            if (end > begin) {
              if (begin !== covered) throw new TypeError("Audio coverage gap or overlap in cut");
              const trimmed = sample.trim(begin - sampleStart, end - sampleStart);
              try { trimmed.setTimestamp(entry.output.startSeconds + (begin - entry.startTick) / rate); await aout.add(trimmed); }
              finally { trimmed.close(); }
              covered = end;
              await progress("audio", entry.output.startSeconds + (covered - entry.startTick) / rate);
            }
            if (covered < entry.endTick) break;
            index++;
            if (index < tickRanges.length) covered = tickRanges[index]!.startTick;
          }
          cursor = sampleEnd;
          if (index === tickRanges.length) break;
        } finally { sample.close(); }
      }
      if (index !== tickRanges.length) throw new TypeError("Audio coverage gap in cut");
    };
    let firstFailure: unknown;
    const guard = async (work: () => Promise<void>) => { try { await work(); } catch (error) { firstFailure ??= error; await cancel(); throw error; } };
    const results = await Promise.allSettled([guard(videoWork), guard(audioWork)]);
    const failed = results.find(result => result.status === "rejected");
    if (failed?.status === "rejected") { signal?.throwIfAborted(); throw firstFailure ?? failed.reason; }
    signal?.throwIfAborted();
    await output.finalize();
    signal?.throwIfAborted();
    const backing = await storage.seal(path, signal);
    const resultInput = new media.Input({ source: new media.FilePathSource(path), formats: media.ALL_FORMATS });
    let observed: { sourceId: string; trackId: string; action: "transcode"; outputStartSeconds: number; outputEndSeconds: number }[];
    let outputDuration: number | undefined;
    try {
      const resultTracks = await resultInput.getTracks();
      const expected = [videoTrackId, audioTrackId].filter((id): id is string => !!id);
      if (resultTracks.length !== expected.length || resultTracks.some((track, i) => track.type !== (videoTrackId && i === 0 ? "video" : "audio"))) throw new TypeError("Cut output tracks do not match selection");
      observed = await Promise.all(resultTracks.map(async (track, i) => ({ sourceId: "source", trackId: expected[i]!, action: "transcode" as const, outputStartSeconds: await track.getFirstTimestamp(), outputEndSeconds: await resultInput.computeDuration([track]) })));
      if (observed.some(track => !Number.isFinite(track.outputStartSeconds) || !Number.isFinite(track.outputEndSeconds) || track.outputEndSeconds <= track.outputStartSeconds)) throw new TypeError("Cut output has no media");
      const outputInspection = await inspectLoadedMedia({ input: resultInput, byteLength: backing.byteLength, sha256: backing.sha256, release: async () => resultInput.dispose() }, signal);
      outputDuration = outputInspection.durationSeconds;
    } finally { resultInput.dispose(); }
    signal?.throwIfAborted();
    if (outputDuration === undefined || !Number.isFinite(outputDuration) || outputDuration <= 0) throw new TypeError("Cut output duration unavailable");
    signal?.throwIfAborted();
    artifact = createConversionArtifact({ backing, mimeType: format.mimeType, durationSeconds: outputDuration, tracks: observed });
    finished = true;
    return { artifact, ranges };
  } catch (error) { failed = true; primaryFailure = error; throw error; }
  finally {
    signal?.removeEventListener("abort", abort);
    if (!finished) await cancel();
    const errors: unknown[] = [];
    if (!finished) { try { await outputStorage?.storage.dispose(); } catch (error) { errors.push(error); } }
    try { await loaded.release(); } catch (error) { errors.push(error); }
    if (finished && errors.length) { try { await artifact?.dispose(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(failed ? [primaryFailure, ...errors] : errors, "Cut cleanup failed");
  }
}

/** Reject raw packet discontinuities before Mediabunny can smooth decoded timestamps. */
async function verifyAudioPacketContinuity(media: typeof import("mediabunny"), track: import("mediabunny").InputAudioTrack, through: number, rate: number, signal?: AbortSignal): Promise<void> {
  const codec = await track.getCodec(), resolution = await track.getTimeResolution();
  const bytesPerSample: Record<string, number> = { "pcm-u8": 1, "pcm-s8": 1, "pcm-s16": 2, "pcm-s16be": 2, "pcm-s24": 3, "pcm-s24be": 3, "pcm-s32": 4, "pcm-s32be": 4, "pcm-f32": 4, "pcm-f32be": 4, "pcm-f64": 8, "pcm-f64be": 8 };
  if (!codec || (codec !== "aac" && bytesPerSample[codec] === undefined)) throw new TypeError(`Audio packet continuity unavailable for codec ${codec ?? "unknown"}`);
  if (!Number.isFinite(resolution) || resolution <= 0) throw new TypeError("Audio packet timestamp resolution unavailable");
  const channels = await track.getNumberOfChannels();
  const tolerance = 1 / resolution + 0.5 / rate + 1e-7;
  let aacFrameDuration: number | undefined;
  if (codec === "aac") {
    // Upstream derives AAC pre-roll from AudioSpecificConfig's frame length
    // and core sample rate; its missing-description fallback is only a guess.
    const config = await track.getDecoderConfig();
    if (!config?.description) throw new TypeError("AAC frame duration unavailable without codec configuration");
    const duration = await track.getPreRollDuration();
    if (duration === null || !Number.isFinite(duration) || duration <= 0) throw new TypeError("AAC frame duration unavailable");
    aacFrameDuration = duration;
  }
  let previousEnd: number | undefined;
  for await (const packet of new media.EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) {
    signal?.throwIfAborted();
    if (packet.timestamp >= through) break;
    const bytes = bytesPerSample[codec];
    if (bytes !== undefined && (channels < 1 || packet.byteLength % (bytes * channels) !== 0)) throw new TypeError("Audio packet sample count unavailable");
    let duration: number;
    if (bytes === undefined) {
      // Do not infer AAC frame length from container packet durations: those
      // can themselves be synthesized from the next packet timestamp.
      if (aacFrameDuration === undefined || Math.abs(aacFrameDuration - packet.duration) > tolerance) throw new TypeError("AAC packet frame duration unavailable or ambiguous");
      duration = aacFrameDuration;
    } else duration = packet.byteLength / (bytes * channels * rate);
    if (!Number.isFinite(packet.timestamp) || !Number.isFinite(duration) || duration <= 0) throw new TypeError("Audio packet timing unavailable");
    if (previousEnd !== undefined && Math.abs(packet.timestamp - previousEnd) > tolerance) throw new TypeError("Audio packet coverage gap or overlap in cut prefix");
    previousEnd = packet.timestamp + duration;
  }
  if (previousEnd === undefined || previousEnd < through - tolerance) throw new TypeError("Audio packet coverage unavailable through cut end");
}
