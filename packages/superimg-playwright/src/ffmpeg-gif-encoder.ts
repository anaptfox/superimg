//! FFmpeg GIF encoder with asynchronous scratch staging and optional host-owned file output.

import { execa } from "execa";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { EncodedFileResult, VideoEncoder, VideoEncoderConfig } from "@superimg/types";
import { EncoderFileOutput } from "./encoder-file-output.js";
import { validateFrameSize } from "./encoder-frame.js";

function detectFrameExt(frame: Buffer): string {
  // JPEG: FF D8 FF
  if (frame[0] === 0xff && frame[1] === 0xd8 && frame[2] === 0xff) return "jpg";
  // PNG: 89 50 4E 47
  if (frame[0] === 0x89 && frame[1] === 0x50 && frame[2] === 0x4e && frame[3] === 0x47) return "png";
  throw new TypeError("GIF frames must be encoded PNG or JPEG screenshots");
}

export class FfmpegGifEncoder implements VideoEncoder<Buffer> {
  private frameDir = "";
  private frameCount = 0;
  private fps = 30;
  private frameExt = "png";
  private gifOptions: { maxColors?: number; loop?: number; dither?: string } = {};
  private width = 0;
  private height = 0;
  private fileOutput = new EncoderFileOutput();
  private finalized = false;

  async init(config: VideoEncoderConfig): Promise<void> {
    if (this.frameDir) throw new Error("FfmpegGifEncoder is already initialized");
    validateFrameSize(config.width, config.height);
    if (!Number.isFinite(config.fps) || config.fps <= 0) throw new TypeError("GIF fps must be positive and finite");
    this.width = config.width;
    this.height = config.height;
    this.fps = config.fps;
    this.gifOptions = config.encoding?.gif ?? {};
    this.frameCount = 0;
    this.finalized = false;
    this.fileOutput = new EncoderFileOutput();

    try {
      await execa("ffmpeg", ["-version"]);
    } catch {
      throw new Error(
        "ffmpeg is required for GIF output but was not found on PATH.\n" +
        "Install it: https://ffmpeg.org/download.html\n" +
        "  macOS:   brew install ffmpeg\n" +
        "  Ubuntu:  sudo apt install ffmpeg\n" +
        "  Windows: winget install ffmpeg"
      );
    }

    try {
      this.frameDir = await mkdtemp(join(tmpdir(), "superimg-gif-"));
      await this.fileOutput.reserve(config.output);
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }

  async addFrame(frame: Buffer, _timestamp: number): Promise<void> {
    if (!this.frameDir || this.finalized) throw new Error("FfmpegGifEncoder is not accepting frames");
    const extension = detectFrameExt(frame);
    if (this.frameCount === 0) {
      this.frameExt = extension;
    }
    if (extension !== this.frameExt) throw new TypeError("GIF capture format must stay consistent across frames");
    const padded = String(this.frameCount).padStart(5, "0");
    await writeFile(join(this.frameDir, `frame_${padded}.${this.frameExt}`), frame);
    this.frameCount++;
  }

  async finalize(): Promise<Uint8Array> {
    if (this.fileOutput.path) throw new Error("File output requires finalizeToFile()");
    return readFile(await this.finish());
  }

  async finalizeToFile(): Promise<EncodedFileResult> {
    if (!this.fileOutput.path) throw new Error("Encoder was not initialized with file output");
    try {
      await this.finish();
      return await this.fileOutput.result();
    } catch (error) {
      await this.fileOutput.dispose();
      throw error;
    }
  }

  private async finish(): Promise<string> {
    if (!this.frameDir || !this.frameCount || this.finalized) throw new Error("GIF encoder has no pending frames");
    this.finalized = true;
    const palettePath = join(this.frameDir, "palette.png");
    const outputPath = this.fileOutput.path ?? join(this.frameDir, "output.gif");
    const maxColors = this.gifOptions.maxColors ?? 256;
    const dither = this.gifOptions.dither ?? "sierra2_4a";
    const loop = this.gifOptions.loop ?? 0;
    const inputPattern = join(this.frameDir, `frame_%05d.${this.frameExt}`);
    const scale = `scale=${this.width}:${this.height}:flags=lanczos`;

    // Pass 1: global palette across all frames (prevents color popping)
    await execa("ffmpeg", [
      "-y",
      "-framerate", String(this.fps),
      "-i", inputPattern,
      "-vf", `${scale},palettegen=max_colors=${maxColors}:stats_mode=full:reserve_transparent=1`,
      palettePath,
    ]);

    // Pass 2: encode with bounding-box delta + dither
    await execa("ffmpeg", [
      "-y",
      "-framerate", String(this.fps),
      "-i", inputPattern,
      "-i", palettePath,
      "-filter_complex", `[0:v]${scale}[scaled];[scaled][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`,
      "-loop", String(loop),
      outputPath,
    ]);

    return outputPath;
  }

  async dispose(): Promise<void> {
    if (this.frameDir) {
      await rm(this.frameDir, { recursive: true, force: true });
      this.frameDir = "";
    }
    await this.fileOutput.dispose();
  }
}
