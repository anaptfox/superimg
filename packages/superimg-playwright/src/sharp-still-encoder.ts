//! Still image encoder — captures a single Playwright screenshot and encodes
//! it to PNG / WebP / JPEG using sharp.

import sharp from "sharp";
import type { VideoEncoder, VideoEncoderConfig } from "@superimg/types";

export type StillFormat = "png" | "webp" | "jpeg";

export class SharpStillEncoder implements VideoEncoder<Buffer> {
  private frame: Buffer | null = null;
  private width = 0;
  private height = 0;

  constructor(private readonly format: StillFormat = "png") {}

  async init(config: VideoEncoderConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
  }

  async addFrame(frameBuffer: Buffer): Promise<void> {
    // Only keep the first frame (still image — totalFrames = 1).
    if (!this.frame) this.frame = frameBuffer;
  }

  async finalize(): Promise<Buffer> {
    if (!this.frame) {
      throw new Error("SharpStillEncoder: no frame was captured");
    }
    // Playwright captures at target size — only resize if dimensions differ.
    const img = sharp(this.frame);
    const meta = await img.metadata();
    const needsResize = meta.width !== this.width || meta.height !== this.height;
    const sized = needsResize ? img.resize(this.width, this.height) : img;
    switch (this.format) {
      case "webp": return sized.webp().toBuffer();
      case "jpeg": return sized.jpeg().toBuffer();
      default: return sized.png().toBuffer();
    }
  }

  async dispose(): Promise<void> {
    this.frame = null;
  }
}
