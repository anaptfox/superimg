import type { EncodingOptions, ResolvedAudioTimeline } from "@superimg/types";
import { BrowserEncoder } from "./encoder.js";
import { get2DContext } from "./utils.js";

export interface ExportConfig {
  fps: number;
  width: number;
  height: number;
  duration: number;
  resolvedAudio?: ResolvedAudioTimeline | null;
  encoding?: EncodingOptions;
}

export interface ExportOptions {
  onProgress?: (frame: number, totalFrames: number) => void;
  onStatusChange?: (message: string) => void;
}

export async function exportToVideo(
  canvas: HTMLCanvasElement,
  config: ExportConfig,
  renderFrame: (frame: number) => Promise<void>,
  options: ExportOptions = {},
): Promise<Blob> {
  const ctx = get2DContext(canvas);
  const totalFrames = Math.floor(config.duration * config.fps);
  if (totalFrames <= 0) {
    throw new Error("Export duration is too short to generate frames");
  }

  const encoder = new BrowserEncoder(config.width, config.height, config.fps, config.encoding);
  if (config.resolvedAudio?.clips.length) {
    options.onStatusChange?.("Loading audio...");
    await encoder.setResolvedAudio(config.resolvedAudio);
  }

  options.onStatusChange?.("Rendering frames...");
  for (let frame = 0; frame < totalFrames; frame += 1) {
    await renderFrame(frame);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    await encoder.addFrame(imageData, frame / config.fps);
    options.onProgress?.(frame + 1, totalFrames);
  }

  options.onStatusChange?.("Finalizing video...");
  return encoder.finalize();
}

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
