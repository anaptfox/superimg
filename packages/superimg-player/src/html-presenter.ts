import morphdom from "morphdom";
import type { FramePresenter, RenderContext } from "@superimg/types";

/**
 * HtmlPresenter renders templates in an iframe with CSS transform scaling.
 *
 * Key features:
 * - Renders at logical dimensions (e.g., 1920x1080)
 * - CSS transform scales to fit container while maintaining aspect ratio
 * - ResizeObserver updates scale when container resizes (even when paused)
 * - Flexbox centering provides object-fit: contain behavior
 */
export class HtmlPresenter implements FramePresenter {
  private container: HTMLElement;
  private iframe: HTMLIFrameElement;
  private scaleWrapper: HTMLDivElement | null = null;
  private root: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver;
  private logicalWidth: number = 1920;
  private logicalHeight: number = 1080;
  private isReady = false;
  private pendingHtml: string | null = null;
  private pendingCtx: RenderContext | null = null;
  private pendingInlineCss: string[] = [];
  private pendingStylesheets: string[] = [];
  private stylesInjected = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create iframe that fills the container
    this.iframe = document.createElement("iframe");
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      display: block;
    `;

    // Security sandbox (allow scripts for template interactivity if needed)
    this.iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");

    container.appendChild(this.iframe);

    // ResizeObserver updates scale when container resizes (even when paused)
    this.resizeObserver = new ResizeObserver(() => this.updateScale());
    this.resizeObserver.observe(container);

    // Initialize iframe body when loaded
    this.iframe.onload = () => this.setupIframeBody();

    // Use srcdoc to initialize empty document
    this.iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
  }

  private injectStylesIntoDoc(doc: Document): void {
    if (this.stylesInjected) return;
    if (this.pendingStylesheets.length === 0 && this.pendingInlineCss.length === 0) return;

    for (const url of this.pendingStylesheets) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      doc.head.appendChild(link);
    }
    if (this.pendingInlineCss.length > 0) {
      const style = doc.createElement("style");
      style.textContent = this.pendingInlineCss.join("\n");
      doc.head.appendChild(style);
    }
    this.stylesInjected = true;
  }

  injectStyles(inlineCss?: string[], stylesheets?: string[]): void {
    this.pendingInlineCss = inlineCss ?? [];
    this.pendingStylesheets = stylesheets ?? [];
    this.stylesInjected = false;
    const doc = this.iframe.contentDocument;
    if (doc && doc.head) {
      this.injectStylesIntoDoc(doc);
    }
  }

  private setupIframeBody(): void {
    const doc = this.iframe.contentDocument;
    if (!doc) return;

    this.injectStylesIntoDoc(doc);

    // Flexbox centering for object-fit: contain behavior
    doc.body.style.cssText = `
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: transparent;
    `;

    // Scale wrapper at logical dimensions
    this.scaleWrapper = doc.createElement("div");
    this.scaleWrapper.id = "scale-wrapper";
    this.scaleWrapper.style.cssText = `
      width: ${this.logicalWidth}px;
      height: ${this.logicalHeight}px;
      transform-origin: center center;
      flex-shrink: 0;
    `;
    doc.body.appendChild(this.scaleWrapper);

    // Inner root for morphdom updates
    this.root = doc.createElement("div");
    this.root.id = "root";
    this.scaleWrapper.appendChild(this.root);

    this.isReady = true;
    this.updateScale();

    // Apply any pending HTML
    if (this.pendingHtml !== null && this.pendingCtx !== null) {
      this.present(this.pendingHtml, this.pendingCtx);
      this.pendingHtml = null;
      this.pendingCtx = null;
    }
  }

  /**
   * Set the logical render dimensions.
   * The presenter will scale to fit the container while maintaining aspect ratio.
   */
  setLogicalSize(width: number, height: number): void {
    this.logicalWidth = width;
    this.logicalHeight = height;

    if (this.scaleWrapper) {
      this.scaleWrapper.style.width = `${width}px`;
      this.scaleWrapper.style.height = `${height}px`;
    }

    this.updateScale();
  }

  private updateScale(): void {
    if (!this.scaleWrapper) return;

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = rect.width / this.logicalWidth;
    const scaleY = rect.height / this.logicalHeight;
    const scale = Math.min(scaleX, scaleY);

    this.scaleWrapper.style.transform = `scale(${scale})`;
  }

  present(html: string, ctx: RenderContext): void {
    if (!this.isReady || !this.root) {
      this.pendingHtml = html;
      this.pendingCtx = ctx;
      return;
    }

    // Update logical size if context dimensions differ
    if (ctx.width !== this.logicalWidth || ctx.height !== this.logicalHeight) {
      this.setLogicalSize(ctx.width, ctx.height);
    }

    // Use morphdom to diff and patch only changed nodes
    morphdom(this.root, `<div id="root">${html}</div>`, {
      childrenOnly: false,
    });
  }

  getElement(): HTMLElement {
    return this.iframe;
  }

  /**
   * Pre-cache fonts/images for faster first render.
   * For HtmlPresenter, this is a no-op since the iframe handles font loading.
   */
  async warmup(): Promise<void> {
    // No-op for HTML presenter - browser handles font loading in iframe
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    this.iframe.remove();
    this.scaleWrapper = null;
    this.root = null;
    this.isReady = false;
  }
}
