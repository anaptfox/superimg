import { createHash } from "node:crypto";
import type { RuntimeAdapterConversionOutput } from "@superimg/core/runtime";
import { mediaTrackId, normalizeConversionCopy, normalizeEncodingQuality, resolveMediaTrackId, type ConversionRequest, type EncodingQuality, type MediaInput, type MediaInspection } from "@superimg/types";
import { DEFAULT_MEDIA_INPUT_BYTES, acquirePreparedMediaInput, isPreparedMediaInput, prepareMediaInput, type NodeMediaInput } from "./owned-media-input.js";
import { allocateMediaTarget } from "./artifact-storage.js";

type FetchLike = typeof fetch;

export interface LoadedInput {
  readonly input: import("mediabunny").Input;
  readonly byteLength: number;
  readonly sha256: string;
  readonly inspection?: () => Promise<MediaInspection>;
  release(): Promise<void>;
}

export async function inspectNativeMedia(input: MediaInput, fetcher: FetchLike, signal?: AbortSignal): Promise<MediaInspection> {
  const loaded = await loadInput(input, fetcher, signal);
  try {
    return await inspectLoadedMedia(loaded, signal);
  } finally {
    await loaded.release();
  }
}

/** Inspect the same owned bytes and decoder input used by the caller. */
export async function inspectLoadedMedia(loaded: LoadedInput, signal?: AbortSignal): Promise<MediaInspection> {
    signal?.throwIfAborted();
    if (loaded.inspection) return await loaded.inspection();
    const tracks = await loaded.input.getTracks();
    return Object.freeze({
      schemaVersion: 0,
      kind: "@foxworth/superimg/media-inspection",
      mimeType: await loaded.input.getMimeType(),
      byteLength: loaded.byteLength,
      sha256: loaded.sha256,
      ...(tracks.length > 0 ? { durationSeconds: await inspectedDuration(loaded.input, tracks) } : {}),
      tracks: Object.freeze(await Promise.all(tracks.filter((track) => track.type === "video" || track.type === "audio").map(async (track) => {
        const durationSeconds = await inspectedDuration(loaded.input, [track]);
        const codec = await track.getCodec();
        if (track.isVideoTrack()) {
          const metrics = await track.computeFrameRateMetrics();
          return Object.freeze({ id: mediaTrackId("video", track.number), kind: "video" as const, ...(codec ? { codec } : {}), durationSeconds, width: await track.getCodedWidth(), height: await track.getCodedHeight(),
            displayWidth: await track.getDisplayWidth(), displayHeight: await track.getDisplayHeight(),
            rotation: await track.getRotation(), flip: await track.getFlip(),
            transformationMatrix: Object.freeze(await track.getTransformationMatrix()),
            canBeTransparent: await track.canBeTransparent(), fps: metrics.bestGuessFrameRate });
        }
        if (!track.isAudioTrack()) throw new TypeError("Unsupported media track");
        return Object.freeze({ id: mediaTrackId("audio", track.number), kind: "audio" as const, ...(codec ? { codec } : {}), durationSeconds, channels: await track.getNumberOfChannels(), sampleRate: await track.getSampleRate() });
      }))),
    });
}

async function inspectedDuration(
  input: import("mediabunny").Input,
  tracks: import("mediabunny").InputTrack[],
): Promise<number> {
  return (await durationInfo(input, tracks)).durationSeconds;
}

/**
 * Matroska can carry a valid container duration for a one-packet stream even
 * when its copied packet has no duration.  Keep those two observations
 * separate: copying that packet again would discard the only timing evidence.
 */
async function durationInfo(
  input: import("mediabunny").Input,
  tracks: import("mediabunny").InputTrack[],
): Promise<{ readonly durationSeconds: number; readonly requiresTimestampTranscode: boolean }> {
  if (tracks.length > 1) {
    const durations = await Promise.all(tracks.map((track) => durationInfo(input, [track])));
    return {
      durationSeconds: Math.max(...durations.map((duration) => duration.durationSeconds)),
      requiresTimestampTranscode: durations.some((duration) => duration.requiresTimestampTranscode),
    };
  }
  const computed = await input.computeDuration(tracks);
  // A sole zero-duration packet can begin after zero. computeDuration then
  // equals its start, not zero, and must not hide valid container end timing.
  const video = tracks.length === 1 && tracks[0]!.isVideoTrack() ? tracks[0]! : undefined;
  if (computed > 0 && (video === undefined || computed !== await video.getFirstTimestamp())) {
    return { durationSeconds: computed, requiresTimestampTranscode: false };
  }
  const metadata = await input.getDurationFromMetadata(tracks);
  return {
    durationSeconds: metadata !== null && metadata > computed ? metadata : computed,
    requiresTimestampTranscode: metadata !== null && metadata > computed,
  };
}

export async function convertNativeMedia(
  request: ConversionRequest,
  fetcher: FetchLike,
  checkpoint: (completed?: number, total?: number) => Promise<void>,
  finalizing: () => void,
  preflight?: (tracks: readonly import("@superimg/types").ConversionTrackPlan[]) => Promise<void>,
): Promise<RuntimeAdapterConversionOutput> {
  throwIfAborted(request.signal);
  const copy = normalizeConversionCopy(request.copy);
  await ensureServerCodecs();
  const sources = new Map<string, LoadedInput>();
  const normalizedInputs: import("mediabunny").Input[] = [];
  const normalizedStorage: import("@superimg/core/runtime").RuntimeArtifactBacking[] = [];
  let output: import("mediabunny").Output | undefined;
  let outputStorage: Awaited<ReturnType<typeof allocateMediaTarget>> | undefined;
  const conversions: import("mediabunny").Conversion[] = [];
  let completed = false;
  let primaryFailure: unknown;
  let failed = false;
  let cancellation: Promise<void> | undefined;
  const cancelProcessing = (): Promise<void> => cancellation ??= Promise.allSettled([
    ...conversions.map((conversion) => conversion.cancel()),
    ...(output === undefined ? [] : [output.cancel()]),
  ]).then(() => undefined);
  const onAbort = () => { void cancelProcessing(); };
  request.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    for (const source of request.sources) {
      throwIfAborted(request.signal);
      if (sources.has(source.id)) throw new TypeError(`Duplicate conversion source ${JSON.stringify(source.id)}`);
      sources.set(source.id, await loadInput(source.input, fetcher, request.signal));
      throwIfAborted(request.signal);
    }
    const selected = [request.video, ...request.audio];
    const audioIds = new Set<string>();
    for (const selection of request.audio) {
      if (audioIds.has(selection.id)) throw new TypeError(`Duplicate conversion audio id ${JSON.stringify(selection.id)}`);
      audioIds.add(selection.id);
    }
    const plans = await Promise.all(selected.map(async (selection) => {
      const source = sources.get(selection.sourceId);
      if (!source) throw new TypeError(`Unknown conversion source ${JSON.stringify(selection.sourceId)}`);
      const tracks = await source.input.getTracks();
      const trackId = resolveMediaTrackId(selection.trackId);
      const track = tracks.find((candidate) => mediaTrackId(candidate.type, candidate.number) === trackId);
      if (!track) throw new TypeError(`Unknown conversion track ${JSON.stringify(selection.trackId)}`);
      const duration = await durationInfo(source.input, [track]);
      const durationSeconds = duration.durationSeconds;
      const { normalizeTrim } = await import("@superimg/types");
      const trim = normalizeTrim(selection.trim, durationSeconds);
      const firstTimestamp = await track.getFirstTimestamp();
      if (firstTimestamp > trim.startSeconds) {
        throw new TypeError(`Conversion track ${JSON.stringify(selection.trackId)} begins at ${firstTimestamp}s after its ${trim.startSeconds}s trim start; leading padding is unsupported`);
      }
      return { source, track, trim, firstTimestamp, durationSeconds, requiresTimestampRepair: track.isVideoTrack() && duration.requiresTimestampTranscode };
    }));
    const videoPlan = plans[0]!;
    if (videoPlan.track.type !== "video") throw new TypeError("Conversion video selection must select a video track");
    if (plans.slice(1).some((plan) => plan.track.type !== "audio")) throw new TypeError("Conversion audio selections must select audio tracks");
    if (plans.some((plan) => plan.requiresTimestampRepair) && plans.length !== 1) {
      throw new TypeError("Conversion cannot preserve metadata-only video timing with additional selected tracks");
    }
    const media = await import("mediabunny");
    throwIfAborted(request.signal);
    for (const plan of plans) {
      if (!plan.requiresTimestampRepair) continue;
      // The decoder now drops zero-duration samples before processing. Restore the
      // sole packet's container-backed timing before conversion, including resizes.
      // MOV supports all accepted video codecs and retains explicit packet durations.
      if (!plan.track.isVideoTrack()) throw new TypeError("Only video tracks support metadata-only timing normalization");
      const repaired = await repairSinglePacketDuration(media, new media.MovOutputFormat(), plan.track, plan.durationSeconds, request.signal);
      normalizedStorage.push(repaired.backing);
      const input = new media.Input({ source: new media.FilePathSource(repaired.path), formats: media.ALL_FORMATS });
      normalizedInputs.push(input);
      const tracks = await input.getVideoTracks();
      if (tracks.length !== 1) throw new TypeError("Conversion timing normalization requires one video track");
      plan.source = { input, byteLength: repaired.backing.byteLength, sha256: repaired.backing.sha256, release: async () => input.dispose() };
      plan.track = tracks[0]!;
      throwIfAborted(request.signal);
    }
    outputStorage = await allocateMediaTarget(media, request.format);
    const { target, path, storage } = outputStorage;
    const format = conversionFormat(media, request);
    output = new media.Output({ format, target });
    const outputTracks: import("mediabunny").OutputTrack[] = [];
    for (const plan of plans) {
      const before = output.tracks.length;
      const conversion = await media.Conversion.init({
      input: plan.source.input,
      output,
      tracks: "all",
      composable: true,
      // Preserve pre-1.56 trim behavior unless boundary-aware copying was requested.
      copy: copy === undefined
        ? (plan.firstTimestamp < plan.trim.startSeconds ? false : {})
        : copy === false ? false : { ...copy, mode: copy.mode === "required" ? "forced" : "preferred", shiftTolerance: 0 },
      trim: { start: plan.trim.startSeconds, end: plan.trim.endSeconds },
      showWarnings: false,
      video: (track: import("mediabunny").InputTrack) => track === plan.track ? videoOptions(media, format, { ...request, ...(request.video.flip !== undefined ? { flip: request.video.flip } : {}), ...(request.video.allowTransformationMetadata !== undefined ? { allowTransformationMetadata: request.video.allowTransformationMetadata } : {}) }, plan.track) : { discard: true },
      audio: (track: import("mediabunny").InputTrack) => track === plan.track ? audioOptions(media, format, request, plan.track) : { discard: true },
      });
      conversions.push(conversion);
      if (request.signal?.aborted) {
        await conversion.cancel();
        throwIfAborted(request.signal);
      }
      if (!conversion.utilizedTracks.includes(plan.track) || conversion.utilizedTracks.length !== 1 || output.tracks.length !== before + 1) {
        await conversion.cancel();
        const reason = conversion.discardedTracks.find((discarded) => discarded.track === plan.track)?.reason;
        throw new TypeError(`Conversion could not realize exactly selected track ${mediaTrackId(plan.track.type, plan.track.number)}${reason === undefined ? "" : `: ${reason}`}`);
      }
      outputTracks.push(output.tracks[before]!);
    }
    const trackPlans = Object.freeze(selected.map((selection, index) => Object.freeze({ sourceId: selection.sourceId, trackId: selection.trackId, action: outputTracks[index]!.source instanceof media.EncodedVideoPacketSource || outputTracks[index]!.source instanceof media.EncodedAudioPacketSource ? "copy" as const : "transcode" as const })));
    throwIfAborted(request.signal);
    await preflight?.(trackPlans);
    throwIfAborted(request.signal);
    await output.start();
    throwIfAborted(request.signal);
    const longest = Math.max(...plans.map((plan) => plan.trim.endSeconds - plan.trim.startSeconds));
    for (let until = 1; until < longest; until += 1) {
      throwIfAborted(request.signal);
      await Promise.all(conversions.map((conversion: import("mediabunny").Conversion) => conversion.execute({ until })));
      throwIfAborted(request.signal);
      await checkpoint(Math.min(until, Math.ceil(longest)), Math.ceil(longest));
      throwIfAborted(request.signal);
    }
    throwIfAborted(request.signal);
    await Promise.all(conversions.map((conversion: import("mediabunny").Conversion) => conversion.execute()));
    throwIfAborted(request.signal);
    await checkpoint(Math.ceil(longest), Math.ceil(longest));
    throwIfAborted(request.signal);
    finalizing();
    await output.finalize();
    throwIfAborted(request.signal);
    const backing = await storage.seal(path, request.signal);
    throwIfAborted(request.signal);
    // Copy policies can retain preroll, omit an initial GOP, or round packet ends.
    // Report observed output bounds and reject selected tracks that yielded no media.
    const resultInput = new media.Input({ source: new media.FilePathSource(path), formats: media.ALL_FORMATS });
    let observedTracks: readonly import("@superimg/types").ConversionTrackPlan[];
    let observedDuration: number;
    try {
      const resultTracks = await resultInput.getTracks();
      if (resultTracks.length !== plans.length) throw new TypeError("Conversion produced no media for a selected track");
      if (resultTracks.some((track, index) => track.type !== plans[index]!.track.type)) {
        throw new TypeError("Conversion output track order does not match selected track order");
      }
      observedTracks = Object.freeze(await Promise.all(resultTracks.map(async (track, index) => {
        const outputStartSeconds = await track.getFirstTimestamp();
        const outputEndSeconds = await inspectedDuration(resultInput, [track]);
        if (!Number.isFinite(outputStartSeconds) || !Number.isFinite(outputEndSeconds) || outputEndSeconds <= outputStartSeconds) {
          throw new TypeError(`Conversion produced no media for selected track ${selected[index]!.trackId}`);
        }
        return Object.freeze({ ...trackPlans[index]!, outputStartSeconds, outputEndSeconds });
      })));
      observedDuration = await inspectedDuration(resultInput, resultTracks);
    } finally {
      resultInput[Symbol.dispose]();
    }
    throwIfAborted(request.signal);
    completed = true;
    return { mimeType: format.mimeType, durationSeconds: copy === undefined ? longest : observedDuration, backing, tracks: observedTracks };
  } catch (error) { failed = true; primaryFailure = error; throw error; }
  finally {
    request.signal?.removeEventListener("abort", onAbort);
    if (!completed) await cancelProcessing();
    const cleanupErrors: unknown[] = [];
    for (const input of normalizedInputs) { try { input[Symbol.dispose](); } catch (error) { cleanupErrors.push(error); } }
    for (const storage of normalizedStorage) { try { await storage.dispose(); } catch (error) { cleanupErrors.push(error); } }
    for (const source of sources.values()) { try { await source.release(); } catch (error) { cleanupErrors.push(error); } }
    if (!completed || cleanupErrors.length) { try { await outputStorage?.storage.dispose(); } catch (error) { cleanupErrors.push(error); } }
    if (cleanupErrors.length) throw new AggregateError(failed ? [primaryFailure, ...cleanupErrors] : cleanupErrors, "Media conversion cleanup failed");
  }
}

/**
 * Some Matroska streams carry the sole packet's duration only in container
 * metadata. Write that evidence onto the original packet before decoding;
 * never infer timing across multiple packets.
 */
export async function repairSinglePacketDuration(
  media: typeof import("mediabunny"),
  format: import("mediabunny").OutputFormat,
  track: import("mediabunny").InputVideoTrack,
  durationSeconds: number,
  signal: AbortSignal | undefined,
  byteLimit?: number,
): Promise<{ path: string; backing: import("@superimg/core/runtime").RuntimeArtifactBacking }> {
  throwIfAborted(signal);
  let output: import("mediabunny").Output | undefined;
  let finalized = false;
  let storage: Awaited<ReturnType<typeof allocateMediaTarget>> | undefined;
  let transferred = false;
  let failure: unknown;
  try {
    const packets = new media.EncodedPacketSink(track).packets();
    const first = await packets.next();
    throwIfAborted(signal);
    const second = await packets.next();
    throwIfAborted(signal);
    if (first.done || !second.done) throw new TypeError("Conversion could not preserve metadata-only timing: expected one packet");
    if (first.value.duration > 0) throw new TypeError("Conversion timing normalization expected one zero-duration packet");
    const codec = await track.getCodec();
    throwIfAborted(signal);
    const decoderConfig = await track.getDecoderConfig();
    throwIfAborted(signal);
    if (codec === null || decoderConfig === null) throw new TypeError("Conversion could not preserve metadata-only timing: missing video codec configuration");
    storage = await allocateMediaTarget(media, "mov", byteLimit);
    const { target } = storage;
    output = new media.Output({ format, target });
    const source = new media.EncodedVideoPacketSource(codec);
    output.addVideoTrack(source, {
      transformationMatrix: await track.getTransformationMatrix(),
      canBeTransparent: await track.canBeTransparent(),
    });
    await output.start();
    throwIfAborted(signal);
    const packetDuration = durationSeconds - first.value.timestamp;
    if (!Number.isFinite(packetDuration) || packetDuration <= 0) throw new TypeError("Conversion timing metadata must end after the sole packet starts");
    const packet = new media.EncodedPacket(first.value.data, first.value.type, first.value.timestamp, packetDuration, first.value.sequenceNumber, first.value.byteLength, first.value.sideData);
    await source.add(packet, { decoderConfig });
    throwIfAborted(signal);
    await output.finalize();
    finalized = true;
    throwIfAborted(signal);
    const backing = await storage.storage.seal(storage.path, signal);
    transferred = true;
    return { path: storage.path, backing };
  } catch (error) {
    failure = error;
    if (output !== undefined && !finalized) {
      try { await output.cancel(); }
      catch (cleanupError) { failure = new AggregateError([error, cleanupError], "Timing repair cancellation failed"); }
    }
    throw failure;
  } finally {
    if (!transferred) {
      try { await storage?.storage.dispose(); }
      catch (cleanupError) { throw new AggregateError(failure === undefined ? [cleanupError] : [failure, cleanupError], "Timing repair cleanup failed"); }
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

export function conversionFormat(
  media: typeof import("mediabunny"),
  request: Pick<ConversionRequest, "format" | "encoding">,
): import("mediabunny").OutputFormat {
  const encoding = request.encoding;
  if (encoding?.capture !== undefined || encoding?.still !== undefined || encoding?.gif !== undefined) {
    throw new TypeError("Conversion does not support capture, still, or GIF encoding options");
  }
  if (encoding?.mp4 !== undefined && request.format !== "mp4") {
    throw new TypeError("Conversion mp4 options require format mp4");
  }
  if (encoding?.webm !== undefined && request.format !== "webm" && request.format !== "mkv") {
    throw new TypeError("Conversion webm options require format webm or mkv");
  }
  if (request.format === "mp4") return new media.Mp4OutputFormat(encoding?.mp4);
  if (request.format === "webm") return new media.WebMOutputFormat(encoding?.webm);
  if (request.format === "mov") return new media.MovOutputFormat();
  if (request.format === "mkv") return new media.MkvOutputFormat(encoding?.webm);
  throw new TypeError(`Unsupported conversion format ${String(request.format)}`);
}

let serverCodecsRegistered = false;
export async function ensureServerCodecs(): Promise<void> {
  if (serverCodecsRegistered) return;
  const server = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@mediabunny/server");
  server.registerMediabunnyServer();
  const dts = await import("@mediabunny/dts");
  dts.registerDtsDecoder();
  dts.registerDtsEncoder();
  serverCodecsRegistered = true;
}

export async function loadInput(input: NodeMediaInput, fetcher: FetchLike, signal?: AbortSignal): Promise<LoadedInput> {
  if (isPreparedMediaInput(input)) return await acquirePreparedMediaInput(input);
  if (input.kind === "url") {
    const prepared = await prepareMediaInput(input, { fetch: fetcher, ...(signal ? { signal } : {}) });
    try {
      const loaded = await acquirePreparedMediaInput(prepared);
      return { ...loaded, release: async () => {
        const errors: unknown[] = [];
        try { await loaded.release(); } catch (error) { errors.push(error); }
        try { await prepared.dispose(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(errors, "Media input cleanup failed");
      } };
    } catch (error) { await prepared.dispose(); throw error; }
  }
  if (input.bytes.byteLength > DEFAULT_MEDIA_INPUT_BYTES) throw new RangeError("Media input exceeds byte limit");
  const bytes = new Uint8Array(input.bytes);
  const media = await import("mediabunny");
  const source = new media.Input({ source: new media.BufferSource(bytes), formats: media.ALL_FORMATS });
  return { input: source, byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), release: async () => source.dispose() };
}

function qualityFor(media: typeof import("mediabunny"), quality: EncodingQuality | undefined): import("mediabunny").Quality | undefined {
  const normalized = normalizeEncodingQuality(quality);
  if (normalized === undefined) return undefined;
  if (typeof normalized === "string") return new media.Quality(normalized);
  return "bitrate" in normalized
    ? new media.Quality({ bitrate: normalized.bitrate, ...(normalized.mode !== undefined ? { bitrateMode: normalized.mode } : {}) })
    : new media.Quality({ quantizer: normalized.quantizer });
}

export async function videoOptions(
  media: typeof import("mediabunny"),
  format: import("mediabunny").OutputFormat,
  request: Pick<ConversionRequest, "format" | "encoding" | "resize" | "copy"> & { flip?: boolean; allowTransformationMetadata?: boolean },
  track: import("mediabunny").InputTrack,
): Promise<import("mediabunny").ConversionVideoOptions> {
  if (!track.isVideoTrack()) throw new TypeError("Conversion video selection must select a video track");
  const video = request.encoding?.video;
  const quality = qualityFor(media, video?.quality);
  const sourceCodec = await track.getCodec();
  const width = request.resize?.width ?? await track.getCodedWidth();
  const height = request.resize?.height ?? await track.getCodedHeight();
  const alpha = video?.alpha;
  const preferences = video?.codec === undefined ? undefined : (Array.isArray(video.codec) ? video.codec : [video.codec]);
  const supported = format.getSupportedVideoCodecs();
  const alphaCompatible = (codec: string) => alpha !== "keep" || ((codec === "vp9" && (request.format === "webm" || request.format === "mkv")) || (codec === "prores" && (request.format === "mov" || request.format === "mkv")));
  const candidates = (preferences ?? supported).filter((codec) => supported.includes(codec as import("mediabunny").VideoCodec) && alphaCompatible(codec));
  if (preferences !== undefined && candidates.length === 0) throw new TypeError(`No requested video codec is compatible with ${request.format}${alpha === "keep" ? " and alpha" : ""}`);
  if (alpha === "keep" && candidates.length === 0) throw new TypeError(`Format ${request.format} has no supported alpha video codec`);
  const requiresEncode = request.copy === false || request.resize !== undefined || quality !== undefined || alpha === "keep" || video?.keyFrameInterval !== undefined || video?.hardwareAcceleration !== undefined || video?.latencyMode !== undefined || (preferences !== undefined && preferences.every((codec) => codec !== sourceCodec));
  let codec: import("mediabunny").VideoCodec | undefined;
  if (request.copy && preferences !== undefined && !requiresEncode && sourceCodec !== null && candidates.includes(sourceCodec)) {
    codec = sourceCodec;
  } else if (preferences !== undefined || requiresEncode) {
    for (const candidate of candidates) {
      if (await media.canEncodeVideo(candidate as import("mediabunny").VideoCodec, { width, height, ...(quality !== undefined ? { quality } : {}), ...(alpha !== undefined ? { alpha } : {}), ...(video?.hardwareAcceleration !== undefined ? { hardwareAcceleration: video.hardwareAcceleration } : {}), ...(video?.latencyMode !== undefined ? { latencyMode: video.latencyMode } : {}) })) {
        codec = candidate as import("mediabunny").VideoCodec;
        break;
      }
    }
    if (codec === undefined) throw new TypeError(`No requested video codec can encode ${width}x${height} for ${request.format}`);
  }
  return {
    ...(request.resize === undefined ? {} : { ...request.resize, fit: request.resize.fit ?? "fill" }),
    ...(request.flip === undefined ? {} : { flip: request.flip }),
    ...(request.allowTransformationMetadata === undefined ? {} : { allowTransformationMetadata: request.allowTransformationMetadata }),
    ...(codec !== undefined ? { codec } : {}),
    ...(quality !== undefined ? { quality } : {}),
    ...(alpha !== undefined ? { alpha } : {}),
    ...(video?.hardwareAcceleration !== undefined ? { hardwareAcceleration: video.hardwareAcceleration } : {}),
    ...(video?.latencyMode !== undefined ? { latencyMode: video.latencyMode } : {}),
    ...(video?.keyFrameInterval !== undefined ? { keyFrameInterval: video.keyFrameInterval } : {}),
    ...((video?.hardwareAcceleration !== undefined || video?.latencyMode !== undefined) ? { forceTranscode: true } : {}),
  };
}

export async function audioOptions(
  media: typeof import("mediabunny"),
  format: import("mediabunny").OutputFormat,
  request: Pick<ConversionRequest, "format" | "encoding" | "copy">,
  track: import("mediabunny").InputTrack,
): Promise<import("mediabunny").ConversionAudioOptions> {
  if (!track.isAudioTrack()) throw new TypeError("Conversion audio selection must select an audio track");
  const audio = request.encoding?.audio;
  const quality = qualityFor(media, audio?.quality);
  const sourceCodec = await track.getCodec();
  const preferences = audio?.codec === undefined ? undefined : (Array.isArray(audio.codec) ? audio.codec : [audio.codec]);
  const supported = format.getSupportedAudioCodecs();
  const candidates = (preferences ?? supported).filter((codec) => supported.includes(codec as import("mediabunny").AudioCodec));
  if (preferences !== undefined && candidates.length === 0) throw new TypeError(`No requested audio codec is compatible with ${request.format}`);
  const requiresEncode = request.copy === false || quality !== undefined || (preferences !== undefined && preferences.every((codec) => codec !== sourceCodec));
  let codec: import("mediabunny").AudioCodec | undefined;
  if (request.copy && preferences !== undefined && !requiresEncode && sourceCodec !== null && candidates.includes(sourceCodec)) {
    codec = sourceCodec;
  } else if (preferences !== undefined || requiresEncode) {
    const channels = await track.getNumberOfChannels();
    const sampleRate = await track.getSampleRate();
    for (const candidate of candidates) {
      if (await media.canEncodeAudio(candidate as import("mediabunny").AudioCodec, { numberOfChannels: channels, sampleRate, ...(quality !== undefined ? { quality } : {}) })) {
        codec = candidate as import("mediabunny").AudioCodec;
        break;
      }
    }
    if (codec === undefined) throw new TypeError(`No requested audio codec can encode ${channels} channels at ${sampleRate}Hz for ${request.format}`);
  }
  return { ...(codec !== undefined ? { codec } : {}), ...(quality !== undefined ? { quality } : {}) };
}
