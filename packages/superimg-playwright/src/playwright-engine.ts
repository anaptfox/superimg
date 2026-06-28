//! Playwright render engine - browser lifecycle and adapter factory

import type { Browser, Page } from "playwright-core";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { serveAssetFile } from "./asset-server.js";
import type { RenderEngine, EncodingOptions, VideoEncoder, AudioValue, FrameRenderer, FrameRendererConfig, ResolvedAssetDeclaration, AssetMeta } from "@superimg/types";
import {
  checkBrowserStatus,
  ensureBrowser,
  getBrowserInstallCommand,
  isCI,
  type BrowserStatus,
  type EnsureBrowserOptions,
} from "./browser-utils.js";
import { PlaywrightFrameRenderer } from "./adapters.js";
import { ensureFfmpegAvailable, FrameExtractor } from "./frame-extractor.js";
import { FfmpegGifEncoder } from "./ffmpeg-gif-encoder.js";
import { NodeVideoEncoder } from "./node-encoder.js";
import { SharpStillEncoder, type StillFormat } from "./sharp-still-encoder.js";

async function launchChromium(
  chromium: import("playwright").BrowserType,
): Promise<Browser> {
  return chromium.launch();
}

function wrapInASCIIBox(text: string, padding = 1): string {
  const lines = text.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  return [
    "╔" + "═".repeat(maxLength + padding * 2) + "╗",
    ...lines.map(
      (line) =>
        "║" +
        " ".repeat(padding) +
        line +
        " ".repeat(maxLength - line.length + padding) +
        "║"
    ),
    "╚" + "═".repeat(maxLength + padding * 2) + "╝",
  ].join("\n");
}

function createBrowserNotFoundMessage(): string {
  const installCommand = getBrowserInstallCommand();
  const ciNote = isCI() ? "\n  For CI, add this to your setup step." : "";

  const lines = [
    "Playwright browser not installed.",
    "",
    "To install the browser, choose one of:",
    "",
    "  1. Auto-install in code:",
    "     await PlaywrightEngine.ensureBrowser();",
    "",
    "  2. CLI command:",
    `     ${installCommand}`,
    ciNote,
  ].filter(Boolean);

  return lines.join("\n");
}

export interface PlaywrightEngineOptions {
  /** If true, automatically install browser if not found (default: false) */
  autoInstall?: boolean;
  /**
   * If true, each createAdapters() call gets its own fresh browser context and page.
   * The renderer's dispose() then closes that context.
   * Use this in the container to isolate clock/viewport/content state across concurrent renders.
   */
  perRenderContext?: boolean;
}

/**
 * Frame renderer that creates a fresh browser context+page per render.
 * Used by PlaywrightEngine when perRenderContext=true.
 * Isolates clock/viewport/content state so concurrent renders don't bleed into each other.
 */
class PerRenderFrameRenderer implements FrameRenderer<Buffer> {
  private inner: PlaywrightFrameRenderer | null = null;

  constructor(
    private readonly browser: Browser,
    private readonly frameExtractor: FrameExtractor,
  ) {}

  async init(config: FrameRendererConfig): Promise<void> {
    const context = await this.browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    this.inner = new PlaywrightFrameRenderer(page, true, this.frameExtractor);
    await this.inner.init(config);
  }

  async captureFrame(html: string, options?: { alpha?: boolean }): Promise<Buffer> {
    return this.inner!.captureFrame(html, options);
  }

  async advanceClock(ms: number): Promise<void> {
    await this.inner!.advanceClock!(ms);
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
 * Playwright-based render engine.
 * Manages browser lifecycle and creates frame renderer + video encoder adapters.
 */
export class PlaywrightEngine implements RenderEngine<Buffer> {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private server: ServerType | null = null;
  private serverPort: number = 0;
  private frameExtractor: FrameExtractor | null = null;

  constructor(private readonly options: PlaywrightEngineOptions = {})  {}

  /**
   * Get the base URL for the internal server.
   * Can be used to construct URLs for assets that need to be fetched from the browser.
   */
  getBaseUrl(): string {
    if (!this.serverPort) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    return `http://localhost:${this.serverPort}`;
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
    const { autoInstall = false } = this.options;

    if (autoInstall) {
      await ensureBrowser({ autoInstall: true });
    }

    await ensureFfmpegAvailable();
    this.frameExtractor = new FrameExtractor();

    try {
      const { chromium } = await import("playwright");
      this.browser = await launchChromium(chromium);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Executable doesn't exist")) {
        const prettyMessage = createBrowserNotFoundMessage();
        throw new Error(`Browser not found.\n\n${wrapInASCIIBox(prettyMessage, 1)}`);
      }
      throw err;
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
      });
      this.page = await context.newPage();
    }

    const app = new Hono();

    // Serve local files for images and other assets referenced in templates
    app.get("/assets", (c) => {
      const result = serveAssetFile(c.req.query("path"), c.req.header("range"));
      for (const [key, value] of Object.entries(result.headers)) {
        c.header(key, value);
      }
      return c.body(new Uint8Array(result.body), result.status);
    });

    this.server = serve({ fetch: app.fetch, port: 0 });
    const address = this.server.address();
    this.serverPort = typeof address === "object" && address ? address.port : 0;
  }

  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): { renderer: FrameRenderer<Buffer>; encoder: VideoEncoder<Buffer> } {
    if (!this.browser) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }

    const fmt = options?.encoding?.format;

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
      encoder = new FfmpegGifEncoder();
    } else if (fmt === "png" || fmt === "webp" || fmt === "jpeg") {
      encoder = new SharpStillEncoder(fmt as StillFormat);
    } else {
      // Server-side encoding via @mediabunny/server — handles both video-only and audio+video
      encoder = new NodeVideoEncoder();
    }

    if (this.options.perRenderContext) {
      // Return a renderer that will lazily create its own context+page and close it on dispose.
      // We pass the browser so the renderer can mint the context at init() time.
      return {
        renderer: new PerRenderFrameRenderer(this.browser, this.frameExtractor!),
        encoder,
      };
    }

    const page = this.page;
    if (!page) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }

    return {
      renderer: new PlaywrightFrameRenderer(page, false, this.frameExtractor!),
      encoder,
    };
  }

  /**
   * Create N independent Playwright pages for parallel frame capture.
   * Each page gets its own browser context and will close it on dispose().
   * Use with executeRenderPlanParallel() in @superimg/core/engine.
   */
  async createParallelRenderers(n: number): Promise<PlaywrightFrameRenderer[]> {
    if (!this.browser) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    const pages = await Promise.all(
      Array.from({ length: n }, async () => {
        const ctx = await this.browser!.newContext({
          viewport: { width: 1920, height: 1080 },
          deviceScaleFactor: 1,
          colorScheme: "light",
          locale: "en-US",
          timezoneId: "UTC",
        });
        return ctx.newPage();
      })
    );
    const extractor = this.frameExtractor!;
    return pages.map((page) => new PlaywrightFrameRenderer(page, true, extractor));
  }

  async dispose(): Promise<void> {
    await this.frameExtractor?.dispose();
    this.frameExtractor = null;
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    this.server?.close();
    this.server = null;
  }
}
