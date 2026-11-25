import type { CaptureOptions, FrameCaptureOptions, FrameReadinessPolicy, RenderContext, RenderOptions } from "@superimg/types";
import { createLinkedExecutionSignal, raceWithExecution, resolveCaptureDefaults, resolveCaptureRegion } from "@superimg/types";
import { buildHeadStyles, googleFontSpecs, isSafeStylesheetUrl } from "@superimg/core";
import { SnapdomCaptureBackend } from "./capture.js";
import { get2DContext } from "./utils.js";
import { waitForFrameResources, waitForResource } from "./preview-readiness.js";

const IMPORT_URL_RE = /@import\s+url\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g;

export type BrowserRenderOptions = RenderOptions & Readonly<{
  capture?: CaptureOptions;
  format?: string;
  alpha?: "discard" | "keep";
  readiness?: FrameReadinessPolicy;
  signal?: AbortSignal;
}>;

function extractCSSImports(html: string): { cleanedHtml: string; urls: string[] } {
  const urls: string[] = [];
  const cleanedHtml = html.replace(IMPORT_URL_RE, (_match, url) => {
    urls.push(url);
    return "";
  });
  return { cleanedHtml, urls };
}

export class BrowserCaptureCapabilityError extends Error {
  readonly code = "BROWSER_EXECUTABLE_MARKUP_UNSUPPORTED";
  constructor() {
    super("Browser capture cannot execute template scripts or event handlers. Use the Node renderer for Three, Lottie, or scripted HTML; supply precompiled CSS instead of the Tailwind CDN.");
    this.name = "BrowserCaptureCapabilityError";
  }
}

function assertStaticMarkup(fragment: DocumentFragment): void {
  for (const element of fragment.querySelectorAll("*")) {
    if (element.localName === "script") {
      const type = (element.getAttribute("type") ?? "").trim().toLowerCase().split(";", 1)[0]!;
      if (!type || type === "module" || type === "importmap" || type === "speculationrules" || /(?:java|ecma)script/.test(type)) {
        throw new BrowserCaptureCapabilityError();
      }
    }
    if (Array.from(element.attributes).some((attribute) => /^on/i.test(attribute.name))) {
      throw new BrowserCaptureCapabilityError();
    }
  }
}

function sampleAnimations(root: HTMLElement, time: number | undefined): void {
  void root.offsetWidth;
  for (const animation of root.getAnimations({ subtree: true })) {
    const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
    animation.pause();
    animation.currentTime = time === undefined ? (Number.isFinite(end) ? end : 0) : time * 1000;
  }
  void root.offsetWidth;
}

function collectStylesheetUrls(options: RenderOptions): string[] {
  const urls: string[] = [];
  const fontSpecs = googleFontSpecs(options.fonts);
  if (fontSpecs.length > 0) {
    const fontFamilies = fontSpecs
      .map((spec) => `family=${encodeURIComponent(spec)}`)
      .join("&");
    urls.push(`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`);
  }
  if (options.stylesheets?.length) {
    urls.push(...options.stylesheets.filter(isSafeStylesheetUrl).map((url) => url.trim()));
  }
  return urls;
}

export class BrowserRenderer {
  private capture = new SnapdomCaptureBackend();
  private preCached = false;
  private warmupRequested = false;
  private iframe: HTMLIFrameElement | null = null;
  private doc: Document | null = null;
  private frameRoot: HTMLElement | null = null;
  private sessionOptions: BrowserRenderOptions | null = null;
  private initialized = false;
  private sessionStylesheetUrls = new Set<string>();
  private activeCapture: AbortController | undefined;

  async warmup(): Promise<void> {
    this.warmupRequested = true;
    if (this.sessionOptions) await this.withDeadline(this.sessionOptions, () => this.preCacheFrameRoot());
  }

  async init(options: BrowserRenderOptions): Promise<void> {
    if (this.activeCapture) throw new Error("BrowserRenderer does not support concurrent captures");
    if (options.tailwind) throw new BrowserCaptureCapabilityError();
    if (options.capture?.colorProfile === "display-p3") {
      throw new Error("Display-P3 capture is unavailable: the current output pipeline supports sRGB only");
    }
    if (this.initialized && this.sessionOptions) {
      const unchanged =
        this.sessionOptions.width === options.width &&
        this.sessionOptions.height === options.height &&
        JSON.stringify(this.sessionOptions.fonts ?? []) === JSON.stringify(options.fonts ?? []) &&
        JSON.stringify(this.sessionOptions.stylesheets ?? []) ===
          JSON.stringify(options.stylesheets ?? []) &&
        JSON.stringify(this.sessionOptions.inlineCss ?? []) ===
          JSON.stringify(options.inlineCss ?? []);
      if (unchanged) { this.sessionOptions = options; return; }
      await this.dispose();
    }

    await this.withDeadline(options, async (signal) => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.border = "none";
      iframe.width = String(options.width);
      iframe.height = String(options.height);

      const headContent = buildHeadStyles({
        ...(options.fonts !== undefined ? { fonts: options.fonts } : {}),
        ...(options.stylesheets !== undefined ? { stylesheets: options.stylesheets } : {}),
        ...(options.inlineCss !== undefined ? { inlineCss: options.inlineCss } : {}),
        ...(options.tailwind !== undefined ? { tailwind: options.tailwind } : {}),
      });
      iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${headContent}</head><body><div id="frame" style="position:relative;width:100%;height:100%;"></div></body></html>`;
      this.iframe = iframe;
      const loaded = waitForResource(iframe, "load", "frame document", signal);
      document.body.appendChild(iframe);
      await loaded;

      const doc = iframe.contentDocument;
      if (!doc) throw new Error("BrowserRenderer failed to create iframe document");
      // The iframe load event includes its stylesheets; failed links have no sheet.
      for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
        if (!link.sheet) throw new Error(`Browser capture stylesheet failed: ${link.href}`);
      }
      const frameRoot = doc.getElementById("frame");
      if (!frameRoot) throw new Error("Frame root #frame not found after init");

      this.iframe = iframe;
      this.doc = doc;
      this.frameRoot = frameRoot;
      this.sessionOptions = options;
      this.sessionStylesheetUrls = new Set(collectStylesheetUrls(options));
      await waitForFrameResources(frameRoot, options.readiness, signal);
      this.initialized = true;
    });
  }

  async captureFrame(html: string, options?: Pick<FrameCaptureOptions, "time" | "signal">): Promise<ImageData> {
    if (!this.frameRoot || !this.sessionOptions || !this.doc) {
      throw new Error("BrowserRenderer.captureFrame: call init() first");
    }

    if (options?.time !== undefined && (!Number.isFinite(options.time) || options.time < 0)) {
      throw new TypeError("Browser capture time must be finite and non-negative");
    }
    const doc = this.doc;
    const frameRoot = this.frameRoot;
    const sessionOptions = this.sessionOptions;
    const fragment = doc.createElement("template");
    const { cleanedHtml, urls } = extractCSSImports(html);
    fragment.innerHTML = cleanedHtml;
    assertStaticMarkup(fragment.content);
    return this.withDeadline({ ...sessionOptions, ...(options?.signal ? { signal: options.signal } : {}) }, async (signal) => {
      const stylesheets: Promise<void>[] = [];
      for (const url of urls) {
        if (!isSafeStylesheetUrl(url) || this.sessionStylesheetUrls.has(url)) continue;
        this.sessionStylesheetUrls.add(url);
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = url;
        stylesheets.push(waitForResource(link, "load", link.href, signal));
        doc.head.appendChild(link);
      }
      await Promise.all(stylesheets);
      // Preserve the root and unchanged markup so conservative burst caching can reuse pixels.
      if (frameRoot.innerHTML !== cleanedHtml) frameRoot.replaceChildren(fragment.content);
      sampleAnimations(frameRoot, options?.time);
      await waitForFrameResources(frameRoot, sessionOptions.readiness, signal);
      await this.preCacheFrameRoot();

      const capture = sessionOptions.capture;
      const region = resolveCaptureRegion(sessionOptions.width, sessionOptions.height, capture);
      const defaults = resolveCaptureDefaults(sessionOptions.format, capture, sessionOptions.alpha === "keep");
      const rootRect = frameRoot.getBoundingClientRect();
      const dpr = defaults.dpr;
      return this.capture.capture(frameRoot, {
        width: sessionOptions.width,
        height: sessionOptions.height,
        backgroundColor: sessionOptions.backgroundColor ?? "#000000",
        embedFonts: true,
        dpr,
        scale: defaults.scale === "css" ? 1 / dpr : 1,
        quality: capture?.jpegQuality === undefined ? 1 : capture.jpegQuality / 100,
        cache: capture?.cache ? "soft" : "disabled",
        ...(region !== undefined ? { region: { x: region.x + rootRect.x, y: region.y + rootRect.y, width: region.width, height: region.height } } : {}),
        ...(sessionOptions.alpha === "keep" ? { backgroundColor: "transparent" } : {}),
        ...(capture?.reconcile !== undefined ? { reconcile: capture.reconcile } : {}),
        ...(capture?.cache !== undefined ? { burst: capture.cache } : {}),
      });
    });
  }

  async render(html: string, options: BrowserRenderOptions, frame?: Pick<FrameCaptureOptions, "time" | "signal">): Promise<ImageData> {
    await this.init(options);
    try {
      return await this.captureFrame(html, frame);
    } finally {
      await this.dispose();
    }
  }

  async renderFrame(
    renderFn: (ctx: RenderContext) => string,
    ctx: RenderContext,
    options: BrowserRenderOptions,
  ): Promise<ImageData> {
    return this.render(renderFn(ctx), options, { time: ctx.globalFrame / ctx.fps });
  }

  async dispose(): Promise<void> {
    this.activeCapture?.abort(new DOMException("Browser renderer disposed", "AbortError"));
    await this.capture.dispose?.();
    this.iframe?.remove();
    this.iframe = null;
    this.doc = null;
    this.frameRoot = null;
    this.sessionOptions = null;
    this.sessionStylesheetUrls.clear();
    this.initialized = false;
    this.preCached = false;
    this.capture = new SnapdomCaptureBackend();
  }

  private async withDeadline<T>(options: BrowserRenderOptions, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.activeCapture) throw new Error("BrowserRenderer does not support concurrent captures");
    const timeoutMs = options.readiness?.timeoutMs ?? 8000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
      throw new TypeError("Browser capture timeout must be a positive finite number of milliseconds");
    }
    const linked = createLinkedExecutionSignal({ deadlineMs: Date.now() + timeoutMs, ...(options.signal ? { signal: options.signal } : {}) });
    const controller = new AbortController();
    const abort = () => controller.abort(linked.signal.reason);
    linked.signal.addEventListener("abort", abort, { once: true });
    if (linked.signal.aborted) abort();
    this.activeCapture = controller;
    try {
      controller.signal.throwIfAborted();
      return await raceWithExecution(operation(controller.signal), { signal: controller.signal });
    } catch (error) {
      await this.dispose();
      throw error;
    } finally {
      controller.abort();
      linked.signal.removeEventListener("abort", abort);
      linked.dispose();
      this.activeCapture = undefined;
    }
  }

  private async preCacheFrameRoot(): Promise<void> {
    if (!this.warmupRequested || this.preCached || !this.frameRoot) return;
    if (this.frameRoot.childElementCount === 0 && this.frameRoot.textContent === "") return;
    await this.capture.warmup(this.frameRoot, {
      width: this.sessionOptions?.width ?? this.frameRoot.clientWidth,
      height: this.sessionOptions?.height ?? this.frameRoot.clientHeight,
    });
    this.preCached = true;
  }
}

export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly renderer = new BrowserRenderer();
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private sessionInitialized = false;
  private cachedOptions: RenderOptions | null = null;
  private renderOptions: Partial<RenderOptions> = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = get2DContext(canvas);
  }

  setOptions(options: Partial<RenderOptions>): void {
    this.renderOptions = options;
    this.sessionInitialized = false;
    this.cachedOptions = null;
  }

  async warmup(): Promise<void> {
    await this.renderer.warmup();
    await this.ensureSession();
  }

  async renderFrame(renderFn: (ctx: RenderContext) => string, ctx: RenderContext): Promise<ImageData> {
    await this.ensureSession();
    const imageData = await this.renderer.captureFrame(renderFn(ctx), { time: ctx.globalFrame / ctx.fps });
    if (imageData.width === this.canvas.width && imageData.height === this.canvas.height) {
      this.ctx.putImageData(imageData, 0, 0);
      return imageData;
    }
    const tempCtx = this.getScalingCanvas(imageData.width, imageData.height);
    tempCtx.putImageData(imageData, 0, 0);
    this.ctx.drawImage(this.tempCanvas!, 0, 0, this.canvas.width, this.canvas.height);
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  async dispose(): Promise<void> {
    await this.renderer.dispose();
    this.sessionInitialized = false;
    this.cachedOptions = null;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  private async ensureSession(): Promise<void> {
    const opts: BrowserRenderOptions = {
      width: this.canvas.width,
      height: this.canvas.height,
      ...this.renderOptions,
    };
    const unchanged =
      this.sessionInitialized &&
      this.cachedOptions &&
      this.cachedOptions.width === opts.width &&
      this.cachedOptions.height === opts.height &&
      JSON.stringify(this.cachedOptions.fonts ?? []) === JSON.stringify(opts.fonts ?? []) &&
      JSON.stringify(this.cachedOptions.stylesheets ?? []) === JSON.stringify(opts.stylesheets ?? []) &&
      JSON.stringify(this.cachedOptions.inlineCss ?? []) === JSON.stringify(opts.inlineCss ?? []);
    if (unchanged) return;
    await this.renderer.init(opts);
    this.cachedOptions = opts;
    this.sessionInitialized = true;
  }

  private getScalingCanvas(width: number, height: number): CanvasRenderingContext2D {
    if (!this.tempCanvas || this.tempCanvas.width !== width || this.tempCanvas.height !== height) {
      this.tempCanvas = document.createElement("canvas");
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
      this.tempCtx = get2DContext(this.tempCanvas);
    }
    return this.tempCtx!;
  }
}
