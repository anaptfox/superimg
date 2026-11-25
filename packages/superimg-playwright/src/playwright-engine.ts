//! Playwright render engine - browser lifecycle and adapter factory

import type { Browser, Page } from "playwright-core";
import { Readable } from "node:stream";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { collectFrameDiagnostics } from "./frame-diagnostics.js";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { AssetRegistry, openRegisteredAsset } from "./asset-server.js";
import type {
  RenderEngine,
  EncodingOptions,
  VideoEncoder,
  VideoEncoderConfig,
  AudioValue,
  Rasterizer,
  RasterizerConfig,
  FrameCaptureOptions,
  ResolvedAssetDeclaration,
  AssetMeta,
} from "@superimg/types";
import { isStillOutputFormat, resolveCaptureDefaults } from "@superimg/types";
import {
  checkBrowserStatus,
  chromiumLaunchError,
  ensureBrowser,
  type BrowserStatus,
  type EnsureBrowserOptions,
} from "./browser-utils.js";
import { applyBrowsersDirectory } from "./runtime-path.js";
import { findHeadlessShellPresence } from "./runtime-probe.js";
import { PlaywrightRasterizer } from "./adapters.js";
import { FrameExtractor } from "./frame-extractor.js";
import type { StillFormat } from "./sharp-still-encoder.js";
import {
  bindPooledStillPage,
  chooseStillRendererKind,
  stillPageKey,
} from "./still-page-pool.js";

/** Chromium flags for sRGB + font antialiasing (device scale is context-owned). */
const CHROMIUM_QUALITY_ARGS = [
  "--force-color-profile=srgb",
  "--high-dpi-support=1",
  "--enable-font-antialiasing",
  "--font-render-hinting=full",
  "--enable-gpu-rasterization",
] as const;

async function launchChromium(
  chromium: import("playwright").BrowserType,
  colorProfile: "srgb" | "display-p3" = "srgb",
): Promise<Browser> {
  const profileArg =
    colorProfile === "display-p3"
      ? "--force-color-profile=display-p3"
      : "--force-color-profile=srgb";
  const args = CHROMIUM_QUALITY_ARGS.map((a) =>
    a.startsWith("--force-color-profile=") ? profileArg : a,
  );
  return chromium.launch({
    headless: true,
    args: [...args],
  });
}

export interface PlaywrightEngineOptions {
  onTiming?: NonNullable<FrameCaptureOptions["onTiming"]>;
  onDiagnostics?: NonNullable<FrameCaptureOptions["onDiagnostics"]>;
  /**
   * If true, each createAdapters() call gets its own fresh browser context and page.
   * The renderer's dispose() then closes that context.
   * Use this in the container to isolate clock/viewport/content state across concurrent renders.
   */
  perRenderContext?: boolean;
  /**
   * Reuse Chromium context+page for stills of the same size×dpr.
   * Off by default so CLI / per-render isolation stays intact. Habitat turns this on.
   */
  poolStillPages?: boolean;
  /** Maximum unique local assets registered during one engine lease. */
  maxRegisteredAssets?: number;
}

const STILL_PAGE_POOL_PER_KEY = 3;

/**
 * Frame renderer that creates a fresh browser context+page per render.
 * Used by PlaywrightEngine when perRenderContext=true or still/high-dpr capture.
 */
class PerRenderRasterizer implements Rasterizer<Buffer> {
  readonly capabilities = Object.freeze({ media: ["html"] as const, browserFree: false, workerSafe: false });
  private inner: PlaywrightRasterizer | null = null;

  constructor(
    private readonly browser: Browser,
    private readonly frameExtractor: FrameExtractor,
    private readonly observers: Pick<FrameCaptureOptions, "onTiming" | "onDiagnostics"> = {},
  ) {}

  accepts(medium: import("@superimg/types").Medium): boolean { return medium === "html"; }

  async init(config: RasterizerConfig): Promise<void> {
    const dpr = config.dpr ?? config.capture?.dpr ?? 1;
    const context = await this.browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: dpr,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    this.inner = new PlaywrightRasterizer(page, true, this.frameExtractor, this.observers);
    await this.inner.init(config);
  }

  async rasterize(html: string, options?: FrameCaptureOptions): Promise<Buffer> {
    return this.inner!.rasterize(html, options);
  }

  async preloadAssets(declarations: ResolvedAssetDeclaration[]): Promise<Record<string, AssetMeta>> {
    return this.inner!.preloadAssets!(declarations);
  }

  async dispose(): Promise<void> {
    await this.inner?.dispose();
    this.inner = null;
  }
}

/**
 * Reuses a Chromium context+page for stills of the same size×dpr.
 * `init()` still reloads the shell; the win is skipping newContext/newPage/close.
 * Stills use frame mode, so Playwright's clock is never installed on a reused page.
 */
class PooledStillRasterizer implements Rasterizer<Buffer> {
  readonly capabilities = Object.freeze({ media: ["html"] as const, browserFree: false, workerSafe: false });
  private inner: PlaywrightRasterizer | null = null;
  private page: Page | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  constructor(
    private readonly engine: PlaywrightEngine,
    private readonly frameExtractor: FrameExtractor,
    private readonly observers: Pick<FrameCaptureOptions, "onTiming" | "onDiagnostics"> = {},
  ) {}

  accepts(medium: import("@superimg/types").Medium): boolean { return medium === "html"; }

  async init(config: RasterizerConfig): Promise<void> {
    this.width = config.width;
    this.height = config.height;
    this.dpr = config.dpr ?? config.capture?.dpr ?? 1;
    const bound = await bindPooledStillPage({
      acquire: () => this.engine.acquireStillPage(this.width, this.height, this.dpr),
      release: (page) => this.engine.releaseStillPage(page, this.width, this.height, this.dpr),
      bind: (page) => new PlaywrightRasterizer(page, false, this.frameExtractor, this.observers),
      init: (inner) => inner.init(config),
    });
    this.page = bound.page;
    this.inner = bound.inner;
  }

  async rasterize(html: string, options?: FrameCaptureOptions): Promise<Buffer> {
    return this.inner!.rasterize(html, options);
  }

  async preloadAssets(declarations: ResolvedAssetDeclaration[]): Promise<Record<string, AssetMeta>> {
    return this.inner!.preloadAssets!(declarations);
  }

  async dispose(): Promise<void> {
    await this.inner?.dispose();
    this.inner = null;
    if (this.page) {
      this.engine.releaseStillPage(this.page, this.width, this.height, this.dpr);
      this.page = null;
    }
  }
}

/**
 * Defers the native-backed video encoder graph until a video render actually
 * initializes its encoder. Still-only consumers can therefore import and use
 * PlaywrightEngine without loading @mediabunny/server or node-av.
 */
class LazyNodeVideoEncoder implements VideoEncoder<Buffer> {
  private encoderPromise: Promise<VideoEncoder<Buffer>> | null = null;

  private load(): Promise<VideoEncoder<Buffer>> {
    this.encoderPromise ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "./node-encoder.js").then(
      ({ NodeVideoEncoder }) => new NodeVideoEncoder(),
    );
    return this.encoderPromise;
  }

  async init(config: VideoEncoderConfig): Promise<void> {
    await (await this.load()).init(config);
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    await (await this.load()).addFrame(frame, timestamp);
  }

  async finalize(): Promise<Uint8Array> {
    return (await this.load()).finalize();
  }

  async finalizeToFile(): Promise<{ path: string; byteLength: number }> {
    const encoder = await this.load();
    if (!encoder.finalizeToFile) throw new Error("This encoder does not support file output");
    return encoder.finalizeToFile();
  }

  async dispose(): Promise<void> {
    if (!this.encoderPromise) return;
    let encoder: VideoEncoder<Buffer>;
    try {
      encoder = await this.encoderPromise;
    } catch {
      return;
    }
    await encoder.dispose();
  }
}

/**
 * Keeps Sharp and its native binding outside the PlaywrightEngine import graph.
 * The still encoder is loaded only when a caller initializes a binary still
 * output; check, inspect, HTML, and unused adapters remain native-free.
 */
class LazySharpStillEncoder implements VideoEncoder<Buffer> {
  private encoderPromise: Promise<VideoEncoder<Buffer>> | null = null;

  constructor(private readonly format: StillFormat) {}

  private load(): Promise<VideoEncoder<Buffer>> {
    this.encoderPromise ??= import("./sharp-still-encoder.js").then(
      ({ SharpStillEncoder }) => new SharpStillEncoder(this.format),
    );
    return this.encoderPromise;
  }

  async init(config: VideoEncoderConfig): Promise<void> {
    await (await this.load()).init(config);
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    await (await this.load()).addFrame(frame, timestamp);
  }

  async finalize(): Promise<Uint8Array> {
    return (await this.load()).finalize();
  }

  async dispose(): Promise<void> {
    if (!this.encoderPromise) return;
    let encoder: VideoEncoder<Buffer>;
    try {
      encoder = await this.encoderPromise;
    } catch {
      return;
    }
    await encoder.dispose();
  }
}

/** Defers execa and the ffmpeg implementation until GIF initialization. */
class LazyFfmpegGifEncoder implements VideoEncoder<Buffer> {
  private encoderPromise: Promise<VideoEncoder<Buffer>> | null = null;

  private load(): Promise<VideoEncoder<Buffer>> {
    this.encoderPromise ??= import("./ffmpeg-gif-encoder.js").then(
      ({ FfmpegGifEncoder }) => new FfmpegGifEncoder(),
    );
    return this.encoderPromise;
  }

  async init(config: VideoEncoderConfig): Promise<void> {
    await (await this.load()).init(config);
  }

  async addFrame(frame: Buffer, timestamp: number): Promise<void> {
    await (await this.load()).addFrame(frame, timestamp);
  }

  async finalize(): Promise<Uint8Array> {
    return (await this.load()).finalize();
  }

  async finalizeToFile(): Promise<{ path: string; byteLength: number }> {
    const encoder = await this.load();
    if (!encoder.finalizeToFile) throw new Error("This encoder does not support file output");
    return encoder.finalizeToFile();
  }

  async dispose(): Promise<void> {
    if (!this.encoderPromise) return;
    let encoder: VideoEncoder<Buffer>;
    try {
      encoder = await this.encoderPromise;
    } catch {
      return;
    }
    await encoder.dispose();
  }
}

/**
 * Playwright-based render engine.
 * Manages browser lifecycle and creates frame renderer + video encoder adapters.
 */
export class PlaywrightEngine implements RenderEngine<Buffer> {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private server: ServerType | null = null;
  private serverPort: number = 0;
  private frameExtractor: FrameExtractor | null = null;
  private readonly assetRegistry: AssetRegistry;
  private readonly stillPool = new Map<string, Page[]>();
  private readonly stillInUse = new Set<Page>();

  constructor(private readonly options: PlaywrightEngineOptions = {})  {
    this.assetRegistry = new AssetRegistry(options.maxRegisteredAssets);
  }

  /**
   * Get the base URL for the internal server.
   * Can be used to construct URLs for assets that need to be fetched from the browser.
   */
  private getAssetOrigin(): string {
    if (!this.serverPort) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    return `http://localhost:${this.serverPort}`;
  }

  /** Operation-owned browser layout inspection; ordinary document work stays lazy. */
  async inspectFrame(html: string, config: RasterizerConfig, options?: FrameCaptureOptions, observationOptions: { tracePath?: string; captureTextPair?: boolean } = {}): Promise<import("@superimg/core/html").BrowserDocumentObservation & { paintStatus?: string; paintPair?: { visible: Uint8Array; background: Uint8Array }; diagnostics: import("@superimg/types").JsonObject; trace?: { kind: string; path: string; error: string | null } }> {
    if (!this.browser) throw new Error("PlaywrightEngine not initialized");
    options?.signal?.throwIfAborted();
    const context = await this.browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: config.dpr ?? config.capture?.dpr ?? 1,
      colorScheme: "light", locale: "en-US", timezoneId: "UTC", serviceWorkers: "block",
    });
    let renderer: PlaywrightRasterizer | undefined;
    let diagnostics: ReturnType<typeof collectFrameDiagnostics> | undefined;
    let observation: (import("@superimg/core/html").BrowserDocumentObservation & { paintStatus?: string; paintPair?: { visible: Uint8Array; background: Uint8Array } }) | undefined;
    let traceStarted = false;
    let traceError: string | null = null;
    let failure: unknown;
    let failed = false;
    try {
      options?.signal?.throwIfAborted();
      if (observationOptions.tracePath) {
        await mkdir(dirname(observationOptions.tracePath), { recursive: true });
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
        traceStarted = true;
      }
      const page = await context.newPage();
      diagnostics = collectFrameDiagnostics(page);
      renderer = new PlaywrightRasterizer(page, false, this.frameExtractor ?? undefined, {
        ...this.options,
        ...(options?.onTiming ? { onTiming: options.onTiming } : {}),
      });
      options?.signal?.throwIfAborted();
      await renderer.init(config, options?.signal);
      observation = await renderer.inspectFrame(html, options, observationOptions.captureTextPair === true);
    } catch (error) {
      failed = true;
      failure = error;
      if (observationOptions.tracePath && !traceStarted) traceError = "Trace recording did not start";
    }
    finally {
      if (traceStarted && observationOptions.tracePath) {
        try { await context.tracing.stop({ path: observationOptions.tracePath }); }
        catch (error) { traceError = String(error); }
      }
      try { await renderer?.dispose(); } catch (error) { if (!failed) { failed = true; failure = error; } }
      try { await context.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    }
    const facts = diagnostics?.finish() ?? { scope: "operation-window", unavailable: "page-not-created" };
    const trace = observationOptions.tracePath ? { kind: "playwright-trace-zip", path: observationOptions.tracePath, error: traceError } : undefined;
    if (failed) {
      if (failure && typeof failure === "object" && Object.isExtensible(failure)) Object.assign(failure, { inspectionDiagnostics: facts, ...(trace ? { inspectionTrace: trace } : {}) });
      throw failure;
    }
    return { ...observation!, diagnostics: facts, ...(trace ? { trace } : {}) };
  }

  registerAsset(filePath: string): string {
    return `${this.getAssetOrigin()}/assets/${this.assetRegistry.register(filePath)}`;
  }

  /** Release job-scoped asset registrations while keeping Chromium warm. */
  clearRegisteredAssets(): void {
    this.assetRegistry.clear();
  }

  /**
   * Check if the Playwright browser is installed.
   */
  static async checkBrowser(): Promise<BrowserStatus> {
    return checkBrowserStatus();
  }

  /**
   * Ensure the browser is installed, optionally auto-installing if missing.
   */
  static async ensureBrowser(options?: EnsureBrowserOptions): Promise<void> {
    return ensureBrowser(options);
  }

  async init(): Promise<void> {
    this.frameExtractor = new FrameExtractor(
      undefined,
      undefined,
      (src) => this.assetRegistry.resolveUrl(src),
    );

    const registry = applyBrowsersDirectory();
    try {
      const { chromium } = await import("playwright");
      this.browser = await launchChromium(chromium);
    } catch (err) {
      throw chromiumLaunchError(err, {
        browsersPath: registry.path,
        markerPresent: findHeadlessShellPresence(registry.path).markerPresent,
      });
    }

    // In perRenderContext mode we skip creating a shared context+page here.
    // Each createAdapters() call mints its own context+page instead.
    if (!this.options.perRenderContext) {
      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        colorScheme: "light",
        locale: "en-US",
        timezoneId: "UTC",
        serviceWorkers: "block",
      });
      this.page = await context.newPage();
    }

    const app = new Hono();

    app.on(["GET", "HEAD"], "/assets/:id", (c) => {
      const range = c.req.header("range");
      const result = openRegisteredAsset(this.assetRegistry, c.req.param("id"), {
        method: c.req.method as "GET" | "HEAD",
        ...(range ? { range } : {}),
        signal: c.req.raw.signal,
      });
      const body = result.body
        ? Readable.toWeb(result.body) as ReadableStream<Uint8Array>
        : null;
      return new Response(body, { status: result.status, headers: result.headers });
    });

    this.server = serve({ fetch: app.fetch, port: 0 });
    const address = this.server.address();
    this.serverPort = typeof address === "object" && address ? address.port : 0;
  }

  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): { renderer: Rasterizer<Buffer>; encoder: VideoEncoder<Buffer> } {
    if (!this.browser) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }

    const fmt = options?.encoding?.format;

    if (isStillOutputFormat(fmt)) {
      let encoder: VideoEncoder<Buffer>;
      if (fmt === "png" || fmt === "webp" || fmt === "jpeg") {
        encoder = new LazySharpStillEncoder(fmt as StillFormat);
      } else {
        encoder = new LazySharpStillEncoder("png");
      }
      const renderer =
        chooseStillRendererKind(this.options.poolStillPages) === "pooled"
          ? new PooledStillRasterizer(this, this.frameExtractor!, this.options)
          : new PerRenderRasterizer(this.browser, this.frameExtractor!, this.options);
      return { renderer, encoder };
    }

    // svg/html formats are pure text — they bypass Playwright entirely and must
    // never reach createAdapters(). NodeVideoEncoder cannot handle them, so fail
    // loudly here rather than producing a cryptic error deep in the encode path.
    if (fmt === "svg" || fmt === "html") {
      throw new Error(
        `createAdapters() does not support format="${fmt}". ` +
        `SVG and HTML outputs bypass the render engine entirely — call render() directly and write the result to disk.`
      );
    }

    let encoder: VideoEncoder<Buffer>;
    if (fmt === "gif") {
      encoder = new LazyFfmpegGifEncoder();
    } else if (fmt === "png" || fmt === "webp" || fmt === "jpeg") {
      encoder = new LazySharpStillEncoder(fmt as StillFormat);
    } else {
      // Server-side encoding via @mediabunny/server — handles both video-only and audio+video
      encoder = new LazyNodeVideoEncoder();
    }

    const capture = resolveCaptureDefaults(
      fmt,
      options?.encoding?.capture,
      options?.encoding?.video?.alpha === "keep",
    );
    // Fresh context when dpr ≠ 1, still masters, or engine option — shared page is dpr=1 only.
    const needsFreshContext =
      this.options.perRenderContext === true ||
      isStillOutputFormat(fmt) ||
      capture.dpr !== 1;

    if (needsFreshContext) {
      return {
        renderer: new PerRenderRasterizer(this.browser, this.frameExtractor!, this.options),
        encoder,
      };
    }

    const page = this.page;
    if (!page) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }

    if (page.isClosed()) {
      // A canceled or failed frame discards its page to stop pending scripts.
      // Future jobs get an isolated replacement rather than reusing that target.
      return { renderer: new PerRenderRasterizer(this.browser, this.frameExtractor!, this.options), encoder };
    }

    return {
      renderer: new PlaywrightRasterizer(page, false, this.frameExtractor!, this.options),
      encoder,
    };
  }

  /**
   * Create N independent Playwright pages for parallel frame capture.
   * Each page gets its own browser context and will close it on dispose().
   * Use with executeRenderPlanParallel() in @superimg/core/engine.
   */
  async createParallelRenderers(
    n: number,
    opts?: { dpr?: number; width?: number; height?: number },
  ): Promise<PlaywrightRasterizer[]> {
    if (!this.browser) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    const dpr = opts?.dpr ?? 1;
    const width = opts?.width ?? 1920;
    const height = opts?.height ?? 1080;
    const pages = await Promise.all(
      Array.from({ length: n }, async () => {
        const ctx = await this.browser!.newContext({
          viewport: { width, height },
          deviceScaleFactor: dpr,
          colorScheme: "light",
          locale: "en-US",
          timezoneId: "UTC",
          serviceWorkers: "block",
        });
        return ctx.newPage();
      })
    );
    const extractor = this.frameExtractor!;
    return pages.map((page) => new PlaywrightRasterizer(page, true, extractor, this.options));
  }

  async acquireStillPage(width: number, height: number, dpr: number): Promise<Page> {
    if (!this.browser) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    const key = stillPageKey(width, height, dpr);
    const idle = this.stillPool.get(key) ?? [];
    while (idle.length > 0) {
      const page = idle.pop()!;
      if (!page.isClosed()) {
        this.stillInUse.add(page);
        return page;
      }
    }
    const context = await this.browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    this.stillInUse.add(page);
    return page;
  }

  releaseStillPage(page: Page, width: number, height: number, dpr: number): void {
    this.stillInUse.delete(page);
    if (page.isClosed()) return;
    const key = stillPageKey(width, height, dpr);
    const idle = this.stillPool.get(key) ?? [];
    if (idle.length >= STILL_PAGE_POOL_PER_KEY) {
      void page.context().close().catch(() => undefined);
      return;
    }
    idle.push(page);
    this.stillPool.set(key, idle);
  }

  async dispose(): Promise<void> {
    await this.frameExtractor?.dispose();
    this.frameExtractor = null;
    const pooled = [...this.stillInUse, ...[...this.stillPool.values()].flat()];
    this.stillInUse.clear();
    this.stillPool.clear();
    await Promise.allSettled(pooled.map((page) => page.context().close()));
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    this.server?.close();
    this.server = null;
    this.assetRegistry.clear();
  }
}
