//! Browser capture and delivery for mounted DOM and trusted HTML.
//! Heavy vector and PDF exporters load only when requested.

export {
  captureBrowserArtifact,
  captureBrowserArtifactWithEvidence,
  captureHtmlArtifact,
  prepareBrowserVector,
  createBrowserExporter,
  SnapdomCaptureBackend,
} from "@superimg/browser-export";
export type {
  BrowserArtifactOptions,
  BrowserCaptureEvidence,
  BrowserCaptureResult,
  BrowserImageArtifactOptions,
  BrowserVectorCapture,
  BrowserCaptureBackend,
  BrowserCaptureOptions,
  BrowserExporter,
  BrowserExporterOptions,
} from "@superimg/browser-export";
