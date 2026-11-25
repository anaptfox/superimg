import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  MkvOutputFormat,
  MovOutputFormat,
  Mp4OutputFormat,
  Output,
  Quality,
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
  EncodingQuality,
  RenderExecutionOptions,
  ResolvedAudioTimeline,
  VideoCodecPreference,
} from "@superimg/types";
import { isAlphaCodecContainerCompatible, normalizeEncodingQuality, raceWithExecution, throwIfExecutionCancelled } from "@superimg/types";
import { registerDtsEncoder } from "@mediabunny/dts";
import { get2DContext } from "./utils.js";

const MAX_BROWSER_AUDIO_BYTES = 256 * 1024 * 1024;

let dtsRegistered = false;

function ensureDtsRegistered(): void {
  if (!dtsRegistered) {
    registerDtsEncoder();
    dtsRegistered = true;
  }
}

function resolveQuality(
  value: EncodingQuality | undefined,
  fallback: ConstructorParameters<typeof Quality>[0],
): Quality {
  const normalized = normalizeEncodingQuality(value);
  if (normalized === undefined || typeof normalized === "string") {
    return new Quality(normalized ?? fallback);
  }
  if ("bitrate" in normalized) {
    return new Quality({ bitrate: normalized.bitrate, ...(normalized.mode !== undefined ? { bitrateMode: normalized.mode } : {}) });
  }
  return new Quality({ quantizer: normalized.quantizer });
}

function createOutputFormat(encoding: EncodingOptions | undefined) {
  if (encoding?.format === "webm") {
    return new WebMOutputFormat({
      ...(encoding.webm?.minimumClusterDuration !== undefined
        ? { minimumClusterDuration: encoding.webm.minimumClusterDuration }
        : {}),
    });
  }
  if (encoding?.format === "mkv") {
    return new MkvOutputFormat({
      ...(encoding.webm?.minimumClusterDuration !== undefined
        ? { minimumClusterDuration: encoding.webm.minimumClusterDuration }
        : {}),
    });
  }
  const options = {
    ...(encoding?.mp4?.fastStart !== undefined
      ? { fastStart: encoding.mp4.fastStart }
      : {}),
  };
  return encoding?.format === "mov" ? new MovOutputFormat(options) : new Mp4OutputFormat(options);
}

function mimeType(format: EncodingOptions["format"]): string {
  switch (format) {
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    case "mkv": return "video/x-matroska";
    default: return "video/mp4";
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
  const response = await raceWithExecution(fetch(url, options?.signal === undefined ? {} : { signal: options.signal }), options);
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
  private readonly encoding: EncodingOptions | undefined;

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
    try {
    ensureDtsRegistered();
    const isWebM = this.encoding?.format === "webm";
    const defaultCodecs: VideoCodecPreference[] = isWebM
      ? ["vp9", "av1"]
      : ["avc", "vp9", "av1"];
    const outputFormat = createOutputFormat(this.encoding);
    const supportedCodecs = outputFormat.getSupportedVideoCodecs();
    const requested = this.encoding?.video?.codec ?? defaultCodecs;
    const codecPrefs = toCodecArray(requested).filter((codec) => supportedCodecs.includes(codec)
      && (this.encoding?.video?.alpha !== "keep" || isAlphaCodecContainerCompatible(this.encoding?.format, codec)));
    const codec = await getFirstEncodableVideoCodec(codecPrefs, {
      width: this.width,
      height: this.height,
      quality: resolveQuality(this.encoding?.video?.quality, "high"),
      ...(this.encoding?.video?.latencyMode ? { latencyMode: this.encoding.video.latencyMode } : {}),
      ...(this.encoding?.video?.alpha ? { alpha: this.encoding.video.alpha } : {}),
      ...(this.encoding?.video?.hardwareAcceleration ? { hardwareAcceleration: this.encoding.video.hardwareAcceleration } : {}),
    });
    if (!codec) throw new Error("No supported video codec found");

    const outputTarget = new BufferTarget();
    this.output = new Output({ format: outputFormat, target: outputTarget });
    this.output.setMetadataTags({ creationTime: null });

    this.canvasSource = new CanvasSource(this.frameCanvas, {
      codec,
      quality: resolveQuality(this.encoding?.video?.quality, "high"),
      keyFrameInterval: this.encoding?.video?.keyFrameInterval ?? 5,
      sizeChangeBehavior: "deny",
      ...(this.encoding?.video?.alpha !== undefined ? { alpha: this.encoding.video.alpha } : {}),
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
      let selected: { codec: import("@superimg/types").AudioCodecPreference; quality: Quality } | undefined;
      for (const candidate of toCodecArray(codecPrefsAudio).filter((codec) => outputFormat.getSupportedAudioCodecs().includes(codec))) {
        const quality = resolveQuality(this.encoding?.audio?.quality, { bitrate: candidate === "dts" ? 768_000 : 128_000 });
        if (await getFirstEncodableAudioCodec([candidate], { numberOfChannels: TARGET_CHANNELS, sampleRate: TARGET_SAMPLE_RATE, quality })) {
          selected = { codec: candidate, quality }; break;
        }
      }
      if (!selected) throw new Error("No supported audio codec found for this container and quality");
      this.audioSource = new AudioBufferSource(selected);
      this.output.addAudioTrack(this.audioSource);
    }

    await raceWithExecution(this.output.start(), options);
    } catch (error) { await this.cancel(); throw error; }
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
    let complete = false;
    try {
      throwIfExecutionCancelled(options);
      if (!this.canvasSource || !this.output) throw new Error("Encoder not initialized");
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
      complete = true;
      return new Blob([buffer], { type: mimeType(this.encoding?.format) });
    } finally {
      if (!complete) await this.cancel();
      else {
        this.canvasSource = null;
        this.audioSource = null;
        this.output = null;
        this.decodedClips = [];
        this.resolvedAudio = null;
      }
    }
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
    this.resolvedAudio = null;
  }
}
