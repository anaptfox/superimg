//! RSC stub — `@foxworth/superimg/browser-export` requires a browser DOM.

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

function browserOnly(name: string): never {
  throw new Error(
    `${name}: @foxworth/superimg/browser-export is client-only. Mark the importing file with "use client", or use @foxworth/superimg/runtime in Server Components / Route Handlers.`,
  );
}

export const captureBrowserArtifact = () => browserOnly("captureBrowserArtifact");
export const captureBrowserArtifactWithEvidence = () => browserOnly("captureBrowserArtifactWithEvidence");
export const captureHtmlArtifact = () => browserOnly("captureHtmlArtifact");
export const prepareBrowserVector = () => browserOnly("prepareBrowserVector");
export const createBrowserExporter = () => browserOnly("createBrowserExporter");
export const SnapdomCaptureBackend = class {
  constructor() {
    browserOnly("SnapdomCaptureBackend");
  }
};
