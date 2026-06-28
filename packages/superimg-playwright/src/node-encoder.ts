//! Server-side video+audio encoder using @mediabunny/server + sharp for JPEG decode

import type {
  ResolvedAudioTimeline,
  VideoEncoder,
  VideoEncoderConfig,
  QualityPreset,
  VideoCodecPreference,
} from "@superimg/types";
import {
  mixAudioClips,
  interleaveStereo,
  TARGET_SAMPLE_RATE,
  TARGET_CHANNELS,
  type DecodedAudioClip,
  type MixClipInput,
} from "@superimg/core";
import {
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  Output,
  VideoSampleSource,
  VideoSample,
  AudioSampleSource,
  AudioSampleSink,
  AudioSample,
  Input,
  FilePathSource,
  ALL_FORMATS,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
  QUALITY_VERY_LOW,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH,
  type Quality,
} from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import sharp from "sharp";
import { resolveLocalAssetPath } from "./resolve-local-asset-path.js";

let serverRegistered = false;

function ensureServerRegistered(): void {
  if (!serverRegistered) {
    registerMediabunnyServer();
    serverRegistered = true;
  }
}

function resolveVideoBitrate(value: number | QualityPreset | undefined): number | Quality {
  if (typeof value === "number") return value;
  switch (value) {
    case "very-low": return QUALITY_VERY_LOW;
    case "low": return QUALITY_LOW;
    case "medium": return QUALITY_MEDIUM;
    case "high": return QUALITY_HIGH;
    case "very-high": return QUALITY_VERY_HIGH;
    default: return QUALITY_HIGH;
  }
}

function resolveAudioBitrate(value: number | QualityPreset | undefined): number {
  if (typeof value === "number") return value;
  switch (value) {
    case "very-low": return 48_000;
    case "low": return 64_000;
    case "medium": return 128_000;
    case "high": return 192_000;
    case "very-high": return 256_000;
    default: return 128_000;
  }
}

function toCodecArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

async function decodeAudioFile(filePath: string): Promise<DecodedAudioClip> {
  const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(filePath) });
  const audioTrack = await input.getPrimaryAudioTrack();
  if (!audioTrack) {
    input.dispose();
    throw new Error(`[NodeVideoEncoder] No audio track found in: ${filePath}`);
  }

  const sampleRate = await audioTrack.getSampleRate();
  const numberOfChannels = await audioTrack.getNumberOfChannels();
  const sourceDuration = await input.computeDuration([audioTrack]);
  const sink = new AudioSampleSink(audioTrack);

  const chunks: Float32Array[][] = Array.from({ length: numberOfChannels }, () => []);
  for await (const sample of sink.samples()) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const size = sample.allocationSize({ planeIndex: ch, format: "f32-planar" });
      const plane = new Float32Array(size / 4);
      sample.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
      chunks[ch]!.push(plane);
    }
    sample.close();
  }
  input.dispose();

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
}

/**
 * Node.js video+audio encoder using Mediabunny server-side encoding.
 */
export class NodeVideoEncoder implements VideoEncoder<Buffer> {
  private videoSource: VideoSampleSource | null = null;
  private audioSource: AudioSampleSource | null = null;
  private output: Output | null = null;
  private width = 0;
  private height = 0;
  private fps = 0;
  private frameDuration = 0;
  private videoDuration = 0;
  private resolvedAudio: ResolvedAudioTimeline | null = null;
  private encodingConfig?: VideoEncoderConfig["encoding"];

  async init(config: VideoEncoderConfig): Promise<void> {
    ensureServerRegistered();

    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps;
    this.frameDuration = 1 / config.fps;
    this.videoDuration = 0;
    this.resolvedAudio = config.resolvedAudio ?? null;
    this.encodingConfig = config.encoding;

    const isWebM = config.encoding?.format === "webm";
    const defaultCodecs: VideoCodecPreference[] = isWebM ? ["vp9", "av1"] : ["avc", "vp9", "av1"];
    const codecPrefs = config.encoding?.video?.codec ?? defaultCodecs;

    const videoCodec = await getFirstEncodableVideoCodec(toCodecArray(codecPrefs), {
      width: this.width,
      height: this.height,
    });
    if (!videoCodec) throw new Error("No supported video codec found for server-side encoding");

    const target = new BufferTarget();
    const format = isWebM
      ? new WebMOutputFormat({
          ...(config.encoding?.webm?.minimumClusterDuration !== undefined
            ? { minimumClusterDuration: config.encoding.webm.minimumClusterDuration }
            : {}),
        })
      : new Mp4OutputFormat({
          ...(config.encoding?.mp4?.fastStart !== undefined
            ? { fastStart: config.encoding.mp4.fastStart }
            : {}),
        });

    this.output = new Output({ format, target });

    this.videoSource = new VideoSampleSource({
      codec: videoCodec,
      bitrate: resolveVideoBitrate(config.encoding?.video?.bitrate),
      keyFrameInterval: config.encoding?.video?.keyFrameInterval ?? 5,
      ...(config.encoding?.video?.bitrateMode !== undefined
        ? { bitrateMode: config.encoding.video.bitrateMode }
        : {}),
      ...(config.encoding?.video?.latencyMode !== undefined
        ? { latencyMode: config.encoding.video.latencyMode }
        : {}),
    });
    this.output.addVideoTrack(this.videoSource, { frameRate: this.fps });

    if (this.resolvedAudio?.clips.length) {
      const audioCodecPrefs = config.encoding?.audio?.codec ?? (["aac", "opus"] as const);
      const audioCodec = await getFirstEncodableAudioCodec(toCodecArray(audioCodecPrefs), {
        numberOfChannels: TARGET_CHANNELS,
        sampleRate: TARGET_SAMPLE_RATE,
        bitrate: resolveAudioBitrate(config.encoding?.audio?.bitrate),
      });
      if (!audioCodec) throw new Error("[NodeVideoEncoder] No supported audio codec found");

      this.audioSource = new AudioSampleSource({
        codec: audioCodec,
        bitrate: resolveAudioBitrate(config.encoding?.audio?.bitrate),
        ...(config.encoding?.audio?.bitrateMode !== undefined
          ? { bitrateMode: config.encoding.audio.bitrateMode }
          : {}),
      });
      this.output.addAudioTrack(this.audioSource);
    }

    await this.output.start();
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    if (!this.videoSource) throw new Error("NodeVideoEncoder not initialized");

    this.videoDuration = Math.max(this.videoDuration, timestamp + this.frameDuration);

    const { data } = await sharp(frame)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const sample = new VideoSample(data, {
      format: "RGBA",
      codedWidth: this.width,
      codedHeight: this.height,
      timestamp,
      duration: this.frameDuration,
    });

    await this.videoSource.add(sample);
    sample.close();
  }

  async finalize(): Promise<Uint8Array> {
    if (!this.videoSource || !this.output) throw new Error("NodeVideoEncoder not initialized");

    this.videoSource.close();

    if (this.audioSource && this.resolvedAudio?.clips.length) {
      await this.finalizeMixedAudio(this.resolvedAudio);
      this.audioSource.close();
    }

    await this.output.finalize();

    const buffer = (this.output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Failed to get encoded video buffer");

    return new Uint8Array(buffer);
  }

  private async finalizeMixedAudio(timeline: ResolvedAudioTimeline): Promise<void> {
    if (!this.audioSource) return;

    const videoDuration = this.videoDuration;
    const mixInputs: MixClipInput[] = [];

    for (const clip of timeline.clips) {
      const filePath = resolveLocalAssetPath(clip.src);
      if (!filePath) {
        throw new Error(
          `[NodeVideoEncoder] Audio src "${clip.src}" is not a local file path.`,
        );
      }
      const decoded = await decodeAudioFile(filePath);
      mixInputs.push({ decoded, resolved: clip });
    }

    const { left, right } = mixAudioClips(mixInputs, videoDuration, timeline.mix);
    const combined = interleaveStereo(left, right);
    const totalFrames = left.length;

    const audioSample = new AudioSample({
      data: combined.buffer,
      format: "f32-planar",
      numberOfChannels: TARGET_CHANNELS,
      sampleRate: TARGET_SAMPLE_RATE,
      timestamp: 0,
    });
    await this.audioSource.add(audioSample);
    audioSample.close();
  }

  async dispose(): Promise<void> {
    // finalize() handles resource cleanup
  }
}