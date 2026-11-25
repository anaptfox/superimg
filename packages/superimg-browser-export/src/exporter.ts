import type { MediaSession } from "@superimg/media";
import {
  SnapdomCaptureBackend,
  captureSurfaceFrame,
  requireSurfaceElement,
  type BrowserCaptureBackend,
  type BrowserCaptureOptions,
} from "./capture.js";
import type { BrowserArtifactOptions } from "./capture-artifact.js";
import { exportImageDataToVideo, type ExportConfig, type ExportOptions } from "./export.js";

export interface BrowserExporterOptions extends BrowserCaptureOptions {
  backend?: BrowserCaptureBackend;
}

export interface BrowserExporter {
  captureFrame(frame: number): Promise<ImageData>;
  captureArtifact(frame: number, options?: BrowserArtifactOptions): Promise<Blob>;
  exportVideo(config: ExportConfig, options?: ExportOptions): Promise<Blob>;
  dispose(): Promise<void>;
}

export function createBrowserExporter(
  session: MediaSession,
  options: BrowserExporterOptions,
): BrowserExporter {
  const backend = options.backend ?? new SnapdomCaptureBackend();
  let disposed = false;
  let captureQueue: Promise<void> = Promise.resolve();
  let disposal: Promise<void> | undefined;
  const captureOptions: BrowserCaptureOptions = {
    width: options.width,
    height: options.height,
    ...(options.backgroundColor !== undefined ? { backgroundColor: options.backgroundColor } : {}),
    ...(options.embedFonts !== undefined ? { embedFonts: options.embedFonts } : {}),
    ...(options.cache !== undefined ? { cache: options.cache } : {}),
    ...(options.dpr !== undefined ? { dpr: options.dpr } : {}),
    ...(options.scale !== undefined ? { scale: options.scale } : {}),
    ...(options.quality !== undefined ? { quality: options.quality } : {}),
    ...(options.region !== undefined ? { region: options.region } : {}),
    ...(options.reconcile !== undefined ? { reconcile: options.reconcile } : {}),
    ...(options.burst !== undefined ? { burst: options.burst } : {}),
    // Every rendered frame can change canvas/CSSOM state. SnapDOM's burst
    // cache therefore needs an explicit invalidation at each capture boundary.
    invalidate: options.invalidate ?? true,
    ...(options.fast !== undefined ? { fast: options.fast } : {}),
  };

  // A session has one mutable DOM surface. Serialize render+capture together so
  // concurrent artifact/video requests cannot photograph each other's frame.
  const captureAtFrame = <T>(frame: number, capture: () => Promise<T>): Promise<T> => {
    if (disposed) return Promise.reject(new Error("Browser exporter has been disposed"));
    const result = captureQueue.then(async () => {
      if (disposed) throw new Error("Browser exporter has been disposed");
      await session.renderFrame(frame);
      if (disposed) throw new Error("Browser exporter has been disposed");
      const value = await capture();
      if (disposed) throw new Error("Browser exporter has been disposed");
      return value;
    });
    captureQueue = result.then(() => {}, () => {});
    return result;
  };
  const captureFrame = (frame: number): Promise<ImageData> => captureAtFrame(frame,
    () => captureSurfaceFrame(backend, session.getSurface(), captureOptions));

  return {
    captureFrame,

    async captureArtifact(frame, artifactOptions = {}) {
      if (disposed) throw new Error("Browser exporter has been disposed");
      if (!backend.captureArtifact) throw new Error("Capture backend does not support direct artifact capture");
      const captureArtifact = backend.captureArtifact.bind(backend);
      return captureAtFrame(frame, () => captureArtifact(requireSurfaceElement(session.getSurface()), { ...captureOptions, ...artifactOptions }));
    },

    async exportVideo(config, exportOptions = {}) {
      return exportImageDataToVideo(config, captureFrame, exportOptions);
    },

    async dispose() {
      if (disposal) return disposal;
      disposed = true;
      disposal = (async () => {
        await captureQueue;
        if (options.backend === undefined) await backend.dispose?.();
      })();
      return disposal;
    },
  };
}
