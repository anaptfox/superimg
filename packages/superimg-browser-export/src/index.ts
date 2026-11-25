export {
  type BrowserCaptureBackend,
  type BrowserCaptureOptions,
  SnapdomCaptureBackend,
  captureSurfaceFrame,
} from "./capture.js";
export {
  captureBrowserArtifact,
  captureBrowserArtifactWithEvidence,
  captureHtmlArtifact,
  prepareBrowserVector,
  type BrowserArtifactOptions,
  type BrowserImageArtifactOptions,
  type BrowserVectorCapture,
} from "./capture-artifact.js";
export { BrowserEncoder, validateFrameDimensions } from "./encoder.js";
export {
  downloadBlob,
  exportToVideo,
  exportImageDataToVideo,
  type ExportConfig,
  type ExportOptions,
} from "./export.js";
export {
  createBrowserExporter,
  type BrowserExporter,
  type BrowserExporterOptions,
} from "./exporter.js";
export { BrowserRenderer, CanvasRenderer } from "./preview.js";
export {
  createBrowserRuntimeAdapter,
  type BrowserRuntimeAdapterOptions,
} from "./runtime/index.js";

export type { BrowserCaptureEvidence, BrowserCaptureResult } from "./capture-evidence.js";
