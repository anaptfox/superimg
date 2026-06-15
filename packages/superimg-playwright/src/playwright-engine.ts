//! Playwright render engine - browser lifecycle and adapter factory

import type { Browser, Page } from "playwright-core";
import { Hono } from "hono";
import { serve, type ServerType } from "@hono/node-server";
import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import type { RenderEngine, EncodingOptions, VideoEncoder, AudioValue } from "@superimg/types";
import {
  checkBrowserStatus,
  ensureBrowser,
  getBrowserInstallCommand,
  isCI,
  type BrowserStatus,
  type EnsureBrowserOptions,
} from "./browser-utils.js";
import { PlaywrightFrameRenderer } from "./adapters.js";
import { FfmpegGifEncoder } from "./ffmpeg-gif-encoder.js";
import { NodeVideoEncoder } from "./node-encoder.js";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

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

    try {
      const { chromium } = await import("playwright");
      this.browser = await chromium.launch();
    } catch (err) {
      if (err instanceof Error && err.message.includes("Executable doesn't exist")) {
        const prettyMessage = createBrowserNotFoundMessage();
        throw new Error(`Browser not found.\n\n${wrapInASCIIBox(prettyMessage, 1)}`);
      }
      throw err;
    }

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
    });

    this.page = await context.newPage();

    const app = new Hono();

    // Serve local files for images and other assets referenced in templates
    app.get("/assets", (c) => {
      const filePath = c.req.query("path");
      if (!filePath) {
        return c.text("Missing path parameter", 400);
      }
      if (!existsSync(filePath)) {
        return c.text(`File not found: ${filePath}`, 404);
      }
      const ext = extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";
      const data = readFileSync(filePath);
      c.header("Content-Type", mimeType);
      c.header("Content-Length", String(data.length));
      return c.body(data);
    });

    this.server = serve({ fetch: app.fetch, port: 0 });
    const address = this.server.address();
    this.serverPort = typeof address === "object" && address ? address.port : 0;
  }

  createAdapters(options?: { encoding?: EncodingOptions; audio?: AudioValue }): { renderer: PlaywrightFrameRenderer; encoder: VideoEncoder<Buffer> } {
    const page = this.page;
    if (!page) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }

    let encoder: VideoEncoder<Buffer>;
    if (options?.encoding?.format === "gif") {
      encoder = new FfmpegGifEncoder();
    } else {
      // Server-side encoding via @mediabunny/server — handles both video-only and audio+video
      encoder = new NodeVideoEncoder();
    }

    return {
      renderer: new PlaywrightFrameRenderer(page),
      encoder,
    };
  }

  async dispose(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    this.server?.close();
    this.server = null;
  }
}
