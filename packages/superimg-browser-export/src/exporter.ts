import type { MediaSession } from "@superimg/media";
import {
  SnapdomCaptureBackend,
  captureSurfaceFrame,
  type BrowserCaptureBackend,
  type BrowserCaptureOptions,
} from "./capture.js";
import { exportImageDataToVideo, type ExportConfig, type ExportOptions } from "./export.js";

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
      return exportImageDataToVideo(config, captureFrame, exportOptions);
    },

    async dispose() {
      // MediaSession owns its DOM surface. The browser exporter has no persistent
      // resources unless a custom backend adds them.
    },
  };
}
