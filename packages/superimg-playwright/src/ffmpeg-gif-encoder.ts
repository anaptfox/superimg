//! FFmpeg-based GIF encoder - renders frames to temp PNGs then encodes via ffmpeg

import { execa } from "execa";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { VideoEncoder, VideoEncoderConfig } from "@superimg/types";

export class FfmpegGifEncoder implements VideoEncoder<Buffer> {
  private frameDir = "";
  private frameCount = 0;
  private fps = 30;
  private gifOptions: { maxColors?: number; loop?: number; dither?: string } = {};

  async init(config: VideoEncoderConfig): Promise<void> {
    this.fps = config.fps;
    this.gifOptions = config.encoding?.gif ?? {};

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

    this.frameDir = join(tmpdir(), `superimg-gif-${Date.now()}`);
    mkdirSync(this.frameDir, { recursive: true });
  }

  async addFrame(frame: Buffer, _timestamp: number): Promise<void> {
    const padded = String(this.frameCount).padStart(5, "0");
    writeFileSync(join(this.frameDir, `frame_${padded}.png`), frame);
    this.frameCount++;
  }

  async finalize(): Promise<Uint8Array> {
    const palettePath = join(this.frameDir, "palette.png");
    const outputPath = join(this.frameDir, "output.gif");
    const maxColors = this.gifOptions.maxColors ?? 256;
    const dither = this.gifOptions.dither ?? "sierra2_4a";
    const loop = this.gifOptions.loop ?? 0;
    const inputPattern = join(this.frameDir, "frame_%05d.png");

    // Pass 1: generate optimal color palette from all frames
    await execa("ffmpeg", [
      "-y",
      "-framerate", String(this.fps),
      "-i", inputPattern,
      "-vf", `palettegen=max_colors=${maxColors}`,
      palettePath,
    ]);

    // Pass 2: encode GIF using the generated palette
    await execa("ffmpeg", [
      "-y",
      "-framerate", String(this.fps),
      "-i", inputPattern,
      "-i", palettePath,
      "-filter_complex", `[0:v][1:v]paletteuse=dither=${dither}`,
      "-loop", String(loop),
      outputPath,
    ]);

    const result = readFileSync(outputPath);
    return new Uint8Array(result);
  }

  async dispose(): Promise<void> {
    if (this.frameDir) {
      rmSync(this.frameDir, { recursive: true, force: true });
    }
  }
}
