//! Server-side video+audio encoder using @mediabunny/server + sharp for JPEG decode

import type { VideoEncoder, VideoEncoderConfig, QualityPreset, VideoCodecPreference, AudioOptions } from "@superimg/types";
import { resolveAudio } from "@superimg/core";
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

/**
 * Extract a local absolute file path from an audio src.
 * Handles two cases:
 *  1. localhost asset URL: http://localhost:PORT/assets?path=<encodedAbsolutePath>
 *  2. Already an absolute path: /path/to/file.mp3
 */
function extractAudioFilePath(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.searchParams.get("path");
    }
    return null; // remote URL — not supported
  } catch {
    // Not a valid URL — treat as a direct file path
    return src.startsWith("/") ? src : null;
  }
}

interface AudioPipeline {
  input: Input;
  sink: AudioSampleSink;
  source: AudioSampleSource;
  sampleRate: number;
  numberOfChannels: number;
  sourceDuration: number;
  opts: AudioOptions;
}

/**
 * Node.js video+audio encoder using Mediabunny server-side encoding.
 * Accepts JPEG or PNG buffers from Playwright screenshots.
 */
export class NodeVideoEncoder implements VideoEncoder<Buffer> {
  private videoSource: VideoSampleSource | null = null;
  private output: Output | null = null;
  private width = 0;
  private height = 0;
  private fps = 0;
  private frameDuration = 0;
  private videoDuration = 0;
  private audio: AudioPipeline | null = null;

  async init(config: VideoEncoderConfig): Promise<void> {
    ensureServerRegistered();

    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps;
    this.frameDuration = 1 / config.fps;
    this.videoDuration = 0;

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
      ? new WebMOutputFormat({ minimumClusterDuration: config.encoding?.webm?.minimumClusterDuration })
      : new Mp4OutputFormat({ fastStart: config.encoding?.mp4?.fastStart ?? undefined });

    this.output = new Output({ format, target });

    this.videoSource = new VideoSampleSource({
      codec: videoCodec,
      bitrate: resolveVideoBitrate(config.encoding?.video?.bitrate),
      keyFrameInterval: config.encoding?.video?.keyFrameInterval ?? 5,
      bitrateMode: config.encoding?.video?.bitrateMode,
      latencyMode: config.encoding?.video?.latencyMode,
    });
    this.output.addVideoTrack(this.videoSource, { frameRate: this.fps });

    // Set up audio pipeline if audio is configured
    if (config.audio) {
      const resolved = resolveAudio(config.audio);
      const filePath = extractAudioFilePath(resolved.src);
      if (!filePath) {
        throw new Error(`[NodeVideoEncoder] Audio src "${resolved.src}" is not a local file path. Remote audio URLs are not supported in server-side mode.`);
      }

      const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(filePath) });
      const audioTrack = await input.getPrimaryAudioTrack();
      if (!audioTrack) throw new Error(`[NodeVideoEncoder] No audio track found in: ${filePath}`);

      const sampleRate = await audioTrack.getSampleRate();
      const numberOfChannels = await audioTrack.getNumberOfChannels();
      const sourceDuration = await input.computeDuration([audioTrack]);

      const audioCodecPrefs = config.encoding?.audio?.codec ?? (["aac", "opus"] as const);
      const audioCodec = await getFirstEncodableAudioCodec(toCodecArray(audioCodecPrefs), {
        numberOfChannels,
        sampleRate,
        bitrate: resolveAudioBitrate(config.encoding?.audio?.bitrate),
      });
      if (!audioCodec) throw new Error("[NodeVideoEncoder] No supported audio codec found");

      const audioSource = new AudioSampleSource({
        codec: audioCodec,
        bitrate: resolveAudioBitrate(config.encoding?.audio?.bitrate),
        bitrateMode: config.encoding?.audio?.bitrateMode,
      });
      this.output.addAudioTrack(audioSource);

      this.audio = {
        input,
        sink: new AudioSampleSink(audioTrack),
        source: audioSource,
        sampleRate,
        numberOfChannels,
        sourceDuration,
        opts: { src: resolved.src, loop: resolved.loop, volume: resolved.volume, fadeIn: resolved.fadeIn, fadeOut: resolved.fadeOut },
      };
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

    if (this.audio) {
      await this.finalizeAudio(this.audio);
      this.audio.source.close();
      this.audio.input.dispose();
    }

    await this.output.finalize();

    const buffer = (this.output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("Failed to get encoded video buffer");

    return new Uint8Array(buffer);
  }

  private async finalizeAudio(audio: AudioPipeline): Promise<void> {
    const { sink, source, sampleRate, numberOfChannels, sourceDuration, opts, videoDuration = this.videoDuration } = audio;
    const { loop = true, volume = 1, fadeIn = 0, fadeOut = 0 } = opts;

    // Decode all source audio samples into per-channel Float32 arrays.
    // Collect chunks first, then concat once to avoid O(n²) re-allocation per sample.
    const chunks: Float32Array[][] = Array.from({ length: numberOfChannels }, () => []);
    for await (const sample of sink.samples()) {
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const size = sample.allocationSize({ planeIndex: ch, format: "f32-planar" });
        const plane = new Float32Array(size / 4);
        sample.copyTo(plane, { planeIndex: ch, format: "f32-planar" });
        chunks[ch].push(plane);
      }
      sample.close();
    }
    const srcChannels: Float32Array[] = chunks.map((chunkList) => {
      const totalLen = chunkList.reduce((sum, c) => sum + c.length, 0);
      const out = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of chunkList) { out.set(chunk, offset); offset += chunk.length; }
      return out;
    });

    const srcTotalFrames = srcChannels[0].length;
    const totalOutputFrames = Math.ceil(this.videoDuration * sampleRate);

    // Build processed output: apply loop, volume, fade in/out
    const outChannels: Float32Array[] = Array.from({ length: numberOfChannels }, () => new Float32Array(totalOutputFrames));
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const src = srcChannels[ch];
      const out = outChannels[ch];
      for (let i = 0; i < totalOutputFrames; i++) {
        const t = i / sampleRate;
        let s: number;
        if (loop) {
          const tInSrc = t % sourceDuration;
          s = src[Math.min(Math.floor(tInSrc * sampleRate), srcTotalFrames - 1)];
        } else if (t < sourceDuration) {
          s = src[Math.min(Math.floor(t * sampleRate), srcTotalFrames - 1)];
        } else {
          s = 0;
        }
        s *= volume;
        if (fadeIn > 0 && t < fadeIn) s *= t / fadeIn;
        if (fadeOut > 0 && t > this.videoDuration - fadeOut) s *= Math.max(0, (this.videoDuration - t) / fadeOut);
        out[i] = s;
      }
    }

    // Combine into f32-planar layout: [ch0_frames..., ch1_frames..., ...]
    const combined = new Float32Array(totalOutputFrames * numberOfChannels);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      combined.set(outChannels[ch], ch * totalOutputFrames);
    }

    const audioSample = new AudioSample({
      data: combined.buffer,
      format: "f32-planar",
      numberOfChannels,
      sampleRate,
      timestamp: 0,
    });
    await source.add(audioSample);
    audioSample.close();
  }

  async dispose(): Promise<void> {
    // finalize() handles resource cleanup
  }
}
