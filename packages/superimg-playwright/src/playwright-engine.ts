//! Playwright render engine - browser lifecycle and adapter factory

import { chromium, type Browser, type Page } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve, type ServerType } from "@hono/node-server";
import type { RenderEngine } from "@superimg/types";
import {
  checkBrowserStatus,
  ensureBrowser,
  getBrowserInstallCommand,
  isCI,
  type BrowserStatus,
  type EnsureBrowserOptions,
} from "./browser-utils.js";
import { PlaywrightFrameRenderer, PlaywrightVideoEncoder } from "./adapters.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  constructor(private readonly options: PlaywrightEngineOptions = {}) {}

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

    await this.page.evaluate(() => {
      const w = window as unknown as { __playwright_clock?: { install: (opts: unknown) => void } };
      if (w.__playwright_clock) {
        w.__playwright_clock.install({ time: new Date("2025-01-01T00:00:00Z") });
      }
    });

    const harnessDir = join(__dirname, "harness");
    const app = new Hono();
    app.use("/*", serveStatic({ root: harnessDir }));

    this.server = serve({ fetch: app.fetch, port: 0 });
    const address = this.server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    await this.page.goto(`http://localhost:${port}/index.html`);

    await this.page.waitForFunction(() => typeof (window as unknown as { __superimg?: unknown }).__superimg !== "undefined", {
      timeout: 5000,
    });
  }

  createAdapters(): { renderer: PlaywrightFrameRenderer; encoder: PlaywrightVideoEncoder } {
    const page = this.page;
    if (!page) {
      throw new Error("PlaywrightEngine not initialized. Call init() first.");
    }
    return {
      renderer: new PlaywrightFrameRenderer(page),
      encoder: new PlaywrightVideoEncoder(page),
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
