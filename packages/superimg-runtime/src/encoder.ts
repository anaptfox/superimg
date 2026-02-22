//! Mediabunny video encoder

import type { Quality } from "mediabunny";
import {
  CanvasSource,
  AudioBufferSource,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
  QUALITY_VERY_LOW,
  QUALITY_LOW,
  QUALITY_MEDIUM,
  QUALITY_HIGH,
  QUALITY_VERY_HIGH,
} from "mediabunny";
import type { EncodingOptions, QualityPreset, AudioOptions, VideoCodecPreference } from "@superimg/types";
import { get2DContext } from "./utils.js";

function resolveVideoBitrate(
  value: number | QualityPreset | undefined
): number | Quality {
  if (value === undefined || typeof value === "string") {
    return typeof value === "string" ? resolveQualityPreset(value) : QUALITY_HIGH;
  }
  return value;
}

function resolveAudioBitrate(
  value: number | QualityPreset | undefined
): number {
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

function toCodecArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v];
}

/**
 * Validate that frame dimensions match encoder dimensions.
 * Throws if they don't match.
 */
export function validateFrameDimensions(
  imageData: { width: number; height: number },
  encoderWidth: number,
  encoderHeight: number
): void {
  if (imageData.width !== encoderWidth || imageData.height !== encoderHeight) {
    throw new Error(
      `Frame dimensions ${imageData.width}x${imageData.height} do not match encoder dimensions ${encoderWidth}x${encoderHeight}`
    );
  }
}

/**
 * Browser encoder using Mediabunny/WebCodecs for video encoding
 */
export class BrowserEncoder {
  private canvasSource: CanvasSource | null = null;
  private audioSource: AudioBufferSource | null = null;
  private output: Output | null = null;
  private width: number;
  private height: number;
  private fps: number;
  private frameDuration: number;
  private videoDuration: number = 0;
  private sourceAudioBuffer: AudioBuffer | null = null;
  private audioOptions: AudioOptions | null = null;
  private frameCanvas: OffscreenCanvas;
  private frameCtx: OffscreenCanvasRenderingContext2D;
  private encoding?: EncodingOptions;

  constructor(
    width: number,
    height: number,
    fps: number,
    encoding?: EncodingOptions
  ) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.encoding = encoding;
    this.frameDuration = 1 / fps;
    this.frameCanvas = new OffscreenCanvas(width, height);
    this.frameCtx = get2DContext(this.frameCanvas);
  }

  /**
   * Initialize the encoder
   */
  async init(): Promise<void> {
    const isWebM = this.encoding?.format === "webm";

    // Smart codec defaults: WebM doesn't support AVC
    const defaultCodecs: VideoCodecPreference[] = isWebM
      ? ["vp9", "av1"]
      : ["avc", "vp9", "av1"];
    const codecPrefs = this.encoding?.video?.codec ?? defaultCodecs;
    const codec = await getFirstEncodableVideoCodec(toCodecArray(codecPrefs), {
      width: this.width,
      height: this.height,
    });

    if (!codec) {
      throw new Error("No supported video codec found");
    }

    const outputTarget = new BufferTarget();
    this.output = new Output({
      format: isWebM ? new WebMOutputFormat() : new Mp4OutputFormat(),
      target: outputTarget,
    });

    this.canvasSource = new CanvasSource(this.frameCanvas, {
      codec,
      bitrate: resolveVideoBitrate(this.encoding?.video?.bitrate),
      keyFrameInterval: this.encoding?.video?.keyFrameInterval ?? 5,
      sizeChangeBehavior: "deny",
      alpha: this.encoding?.video?.alpha,
    });

    this.output.addVideoTrack(this.canvasSource, { frameRate: this.fps });

    if (this.audioSource) {
      this.output.addAudioTrack(this.audioSource);
    }

    await this.output.start();
  }

  /**
   * Set audio track for the video
   * Must be called before init()
   */
  async setAudioTrack(audioUrl: string, options: AudioOptions): Promise<void> {
    if (this.output) {
      throw new Error("setAudioTrack must be called before init()");
    }

    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${audioUrl} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();

    const audioContext = new AudioContext();
    this.sourceAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    this.audioOptions = options;

    const { numberOfChannels, sampleRate } = this.sourceAudioBuffer;

    const codecPrefs = this.encoding?.audio?.codec ?? (["aac", "opus"] as const);
    const audioCodec = await getFirstEncodableAudioCodec(
      toCodecArray(codecPrefs),
      {
        numberOfChannels,
        sampleRate,
        bitrate: resolveAudioBitrate(this.encoding?.audio?.bitrate),
      }
    );

    if (!audioCodec) {
      throw new Error("No supported audio codec found");
    }

    this.audioSource = new AudioBufferSource({
      codec: audioCodec,
      bitrate: resolveAudioBitrate(this.encoding?.audio?.bitrate),
    });
  }

  /**
   * Add a frame to the encoder
   */
  async addFrame(imageData: ImageData, timestamp: number): Promise<void> {
    validateFrameDimensions(imageData, this.width, this.height);

    this.videoDuration = Math.max(
      this.videoDuration,
      timestamp + this.frameDuration
    );
    if (!this.canvasSource) {
      await this.init();
    }

    if (!this.canvasSource) {
      throw new Error("Failed to initialize encoder");
    }

    this.frameCtx.putImageData(imageData, 0, 0);
    await this.canvasSource.add(timestamp, this.frameDuration);
  }

  /**
   * Process source audio with looping, volume, and fade effects into a single AudioBuffer
   */
  private processAudio(
    audioContext: AudioContext,
    videoDuration: number
  ): AudioBuffer {
    const src = this.sourceAudioBuffer!;
    const opts = this.audioOptions!;
    const loop = opts.loop ?? true;
    const volume = opts.volume ?? 1;
    const fadeIn = opts.fadeIn ?? 0;
    const fadeOut = opts.fadeOut ?? 0;

    const sampleRate = src.sampleRate;
    const numberOfChannels = src.numberOfChannels;
    const totalFrames = Math.ceil(videoDuration * sampleRate);
    const srcDuration = src.duration;
    const srcTotalSamples = src.length;

    const out = audioContext.createBuffer(
      numberOfChannels,
      totalFrames,
      sampleRate
    );

    for (let ch = 0; ch < numberOfChannels; ch++) {
      const srcData = src.getChannelData(ch);
      const outData = out.getChannelData(ch);

      for (let i = 0; i < totalFrames; i++) {
        const t = i / sampleRate;
        let sample: number;

        if (loop) {
          const tInSrc = t % srcDuration;
          const srcIdx = Math.min(
            Math.floor(tInSrc * sampleRate),
            srcTotalSamples - 1
          );
          sample = srcData[srcIdx];
        } else if (t < srcDuration) {
          const srcIdx = Math.min(
            Math.floor(t * sampleRate),
            srcTotalSamples - 1
          );
          sample = srcData[srcIdx];
        } else {
          sample = 0;
        }

        sample *= volume;

        if (t < fadeIn && fadeIn > 0) {
          sample *= t / fadeIn;
        }
        if (t > videoDuration - fadeOut && fadeOut > 0) {
          sample *= Math.max(0, (videoDuration - t) / fadeOut);
        }

        outData[i] = sample;
      }
    }

    return out;
  }

  /**
   * Finalize encoding and return video blob
   */
  async finalize(): Promise<Blob> {
    if (!this.canvasSource || !this.output) {
      throw new Error("Encoder not initialized");
    }

    this.canvasSource.close();

    if (this.audioSource && this.sourceAudioBuffer && this.audioOptions) {
      const audioContext = new AudioContext({
        sampleRate: this.sourceAudioBuffer.sampleRate,
      });
      const processedBuffer = this.processAudio(
        audioContext,
        this.videoDuration
      );
      await this.audioSource.add(processedBuffer);
      this.audioSource.close();
    }

    await this.output.finalize();

    const buffer = (this.output.target as BufferTarget).buffer;

    if (!buffer) {
      throw new Error("Failed to get encoded video buffer");
    }

    const mimeType = this.encoding?.format === "webm" ? "video/webm" : "video/mp4";
    return new Blob([buffer], { type: mimeType });
  }
}
