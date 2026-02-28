//! Snapdom-based HTML renderer

import { snapdom, preCache } from "@zumer/snapdom";
import type { RenderOptions, RenderContext } from "@superimg/types";
import { get2DContext } from "./utils.js";

const IMPORT_URL_RE = /@import\s+url\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g;

/**
 * Extract @import url(...) from HTML, returning the cleaned HTML and the URLs.
 * CSS @import inside <style> blocks doesn't reliably trigger font loading before
 * doc.fonts.ready resolves. Converting them to <link> tags lets us wait for the
 * load event explicitly.
 */
function extractCSSImports(html: string): { cleanedHtml: string; urls: string[] } {
  const urls: string[] = [];
  const cleanedHtml = html.replace(IMPORT_URL_RE, (_match, url) => {
    urls.push(url);
    return "";
  });
  return { cleanedHtml, urls };
}

/**
 * Wait for all <link rel="stylesheet"> elements in a document to finish loading.
 */
function waitForStylesheets(doc: Document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
  if (links.length === 0) return Promise.resolve();

  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          // Already loaded
          if (link.sheet) {
            resolve();
            return;
          }
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => {});
}

/**
 * Build shell HTML from options (fonts, stylesheets, inlineCss, base styles).
 */
function buildShell(options: RenderOptions): { headContent: string; urls: string[] } {
  const urls: string[] = [];

  if (options.fonts && options.fonts.length > 0) {
    const fontFamilies = options.fonts.map((f) => `family=${f.replace(/ /g, "+")}`).join("&");
    urls.push(`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`);
  }

  if (options.stylesheets && options.stylesheets.length > 0) {
    urls.push(...options.stylesheets);
  }

  const linkTags = urls.map((url) => `<link rel="stylesheet" href="${url}">`).join("");
  const inlineStyleBlock =
    options.inlineCss && options.inlineCss.length > 0
      ? `<style>${options.inlineCss.join("\n")}</style>`
      : "";
  const baseStyles =
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>";

  return {
    headContent: `${linkTags}${inlineStyleBlock}${baseStyles}`,
    urls,
  };
}

/**
 * Browser renderer using Snapdom for HTML → ImageData conversion.
 * Supports persistent session mode (init → captureFrame × N → dispose) for
 * efficient frame loops, and one-shot mode via render().
 */
export class BrowserRenderer {
  private preCached = false;

  // Session state (persistent iframe)
  private iframe: HTMLIFrameElement | null = null;
  private doc: Document | null = null;
  private frameRoot: HTMLElement | null = null;
  private sessionOptions: RenderOptions | null = null;
  private initialized = false;
  private sessionStylesheetUrls = new Set<string>();

  /**
   * Pre-cache fonts/images for faster first render
   */
  async warmup(): Promise<void> {
    if (this.preCached) return;
    await preCache(document, { embedFonts: true });
    this.preCached = true;
  }

  /**
   * Initialize a persistent session. Creates iframe once, injects shell (fonts,
   * stylesheets, inline CSS), waits for load. Call before captureFrame().
   */
  async init(options: RenderOptions): Promise<void> {
    if (this.initialized && this.sessionOptions) {
      // Re-init if dimensions or CSS changed
      if (
        this.sessionOptions.width === options.width &&
        this.sessionOptions.height === options.height &&
        JSON.stringify(this.sessionOptions.fonts ?? []) === JSON.stringify(options.fonts ?? []) &&
        JSON.stringify(this.sessionOptions.stylesheets ?? []) ===
          JSON.stringify(options.stylesheets ?? []) &&
        JSON.stringify(this.sessionOptions.inlineCss ?? []) ===
          JSON.stringify(options.inlineCss ?? [])
      ) {
        return;
      }
      await this.dispose();
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.border = "none";
    iframe.width = String(options.width);
    iframe.height = String(options.height);

    const { headContent, urls } = buildShell(options);
    const frameDiv = `<div id="frame" style="position:relative;width:100%;height:100%;"></div>`;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">${headContent}</head><body>${frameDiv}</body></html>`;

    iframe.srcdoc = fullHtml;
    document.body.appendChild(iframe);

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
    });

    const doc = iframe.contentDocument!;
    await waitForStylesheets(doc);
    await doc.fonts.ready;

    const frameRoot = doc.getElementById("frame");
    if (!frameRoot) throw new Error("Frame root #frame not found after init");

    this.iframe = iframe;
    this.doc = doc;
    this.frameRoot = frameRoot;
    this.sessionOptions = options;
    this.sessionStylesheetUrls = new Set(urls);
    this.initialized = true;
  }

  /**
   * Capture a frame using the current session. Must call init() first.
   */
  async captureFrame(html: string): Promise<ImageData> {
    if (!this.frameRoot || !this.sessionOptions || !this.doc) {
      throw new Error("BrowserRenderer.captureFrame: call init() first");
    }

    // Handle @import in per-frame HTML: append missing links with de-dupe
    const { cleanedHtml, urls } = extractCSSImports(html);
    if (urls.length > 0 && this.doc.head) {
      for (const url of urls) {
        if (!this.sessionStylesheetUrls.has(url)) {
          this.sessionStylesheetUrls.add(url);
          const link = this.doc.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          this.doc.head.appendChild(link);
        }
      }
      // Wait for any newly added stylesheets
      await waitForStylesheets(this.doc);
      await this.doc.fonts.ready;
    }

    this.frameRoot.innerHTML = cleanedHtml;

    const result = await snapdom(this.frameRoot, {
      width: this.sessionOptions.width,
      height: this.sessionOptions.height,
      scale: 1,
      dpr: 1,
      embedFonts: true,
      backgroundColor: this.sessionOptions.backgroundColor ?? "transparent",
      cache: "full",
    });

    const canvas = await result.toCanvas();
    const ctx = get2DContext(canvas);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Dispose the session. Removes iframe and clears refs.
   */
  async dispose(): Promise<void> {
    this.iframe?.remove();
    this.iframe = null;
    this.doc = null;
    this.frameRoot = null;
    this.sessionOptions = null;
    this.sessionStylesheetUrls.clear();
    this.initialized = false;
  }

  /**
   * One-shot render: init → captureFrame → dispose. Backward-compatible.
   */
  async render(html: string, options: RenderOptions): Promise<ImageData> {
    await this.init(options);
    try {
      return await this.captureFrame(html);
    } finally {
      await this.dispose();
    }
  }

  /**
   * Render a frame using a template render function
   */
  async renderFrame(
    renderFn: (ctx: RenderContext) => string,
    ctx: RenderContext,
    options: RenderOptions
  ): Promise<ImageData> {
    const html = renderFn(ctx);
    return this.render(html, options);
  }
}
