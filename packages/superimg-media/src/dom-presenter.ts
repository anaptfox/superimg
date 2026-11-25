import morphdom from "morphdom";
import type { TailwindConfig } from "@superimg/types";
import { superimgDebug } from "./debug.js";
import { reexecuteScriptsUnder } from "./script-reexec.js";
import { resolvePlayerPolicy, type PlayerMode } from "./player-policy.js";
import { isEscapedTreeHtml } from "./escaped-html.js";
import type { FramePerformanceSample } from "./performance.js";

export interface DomPresentOptions {
  /** Internal proof tied to exact escaped lowerer output; callers cannot mint it. */
  escapedTree?: object;
  /** Opt-in numeric stage observation; absent on the ordinary path. */
  performance?: FramePerformanceSample;
}

export interface DomPresenter {
  attach(container: HTMLElement): void;
  present(
    html: string,
    width: number,
    height: number,
    options?: DomPresentOptions,
  ): Promise<void> | void;
  /** Update logical render dimensions without presenting new HTML */
  setLogicalSize(width: number, height: number): void;
  injectStyles(inlineCss?: string[], stylesheets?: string[], tailwind?: boolean | TailwindConfig): void;
  getElement(): HTMLElement;
  /** Changes when DOM target membership changes; optional for custom presenters. */
  getDomRevision?(): number;
  /** Remeasure host geometry after changes such as an ancestor CSS transform. */
  refreshGeometry?(): void;
  dispose(): void;
}

export interface IframePresenterOptions {
  /** Product boundary: "render-only" (prod) | "dev" (playground / islands). */
  playerMode?: PlayerMode;
  /**
   * Log strip / wall-clock CSS warnings.
   * Default follows policy: **dev → on**, **render-only → off** (opt-in here).
   */
  warn?: boolean;
  sourceId?: string;
  /**
   * Floor behind the template canvas (letterbox / subpixel gaps).
   * Default **transparent** so the host page (or template) owns color —
   * never force a product dark underlay into authors' embeds.
   * Pass a solid (e.g. `#07070c`) only for export/composite floors.
   */
  stageBackground?: string;
}

/** Browser playback uses native video for the same deterministic clip marker
 * that the export adapter replaces with an extracted image frame. Keep the
 * video element stable across morphs so a seek changes its clock, not its src.
 */
function browserClipHtml(html: string, doc: Document): string {
  if (!html.includes("data-superimg-clip")) return html;
  const template = doc.createElement("template");
  template.innerHTML = html;
  for (const image of template.content.querySelectorAll("img[data-superimg-clip]")) {
    const src = image.getAttribute("data-src");
    if (!src) continue;
    const video = doc.createElement("video");
    video.setAttribute("src", src);
    video.setAttribute("data-superimg-media", "video");
    video.setAttribute("data-t", image.getAttribute("data-t") ?? "0");
    video.setAttribute("preload", "auto");
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.style.cssText = image.getAttribute("style") ?? "";
    image.replaceWith(video);
  }
  return template.innerHTML;
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
  private lastPresentedHtml: string | null = null;
  private lastPresentedSanitized: boolean | null = null;
  private sanitizedFragments: import("./sanitize-html.js").SanitizedFragmentCache | null = null;
  private containerWidth = 0;
  private containerHeight = 0;
  private lastScaleTransform: string | null = null;
  private domRevision = 0;
  private resizeWindow: Window | null = null;
  private readonly onWindowResize = () => this.measureContainer();
  private pendingInlineCss: string[] = [];
  private pendingStylesheets: string[] = [];
  private pendingTailwind: boolean | TailwindConfig | undefined;
  private stylesInjected = false;
  private stripHtml: boolean;
  private reexecuteScripts: boolean;
  private injectTailwindCdn: boolean;
  /** True once allow-scripts has been applied; cannot be removed for this iframe. */
  private scriptsEnabled: boolean;
  private warn: boolean;
  private sourceId: string | undefined;
  /** Underlayer behind template; transparent by default (host/template own color). */
  private stageBackground: string;
  private wallClockWarned = false;
  /** One strip warning per presenter lifetime (avoid per-frame spam). */
  private stripWarned = false;
  /** Resolvers waiting for iframe onload + #root (first present may race srcdoc). */
  private iframeReadyWaiters: Array<() => void> = [];

  constructor(opts: IframePresenterOptions = {}) {
    const policy = resolvePlayerPolicy({
      playerMode: opts.playerMode ?? "render-only",
      hasTailwind: false, // refined when injectStyles / applyPolicy runs
    });
    this.stripHtml = policy.stripHtml;
    this.reexecuteScripts = policy.reexecuteScripts;
    this.injectTailwindCdn = policy.injectTailwindCdn;
    this.scriptsEnabled = policy.allowScripts;
    this.warn = opts.warn ?? policy.warnDefault;
    this.sourceId = opts.sourceId;
    this.stageBackground = opts.stageBackground ?? "transparent";

    this.iframe = document.createElement("iframe");
    // Transparent chrome by default: template owns fill; host page shows through gaps.
    // Optional stageBackground only for export-style solid floors.
    this.iframe.style.cssText = `
      width:100%;
      height:100%;
      border:none;
      outline:none;
      pointer-events:none;
      background:${this.stageBackground};
      display:block;
    `;
    // Parent-driven morphdom needs same-origin. Scripts only for dev path.
    const sandbox = ["allow-same-origin"];
    if (policy.allowScripts) sandbox.push("allow-scripts");
    this.iframe.setAttribute("sandbox", sandbox.join(" "));
    this.iframe.onload = () => this.setupIframeBody();
    // Use the initial blank document. A srcdoc navigation inside a WebMCP
    // invocation can be mistaken for that invocation's cross-document result.
  }

  /**
   * Apply resolved policy when runtime knows tailwind / mode.
   * Sandbox is one-way for this iframe: scripts can be added, never removed.
   * Downgrading to a script-less policy after scripts were enabled throws —
   * create a new presenter for production strip mode.
   */
  applyPolicy(input: { playerMode: PlayerMode; hasTailwind?: boolean }): void {
    const policy = resolvePlayerPolicy(input);
    if (this.scriptsEnabled && !policy.allowScripts) {
      throw new Error(
        "IframePresenter cannot downgrade sandbox after allow-scripts was enabled. " +
          "Create a new presenter for render-only / stripHtml mode.",
      );
    }
    if (this.stripHtml !== policy.stripHtml) this.invalidateSanitizedFragments();
    this.stripHtml = policy.stripHtml;
    this.reexecuteScripts = policy.reexecuteScripts;
    this.injectTailwindCdn = policy.injectTailwindCdn;
    if (policy.allowScripts) this.ensureScriptSandbox();
  }

  private ensureScriptSandbox(): void {
    this.scriptsEnabled = true;
    const current = this.iframe.getAttribute("sandbox") || "";
    if (current.includes("allow-scripts")) return;
    // Changing sandbox after load can reset the frame in some browsers; set early.
    this.iframe.setAttribute("sandbox", "allow-same-origin allow-scripts");
  }


  attach(container: HTMLElement): void {
    if (this.container === container) return;
    this.disposeContainerOnly();
    this.container = container;
    container.appendChild(this.iframe);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.measureContainer());
      this.resizeObserver.observe(container);
    } else {
      this.resizeWindow = container.ownerDocument.defaultView;
      this.resizeWindow?.addEventListener("resize", this.onWindowResize);
    }
    this.measureContainer();
  }

  injectStyles(
    inlineCss?: string[],
    stylesheets?: string[],
    tailwind?: boolean | TailwindConfig,
  ): void {
    const nextInlineCss = inlineCss ?? [];
    const nextStylesheets = stylesheets ?? [];
    const nextTailwind = this.injectTailwindCdn ? tailwind : undefined;
    const sameStrings = (a: string[], b: string[]) =>
      a.length === b.length && a.every((value, index) => value === b[index]);
    const sameTailwind = typeof this.pendingTailwind === typeof nextTailwind &&
      (typeof nextTailwind === "object"
        ? typeof this.pendingTailwind === "object" && this.pendingTailwind.css === nextTailwind.css
        : this.pendingTailwind === nextTailwind);
    // A data-only session update must not restart font/style resources. Compare
    // ordered content, not caller identity, and snapshot mutable inputs.
    if (this.stylesInjected && sameStrings(this.pendingInlineCss, nextInlineCss) &&
      sameStrings(this.pendingStylesheets, nextStylesheets) && sameTailwind) return;
    this.invalidateSanitizedFragments();
    this.pendingInlineCss = [...nextInlineCss];
    this.pendingStylesheets = [...nextStylesheets];
    this.pendingTailwind = typeof nextTailwind === "object" ? { ...nextTailwind } : nextTailwind;
    if (this.pendingTailwind) this.ensureScriptSandbox();
    this.stylesInjected = false;
    const doc = this.iframe.contentDocument;
    superimgDebug("injectStyles", {
      inlineCss: this.pendingInlineCss.length,
      stylesheets: this.pendingStylesheets,
      isReady: this.isReady,
      sandbox: this.iframe.getAttribute("sandbox"),
      injectTailwindCdn: this.injectTailwindCdn,
    });
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

    if (this.pendingTailwind && this.injectTailwindCdn) {
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
    // Re-pin dark chrome after user CSS (templates often set body without bg).
    this.applyStageChrome(doc);
    this.stylesInjected = true;
    const links = Array.from(doc.head.querySelectorAll('link[rel="stylesheet"]')).map(
      (l) => (l as HTMLLinkElement).href,
    );
    superimgDebug("injectStylesIntoDoc done", {
      stylesheetLinksInHead: links,
      inlineStyleBlocks: doc.head.querySelectorAll("style").length,
    });
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

  private notifyIframeReady(): void {
    const waiters = this.iframeReadyWaiters;
    this.iframeReadyWaiters = [];
    for (const resolve of waiters) resolve();
  }

  /** Wait until the iframe document and #root exist (present can race onload). */
  private waitForIframeReady(): Promise<void> {
    if (this.isReady && this.root) return Promise.resolve();
    return new Promise((resolve) => {
      this.iframeReadyWaiters.push(resolve);
    });
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
    if (this.isReady && this.root?.ownerDocument === doc && this.root.isConnected) return;
    this.invalidateSanitizedFragments();
    this.lastScaleTransform = null;
    // Initial about:blank is a quirks document. Parse our own empty standards
    // document without a browsing-context navigation or changing its sandbox.
    if (!doc.doctype) {
      doc.open();
      doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
      doc.close();
    }
    this.stylesInjected = false;
    this.injectStylesIntoDoc(doc);

    // Stage reset only (size/overflow). Fill comes from stageBackground + template.
    this.applyStageChrome(doc);

    this.scaleWrapper = doc.createElement("div");
    this.scaleWrapper.id = "scale-wrapper";
    this.scaleWrapper.style.cssText = `
      position:absolute;
      left:0;
      top:0;
      width:${this.logicalWidth}px;
      height:${this.logicalHeight}px;
      transform-origin:0 0;
      overflow:hidden;
      background:${this.stageBackground};
      border:none;
      outline:none;
    `;
    doc.body.appendChild(this.scaleWrapper);

    this.root = doc.createElement("div");
    this.root.id = "root";
    this.root.style.cssText = `position:relative;width:100%;height:100%;background:${this.stageBackground};overflow:hidden;`;
    this.scaleWrapper.appendChild(this.root);
    this.domRevision += 1;
    this.isReady = true;
    this.updateScale();
    // Wake any present() calls that raced iframe load — they paint after await.
    const hadReadyWaiters = this.iframeReadyWaiters.length > 0;
    this.notifyIframeReady();
    // A presenter mounted into a detached container has no browsing context yet.
    // Its first present() records pending HTML without waiting forever; paint it
    // when the container is eventually connected and the iframe loads.
    if (!hadReadyWaiters && this.pendingHtml) {
      void this.present(this.pendingHtml, this.logicalWidth, this.logicalHeight);
    }
  }

  setLogicalSize(width: number, height: number): void {
    if (this.logicalWidth === width && this.logicalHeight === height) return;
    this.logicalWidth = width;
    this.logicalHeight = height;
    if (this.scaleWrapper) {
      this.scaleWrapper.style.width = `${width}px`;
      this.scaleWrapper.style.height = `${height}px`;
    }
    this.updateScale();
  }

  /**
   * Paint template HTML into the iframe.
   * Resolves only after the iframe is ready and morphdom has applied `html`
   * (so session.mount / player.load do not mark ready on an empty frame).
   */
  async present(
    html: string,
    width: number,
    height: number,
    options: DomPresentOptions = {},
  ): Promise<void> {
    if (this.stripHtml && html.includes("data-superimg-native")) {
      const probe = document.createElement("template");
      probe.innerHTML = html;
      if (probe.content.querySelector("script[data-superimg-native]")) {
        throw Object.assign(new Error("Native surfaces are not supported by render-only Player"), { code: "NATIVE_SURFACE_UNSUPPORTED" });
      }
    }
    const geometryStarted = options.performance?.start();
    this.setLogicalSize(width, height);
    if (geometryStarted !== undefined) options.performance!.end("geometry", geometryStarted);
    // Track latest HTML so superseded presents can drop out after await.
    this.pendingHtml = html;

    if (!this.isReady || !this.root) {
      // Detached containers do not create an iframe browsing context in DOM
      // implementations (and some test environments). Preserve pending HTML,
      // but let session/player state become ready instead of hanging forever.
      if (!this.iframe.isConnected && !this.iframe.contentDocument) return;
      await this.waitForIframeReady();
    }

    // Disposed while waiting, or a newer present() won.
    if (!this.isReady || !this.root) return;
    if (this.pendingHtml !== html) return;

    const doc = this.iframe.contentDocument;
    const root = this.root;
    if (!doc || !root) return;

    // Time can advance while the deterministic tree remains identical. Avoid
    // reparsing/morphing it; MediaSession still synchronizes native media.
    const sanitize = this.stripHtml && !isEscapedTreeHtml(options.escapedTree, html);
    if (this.lastPresentedHtml === html && this.lastPresentedSanitized === sanitize) {
      this.pendingHtml = null;
      return;
    }
    const presentationHtml = browserClipHtml(html, doc);

    if (this.warn && !this.wallClockWarned) {
      const { detectWallClockCssHints, logWallClockCssWarnings } = await import("./sanitize-html.js");
      const hints = detectWallClockCssHints(presentationHtml);
      if (hints.length > 0) {
        this.wallClockWarned = true;
        logWallClockCssWarnings(hints);
      }
    }

    // Always purify when stripHtml — prefilter is advisory only, not a security gate.
    if (sanitize) {
      const sanitizer = await import("./sanitize-html.js");
      await sanitizer.getTrustedPurifier();
      let stripped: import("./sanitize-html.js").SanitizeStrip[] = [];
      let morphed = false;
      try {
        const sanitizeStarted = options.performance?.start();
        this.sanitizedFragments ??= new sanitizer.SanitizedFragmentCache(doc);
        const result = this.sanitizedFragments.sanitize(presentationHtml);
        if (sanitizeStarted !== undefined) options.performance!.end("sanitize", sanitizeStarted);
        stripped = result.stripped;
        const wrapper = doc.createElement("div");
        wrapper.id = "root";
        // adoptNode can fail across purifier/document implementations (e.g. happy-dom).
        wrapper.appendChild(doc.adoptNode(result.fragment));
        const morphStarted = options.performance?.start();
        this.morph(root, wrapper);
        if (morphStarted !== undefined) options.performance!.end("morph", morphStarted);
        morphed = true;
      } catch {
        // Fall back to string sanitization + morphdom parse into the iframe document.
        const sanitizeStarted = options.performance?.start();
        const result = sanitizer.sanitizeTemplateHtml(presentationHtml, doc);
        if (sanitizeStarted !== undefined) options.performance!.end("sanitize", sanitizeStarted);
        stripped = result.stripped;
        const morphStarted = options.performance?.start();
        this.morph(root, `<div id="root">${result.html}</div>`);
        if (morphStarted !== undefined) options.performance!.end("morph", morphStarted);
        morphed = true;
      }
      if (morphed && this.warn && stripped.length > 0 && !this.stripWarned) {
        this.stripWarned = true;
        sanitizer.logSanitizeWarnings(stripped, {
          ...(this.sourceId !== undefined ? { sourceId: this.sourceId } : {}),
        });
      }
    } else {
      const morphStarted = options.performance?.start();
      this.morph(root, `<div id="root">${presentationHtml}</div>`);
      if (morphStarted !== undefined) options.performance!.end("morph", morphStarted);
    }

    if (this.reexecuteScripts) {
      reexecuteScriptsUnder(root, doc);
    }

    if (this.pendingHtml === html) {
      this.pendingHtml = null;
    }
    this.lastPresentedHtml = html;
    this.lastPresentedSanitized = sanitize;
  }

  /**
   * Stage layout reset — zero chrome that fights template/host fill.
   * Background is only `stageBackground` (default transparent) so embeds
   * inherit the host page; templates paint their own canvas on top.
   */
  private applyStageChrome(doc: Document): void {
    const bg = this.stageBackground;
    const base = doc.head.querySelector(
      "style[data-superimg-stage-chrome]",
    ) as HTMLStyleElement | null;
    // No !important on background — templates must own their fill.
    const css =
      `html,body,#root,#scale-wrapper{margin:0;padding:0;background:${bg}}` +
      "html,body{width:100%;height:100%;overflow:hidden}" +
      "body{position:relative}";
    if (base) {
      base.textContent = css;
    } else if (doc.head) {
      const style = doc.createElement("style");
      style.dataset.superimgStageChrome = "1";
      style.textContent = css;
      doc.head.insertBefore(style, doc.head.firstChild);
    }
    if (doc.documentElement) {
      doc.documentElement.style.cssText = `margin:0;padding:0;width:100%;height:100%;background:${bg};`;
    }
    doc.body.style.cssText = `margin:0;padding:0;width:100%;height:100%;overflow:hidden;position:relative;background:${bg};`;
  }

  private measureContainer(): void {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.containerWidth = rect.width;
    this.containerHeight = rect.height;
    this.updateScale();
  }

  private updateScale(): void {
    if (!this.scaleWrapper || !this.container) return;
    const width = this.containerWidth;
    const height = this.containerHeight;
    // ResizeObserver wakes a hidden/zero-size host when it becomes visible.
    // Do not create an animation-frame retry loop while hidden or detached.
    if (width <= 0 || height <= 0) return;
    // Cover-fill the host so no letterbox bars (top/bottom/side) can show.
    // Origin top-left + translate keeps alignment stable (no flex-center drift).
    const scale = Math.max(
      width / this.logicalWidth,
      height / this.logicalHeight,
    );
    const ox = (width - this.logicalWidth * scale) / 2;
    const oy = (height - this.logicalHeight * scale) / 2;
    const transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
    if (transform === this.lastScaleTransform) return;
    this.scaleWrapper.style.transform = transform;
    this.lastScaleTransform = transform;
  }

  /** Internal numeric qualification seam, intentionally absent from Player's public surface. */
  getCacheStats(): Readonly<import("./sanitize-html.js").SanitizedFragmentCacheStats> | null {
    return this.sanitizedFragments?.getStats() ?? null;
  }

  private invalidateSanitizedFragments(): void {
    this.sanitizedFragments?.clear();
    this.sanitizedFragments = null;
    this.lastPresentedHtml = null;
    this.lastPresentedSanitized = null;
  }

  getElement(): HTMLElement {
    return this.iframe;
  }

  getDomRevision(): number {
    // Trusted dev scripts may mutate the DOM outside our reconciliation hooks.
    if (this.reexecuteScripts) this.domRevision += 1;
    return this.domRevision;
  }

  refreshGeometry(): void {
    this.measureContainer();
  }

  private morph(root: HTMLElement, target: HTMLElement | string): void {
    let targetMembershipChanged = false;
    morphdom(root, target, {
      childrenOnly: false,
      onBeforeElUpdated: (from, to) => {
        if (from.isEqualNode(to)) return false;
        if (targetMembership(from) !== targetMembership(to)) targetMembershipChanged = true;
        return true;
      },
      onNodeAdded: (node) => { if (node.nodeType === 1) targetMembershipChanged = true; },
      onNodeDiscarded: (node) => { if (node.nodeType === 1) targetMembershipChanged = true; },
    });
    if (targetMembershipChanged) this.domRevision += 1;
  }

  private disposeContainerOnly(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resizeWindow?.removeEventListener("resize", this.onWindowResize);
    this.resizeWindow = null;
    this.iframe.remove();
    this.container = null;
    this.containerWidth = 0;
    this.containerHeight = 0;
  }

  dispose(): void {
    this.disposeContainerOnly();
    this.scaleWrapper = null;
    this.root = null;
    this.isReady = false;
    this.pendingHtml = null;
    this.lastPresentedHtml = null;
    this.invalidateSanitizedFragments();
    // Unblock waiters so load() cannot hang forever after dispose.
    this.notifyIframeReady();
  }
}

// A node whose synchronization metadata merely changes value stays in the
// target index. Added/removed eligibility must refresh membership instead.
function targetMembership(element: HTMLElement): number {
  return (element.localName === "video" && element.hasAttribute("data-superimg-media") ? 1 : 0) |
    (element.hasAttribute("data-superimg-plate") ? 2 : 0) |
    (element.hasAttribute("data-si-action") || element.hasAttribute("data-si-actions") ? 4 : 0) |
    (element.hasAttribute("data-si-hit-target") ? 8 : 0);
}
