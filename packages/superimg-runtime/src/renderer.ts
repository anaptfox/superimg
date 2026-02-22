//! Snapdom-based HTML renderer

import { snapdom, preCache } from "@zumer/snapdom";
import type { RenderOptions, RenderContext } from "@superimg/types";
import { get2DContext } from "./utils.js";

const IMPORT_URL_RE = /@import\s+url\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g;

/**
 * Extract @import url(...) from HTML, returning the cleaned HTML and the URLs.
 * CSS @import inside <style> blocks written via doc.write() doesn't reliably
 * trigger font loading before doc.fonts.ready resolves. Converting them to
 * <link> tags lets us wait for the load event explicitly.
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
 * Browser renderer using Snapdom for HTML → ImageData conversion
 */
export class BrowserRenderer {
  private preCached = false;

  /**
   * Pre-cache fonts/images for faster first render
   */
  async warmup(): Promise<void> {
    if (this.preCached) return;
    await preCache(document, { embedFonts: true });
    this.preCached = true;
  }

  /**
   * Render HTML string to ImageData using Snapdom
   * Uses an iframe for document isolation - templates using `body { ... }` CSS work natively
   */
  async render(html: string, options: RenderOptions): Promise<ImageData> {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.border = "none";
    iframe.width = String(options.width);
    iframe.height = String(options.height);
    document.body.appendChild(iframe);

    try {
      const doc = iframe.contentDocument!;

      // Extract @import url() from HTML and convert to <link> tags so we can
      // reliably wait for the external stylesheets (and their @font-face rules)
      // to load before capturing the frame.
      const { cleanedHtml, urls } = extractCSSImports(html);

      // Add Google Fonts if provided in options
      if (options.fonts && options.fonts.length > 0) {
        const fontFamilies = options.fonts.map((f) => `family=${f.replace(/ /g, "+")}`).join("&");
        urls.push(`https://fonts.googleapis.com/css2?${fontFamilies}&display=swap`);
      }

      const linkTags = urls
        .map((url) => `<link rel="stylesheet" href="${url}">`)
        .join("");

      doc.open();
      doc.write(
        `<!DOCTYPE html><html><head>${linkTags}<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style></head><body>${cleanedHtml}</body></html>`
      );
      doc.close();

      // Wait for external stylesheets to load (so @font-face rules are parsed)
      await waitForStylesheets(doc);

      // Now doc.fonts actually knows about the font faces — wait for them to load
      await doc.fonts.ready;

      const result = await snapdom(doc.body, {
        width: options.width,
        height: options.height,
        scale: 1,
        dpr: 1,
        embedFonts: true,
        backgroundColor: options.backgroundColor ?? "transparent",
        cache: "full",
      });

      const canvas = await result.toCanvas();
      const ctx = get2DContext(canvas);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } finally {
      document.body.removeChild(iframe);
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
