//! Render harness - runs in Playwright's browser context (encoder-only)

import { BrowserEncoder } from "@superimg/runtime";
import type { EncodingOptions } from "@superimg/types";

// Declare global interface for window.__superimg
declare global {
  interface Window {
    __superimg: {
      initEncoder(config: InitEncoderConfig): Promise<void>;
      addFrame(pngBase64: string, timestamp: number): Promise<void>;
      finalize(): Promise<Uint8Array>;
    };
  }
}

export interface InitEncoderConfig {
  width: number;
  height: number;
  fps: number;
  encoding?: EncodingOptions;
  audio?: { src: string } & Record<string, unknown>;
}

let encoder: BrowserEncoder;
let w: number;
let h: number;

window.__superimg = {
  async initEncoder(config: InitEncoderConfig): Promise<void> {
    w = config.width;
    h = config.height;
    encoder = new BrowserEncoder(w, h, config.fps, config.encoding);

    if (config.audio) {
      const { src, ...opts } = config.audio;
      await encoder.setAudioTrack(src, opts as any);
    }

    await encoder.init();
  },

  async addFrame(pngBase64: string, timestamp: number): Promise<void> {
    const img = new Image();
    img.src = `data:image/png;base64,${pngBase64}`;
    await img.decode();

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { alpha: true })!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);

    await encoder.addFrame(imageData, timestamp);
  },

  async finalize(): Promise<Uint8Array> {
    const blob = await encoder.finalize();
    return new Uint8Array(await blob.arrayBuffer());
  },
};
