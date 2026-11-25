import { snapdom, type CaptureResult } from "@zumer/snapdom";
import type { PdfPluginOptions } from "@zumer/snapdom-pdf";
import type { VectorOptions } from "@zumer/snapdom-vector";
import { capturePixelSize, snapdomCaptureOptions, type BrowserCaptureOptions } from "./capture.js";
import { captureEvidence, contextCapturePlugins, snapshotCaptureOptions, type BrowserCaptureResult } from "./capture-evidence.js";

/** SVG retains HTML via foreignObject; vector-svg emits supported editable shapes/text. */
export interface BrowserImageArtifactOptions {
  format?: "png" | "jpeg" | "webp" | "svg";
}

export type BrowserArtifactOptions =
  | BrowserImageArtifactOptions
  | { format: "vector-svg"; vector?: VectorOptions }
  | { format: "pdf"; pdf?: Omit<PdfPluginOptions, "download"> };

/**
 * Capture a mounted DOM element directly to file bytes. PNG uses SnapDOM's
 * bounded raster windows for oversized captures when CompressionStream exists;
 * this path never creates a full-frame ImageData or calls result.toCanvas().
 * SVG and document geometry are logical CSS pixels; DPR applies to raster output.
 * No download or clipboard operation is performed.
 */
export async function captureBrowserArtifact(
  element: HTMLElement,
  options: BrowserCaptureOptions & BrowserArtifactOptions,
): Promise<Blob> {
  return (await captureArtifactObservation(element, options, false)).output;
}

/** Pixels, frozen context and degradation facts from one capture/export operation. */
export async function captureBrowserArtifactWithEvidence(
  element: HTMLElement,
  options: BrowserCaptureOptions & BrowserArtifactOptions,
): Promise<BrowserCaptureResult<Blob>> {
  return captureArtifactObservation(element, options, true);
}

async function captureArtifactObservation(
  element: HTMLElement,
  requestedOptions: BrowserCaptureOptions & BrowserArtifactOptions,
  withContext: boolean,
): Promise<BrowserCaptureResult<Blob>> {
  const options = snapshotCaptureOptions(requestedOptions);
  const captureOptions = snapdomCaptureOptions(options);
  const format = options.format ?? "png";
  if (!["png", "jpeg", "webp", "svg", "vector-svg", "pdf"].includes(format)) throw new TypeError(`Unsupported browser capture format: ${format}`);
  const plugins = await contextCapturePlugins(withContext);
  if (options.format === "vector-svg") {
    if (!element.isConnected) throw new Error("Vector capture requires a connected source element");
    const { vector } = await import("@zumer/snapdom-vector");
    plugins.push(vector(options.vector));
  } else if (options.format === "pdf") {
    const { pdf } = await import("@zumer/snapdom-pdf");
    plugins.push(pdf({ ...options.pdf, download: false }));
  }
  if (options.format === "vector-svg" && !element.isConnected) throw new Error("Vector capture requires a connected source element");
  const start = performance.now();
  const result = await snapdom(element, { ...captureOptions, plugins });
  const captured = performance.now();
  const output = options.format === "pdf" ? await result.toPdf({ ...options.pdf, download: false })
    : options.format === "vector-svg" ? new Blob([await result.toVector(options.vector)], { type: "image/svg+xml" })
    : await exportImageArtifact(result, options as BrowserCaptureOptions & BrowserImageArtifactOptions);
  if (options.format === "vector-svg" && !element.isConnected) throw new Error("Vector capture requires a connected source element");
  const encoded = performance.now();
  const actual = format === "png" ? await pngSize(output) : null;
  return Object.freeze({ output, evidence: await captureEvidence(result, options, { start, captured, encoded }, actual, withContext) });
}

async function pngSize(blob: Blob): Promise<{ width: number; height: number }> {
  const view = new DataView(await blob.slice(0, 24).arrayBuffer());
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * Capture trusted HTML using an offscreen mount owned and cleaned up by SnapDOM.
 * HTML is activated in the current document; sanitize user content before calling.
 * Plugins needing a connected source use captureBrowserArtifact instead.
 */
export async function captureHtmlArtifact(
  html: string,
  requestedOptions: BrowserCaptureOptions & BrowserImageArtifactOptions,
): Promise<Blob> {
  const options = snapshotCaptureOptions(requestedOptions);
  const format = options.format ?? "png";
  if (!["png", "jpeg", "webp", "svg"].includes(format)) throw new TypeError(`Unsupported HTML capture format: ${format}`);
  const result = await snapdom.fromString(html, snapdomCaptureOptions(options));
  return exportImageArtifact(result, options);
}

async function exportImageArtifact(result: CaptureResult, options: BrowserCaptureOptions & BrowserImageArtifactOptions): Promise<Blob> {
  const format = options.format ?? "png";
  const blob = await result.toBlob({ format });
  if (!(blob instanceof Blob)) throw new Error(`Browser could not encode ${format} capture`);
  const mimeType = format === "svg" ? "image/svg+xml" : `image/${format}`;
  if (blob.type !== mimeType) throw new Error(`Browser encoded ${blob.type || "an unknown format"} instead of ${mimeType}`);
  if (format === "png") {
    // Inspect only the PNG header, including oversized files a browser image
    // decoder cannot load. Never allocate or decode the full image to validate it.
    const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (header.length < 24 || pngSignature.some((byte, i) => header[i] !== byte)) {
      throw new Error("Browser returned an invalid PNG capture");
    }
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const expected = capturePixelSize(options);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width !== expected.width || height !== expected.height) {
      throw new Error(`PNG capture was resized to ${width}x${height}; expected ${expected.width}x${expected.height}. Oversized PNG export requires CompressionStream.`);
    }
  } else if (format !== "svg" && result.warnings.some(warning => warning.code === "canvas-clamp" || warning.code === "raster-clamp")) {
    throw new Error(`Browser resized the ${format} capture; use PNG for oversized images`);
  }
  return blob;
}

/** Prepared ahead of a click so plugin loading/capture cannot consume user activation. */
export interface BrowserVectorCapture {
  toSvg(): Promise<Blob>;
  /** Call from a browser user gesture. This is the only clipboard-writing API. */
  copyToFigma(): Promise<void>;
  /** Release the retained capture and source references; returned Blobs remain valid. */
  dispose(): void;
}

/**
 * Lazily load the vector plugin and prepare a capture while the source is mounted.
 * Keep the source connected until each export completes. Unsupported paints can
 * differ from a raster capture; vector-svg is an explicit choice of representation.
 */
export async function prepareBrowserVector(
  element: HTMLElement,
  requestedOptions: BrowserCaptureOptions,
  requestedVectorOptions?: VectorOptions,
): Promise<BrowserVectorCapture> {
  const options = snapshotCaptureOptions(requestedOptions);
  const vectorOptions = snapshotCaptureOptions(requestedVectorOptions);
  const captureOptions = snapdomCaptureOptions(options);
  if (!element.isConnected) throw new Error("Vector capture requires a connected source element");
  const { vector } = await import("@zumer/snapdom-vector");
  let source: HTMLElement | undefined = element;
  let capture: CaptureResult | undefined = await snapdom(element, { ...captureOptions, plugins: [vector(vectorOptions)] });
  const requireCapture = () => {
    if (!capture) throw new Error("Vector capture has been disposed");
    if (!source?.isConnected) throw new Error("Vector capture requires a connected source element");
    return capture;
  };
  return {
    async toSvg() {
      const svg = await requireCapture().toVector(vectorOptions);
      requireCapture();
      return new Blob([svg], { type: "image/svg+xml" });
    },
    copyToFigma() {
      try {
        const result = requireCapture();
        if (source?.ownerDocument.defaultView?.navigator.userActivation?.isActive !== true) {
          throw new Error("Copy to Figma requires an active browser user gesture");
        }
        // No import, capture or other awaited preparation precedes this call.
        return result.toFigma(vectorOptions);
      } catch (error) {
        return Promise.reject(error);
      }
    },
    dispose() {
      capture = undefined;
      source = undefined;
    },
  };
}
