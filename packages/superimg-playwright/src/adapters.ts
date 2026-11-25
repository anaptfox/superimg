//! Playwright adapters implementing Rasterizer and VideoEncoder contracts

import type { Page, Route } from "playwright";
import { createHash } from "node:crypto";
import type {
  RasterizerConfig,
  FrameReadinessPolicy,
  Rasterizer,
  FrameCaptureOptions,
  ResolvedAssetDeclaration,
  AssetMeta,
  OutputFormat,
  TemplateBundle,
} from "@superimg/types";
import { RenderError, RenderExecutionError, createLinkedExecutionSignal, raceWithExecution, resolveCaptureDefaults, resolveCaptureRegion } from "@superimg/types";
import { buildPageShell, measureBrowserDocument, type BrowserDocumentObservation } from "@superimg/core/html";
import { hashTemplateOutputs } from "@superimg/core";

import { FrameExtractor } from "./frame-extractor.js";
import { staticCaptureSignature } from "./capture-reuse.js";
import { ChromiumCapture } from "./chromium-capture.js";
import { collectFrameDiagnostics } from "./frame-diagnostics.js";
import { preloadThreeModule } from "./three-preload.js";
import { preloadLottieModule } from "./lottie-preload.js";
import {
  WAIT_ATTR,
  formatReadinessFail,
  formatReadinessTimeout,
  readinessEvaluateInPage,
  resolveReadinessPolicy,
} from "./readiness.js";

const reuseTaintedPages = new WeakSet<Page>();

const CLIP_SYNC_ATTR = "data-superimg-clip";
const EXTERNAL_EMBED_ATTR = "data-superimg-external-embed";
const CLIP_TAG_RE = /<([a-z0-9-]+)\b(?=[^>]*\bdata-superimg-clip\b)[^>]*>(?:<\/\1>)?/gi;
const EXTERNAL_EMBED_TAG_RE = /<([a-z0-9-]+)\b(?=[^>]*\bdata-superimg-external-embed\b)[^>]*>(?:<\/\1>)?/gi;

function getAttr(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const quoted = tag.match(re);
  if (quoted) return quoted[1];
  if (tag.includes(` ${name} `) || tag.endsWith(` ${name}`) || tag.includes(` ${name}>`)) {
    return "";
  }
  return undefined;
}

function buildInjectedImgTag(tag: string, dataUri: string): string {
  const style = getAttr(tag, "style");
  const alt = getAttr(tag, "alt") ?? "";
  const parts = [`<img src="${dataUri}"`];
  if (style !== undefined) parts.push(` style="${style}"`);
  if (alt) parts.push(` alt="${alt}"`);
  parts.push(">");
  return parts.join("");
}

function buildExternalEmbedPlaceholder(tag: string): string {
  const style = getAttr(tag, "style") ?? "width:100%;height:100%;display:block";
  const provider = getAttr(tag, "data-provider") || "external";
  const poster = getAttr(tag, "data-poster");
  if (poster) {
    return `<img src="${poster}" style="${style}" alt="${provider} embed placeholder">`;
  }
  return [
    `<div style="${style};background:#111827;color:#f9fafb;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:18px;text-align:center;padding:24px;box-sizing:border-box">`,
    `${provider} embed unavailable for deterministic export`,
    `</div>`,
  ].join("");
}

/**
 * Playwright-based frame renderer.
 * Captures HTML to PNG buffer via browser screenshot.
 */
export class PlaywrightRasterizer implements Rasterizer<Buffer> {
  readonly capabilities = Object.freeze({ media: ["html"] as const, browserFree: false, workerSafe: false });
  private fps = 30;
  private mode: 'frame' | 'animation' = 'frame';
  private readiness: FrameReadinessPolicy | undefined;
  private captureDefaults: ReturnType<typeof resolveCaptureDefaults> | null = null;
  private format: OutputFormat | undefined;
  private region = { x: 0, y: 0, width: 0, height: 0 };
  private readonly capture: ChromiumCapture;
  private disposed = false;
  private reuseEnabled = false;
  private reuseTainted = false;
  private reused: { key: string; bytes: Buffer } | undefined;
  private activeCapture: AbortController | undefined;
  private readonly nativeFiles = new Map<string, { body: string | Buffer; contentType: string }>();
  private readonly nativeSetFingerprints = new Map<string, string>();
  private nativeRouteInstalled = false;
  private readonly nativeRoute = async (route: Route) => {
    const file = this.nativeFiles.get(route.request().url());
    if (!file) { await route.fulfill({ status: 404 }); return; }
    await route.fulfill({ status: 200, body: file.body, contentType: file.contentType, headers: { "access-control-allow-origin": "*" } });
  };

  /** Install host-prepared native files into this capture page's private origin. */
  async installNativeModuleFiles(identity: string, outputs: NonNullable<TemplateBundle["outputs"]>): Promise<string> {
    if (this.disposed) throw new Error("Frame renderer disposed");
    if (!/^[a-f0-9]{64}$/.test(identity)) throw new TypeError("Native module identity must be a SHA-256 hex digest");
    const snapshot: NonNullable<TemplateBundle["outputs"]> = outputs.map(file => file.type === "chunk"
      ? { type: "chunk", fileName: file.fileName, code: file.code, isEntry: file.isEntry, sourceMap: structuredClone(file.sourceMap) }
      : { type: "asset", fileName: file.fileName, source: typeof file.source === "string" ? file.source : new Uint8Array(file.source) });
    if (hashTemplateOutputs(snapshot) !== identity) throw new TypeError("Native module identity does not match its files");
    const base = `https://superimg-native.invalid/${identity}/`;
    const candidate = new Map<string, { body: string | Buffer; contentType: string }>();
    for (const file of snapshot) {
      if (!file.fileName || file.fileName.startsWith("/") || file.fileName.split("/").some(segment => !segment || segment === "." || segment === "..") || /[%?#\\\s\x00-\x1f]/.test(file.fileName)) throw new TypeError("Invalid native module filename");
      const extension = file.fileName.split(".").pop()?.toLowerCase();
      const contentType = file.type === "chunk" ? "application/javascript; charset=utf-8" : extension === "wasm" ? "application/wasm" : extension === "json" || extension === "map" ? "application/json" : extension === "png" ? "image/png" : extension === "svg" ? "image/svg+xml" : "application/octet-stream";
      const source = file.type === "chunk" ? file.code : file.source;
      const url = base + file.fileName;
      if (candidate.has(url)) throw new TypeError("Duplicate native module filename");
      candidate.set(url, { body: typeof source === "string" ? source : Buffer.from(source), contentType });
    }
    const fingerprint = createHash("sha256");
    for (const [url, file] of [...candidate].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      fingerprint.update(JSON.stringify([url, file.contentType]));
      fingerprint.update(createHash("sha256").update(file.body).digest());
    }
    const digest = fingerprint.digest("hex");
    const previous = this.nativeSetFingerprints.get(identity);
    if (previous !== undefined && previous !== digest) throw new TypeError("Native module identity already has different files");
    if (!this.nativeRouteInstalled) {
      await this.page.route("https://superimg-native.invalid/**", this.nativeRoute);
      this.nativeRouteInstalled = true;
    }
    for (const [url, file] of candidate) this.nativeFiles.set(url, file);
    this.nativeSetFingerprints.set(identity, digest);
    return base;
  }

  constructor(
    private readonly page: Page,
    /** When true, dispose() closes the browser context so per-render pages don't leak. */
    private readonly closeContextOnDispose = false,
    private readonly frameExtractor: FrameExtractor = new FrameExtractor(),
    private readonly observers: Pick<FrameCaptureOptions, "onTiming" | "onDiagnostics"> = {},
  ) { this.capture = new ChromiumCapture(page); }

  accepts(medium: import("@superimg/types").Medium): boolean { return medium === "html"; }

  async init(config: RasterizerConfig, signal?: AbortSignal): Promise<void> {
    if (this.disposed) throw new Error("Frame renderer disposed");
    if (config.capture?.reconcile) {
      throw new TypeError("Playwright capture does not support layout reconciliation; select the SnapDOM browser backend");
    }
    if (config.capture?.colorProfile === "display-p3") {
      throw new TypeError("Display-P3 capture is unavailable: the current output pipeline supports sRGB only");
    }
    for (const moduleSet of config.nativeModuleSets ?? []) {
      await this.installNativeModuleFiles(moduleSet.identity, moduleSet.outputs);
    }
    this.reused = undefined;
    this.reuseEnabled = config.capture?.cache === true && !config.tailwind;
    this.region = resolveCaptureRegion(config.width, config.height, config.capture);
    this.fps = config.fps ?? 30;
    this.mode = config.mode ?? 'frame';
    this.readiness = config.readiness;
    this.format = config.format;
    this.captureDefaults = resolveCaptureDefaults(
      config.format,
      config.capture,
      false,
    );
    const shell = buildPageShell({
      fonts: config.fonts ?? [],
      inlineCss: config.inlineCss ?? [],
      stylesheets: config.stylesheets ?? [],
      ...(config.tailwind !== undefined ? { tailwind: config.tailwind } : {}),
    });
    await this.withDeadline(signal, async (run, remaining) => {
      await run("viewport", () => this.page.setViewportSize({ width: config.width, height: config.height }));
      await run("graphics cleanup", () => this.page.evaluate(async () => {
        const resources = (window as unknown as { __superimgResources?: { dispose(): void; flush?(): Promise<void> } }).__superimgResources;
        resources?.dispose();
        await resources?.flush?.();
      }));
      await run("page stylesheets", () => this.page.setContent(shell, { waitUntil: "load", timeout: remaining() }));
      await run("capture density", () => this.page.evaluate((dpr) => {
        (window as unknown as { __SUPERIMG_CAPTURE_DPR__?: number }).__SUPERIMG_CAPTURE_DPR__ = dpr;
      }, this.captureDefaults!.dpr));
      await run("fonts", () => this.page.evaluate(() => document.fonts.ready));
    });
  }

  async rasterize(html: string, options?: FrameCaptureOptions): Promise<Buffer> {
    return this.withPreparedFrame(html, options, async (run) => {
      const useAlpha = options?.alpha === true;
      const resolved =
        this.captureDefaults ??
        resolveCaptureDefaults(this.format, undefined, useAlpha);
      // Alpha forces PNG (JPEG has no transparency).
      const intermediate =
        options?.intermediate ??
        (useAlpha ? "png" : resolved.intermediate);
      const jpegQuality = options?.jpegQuality ?? resolved.jpegQuality;
      const scale = options?.scale ?? resolved.scale;
      const isPng = intermediate === "png" || useAlpha;

      // A prior script may have installed timers/listeners outside its own frame.
      // Never reuse pixels again during that renderer lease, even after removal.
      if (reuseTaintedPages.has(this.page)) this.reuseTainted = true;
      const key = this.reuseEnabled && !this.reuseTainted
        ? await run("capture reuse", () => this.page.evaluate(staticCaptureSignature, { html, encoding: JSON.stringify([this.region, isPng, jpegQuality, useAlpha, scale, resolved.dpr]) }))
        : null;
      // An ineligible frame can leave browser state (for example an object or
      // frame script). Do not regain reuse eligibility later in this lease.
      if (this.reuseEnabled && key === null) { this.reuseTainted = true; reuseTaintedPages.add(this.page); }
      if (key !== null && this.reused?.key === key) return Buffer.from(this.reused.bytes);
      this.reused = undefined;
      const bytes = await run("capture", () => this.capture.capture({
        format: isPng ? "png" : "jpeg",
        jpegQuality,
        region: this.region,
        alpha: useAlpha,
        scale,
        dpr: resolved.dpr,
        animationTimeMs: this.mode === "animation" ? (options?.time ?? 0) * 1000 : null,
      }));
      if (key !== null) this.reused = { key, bytes: Buffer.from(bytes) };
      return bytes;
    });
  }

  /** Measures the exact prepared DOM under the same readiness/deadline lease. */
  async inspectFrame(html: string, options?: FrameCaptureOptions, captureTextPair = false): Promise<BrowserDocumentObservation & { paintStatus?: string; paintPair?: { visible: Uint8Array; background: Uint8Array } }> {
    return this.withPreparedFrame(html, options, async (run) => {
      const observation = await run("rendered layout", () => this.page.evaluate(measureBrowserDocument, { rootId: "frame", measureTextPaint: captureTextPair }));
      if (!captureTextPair) return observation;
      const resolved = this.captureDefaults ?? resolveCaptureDefaults(this.format);
      const capture = () => this.capture.capture({ format: "png", jpegQuality: resolved.jpegQuality, region: this.region, alpha: false, scale: resolved.scale, dpr: resolved.dpr, animationTimeMs: this.mode === "animation" ? (options?.time ?? 0) * 1000 : null });
      let savedStyles: (string | null)[] = [];
      const restore = () => this.page.evaluate((saved) => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('#frame span[id],#frame p[id],#frame h1[id],#frame h2[id],#frame h3[id],#frame label[id],#frame text[id],#frame tspan[id],#frame span[data-si-node],#frame p[data-si-node],#frame h1[data-si-node],#frame h2[data-si-node],#frame h3[data-si-node],#frame label[data-si-node],#frame text[data-si-node],#frame tspan[data-si-node]')).filter(node => Array.from(node.childNodes).some(child => child.nodeType === 3 && child.textContent?.trim()));
        nodes.forEach((node, index) => { const previous = saved[index]; if (previous === undefined) return; if (previous === null) node.removeAttribute("style"); else node.setAttribute("style", previous); });
      }, savedStyles);
      try {
        const visible = await run("contrast visible capture", capture);
        const masked = await this.page.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>('#frame span[id],#frame p[id],#frame h1[id],#frame h2[id],#frame h3[id],#frame label[id],#frame text[id],#frame tspan[id],#frame span[data-si-node],#frame p[data-si-node],#frame h1[data-si-node],#frame h2[data-si-node],#frame h3[data-si-node],#frame label[data-si-node],#frame text[data-si-node],#frame tspan[data-si-node]')).filter(node => Array.from(node.childNodes).some(child => child.nodeType === 3 && child.textContent?.trim()));
          const styles = nodes.map(node => node.getAttribute("style"));
          for (const node of nodes) {
            node.style.setProperty("color", "transparent", "important");
            node.style.setProperty("-webkit-text-fill-color", "transparent", "important");
            node.style.setProperty("text-shadow", "none", "important");
            if (node.namespaceURI === "http://www.w3.org/2000/svg") { node.style.setProperty("fill", "transparent", "important"); node.style.setProperty("stroke", "transparent", "important"); }
          }
          return { styles, hidden: nodes.length > 0 && nodes.every(node => {
            const computed = getComputedStyle(node);
            return node.namespaceURI === "http://www.w3.org/2000/svg" ? computed.fill === "rgba(0, 0, 0, 0)" && computed.stroke === "rgba(0, 0, 0, 0)" : computed.color === "rgba(0, 0, 0, 0)" && computed.getPropertyValue("-webkit-text-fill-color") === "rgba(0, 0, 0, 0)";
          }) };
        });
        savedStyles = masked.styles;
        if (!masked.hidden) return { ...observation, paintStatus: "mask-unavailable" };
        const background = await run("contrast background capture", capture);
        await restore();
        const restored = await run("contrast stability capture", capture);
        if (!visible.equals(restored)) return { ...observation, paintStatus: "capture-unstable" };
        return { ...observation, paintStatus: "captured", paintPair: { visible, background } };
      } catch (error) {
        options?.signal?.throwIfAborted();
        return { ...observation, paintStatus: "capture-failed" }; // An unavailable optional probe remains unverified.
      } finally {
        await restore().catch(() => {});
      }
    });
  }

  private async withPreparedFrame<T>(
    html: string,
    options: FrameCaptureOptions | undefined,
    consume: (run: <V>(stage: string, task: () => Promise<V>) => Promise<V>) => Promise<T>,
  ): Promise<T> {
    if (this.disposed) throw new Error("Frame renderer disposed");
    // Track effects even when this job did not request reuse: a later still
    // renderer may lease the same pooled page after scripts left timers behind.
    if (/<(?:script|iframe|object|embed)\b|\son[a-z]+\s*=/i.test(html)) reuseTaintedPages.add(this.page);
    const timeMs = (options?.time ?? 0) * 1000;
    if (!Number.isFinite(timeMs) || timeMs < 0) throw new TypeError("Capture time must be non-negative and finite");
    const onDiagnostics = options?.onDiagnostics ?? this.observers.onDiagnostics;
    const diagnostics = onDiagnostics ? collectFrameDiagnostics(this.page) : undefined;
    try { return await this.withDeadline(options?.signal, async (run, remaining, signal) => {
      const injected = await run("embedded clips", () => this.injectClipFrames(html, signal));

      if (injected.includes("__SUPERIMG_THREE__")) {
        await run("Three module", () => preloadThreeModule(this.page));
      }
      if (
        injected.includes("data-superimg-lottie") ||
        injected.includes("lottie.loadAnimation") ||
        injected.includes("loadAnimation({")
      ) {
        await run("Lottie module", () => preloadLottieModule(this.page, injected.includes("lottie.min.js")));
      }

      // Per-frame protocol: reset → inject HTML + run scripts (may done() sync) → wait.
      // Reset MUST run before scripts; resetting after wipes three.scene / canvas signals.
      await run("frame scripts", () => this.page.evaluate(async (h: string) => {
        const ready = (
          window as unknown as { __superimgReady?: { __reset?: () => void } }
        ).__superimgReady;
        ready?.__reset?.();
        (window as unknown as { __superimgResources?: { begin(): void } }).__superimgResources?.begin();

        const el = document.getElementById("frame");
        if (!el) throw new Error("Frame root #frame missing");
        el.innerHTML = h;

        // innerHTML does not execute <script> — re-insert so WebGL/three scenes run.
        const scripts = Array.from(el.querySelectorAll("script"));
        for (const old of scripts) {
          const s = document.createElement("script");
          if (old.src) {
            s.src = old.src;
            s.async = false;
          } else {
            s.textContent = old.textContent;
          }
          if (old.type) s.type = old.type;
          for (const attr of old.attributes) {
            if (attr.name !== "src" && attr.name !== "type") s.setAttribute(attr.name, attr.value);
          }
          const loaded = s.src || s.type === "module" ? new Promise<void>((resolve, reject) => {
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`Failed to load script: ${s.src || "inline module"}`));
          }) : undefined;
          old.replaceWith(s);
          if (loaded) await loaded;
        }
      }, injected));
      // Sampling may select a different font or image in authored keyframes.
      // Materialize those styles before collecting the assets to await.
      await run("animation sampling", () => this.capture.sampleAnimations(this.mode === "animation" ? timeMs : null));

      const policy = resolveReadinessPolicy(this.readiness);
      const waitFonts = policy.waitImplicit.includes("fonts");
      const waitImages = policy.waitImplicit.includes("images");

      const readinessResult = await run("frame assets and readiness tokens", () => this.page.evaluate(readinessEvaluateInPage, {
        timeoutMs: remaining(),
        waitFonts,
        waitImages,
        waitAttr: WAIT_ATTR,
      }));

      if (!readinessResult.ok) {
        const msg =
          !readinessResult.error || readinessResult.error === "timeout"
            ? formatReadinessTimeout(readinessResult.open, policy.timeoutMs)
            : formatReadinessFail(readinessResult.open, readinessResult.error);
        throw new Error(msg);
      }

      // Inline graphics helpers are asynchronous. Their readiness token proves
      // they have claimed this frame's retained resource; only then can absent
      // resources be pruned without a first-to-second-frame reinitialization.
      await run("graphics lifecycle", () => this.page.evaluate(async () => {
        const resources = (window as unknown as { __superimgResources?: { end(): void; flush?(): Promise<void> } }).__superimgResources;
        resources?.end();
        await resources?.flush?.();
      }));

      if (process.env.SUPERIMG_PROFILE === "1") {
        const stats = this.frameExtractor.getStats();
        if (stats.misses > 0 || stats.hits > 0) {
          console.error(
            `[SUPERIMG_PROFILE] clip extract: ${stats.extractMs.toFixed(0)}ms (${stats.hits} hits, ${stats.misses} misses)`,
          );
        }
      }

      return await consume(run);
    }, options?.onTiming ?? this.observers.onTiming);
    } finally {
      if (diagnostics) { try { onDiagnostics?.(diagnostics.finish()); } catch { /* Observations do not change capture success. */ } }
    }
  }

  private async withDeadline<T>(
    signal: AbortSignal | undefined,
    work: (
      run: <V>(stage: string, task: () => Promise<V>) => Promise<V>,
      remaining: () => number,
      signal: AbortSignal,
    ) => Promise<T>,
    onTiming = this.observers.onTiming,
  ): Promise<T> {
    if (this.activeCapture) throw new Error("A frame capture is already active on this renderer");
    const timeoutMs = resolveReadinessPolicy(this.readiness).timeoutMs;
    const deadlineMs = Date.now() + timeoutMs;
    const linked = createLinkedExecutionSignal({ deadlineMs, ...(signal ? { signal } : {}) });
    const controller = new AbortController();
    this.activeCapture = controller;
    let stage = "frame setup";
    const abort = () => controller.abort(linked.signal.reason);
    let discarded: Promise<void> | undefined;
    const discardPage = () => { discarded ??= this.page.close().catch(() => undefined); };
    linked.signal.addEventListener("abort", abort, { once: true });
    controller.signal.addEventListener("abort", discardPage, { once: true });
    if (linked.signal.aborted) abort();
    const run = async <V>(label: string, task: () => Promise<V>): Promise<V> => {
      stage = label;
      if (controller.signal.aborted) throw controller.signal.reason;
      const started = performance.now();
      let status: "completed" | "failed" = "completed";
      try { return await raceWithExecution(task(), { signal: controller.signal }); }
      catch (error) { status = "failed"; throw error; }
      finally { try { onTiming?.({ stage: label, durationMs: performance.now() - started, status, clock: "local-monotonic" }); } catch { /* Timing is observation only. */ } }
    };
    try {
      return await work(run, () => Math.max(1, deadlineMs - Date.now()), controller.signal);
    } catch (error) {
      // Stop outstanding scripts/loads before this page can be reused. The engine
      // replaces discarded shared pages; pooled pages are skipped when closed.
      discardPage();
      await discarded;
      const reason = linked.signal.reason;
      if (reason instanceof RenderExecutionError && reason.code === "deadline_exceeded") {
        throw new RenderExecutionError("deadline_exceeded", formatReadinessTimeout([stage], timeoutMs));
      }
      throw error;
    } finally {
      linked.signal.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", discardPage);
      linked.dispose();
      this.activeCapture = undefined;
    }
  }

  private async injectClipFrames(html: string, signal?: AbortSignal): Promise<string> {
    let nextHtml = this.injectExternalEmbedPlaceholders(html);
    if (!nextHtml.includes(CLIP_SYNC_ATTR)) return nextHtml;

    const matches = [...nextHtml.matchAll(CLIP_TAG_RE)];
    if (matches.length === 0) return nextHtml;

    const replacements = await Promise.all(
      matches.map(async (match) => {
        const tag = match[0];
        const src = getAttr(tag, "data-src");
        const tRaw = getAttr(tag, "data-t");
        if (!src || tRaw === undefined) {
          throw new RenderError({
            frame: -1,
            browserError: `Clip placeholder missing data-src or data-t: ${tag}`,
          });
        }
        const t = Number(tRaw);
        const frameRaw = getAttr(tag, "data-frame");
        const frameIndex = frameRaw !== undefined ? Number(frameRaw) : Math.round(t * this.fps);
        void frameIndex;

        try {
          const png = await this.frameExtractor.extractFrame(src, t, this.fps, signal);
          const dataUri = `data:image/png;base64,${png.toString("base64")}`;
          return { tag, replacement: buildInjectedImgTag(tag, dataUri) };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new RenderError({
            frame: -1,
            browserError: `Clip frame extraction failed: ${src} at t=${t}s: ${message}`,
          });
        }
      }),
    );

    let result = nextHtml;
    for (const { tag, replacement } of replacements) {
      result = result.replace(tag, replacement);
    }
    return result;
  }

  private injectExternalEmbedPlaceholders(html: string): string {
    if (!html.includes(EXTERNAL_EMBED_ATTR)) return html;
    return html.replace(EXTERNAL_EMBED_TAG_RE, (tag) => buildExternalEmbedPlaceholder(tag));
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.reused = undefined;
    this.activeCapture?.abort(new RenderExecutionError("aborted", "Frame renderer disposed"));
    await this.capture.dispose();
    await this.page.evaluate(async () => {
      const resources = (window as unknown as { __superimgResources?: { dispose(): void; flush?(): Promise<void> } }).__superimgResources;
      resources?.dispose();
      await resources?.flush?.();
    }).catch(() => undefined);
    if (this.nativeRouteInstalled) await this.page.unroute("https://superimg-native.invalid/**", this.nativeRoute).catch(() => undefined);
    this.nativeFiles.clear();
    this.nativeSetFingerprints.clear();
    if (this.closeContextOnDispose) {
      await this.page.context().close();
    }
  }

  async preloadAssets(
    declarations: ResolvedAssetDeclaration[]
  ): Promise<Record<string, AssetMeta>> {
    if (declarations.length === 0) return {};

    return this.page.evaluate(
      async (decls: ResolvedAssetDeclaration[]) => {
        const result: Record<string, AssetMeta> = {};

        const getHeaders = async (src: string, type: string) => {
          try {
            const res = await fetch(src, { method: "HEAD" });
            return {
              size: parseInt(res.headers.get("content-length") ?? "0", 10) || 0,
              mimeType:
                res.headers.get("content-type")?.split(";")[0]?.trim() ||
                (type === "image" ? "image/png" : type === "video" ? "video/mp4" : "audio/mpeg"),
            };
          } catch {
            return {
              size: 0,
              mimeType: type === "image" ? "image/png" : type === "video" ? "video/mp4" : "audio/mpeg",
            };
          }
        };

        for (const d of decls) {
          try {
            const { size, mimeType } = await getHeaders(d.src, d.type);

            if (d.type === "image") {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () =>
                  resolve({
                    type: "image",
                    url: d.src,
                    mimeType,
                    size,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                img.onerror = () => reject(new Error(`Failed to load image: ${d.src}`));
                img.src = d.src;
              });
              result[d.key] = meta;
            } else if (d.type === "video") {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const video = document.createElement("video");
                video.crossOrigin = "anonymous";
                video.preload = "metadata";
                video.addEventListener(
                  "loadedmetadata",
                  () => {
                    resolve({
                      type: "video",
                      url: d.src,
                      mimeType,
                      size,
                      width: video.videoWidth,
                      height: video.videoHeight,
                      duration: video.duration,
                    });
                  },
                  { once: true }
                );
                video.addEventListener("error", () => reject(video.error), { once: true });
                video.src = d.src;
              });
              result[d.key] = meta;
            } else {
              const meta = await new Promise<AssetMeta>((resolve, reject) => {
                const audio = new Audio();
                audio.crossOrigin = "anonymous";
                audio.addEventListener(
                  "loadedmetadata",
                  () => {
                    resolve({
                      type: "audio",
                      url: d.src,
                      mimeType,
                      size,
                      duration: audio.duration,
                    });
                  },
                  { once: true }
                );
                audio.addEventListener("error", () => reject(audio.error), { once: true });
                audio.src = d.src;
              });
              result[d.key] = meta;
            }
          } catch (err) {
            console.warn(`[superimg] Failed to load asset ${d.key}:`, err);
            result[d.key] = {
              type: d.type,
              url: d.src,
              mimeType: d.type === "image" ? "image/png" : d.type === "video" ? "video/mp4" : "audio/mpeg",
              size: 0,
              ...(d.type === "image" ? { width: 0, height: 0 } : {}),
              ...(d.type === "video" ? { width: 0, height: 0, duration: 0 } : {}),
              ...(d.type === "audio" ? { duration: 0 } : {}),
            } as AssetMeta;
          }
        }
        return result;
      },
      declarations
    );
  }
}
