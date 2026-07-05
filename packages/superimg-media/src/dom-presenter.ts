import morphdom from "morphdom";
import type { TailwindConfig } from "@superimg/types";
import { superimgDebug } from "./debug.js";

export interface DomPresenter {
  attach(container: HTMLElement): void;
  present(html: string, width: number, height: number): Promise<void> | void;
  /** Update logical render dimensions without presenting new HTML */
  setLogicalSize(width: number, height: number): void;
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

  constructor(opts: { allowScripts?: boolean } = {}) {
    this.iframe = document.createElement("iframe");
    this.iframe.style.cssText = `
      width:100%;
      height:100%;
      border:none;
      pointer-events:none;
      background:#000000;
      display:block;
    `;
    // Rendering is parent-driven (morphdom into the same-origin iframe DOM), so the
    // frame needs no scripts of its own — keep the sandbox script-less by default.
    // `allow-scripts` is added only when a template runs in-frame JS (e.g. the
    // Tailwind browser CDN); the "can escape its sandboxing" warning that the
    // same-origin + scripts combo triggers is then expected and justified.
    const sandbox = ["allow-same-origin"];
    if (opts.allowScripts) sandbox.push("allow-scripts");
    this.iframe.setAttribute("sandbox", sandbox.join(" "));
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
    superimgDebug("injectStyles", {
      inlineCss: this.pendingInlineCss.length,
      stylesheets: this.pendingStylesheets,
      isReady: this.isReady,
      sandbox: this.iframe.getAttribute("sandbox"),
    });
    // Only inject once the srcdoc document is live (isReady). Injecting into the
    // pre-load about:blank document is pointless — srcdoc replaces it on load,
    // and the stale `stylesInjected` flag would then make setupIframeBody skip the
    // real document, leaving it with no fonts/CSS. Before isReady, setupIframeBody
    // performs the injection on `onload`.
    if (this.isReady && doc?.head) this.injectStylesIntoDoc(doc);
    else superimgDebug("injectStyles deferred — waiting for iframe onload");
  }

  private injectStylesIntoDoc(doc: Document): void {
    if (this.stylesInjected) {
      superimgDebug("injectStylesIntoDoc skipped (stylesInjected already true)");
      return;
    }
    doc.head
      .querySelectorAll("[data-superimg-media-style]")
      .forEach((node) => node.remove());

    if (this.pendingTailwind) {
      const script = doc.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";
      script.dataset.superimgMediaStyle = "tailwind";
      doc.head.appendChild(script);

      if (typeof this.pendingTailwind === "object" && this.pendingTailwind.css) {
        const style = doc.createElement("style");
        style.setAttribute("type", "text/tailwindcss");
        style.dataset.superimgMediaStyle = "tailwind-config";
        style.textContent = this.pendingTailwind.css;
        doc.head.appendChild(style);
      }
    }

    for (const url of this.pendingStylesheets) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.superimgMediaStyle = "stylesheet";
      doc.head.appendChild(link);
    }

    if (this.pendingInlineCss.length > 0) {
      const style = doc.createElement("style");
      style.dataset.superimgMediaStyle = "inline";
      style.textContent = this.pendingInlineCss.join("\n");
      doc.head.appendChild(style);
    }
    this.stylesInjected = true;
    const links = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).map(
      (l) => (l as HTMLLinkElement).href,
    );
    superimgDebug("injectStylesIntoDoc done", {
      stylesheetLinksInHead: links,
      inlineStyleBlocks: doc.head.querySelectorAll("style").length,
    });
    // Surface whether the iframe actually finished loading the fonts.
    const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        superimgDebug("iframe document.fonts ready", {
          status: fonts.status,
          loaded: Array.from(fonts).map((f) => `${f.family} ${f.weight} ${f.status}`),
        });
      });
    }
  }

  private setupIframeBody(): void {
    const doc = this.iframe.contentDocument;
    superimgDebug("setupIframeBody (iframe onload fired)", {
      hasContentDoc: !!doc,
      hasHead: !!doc?.head,
      pendingStylesheets: this.pendingStylesheets.length,
      stylesInjected: this.stylesInjected,
    });
    if (!doc) return;
    // Fresh srcdoc document — discard any flag set against the pre-load document
    // so styles/fonts are (re)injected into the document that's actually visible.
    this.stylesInjected = false;
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

  setLogicalSize(width: number, height: number): void {
    this.logicalWidth = width;
    this.logicalHeight = height;
    if (this.scaleWrapper) {
      this.scaleWrapper.style.width = `${width}px`;
      this.scaleWrapper.style.height = `${height}px`;
    }
    this.updateScale();
  }

  present(html: string, width: number, height: number): void {
    this.setLogicalSize(width, height);

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
