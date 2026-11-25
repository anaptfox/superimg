import { snapdom, type SnapdomOptions } from "@zumer/snapdom";
import type { MediaSurface } from "@superimg/media";
import type { BrowserArtifactOptions } from "./capture-artifact.js";
import { get2DContext } from "./utils.js";
import { captureEvidence, contextCapturePlugins, snapshotCaptureOptions, type BrowserCaptureResult } from "./capture-evidence.js";

export interface BrowserCaptureOptions {
  width: number;
  height: number;
  backgroundColor?: string;
  embedFonts?: SnapdomOptions["embedFonts"];
  cache?: SnapdomOptions["cache"];
  /**
   * Device pixel ratio for Snapdom (default 2 for retina masters).
   * Set 1 for 1:1 CSS pixels.
   */
  dpr?: number;
  /** Spatial scale multiplier (default 1). Combined with dpr for canvas size. */
  scale?: number;
  /** Max quality 0–1 (default 1). */
  quality?: number;
  /** CSS-pixel region to capture, or the element viewport. */
  region?: "viewport" | { x: number; y: number; width: number; height: number };
  /** Pin clone boxes to live DOM measurements when layout drift is detected. */
  reconcile?: boolean;
  /** Reuse an unchanged element capture between frames. */
  burst?: boolean;
  /** Force a fresh capture when burst cannot observe the mutation. */
  invalidate?: boolean;
  /** Skip SnapDOM idle delays. */
  fast?: boolean;
}

export interface BrowserCaptureBackend {
  warmup(element: HTMLElement, options: BrowserCaptureOptions): Promise<void>;
  capture(element: HTMLElement, options: BrowserCaptureOptions): Promise<ImageData>;
  /** Direct file capture, without a full-frame ImageData allocation. */
  captureArtifact?(element: HTMLElement, options: BrowserCaptureOptions & BrowserArtifactOptions): Promise<Blob>;
  dispose?(): Promise<void>;
}

export class SnapdomCaptureBackend implements BrowserCaptureBackend {
  private cached: { element: HTMLElement; signature: string; result: BrowserCaptureResult<ImageData> } | undefined;
  private disposed = false;

  async dispose(): Promise<void> {
    this.disposed = true;
    this.cached = undefined;
  }

  async warmup(element: HTMLElement, options: BrowserCaptureOptions): Promise<void> {
    if (this.disposed) throw new Error("Capture backend has been disposed");
    // preCapture learns intent from input events; it is not resource warm-up.
    // A real capture populates fonts/images/styles without rasterizing a canvas,
    // registering input listeners, or retaining the element in upstream's memo.
    await snapdom(element, snapdomCaptureOptions({ ...options, cache: options.cache ?? "soft" }));
    if (this.disposed) throw new Error("Capture backend has been disposed");
  }

  async captureArtifact(element: HTMLElement, options: BrowserCaptureOptions & BrowserArtifactOptions): Promise<Blob> {
    if (this.disposed) throw new Error("Capture backend has been disposed");
    const requested = snapshotCaptureOptions(options);
    const { captureBrowserArtifact } = await import("./capture-artifact.js");
    const blob = await captureBrowserArtifact(element, requested);
    if (this.disposed) throw new Error("Capture backend has been disposed");
    return blob;
  }

  async capture(element: HTMLElement, options: BrowserCaptureOptions): Promise<ImageData> {
    return (await this.captureObservation(element, options, false)).output;
  }

  /** Opt-in bounded DOM context paired with the same raster output. */
  async captureWithEvidence(element: HTMLElement, options: BrowserCaptureOptions): Promise<BrowserCaptureResult<ImageData>> {
    return this.captureObservation(element, options, true);
  }

  private async captureObservation(element: HTMLElement, requestedOptions: BrowserCaptureOptions, withContext: boolean): Promise<BrowserCaptureResult<ImageData>> {
    const options = snapshotCaptureOptions(requestedOptions);
    if (this.disposed) throw new Error("Capture backend has been disposed");
    const signature = options.burst && !options.invalidate ? captureSignature(element, options) : undefined;
    if (signature !== undefined && this.cached?.element === element && this.cached.signature === `${withContext}:${signature}`) {
      const cached = this.cached.result;
      return Object.freeze({ output: new ImageData(new Uint8ClampedArray(cached.output.data), cached.output.width, cached.output.height), evidence: cached.evidence });
    }
    this.cached = undefined;
    const plugins = await contextCapturePlugins(withContext);
    const start = performance.now();
    const result = await snapdom(element, { ...snapdomCaptureOptions(options), plugins });
    const captured = performance.now();
    const canvas = await result.toCanvas();
    let pixels: ImageData;
    try {
      const expected = capturePixelSize(options);
      if (canvas.width !== expected.width || canvas.height !== expected.height) {
        throw new Error(`Capture was resized to ${canvas.width}x${canvas.height}; expected ${expected.width}x${expected.height}. Use captureArtifact with format: 'png' for oversized images.`);
      }
      pixels = get2DContext(canvas).getImageData(0, 0, canvas.width, canvas.height);
    } finally { canvas.width = canvas.height = 0; }
    const encoded = performance.now();
    if (this.disposed) throw new Error("Capture backend has been disposed");
    const observation = Object.freeze({ output: pixels, evidence: await captureEvidence(result, options, { start, captured, encoded }, { width: pixels.width, height: pixels.height }, withContext) });
    if (this.disposed) throw new Error("Capture backend has been disposed");
    if (signature !== undefined) this.cached = { element, signature: `${withContext}:${signature}`, result: Object.freeze({ output: new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), evidence: observation.evidence }) };
    return observation;
  }
}

/** Shared sizing rule for ImageData and direct artifact export. */
export function capturePixelSize(options: BrowserCaptureOptions): { width: number; height: number } {
  const { width, height, dpr } = snapdomCaptureOptions(options);
  return { width: Math.max(1, Math.floor(width! * dpr!)), height: Math.max(1, Math.floor(height! * dpr!)) };
}

// A public keep predicate prevents upstream auto-memoization from registering
// observers/listeners. SuperImg owns its bounded, disposable repeat-pixel cache.
const keepCaptureNode = () => true;

/** Internal adapter shared with direct Blob exports. */
export function snapdomCaptureOptions(options: BrowserCaptureOptions): SnapdomOptions {
  const width = typeof options.region === "object" ? options.region.width : options.width;
  const height = typeof options.region === "object" ? options.region.height : options.height;
  const scale = options.scale ?? 1;
  const dpr = options.dpr ?? 2;
  if (![options.width, options.height, width, height, scale, dpr, width * scale * dpr, height * scale * dpr].every(value => Number.isFinite(value) && value > 0)) {
    throw new RangeError("Capture dimensions, scale and DPR must be finite and positive");
  }
  if (typeof options.region === "object" && ![options.region.x, options.region.y].every(Number.isFinite)) {
    throw new RangeError("Capture region coordinates must be finite");
  }
  const quality = options.quality ?? 1;
  if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new RangeError("Capture quality must be between 0 and 1");
  return {
    // v3 width/height override scale. Fold scale in once; DPR stays raster-only.
    width: width * scale,
    height: height * scale,
    scale: 1,
    dpr,
    quality,
    embedFonts: options.embedFonts ?? true,
    backgroundColor: options.backgroundColor ?? "#000000",
    cache: options.cache ?? "disabled",
    filter: keepCaptureNode,
    // Computed-style/CSSOM state may change without a DOM mutation.
    invalidate: true,
    plugins: [],
    ...(options.region !== undefined ? { clip: options.region } : {}),
    ...(options.reconcile !== undefined ? { reconcile: options.reconcile } : {}),
    ...(options.fast !== undefined ? { fast: options.fast } : {}),
  };
}

function captureSignature(element: HTMLElement, options: BrowserCaptureOptions): string | undefined {
  // Pixel and media updates need not mutate the DOM. Always capture these live.
  const liveContent = "canvas,video,iframe,object,embed,input,textarea,select,image";
  if (element.matches(liveContent) || element.querySelector(liveContent)) return undefined;
  const view = element.ownerDocument.defaultView;
  if (!view || element.ownerDocument.fonts?.status === "loading") return undefined;
  const nodes = [element, ...element.querySelectorAll("*")];
  if (nodes.some((node) => node.shadowRoot !== null)) return undefined;
  let hasPixelResource = false;
  const measurements = nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    const style = view.getComputedStyle(node);
    // Computed values also catch CSSOM edits and ancestor/stylesheet changes.
    const properties = Array.from(style, (name) => `${name}:${style.getPropertyValue(name)}`);
    if (properties.some((value) => /url\(/i.test(value))) hasPixelResource = true;
    const image = node instanceof view.HTMLImageElement ? [node.currentSrc, node.complete, node.naturalWidth, node.naturalHeight] : [];
    const pseudo = ["::before", "::after"].map((selector) => {
      const style = view.getComputedStyle(node, selector);
      const properties = Array.from(style, (name) => `${name}:${style.getPropertyValue(name)}`);
      if (properties.some((value) => /url\(/i.test(value))) hasPixelResource = true;
      return properties;
    });
    return [rect.x, rect.y, rect.width, rect.height, properties, image, pseudo];
  });
  // Animated image resources can change pixels independently of these facts.
  if (hasPixelResource || nodes.some((node) => node instanceof view.HTMLImageElement)) return undefined;
  return JSON.stringify([options, element.outerHTML, measurements]);
}

export function requireSurfaceElement(surface: MediaSurface | null): HTMLElement {
  const element = surface?.getElement() ?? null;
  if (!element) {
    throw new Error("MediaSession has no mounted DOM surface to capture");
  }
  return element;
}

export async function captureSurfaceFrame(
  backend: BrowserCaptureBackend,
  surface: MediaSurface | null,
  options: BrowserCaptureOptions,
): Promise<ImageData> {
  return backend.capture(requireSurfaceElement(surface), options);
}
