//! Still image encoder — Playwright buffer → PNG / WebP / JPEG via sharp.
//! Option B quality: 8-bit deband + optional 16-bit PNG masters.

import sharp, { type Sharp } from "sharp";
import type {
  StillEncodeOptions,
  StillDebandMode,
  VideoEncoder,
  VideoEncoderConfig,
  EncodedFileResult,
} from "@superimg/types";
import { debandRaw } from "./still-deband.js";
import { EncoderFileOutput } from "./encoder-file-output.js";
import { validateFrameSize } from "./encoder-frame.js";

export type StillFormat = "png" | "webp" | "jpeg";

function clampPngCompression(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(9, Math.round(value)));
}

function resolveDeband(
  format: StillFormat,
  still: StillEncodeOptions,
): { mode: StillDebandMode; strength: number } {
  const bitDepth = still.bitDepth ?? 8;
  // Writing 16-bit samples preserves the captured precision; it does not create extra precision.
  if (bitDepth === 16) return { mode: "none", strength: 0 };
  const mode: StillDebandMode =
    still.deband ?? (format === "png" ? "blue-noise" : "none");
  const strength = still.debandStrength ?? 0.35;
  return { mode, strength };
}

export class SharpStillEncoder implements VideoEncoder<Buffer> {
  private frame: Buffer | null = null;
  private width = 0;
  private height = 0;
  private still: StillEncodeOptions = {};
  private fileOutput = new EncoderFileOutput();

  constructor(private readonly format: StillFormat = "png") {}

  async init(config: VideoEncoderConfig): Promise<void> {
    validateFrameSize(config.width, config.height);
    await this.dispose();
    this.fileOutput = new EncoderFileOutput();
    this.width = config.width;
    this.height = config.height;
    this.still = config.encoding?.still ?? {};
    try {
      await this.fileOutput.reserve(config.output);
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  async addFrame(frameBuffer: Buffer): Promise<void> {
    if (!this.frame) this.frame = frameBuffer;
  }

  async finalize(): Promise<Buffer> {
    if (this.fileOutput.path) throw new Error("File output requires finalizeToFile()");
    return (await this.buildPipeline()).toBuffer();
  }

  async finalizeToFile(): Promise<EncodedFileResult> {
    if (!this.fileOutput.path) throw new Error("Encoder was not initialized with file output");
    try {
      await (await this.buildPipeline()).toFile(this.fileOutput.path);
      return await this.fileOutput.result();
    } catch (error) {
      await this.fileOutput.dispose();
      throw error;
    }
  }

  private async buildPipeline(): Promise<Sharp> {
    if (!this.frame) {
      throw new Error("SharpStillEncoder: no frame was captured");
    }

    let pipeline = sharp(this.frame);
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height || (meta.pages ?? 1) !== 1) {
      throw new TypeError("Still encoder input must contain exactly one image with known dimensions");
    }
    const needsResize =
      meta.width !== this.width || meta.height !== this.height;
    if (needsResize) {
      pipeline = pipeline.resize(this.width, this.height, {
        kernel: "lanczos3",
        fit: "fill",
      });
    }

    const quality = this.still.quality ?? 95;
    const lossless = this.still.lossless ?? this.format === "webp";
    const chroma = this.still.chromaSubsampling ?? "4:4:4";
    const bitDepth = this.still.bitDepth ?? 8;
    const { mode, strength } = resolveDeband(this.format, this.still);

    const compressionLevel = clampPngCompression(
      this.still.compressionLevel,
      bitDepth === 16 ? 9 : 4,
    );

    // 16-bit PNG master path
    if (this.format === "png" && bitDepth === 16) {
      return pipeline
        .toColourspace("rgb16")
        .png({ compressionLevel, adaptiveFiltering: true });
    }

    // Optional deband on 8-bit raw before final encode
    if (mode !== "none" && strength > 0) {
      const { data, info } = await pipeline
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const channels = (info.channels === 4 ? 4 : 3) as 3 | 4;
      const debanded = debandRaw(
        data,
        info.width,
        info.height,
        channels,
        { mode, strength },
      );
      pipeline = sharp(debanded, {
        raw: {
          width: info.width,
          height: info.height,
          channels,
        },
      });
    }

    switch (this.format) {
      case "webp":
        return pipeline
          .webp(
            lossless
              ? { lossless: true, effort: 6 }
              : { quality, effort: 6, smartSubsample: true },
          );
      case "jpeg":
        return pipeline
          .jpeg({
            quality,
            chromaSubsampling: chroma,
            mozjpeg: true,
          });
      default:
        return pipeline
          .png({
            compressionLevel,
            adaptiveFiltering: true,
          });
    }
  }

  async dispose(): Promise<void> {
    this.frame = null;
    await this.fileOutput.dispose();
  }
}
