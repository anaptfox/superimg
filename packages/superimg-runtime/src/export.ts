//! Video export helpers for browser runtime

import type { EncodingOptions, AudioOptions } from "@superimg/types";
import { BrowserEncoder } from "./encoder.js";
import { get2DContext } from "./utils.js";

export interface ExportConfig {
  fps: number;
  width: number;
  height: number;
  durationSeconds: number;
  audio?: AudioOptions;
  encoding?: EncodingOptions;
}

export interface ExportOptions {
  onProgress?: (frame: number, totalFrames: number) => void;
  onStatusChange?: (message: string) => void;
}

/**
 * Render frames to a video blob using BrowserEncoder.
 */
export async function exportToVideo(
  canvas: HTMLCanvasElement,
  config: ExportConfig,
  renderFrame: (frame: number) => Promise<void>,
  options?: ExportOptions
): Promise<Blob> {
  const ctx = get2DContext(canvas);
  const totalFrames = Math.floor(config.durationSeconds * config.fps);

  if (totalFrames <= 0) {
    throw new Error("Export duration is too short to generate frames");
  }

  const encoder = new BrowserEncoder(
    config.width,
    config.height,
    config.fps,
    config.encoding
  );

  if (config.audio?.src) {
    options?.onStatusChange?.("Loading audio...");
    await encoder.setAudioTrack(config.audio.src, config.audio);
  }

  options?.onStatusChange?.("Rendering frames...");

  for (let frame = 0; frame < totalFrames; frame += 1) {
    await renderFrame(frame);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const timestamp = frame / config.fps;
    await encoder.addFrame(imageData, timestamp);

    options?.onProgress?.(frame + 1, totalFrames);
  }

  options?.onStatusChange?.("Finalizing video...");
  return encoder.finalize();
}

/**
 * Download a blob as a file in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
