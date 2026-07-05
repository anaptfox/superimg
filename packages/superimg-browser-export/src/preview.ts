import type { RenderContext, RenderOptions } from "@superimg/types";
import { buildHeadStyles, isSafeStylesheetUrl } from "@superimg/core";
import { SnapdomCaptureBackend } from "./capture.js";
import { get2DContext } from "./utils.js";

const IMPORT_URL_RE = /@import\s+url\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g;

function extractCSSImports(html: string): { cleanedHtml: string; urls: string[] } {
  const urls: string[] = [];
  const cleanedHtml = html.replace(IMPORT_URL_RE, (_match, url) => {
    urls.push(url);
    return "";
  });
  return { cleanedHtml, urls };
}

function waitForStylesheets(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  if (links.length === 0) return Promise.resolve();
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) {
            resolve();
            return;
          }
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function collectStylesheetUrls(options: RenderOptions): string[] {
  const urls: string[] = [];
  if (options.fonts?.length) {
    const fontFamilies = options.fonts
      .map((font) => `family=${encodeURIComponent(font.trim())}`)
      .join("&");
    urls.push(`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`);
  }
  if (options.stylesheets?.length) {
    urls.push(...options.stylesheets.filter(isSafeStylesheetUrl).map((url) => url.trim()));
  }
  return urls;
}

export class BrowserRenderer {
  private readonly capture = new SnapdomCaptureBackend();
  private preCached = false;
  private warmupRequested = false;
  private iframe: HTMLIFrameElement | null = null;
  private doc: Document | null = null;
  private frameRoot: HTMLElement | null = null;
  private sessionOptions: RenderOptions | null = null;
  private initialized = false;
  private sessionStylesheetUrls = new Set<string>();

  async warmup(): Promise<void> {
    this.warmupRequested = true;
    await this.preCacheFrameRoot();
  }

  async init(options: RenderOptions): Promise<void> {
    if (this.initialized && this.sessionOptions) {
      const unchanged =
        this.sessionOptions.width === options.width &&
        this.sessionOptions.height === options.height &&
        JSON.stringify(this.sessionOptions.fonts ?? []) === JSON.stringify(options.fonts ?? []) &&
        JSON.stringify(this.sessionOptions.stylesheets ?? []) ===
          JSON.stringify(options.stylesheets ?? []) &&
        JSON.stringify(this.sessionOptions.inlineCss ?? []) ===
          JSON.stringify(options.inlineCss ?? []);
      if (unchanged) return;
      await this.dispose();
    }

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
    document.body.appendChild(iframe);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const doc = iframe.contentDocument;
    if (!doc) throw new Error("BrowserRenderer failed to create iframe document");
    await waitForStylesheets(doc);
    await doc.fonts.ready;
    const frameRoot = doc.getElementById("frame");
    if (!frameRoot) throw new Error("Frame root #frame not found after init");

    this.iframe = iframe;
    this.doc = doc;
    this.frameRoot = frameRoot;
    this.sessionOptions = options;
    this.sessionStylesheetUrls = new Set(collectStylesheetUrls(options));
    this.initialized = true;
  }

  async captureFrame(html: string): Promise<ImageData> {
    if (!this.frameRoot || !this.sessionOptions || !this.doc) {
      throw new Error("BrowserRenderer.captureFrame: call init() first");
    }

    const { cleanedHtml, urls } = extractCSSImports(html);
    for (const url of urls) {
      if (!isSafeStylesheetUrl(url) || this.sessionStylesheetUrls.has(url)) continue;
      this.sessionStylesheetUrls.add(url);
      const link = this.doc.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      this.doc.head.appendChild(link);
    }
    if (urls.length > 0) {
      await waitForStylesheets(this.doc);
      await this.doc.fonts.ready;
    }

    this.frameRoot.innerHTML = cleanedHtml;
    await this.preCacheFrameRoot();

    return this.capture.capture(this.frameRoot, {
      width: this.sessionOptions.width,
      height: this.sessionOptions.height,
      backgroundColor: this.sessionOptions.backgroundColor ?? "#000000",
      embedFonts: true,
      cache: "auto",
      compress: false,
    });
  }

  async render(html: string, options: RenderOptions): Promise<ImageData> {
    await this.init(options);
    try {
      return await this.captureFrame(html);
    } finally {
      await this.dispose();
    }
  }

  async renderFrame(
    renderFn: (ctx: RenderContext) => string,
    ctx: RenderContext,
    options: RenderOptions,
  ): Promise<ImageData> {
    return this.render(renderFn(ctx), options);
  }

  async dispose(): Promise<void> {
    this.iframe?.remove();
    this.iframe = null;
    this.doc = null;
    this.frameRoot = null;
    this.sessionOptions = null;
    this.sessionStylesheetUrls.clear();
    this.initialized = false;
    this.preCached = false;
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
    const imageData = await this.renderer.captureFrame(renderFn(ctx));
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
    const opts: RenderOptions = {
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
