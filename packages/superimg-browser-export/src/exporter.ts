import type { MediaSession } from "@superimg/media";
import { BrowserEncoder } from "./encoder.js";
import {
  SnapdomCaptureBackend,
  captureSurfaceFrame,
  type BrowserCaptureBackend,
  type BrowserCaptureOptions,
} from "./capture.js";
import type { ExportConfig, ExportOptions } from "./export.js";

export interface BrowserExporterOptions extends BrowserCaptureOptions {
  backend?: BrowserCaptureBackend;
}

export interface BrowserExporter {
  captureFrame(frame: number): Promise<ImageData>;
  exportVideo(config: ExportConfig, options?: ExportOptions): Promise<Blob>;
  dispose(): Promise<void>;
}

export function createBrowserExporter(
  session: MediaSession,
  options: BrowserExporterOptions,
): BrowserExporter {
  const backend = options.backend ?? new SnapdomCaptureBackend();
  const captureOptions: BrowserCaptureOptions = {
    width: options.width,
    height: options.height,
    ...(options.backgroundColor !== undefined ? { backgroundColor: options.backgroundColor } : {}),
    ...(options.embedFonts !== undefined ? { embedFonts: options.embedFonts } : {}),
    ...(options.cache !== undefined ? { cache: options.cache } : {}),
    ...(options.compress !== undefined ? { compress: options.compress } : {}),
  };

  const captureFrame = async (frame: number): Promise<ImageData> => {
    await session.renderFrame(frame);
    return captureSurfaceFrame(backend, session.getSurface(), captureOptions);
  };

  return {
    captureFrame,

    async exportVideo(config, exportOptions = {}) {
      const totalFrames = Math.floor(config.duration * config.fps);
      if (totalFrames <= 0) {
        throw new Error("Export duration is too short to generate frames");
      }

      const encoder = new BrowserEncoder(config.width, config.height, config.fps, config.encoding);
      if (config.resolvedAudio?.clips.length) {
        exportOptions.onStatusChange?.("Loading audio...");
        await encoder.setResolvedAudio(config.resolvedAudio);
      }

      exportOptions.onStatusChange?.("Rendering frames...");
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const imageData = await captureFrame(frame);
        await encoder.addFrame(imageData, frame / config.fps);
        exportOptions.onProgress?.(frame + 1, totalFrames);
      }

      exportOptions.onStatusChange?.("Finalizing video...");
      return encoder.finalize();
    },

    async dispose() {
      // MediaSession owns its DOM surface. The browser exporter has no persistent
      // resources unless a custom backend adds them.
    },
  };
}
