import type { Quality } from "mediabunny";
import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_VERY_HIGH,
  QUALITY_VERY_LOW,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import {
  TARGET_CHANNELS,
  TARGET_SAMPLE_RATE,
  mixAudioClips,
  type DecodedAudioClip,
  type MixClipInput,
} from "@superimg/core";
import type {
  EncodingOptions,
  QualityPreset,
  ResolvedAudioTimeline,
  VideoCodecPreference,
} from "@superimg/types";
import { get2DContext } from "./utils.js";

function resolveVideoBitrate(value: number | QualityPreset | undefined): number | Quality {
  if (value === undefined || typeof value === "string") {
    return typeof value === "string" ? resolveQualityPreset(value) : QUALITY_HIGH;
  }
  return value;
}

function resolveAudioBitrate(value: number | QualityPreset | undefined): number {
  if (typeof value === "number") return value;
  switch (value) {
    case "very-low":
      return 48_000;
    case "low":
      return 64_000;
    case "medium":
      return 128_000;
    case "high":
      return 192_000;
    case "very-high":
      return 256_000;
    default:
      return 128_000;
  }
}

function resolveQualityPreset(preset: QualityPreset): Quality {
  switch (preset) {
    case "very-low":
      return QUALITY_VERY_LOW;
    case "low":
      return QUALITY_LOW;
    case "medium":
      return QUALITY_MEDIUM;
    case "high":
      return QUALITY_HIGH;
    case "very-high":
      return QUALITY_VERY_HIGH;
    default:
      return QUALITY_HIGH;
  }
}

function toCodecArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function validateFrameDimensions(
  imageData: { width: number; height: number },
  encoderWidth: number,
  encoderHeight: number,
): void {
  if (imageData.width !== encoderWidth || imageData.height !== encoderHeight) {
    throw new Error(
      `Frame dimensions ${imageData.width}x${imageData.height} do not match encoder dimensions ${encoderWidth}x${encoderHeight}`,
    );
  }
}

async function decodeAudioUrl(url: string): Promise<DecodedAudioClip> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${url} (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    channels.push(buffer.getChannelData(ch));
  }
  return {
    channels,
    sampleRate: buffer.sampleRate,
    sourceDurationSeconds: buffer.duration,
  };
}

export class BrowserEncoder {
  private canvasSource: CanvasSource | null = null;
  private audioSource: AudioBufferSource | null = null;
  private output: Output | null = null;
  private readonly width: number;
  private readonly height: number;
  private readonly fps: number;
  private readonly frameDuration: number;
  private videoDuration = 0;
  private resolvedAudio: ResolvedAudioTimeline | null = null;
  private decodedClips: MixClipInput[] = [];
  private readonly frameCanvas: OffscreenCanvas;
  private readonly frameCtx: OffscreenCanvasRenderingContext2D;
  private readonly encoding?: EncodingOptions;

  constructor(width: number, height: number, fps: number, encoding?: EncodingOptions) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.encoding = encoding;
    this.frameDuration = 1 / fps;
    this.frameCanvas = new OffscreenCanvas(width, height);
    this.frameCtx = get2DContext(this.frameCanvas);
  }

  async setResolvedAudio(timeline: ResolvedAudioTimeline): Promise<void> {
    if (this.output) {
      throw new Error("setResolvedAudio must be called before init()");
    }
    this.resolvedAudio = timeline;
    this.decodedClips = [];
    for (const clip of timeline.clips) {
      const decoded = await decodeAudioUrl(clip.src);
      this.decodedClips.push({ decoded, resolved: clip });
    }
  }

  async init(): Promise<void> {
    const isWebM = this.encoding?.format === "webm";
    const defaultCodecs: VideoCodecPreference[] = isWebM
      ? ["vp9", "av1"]
      : ["avc", "vp9", "av1"];
    const codecPrefs = this.encoding?.video?.codec ?? defaultCodecs;
    const codec = await getFirstEncodableVideoCodec(toCodecArray(codecPrefs), {
      width: this.width,
      height: this.height,
    });
    if (!codec) throw new Error("No supported video codec found");

    const outputTarget = new BufferTarget();
    const outputFormat = isWebM
      ? new WebMOutputFormat({
          ...(this.encoding?.webm?.minimumClusterDuration !== undefined
            ? { minimumClusterDuration: this.encoding.webm.minimumClusterDuration }
            : {}),
        })
      : new Mp4OutputFormat({
          ...(this.encoding?.mp4?.fastStart !== undefined
            ? { fastStart: this.encoding.mp4.fastStart }
            : {}),
        });
    this.output = new Output({ format: outputFormat, target: outputTarget });

    this.canvasSource = new CanvasSource(this.frameCanvas, {
      codec,
      bitrate: resolveVideoBitrate(this.encoding?.video?.bitrate),
      keyFrameInterval: this.encoding?.video?.keyFrameInterval ?? 5,
      sizeChangeBehavior: "deny",
      ...(this.encoding?.video?.alpha !== undefined ? { alpha: this.encoding.video.alpha } : {}),
      ...(this.encoding?.video?.bitrateMode !== undefined
        ? { bitrateMode: this.encoding.video.bitrateMode }
        : {}),
      ...(this.encoding?.video?.latencyMode !== undefined
        ? { latencyMode: this.encoding.video.latencyMode }
        : {}),
      ...(this.encoding?.video?.hardwareAcceleration !== undefined
        ? { hardwareAcceleration: this.encoding.video.hardwareAcceleration }
        : {}),
    });
    this.output.addVideoTrack(this.canvasSource, { frameRate: this.fps });

    if (this.resolvedAudio?.clips.length) {
      const codecPrefsAudio = this.encoding?.audio?.codec ?? (["aac", "opus"] as const);
      const audioCodec = await getFirstEncodableAudioCodec(toCodecArray(codecPrefsAudio), {
        numberOfChannels: TARGET_CHANNELS,
        sampleRate: TARGET_SAMPLE_RATE,
        bitrate: resolveAudioBitrate(this.encoding?.audio?.bitrate),
      });
      if (!audioCodec) throw new Error("No supported audio codec found");
      this.audioSource = new AudioBufferSource({
        codec: audioCodec,
        bitrate: resolveAudioBitrate(this.encoding?.audio?.bitrate),
        ...(this.encoding?.audio?.bitrateMode !== undefined
          ? { bitrateMode: this.encoding.audio.bitrateMode }
          : {}),
      });
      this.output.addAudioTrack(this.audioSource);
    }

    await this.output.start();
  }

  async addFrame(imageData: ImageData, timestamp: number): Promise<void> {
    validateFrameDimensions(imageData, this.width, this.height);
    this.videoDuration = Math.max(this.videoDuration, timestamp + this.frameDuration);
    if (!this.canvasSource) await this.init();
    if (!this.canvasSource) throw new Error("Failed to initialize encoder");
    this.frameCtx.putImageData(imageData, 0, 0);
    await this.canvasSource.add(timestamp, this.frameDuration);
  }

  async finalize(): Promise<Blob> {
    if (!this.canvasSource || !this.output) {
      throw new Error("Encoder not initialized");
    }
    this.canvasSource.close();

    if (this.audioSource && this.resolvedAudio && this.decodedClips.length) {
      const { left, right } = mixAudioClips(
        this.decodedClips,
        this.videoDuration,
        this.resolvedAudio.mix,
      );
      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      const buffer = audioContext.createBuffer(TARGET_CHANNELS, left.length, TARGET_SAMPLE_RATE);
      buffer.copyToChannel(left, 0);
      buffer.copyToChannel(right, 1);
      await this.audioSource.add(buffer);
      this.audioSource.close();
    }

    await this.output.finalize();
    const buffer = (this.output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Failed to get encoded video buffer");
    return new Blob([buffer], {
      type: this.encoding?.format === "webm" ? "video/webm" : "video/mp4",
    });
  }
}
