import morphdom from "morphdom";
import type { TailwindConfig } from "@superimg/types";

export interface DomPresenter {
  attach(container: HTMLElement): void;
  present(html: string, width: number, height: number): Promise<void> | void;
  injectStyles(inlineCss?: string[], stylesheets?: string[], tailwind?: boolean | TailwindConfig): void;
  getElement(): HTMLElement;
  dispose(): void;
}

export class IframePresenter implements DomPresenter {
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement;
  private scaleWrapper: HTMLDivElement | null = null;
  private root: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private logicalWidth = 1920;
  private logicalHeight = 1080;
  private isReady = false;
  private pendingHtml: string | null = null;
  private pendingInlineCss: string[] = [];
  private pendingStylesheets: string[] = [];
  private pendingTailwind: boolean | TailwindConfig | undefined;
  private stylesInjected = false;

  constructor() {
    this.iframe = document.createElement("iframe");
    this.iframe.style.cssText = `
      width:100%;
      height:100%;
      border:none;
      pointer-events:none;
      background:#000000;
      display:block;
    `;
    this.iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
    this.iframe.onload = () => this.setupIframeBody();
    this.iframe.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';
  }

  attach(container: HTMLElement): void {
    if (this.container === container) return;
    this.disposeContainerOnly();
    this.container = container;
    container.appendChild(this.iframe);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.updateScale());
      this.resizeObserver.observe(container);
    }
  }

  injectStyles(inlineCss?: string[], stylesheets?: string[], tailwind?: boolean | TailwindConfig): void {
    this.pendingInlineCss = inlineCss ?? [];
    this.pendingStylesheets = stylesheets ?? [];
    this.pendingTailwind = tailwind;
    this.stylesInjected = false;
    const doc = this.iframe.contentDocument;
    if (doc?.head) this.injectStylesIntoDoc(doc);
  }

  private injectStylesIntoDoc(doc: Document): void {
    if (this.stylesInjected) return;
    doc.head
      .querySelectorAll("[data-superimg-runtime-web-style]")
      .forEach((node) => node.remove());

    if (this.pendingTailwind) {
      const script = doc.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
      script.dataset.superimgRuntimeWebStyle = "tailwind";
      doc.head.appendChild(script);

      if (typeof this.pendingTailwind === "object" && this.pendingTailwind.css) {
        const style = doc.createElement("style");
        style.setAttribute("type", "text/tailwindcss");
        style.dataset.superimgRuntimeWebStyle = "tailwind-config";
        style.textContent = this.pendingTailwind.css;
        doc.head.appendChild(style);
      }
    }

    for (const url of this.pendingStylesheets) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.superimgRuntimeWebStyle = "stylesheet";
      doc.head.appendChild(link);
    }

    if (this.pendingInlineCss.length > 0) {
      const style = doc.createElement("style");
      style.dataset.superimgRuntimeWebStyle = "inline";
      style.textContent = this.pendingInlineCss.join("\n");
      doc.head.appendChild(style);
    }
    this.stylesInjected = true;
  }

  private setupIframeBody(): void {
    const doc = this.iframe.contentDocument;
    if (!doc) return;
    this.injectStylesIntoDoc(doc);

    doc.body.style.cssText = `
      margin:0;
      display:flex;
      align-items:center;
      justify-content:center;
      width:100vw;
      height:100vh;
      overflow:hidden;
      background:#000000;
    `;

    this.scaleWrapper = doc.createElement("div");
    this.scaleWrapper.id = "scale-wrapper";
    this.scaleWrapper.style.cssText = `
      width:${this.logicalWidth}px;
      height:${this.logicalHeight}px;
      transform-origin:center center;
      flex-shrink:0;
    `;
    doc.body.appendChild(this.scaleWrapper);

    this.root = doc.createElement("div");
    this.root.id = "root";
    this.scaleWrapper.appendChild(this.root);
    this.isReady = true;
    this.updateScale();

    if (this.pendingHtml !== null) {
      void this.present(this.pendingHtml, this.logicalWidth, this.logicalHeight);
      this.pendingHtml = null;
    }
  }

  present(html: string, width: number, height: number): void {
    this.logicalWidth = width;
    this.logicalHeight = height;
    if (this.scaleWrapper) {
      this.scaleWrapper.style.width = `${width}px`;
      this.scaleWrapper.style.height = `${height}px`;
    }
    this.updateScale();

    if (!this.isReady || !this.root) {
      this.pendingHtml = html;
      return;
    }

    morphdom(this.root, `<div id="root">${html}</div>`, {
      childrenOnly: false,
    });
  }

  private updateScale(): void {
    if (!this.scaleWrapper || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => this.updateScale());
      }
      return;
    }
    const scale = Math.min(rect.width / this.logicalWidth, rect.height / this.logicalHeight);
    this.scaleWrapper.style.transform = `scale(${scale})`;
  }

  getElement(): HTMLElement {
    return this.iframe;
  }

  private disposeContainerOnly(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.iframe.remove();
    this.container = null;
  }

  dispose(): void {
    this.disposeContainerOnly();
    this.scaleWrapper = null;
    this.root = null;
    this.isReady = false;
  }
}
