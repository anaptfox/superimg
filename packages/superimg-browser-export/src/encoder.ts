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
  RenderExecutionOptions,
  ResolvedAudioTimeline,
  VideoCodecPreference,
} from "@superimg/types";
import { raceWithExecution, throwIfExecutionCancelled } from "@superimg/types";
import { get2DContext } from "./utils.js";

const MAX_BROWSER_AUDIO_BYTES = 256 * 1024 * 1024;

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

async function decodeAudioUrl(
  url: string,
  options?: RenderExecutionOptions,
): Promise<DecodedAudioClip> {
  throwIfExecutionCancelled(options);
  const response = await raceWithExecution(fetch(url, { signal: options?.signal }), options);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${url} (${response.status})`);
  }
  const declaredBytes = Number(response.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_BROWSER_AUDIO_BYTES) {
    throw new Error(`Audio source exceeds ${MAX_BROWSER_AUDIO_BYTES} bytes`);
  }
  if (!response.body) throw new Error(`Audio source returned an empty body: ${url}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await raceWithExecution(reader.read(), options);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BROWSER_AUDIO_BYTES) {
        await reader.cancel("audio_too_large");
        throw new Error(`Audio source exceeds ${MAX_BROWSER_AUDIO_BYTES} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const arrayBuffer = bytes.buffer;
  const audioContext = new AudioContext();
  try {
    const buffer = await raceWithExecution(audioContext.decodeAudioData(arrayBuffer), options);
    const channels: Float32Array[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
      channels.push(buffer.getChannelData(ch).slice());
    }
    return {
      channels,
      sampleRate: buffer.sampleRate,
      sourceDurationSeconds: buffer.duration,
    };
  } finally {
    await audioContext.close();
  }
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

  async setResolvedAudio(
    timeline: ResolvedAudioTimeline,
    options?: RenderExecutionOptions,
  ): Promise<void> {
    if (this.output) {
      throw new Error("setResolvedAudio must be called before init()");
    }
    this.resolvedAudio = timeline;
    this.decodedClips = [];
    for (const clip of timeline.clips) {
      const decoded = await decodeAudioUrl(clip.src, options);
      this.decodedClips.push({ decoded, resolved: clip });
    }
  }

  async init(options?: RenderExecutionOptions): Promise<void> {
    throwIfExecutionCancelled(options);
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

    await raceWithExecution(this.output.start(), options);
  }

  async addFrame(
    imageData: ImageData,
    timestamp: number,
    options?: RenderExecutionOptions,
  ): Promise<void> {
    throwIfExecutionCancelled(options);
    validateFrameDimensions(imageData, this.width, this.height);
    this.videoDuration = Math.max(this.videoDuration, timestamp + this.frameDuration);
    if (!this.canvasSource) await this.init(options);
    if (!this.canvasSource) throw new Error("Failed to initialize encoder");
    this.frameCtx.putImageData(imageData, 0, 0);
    await raceWithExecution(this.canvasSource.add(timestamp, this.frameDuration), options);
  }

  async finalize(options?: RenderExecutionOptions): Promise<Blob> {
    throwIfExecutionCancelled(options);
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
      try {
        const buffer = audioContext.createBuffer(TARGET_CHANNELS, left.length, TARGET_SAMPLE_RATE);
        buffer.copyToChannel(left, 0);
        buffer.copyToChannel(right, 1);
        await raceWithExecution(this.audioSource.add(buffer), options);
        this.audioSource.close();
      } finally {
        await audioContext.close();
      }
    }

    await raceWithExecution(this.output.finalize(), options);
    const buffer = (this.output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Failed to get encoded video buffer");
    return new Blob([buffer], {
      type: this.encoding?.format === "webm" ? "video/webm" : "video/mp4",
    });
  }

  async cancel(): Promise<void> {
    try { this.canvasSource?.close(); } catch { /* already closed */ }
    try { this.audioSource?.close(); } catch { /* already closed */ }
    if (this.output) {
      try { await this.output.cancel(); } catch { /* best-effort cleanup */ }
    }
    this.canvasSource = null;
    this.audioSource = null;
    this.output = null;
    this.decodedClips = [];
  }
}
