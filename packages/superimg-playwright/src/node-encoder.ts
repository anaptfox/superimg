//! Server-side video+audio encoder with explicit capture dimensions and bounded file output.

import type {
  ResolvedAudioTimeline,
  VideoEncoder,
  VideoEncoderConfig,
  VideoCodecPreference,
  EncodingQuality,
  EncodedFileResult,
  VideoEncoderDiagnostics,
} from "@superimg/types";
import { isAlphaCodecContainerCompatible } from "@superimg/types";
import {
  mixAudioClips,
  TARGET_SAMPLE_RATE,
  TARGET_CHANNELS,
  type DecodedAudioClip,
  type MixClipInput,
} from "@superimg/core";
import {
  BufferTarget,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  WebMOutputFormat,
  Output,
  VideoSampleSource,
  VideoSample,
  AudioSampleSource,
  AudioSampleSink,
  AudioSample,
  Input,
  BufferSource,
  FilePathSource,
  FilePathTarget,
  ALL_FORMATS,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
  Quality,
} from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { registerDtsEncoder } from "@mediabunny/dts";
import { resolveLocalAssetPath } from "./resolve-local-asset-path.js";
import { decodeEncoderFrame, validateFrameSize, type CapturedFrame } from "./encoder-frame.js";
import { EncoderFileOutput } from "./encoder-file-output.js";
import { resolveNodeVideoQualityOptions, resolveNodeAudioQualityOptions } from "./encoder-quality.js";

export type { CapturedFrame, RawRgbaFrame } from "./encoder-frame.js";

let serverRegistered = false;

function ensureServerRegistered(): void {
  if (!serverRegistered) {
    registerMediabunnyServer();
    registerDtsEncoder();
    serverRegistered = true;
  }
}

function createOutputFormat(config: VideoEncoderConfig["encoding"], fileOutput: boolean) {
  if (config?.format === "webm") {
    return new WebMOutputFormat({
      ...(config.webm?.minimumClusterDuration !== undefined
        ? { minimumClusterDuration: config.webm.minimumClusterDuration }
        : {}),
    });
  }
  if (config?.format === "mkv") {
    return new MkvOutputFormat({
      ...(config.webm?.minimumClusterDuration !== undefined
        ? { minimumClusterDuration: config.webm.minimumClusterDuration }
        : {}),
    });
  }
  const options = {
    // Seekable host files can stream packets and write their index at the end.
    // In-memory fast start would retain the whole movie despite selecting a file target.
    ...(fileOutput ? { fastStart: config?.mp4?.fastStart ?? false } : config?.mp4?.fastStart !== undefined
      ? { fastStart: config.mp4.fastStart }
      : {}),
  };
  return config?.format === "mov" ? new MovOutputFormat(options) : new Mp4OutputFormat(options);
}

function toCodecArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

function audioQuality(codec: string, value: EncodingQuality | undefined): Quality {
  return new Quality(resolveNodeAudioQualityOptions(codec, value));
}

async function decodeAudioSource(src: string): Promise<DecodedAudioClip> {
  const filePath = resolveLocalAssetPath(src);
  const source = filePath !== null
    ? new FilePathSource(filePath)
    : new BufferSource(await readAudioUrl(src));
  const input = new Input({ formats: ALL_FORMATS, source });
  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      throw new Error(`[NodeVideoEncoder] No audio track found in: ${src}`);
    }

    const sampleRate = await audioTrack.getSampleRate();
    const numberOfChannels = await audioTrack.getNumberOfChannels();
    const sourceDuration = await input.computeDuration([audioTrack]);
    const sink = new AudioSampleSink(audioTrack);
    const chunks: Float32Array[][] = Array.from({ length: numberOfChannels }, () => []);
    for await (const sample of sink.samples()) {
      try {
        for (let ch = 0; ch < numberOfChannels; ch++) {
          const size = sample.allocationSize({ planeIndex: ch, format: "f32-planar" });
          const plane = new Float32Array(size / 4);
          sample.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
          chunks[ch]!.push(plane);
        }
      } finally {
        sample.close();
      }
    }

    const channels = chunks.map((chunkList) => {
      const totalLen = chunkList.reduce((sum, c) => sum + c.length, 0);
      const out = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of chunkList) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return out;
    });

    return { channels, sampleRate, sourceDurationSeconds: sourceDuration };
  } finally {
    input.dispose();
  }
}

async function readAudioUrl(src: string): Promise<Uint8Array> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`[NodeVideoEncoder] Failed to fetch audio: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * Node.js video+audio encoder using Mediabunny server-side encoding.
 */
export class NodeVideoEncoder implements VideoEncoder<CapturedFrame> {
  private videoSource: VideoSampleSource | null = null;
  private audioSource: AudioSampleSource | null = null;
  private output: Output | null = null;
  private width = 0;
  private height = 0;
  private fps = 0;
  private frameDuration = 0;
  private videoDuration = 0;
  private resolvedAudio: ResolvedAudioTimeline | null = null;
  private fileOutput = new EncoderFileOutput();
  private plannedDuration: number | undefined;
  private mixedAudio: ReturnType<typeof mixAudioClips> | null = null;
  private audioFramesSubmitted = 0;

  async init(config: VideoEncoderConfig): Promise<void> {
    if (this.output) throw new Error("NodeVideoEncoder is already initialized");
    this.fileOutput = new EncoderFileOutput();
    try {
      await this.initialize(config);
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  private async initialize(config: VideoEncoderConfig): Promise<void> {
    validateFrameSize(config.width, config.height);
    if (!Number.isFinite(config.fps) || config.fps <= 0) throw new TypeError("Encoder fps must be positive and finite");
    if (config.durationSeconds !== undefined && (!Number.isFinite(config.durationSeconds) || config.durationSeconds <= 0)) {
      throw new TypeError("Encoder durationSeconds must be positive and finite");
    }
    if (config.output && config.encoding?.mp4?.fastStart === "in-memory") {
      throw new TypeError("File output cannot use in-memory fast start; use false or fragmented");
    }
    const quality = new Quality(resolveNodeVideoQualityOptions(config.encoding?.video?.quality, config.encoding?.video?.hardwareAcceleration));
    ensureServerRegistered();

    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps;
    this.frameDuration = 1 / config.fps;
    this.videoDuration = 0;
    this.resolvedAudio = config.resolvedAudio ?? null;
    this.plannedDuration = config.durationSeconds ?? config.resolvedAudio?.videoDurationSeconds;
    this.mixedAudio = null;
    this.audioFramesSubmitted = 0;

    const isWebM = config.encoding?.format === "webm";
    const defaultCodecs: VideoCodecPreference[] = isWebM ? ["vp9", "av1"] : ["avc", "vp9", "av1"];
    const format = createOutputFormat(config.encoding, config.output !== undefined);
    const supportedCodecs = format.getSupportedVideoCodecs();
    const requested = config.encoding?.video?.codec ?? defaultCodecs;
    const codecPrefs = toCodecArray(requested).filter((codec) => supportedCodecs.includes(codec)
      && (config.encoding?.video?.alpha !== "keep" || isAlphaCodecContainerCompatible(config.encoding?.format, codec)));

    const videoCodec = await getFirstEncodableVideoCodec(codecPrefs, {
      width: this.width,
      height: this.height,
      quality,
      ...(config.encoding?.video?.latencyMode ? { latencyMode: config.encoding.video.latencyMode } : {}),
      ...(config.encoding?.video?.alpha ? { alpha: config.encoding.video.alpha } : {}),
      ...(config.encoding?.video?.hardwareAcceleration ? { hardwareAcceleration: config.encoding.video.hardwareAcceleration } : {}),
    });
    if (!videoCodec) throw new Error("No supported video codec found for server-side encoding");

    let selectedConfig: VideoEncoderDiagnostics | undefined;
    let diagnosticsReported = false;
    this.videoSource = new VideoSampleSource({
      codec: videoCodec,
      quality,
      keyFrameInterval: config.encoding?.video?.keyFrameInterval ?? 5,
      ...(config.encoding?.video?.alpha !== undefined ? { alpha: config.encoding.video.alpha } : {}),
      ...(config.encoding?.video?.latencyMode !== undefined
        ? { latencyMode: config.encoding.video.latencyMode }
        : {}),
      ...(config.encoding?.video?.hardwareAcceleration !== undefined
        ? { hardwareAcceleration: config.encoding.video.hardwareAcceleration }
        : {}),
      onEncoderConfig: (candidate) => {
        selectedConfig = {
          codec: videoCodec,
          codecString: candidate.codec,
          width: candidate.width,
          height: candidate.height,
          ...(candidate.bitrateMode !== undefined ? { rateControl: candidate.bitrateMode } : {}),
          hardwarePreference: config.encoding?.video?.hardwareAcceleration ?? "no-preference",
          inputPixelFormat: "RGBA",
        };
      },
      onEncodedPacket: (_packet, metadata) => {
        // onEncoderConfig can describe rejected candidates. A packet confirms the selected one.
        if (diagnosticsReported || !selectedConfig) return;
        diagnosticsReported = true;
        try {
          const codecString = metadata?.decoderConfig?.codec ?? selectedConfig.codecString;
          const observed = config.onDiagnostics?.({ ...selectedConfig, ...(codecString !== undefined ? { codecString } : {}) });
          void Promise.resolve(observed).catch(() => {});
        } catch { /* Observation must not change encoding. */ }
      },
    });

    if (this.resolvedAudio?.clips.length) {
      const audioCodecPrefs = config.encoding?.audio?.codec ?? (["aac", "opus"] as const);
      const audioCandidates = toCodecArray(audioCodecPrefs).filter((codec) => format.getSupportedAudioCodecs().includes(codec));
      let audioCodec: import("mediabunny").AudioCodec | null = null;
      let selectedAudioQuality: Quality | undefined;
      for (const candidate of audioCandidates) {
        const quality = audioQuality(candidate, config.encoding?.audio?.quality);
        if (await getFirstEncodableAudioCodec([candidate], {
          numberOfChannels: TARGET_CHANNELS,
          sampleRate: TARGET_SAMPLE_RATE,
          quality,
        })) {
          audioCodec = candidate;
          selectedAudioQuality = quality;
          break;
        }
      }
      if (!audioCodec) throw new Error("[NodeVideoEncoder] No supported audio codec found");

      this.audioSource = new AudioSampleSource({
        codec: audioCodec,
        quality: selectedAudioQuality!,
      });
    }

    // Validate codecs and sources before opening the host's output file.
    await this.fileOutput.reserve(config.output);
    const target = this.fileOutput.path
      ? new FilePathTarget(this.fileOutput.path, { chunked: true, chunkSize: 4 * 1024 * 1024 })
      : new BufferTarget();
    this.output = new Output({ format, target });
    this.output.setMetadataTags({ creationTime: null });
    this.output.addVideoTrack(this.videoSource, { frameRate: this.fps });
    if (this.audioSource) this.output.addAudioTrack(this.audioSource);
    await this.output.start();
  }

  async addFrame(frame: CapturedFrame, timestamp: number): Promise<void> {
    if (!this.videoSource) throw new Error("NodeVideoEncoder not initialized");
    if (!Number.isFinite(timestamp) || timestamp < 0) throw new TypeError("Encoder timestamp must be nonnegative and finite");
    const data = await decodeEncoderFrame(frame, this.width, this.height);

    const sample = new VideoSample(data, {
      format: "RGBA",
      codedWidth: this.width,
      codedHeight: this.height,
      timestamp,
      duration: this.frameDuration,
    });

    try {
      // Keep both tracks moving so the muxer does not retain a whole movie while waiting for audio.
      if (this.audioSource && this.plannedDuration !== undefined) {
        await this.prepareMixedAudio(this.plannedDuration);
        await this.submitAudioThrough(timestamp + this.frameDuration);
      }
      await this.videoSource.add(sample).catch((error) => {
        throw new Error(`Video frame at ${timestamp}s: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      });
      this.videoDuration = Math.max(this.videoDuration, timestamp + this.frameDuration);
    } finally {
      sample.close();
    }
  }

  async finalize(): Promise<Uint8Array> {
    if (this.fileOutput.path) throw new Error("File output requires finalizeToFile()");
    const target = await this.finish();
    if (!(target instanceof BufferTarget) || !target.buffer) throw new Error("Failed to get encoded video buffer");
    // This is a view over the target's ArrayBuffer, not another full-output copy.
    const bytes = new Uint8Array(target.buffer);
    return bytes;
  }

  async finalizeToFile(): Promise<EncodedFileResult> {
    if (!this.fileOutput.path) throw new Error("Encoder was not initialized with file output");
    await this.finish();
    try {
      return await this.fileOutput.result();
    } catch (error) {
      await this.fileOutput.dispose();
      throw error;
    }
  }

  private async finish(): Promise<Output["target"]> {
    if (!this.videoSource || !this.output) throw new Error("NodeVideoEncoder not initialized");
    const output = this.output;
    try {
      this.videoSource.close();

      if (this.audioSource && this.resolvedAudio?.clips.length) {
        // Legacy callers without a declared duration still mix against the frames actually submitted.
        await this.prepareMixedAudio(this.plannedDuration ?? this.videoDuration);
        await this.submitAudioThrough(this.videoDuration);
        this.audioSource.close();
      }

      await output.finalize();
      return output.target;
    } catch (error) {
      try { await output.cancel(); } catch { /* Preserve the original failure. */ }
      await this.fileOutput.dispose();
      throw error;
    } finally {
      this.videoSource = null;
      this.audioSource = null;
      this.output = null;
      this.resolvedAudio = null;
      this.mixedAudio = null;
    }
  }

  private async prepareMixedAudio(duration: number): Promise<void> {
    if (this.mixedAudio || !this.resolvedAudio) return;
    const timeline = this.resolvedAudio;
    const mixInputs: MixClipInput[] = [];
    const sources = new Map<string, DecodedAudioClip>();
    for (const clip of timeline.clips) {
      const decoded = sources.get(clip.src) ?? await decodeAudioSource(clip.src);
      sources.set(clip.src, decoded);
      mixInputs.push({ decoded, resolved: clip });
    }
    this.mixedAudio = mixAudioClips(mixInputs, duration, timeline.mix);
    const invalidLeft = this.mixedAudio.left.findIndex((value) => !Number.isFinite(value));
    const invalidRight = this.mixedAudio.right.findIndex((value) => !Number.isFinite(value));
    if (invalidLeft >= 0 || invalidRight >= 0) {
      throw new Error(`Narration mix contains non-finite samples (left ${invalidLeft}, right ${invalidRight})`);
    }
  }

  private async submitAudioThrough(seconds: number): Promise<void> {
    if (!this.audioSource || !this.mixedAudio) return;
    const { left, right } = this.mixedAudio;
    const end = Math.min(left.length, Math.ceil(seconds * TARGET_SAMPLE_RATE));
    while (this.audioFramesSubmitted < end) {
      const start = this.audioFramesSubmitted;
      const count = Math.min(4096, end - start);
      const planes = new Float32Array(count * TARGET_CHANNELS);
      planes.set(left.subarray(start, start + count));
      planes.set(right.subarray(start, start + count), count);
      const sample = new AudioSample({
        data: planes,
        format: "f32-planar",
        numberOfChannels: TARGET_CHANNELS,
        sampleRate: TARGET_SAMPLE_RATE,
        timestamp: start / TARGET_SAMPLE_RATE,
      });
      try {
        await this.audioSource.add(sample).catch((error) => {
          throw new Error(`Narration samples ${start}–${start + count}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        });
        this.audioFramesSubmitted += count;
      } finally {
        sample.close();
      }
    }
  }

  async dispose(): Promise<void> {
    try { this.videoSource?.close(); } catch { /* already closed */ }
    try { this.audioSource?.close(); } catch { /* already closed */ }
    if (this.output) {
      try { await this.output.cancel(); } catch { /* best-effort cleanup */ }
    }
    this.videoSource = null;
    this.audioSource = null;
    this.output = null;
    this.resolvedAudio = null;
    this.mixedAudio = null;
    await this.fileOutput.dispose();
  }
}
