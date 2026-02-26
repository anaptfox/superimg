//! Browser detection and installation utilities for Playwright

import { fork } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { chromium } from "playwright";
import type { Browser } from "playwright-core";

const require = createRequire(import.meta.url);

// =============================================================================
// TYPES
// =============================================================================

export interface BrowserStatus {
  /** Whether Chromium browser is installed and accessible */
  installed: boolean;
  /** Path to the browser executable, or null if not installed */
  executablePath: string | null;
  /** Custom browsers path if PLAYWRIGHT_BROWSERS_PATH is set */
  browsersPath: string | null;
  /** Operating system platform */
  platform: "darwin" | "linux" | "win32";
  /** CPU architecture */
  architecture: "x64" | "arm64" | string;
}

export interface EnsureBrowserOptions {
  /** If true, automatically install browser without prompting (default: false) */
  autoInstall?: boolean;
  /** Callback for installation progress messages */
  onProgress?: (message: string) => void;
  /** Installation timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

export interface InstallOptions {
  /** Callback for installation progress messages */
  onProgress?: (message: string) => void;
  /** Installation timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

// =============================================================================
// CUSTOM ERRORS
// =============================================================================

export class BrowserNotInstalledError extends Error {
  readonly installCommand: string;
  readonly browsersPath: string | null;

  constructor(details: { browsersPath?: string | null }) {
    super("Playwright browser is not installed");
    this.name = "BrowserNotInstalledError";
    this.installCommand = getBrowserInstallCommand();
    this.browsersPath = details.browsersPath ?? null;
  }
}

export class BrowserInstallError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message?: string) {
    super(message ?? `Failed to install browser (exit code ${exitCode})`);
    this.name = "BrowserInstallError";
    this.exitCode = exitCode;
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the command to install the Playwright browser.
 * Useful for error messages and documentation.
 */
export function getBrowserInstallCommand(): string {
  return "npx playwright install chromium";
}

/**
 * Check if the Playwright Chromium browser is installed.
 * This is a read-only check that does NOT launch a browser or install anything.
 */
export async function checkBrowserStatus(): Promise<BrowserStatus> {
  const platform = process.platform as "darwin" | "linux" | "win32";
  const architecture = process.arch;
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? null;

  let executablePath: string | null = null;
  let installed = false;

  try {
    // Get the executable path from Playwright
    executablePath = chromium.executablePath();

    // Verify the executable actually exists on disk
    await access(executablePath);
    installed = true;
  } catch {
    // Either executablePath() threw or file doesn't exist
    executablePath = null;
    installed = false;
  }

  return {
    installed,
    executablePath,
    browsersPath,
    platform,
    architecture,
  };
}

/**
 * Ensure the Playwright browser is installed.
 *
 * - If browser is already installed, returns immediately.
 * - If not installed and autoInstall is true, installs the browser.
 * - If not installed and autoInstall is false, throws BrowserNotInstalledError.
 */
export async function ensureBrowser(options: EnsureBrowserOptions = {}): Promise<void> {
  const { autoInstall = false, onProgress, timeout } = options;

  const status = await checkBrowserStatus();

  if (status.installed) {
    onProgress?.("Browser already installed");
    return;
  }

  if (!autoInstall) {
    throw new BrowserNotInstalledError({ browsersPath: status.browsersPath });
  }

  // Auto-install
  await installBrowser({ onProgress, timeout });
}

/**
 * Install the Playwright Chromium browser.
 * This will download and install even if the browser is already installed.
 */
export async function installBrowser(options: InstallOptions = {}): Promise<void> {
  const { onProgress, timeout = 300000 } = options;

  onProgress?.("Installing Playwright Chromium browser...");

  try {
    // Resolve playwright CLI from node_modules
    const cliPath = join(require.resolve("playwright/package.json"), "..", "cli.js");

    await new Promise<void>((resolve, reject) => {
      const child = fork(cliPath, ["install", "chromium"], {
        stdio: onProgress ? "pipe" : "inherit",
        timeout,
      });

      if (onProgress && child.stdout) {
        child.stdout.on("data", (data: Buffer) => {
          onProgress(data.toString().trim());
        });
      }
      if (onProgress && child.stderr) {
        child.stderr.on("data", (data: Buffer) => {
          onProgress(data.toString().trim());
        });
      }

      child.on("close", (code) => {
        if (code === 0) {
          onProgress?.("Browser installation complete");
          resolve();
        } else {
          reject(new BrowserInstallError(code ?? 1));
        }
      });

      child.on("error", (err) => {
        reject(new BrowserInstallError(1, err.message));
      });
    });
  } catch (err) {
    if (err instanceof BrowserInstallError) {
      throw err;
    }
    throw new BrowserInstallError(1, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Check if we're running in a CI environment.
 */
export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL
  );
}

// =============================================================================
// SERVERLESS SUPPORT
// =============================================================================

export interface ServerlessChromium {
  executablePath: string;
  args: string[];
}

/**
 * Check if we're running in a serverless environment (Vercel, AWS Lambda, Netlify).
 */
export function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY
  );
}

/**
 * Get serverless Chromium configuration from @sparticuz/chromium if available.
 * Returns null if not in serverless environment or if @sparticuz/chromium is not installed.
 */
export async function getServerlessChromium(): Promise<ServerlessChromium | null> {
  if (!isServerless()) return null;
  try {
    const chromiumBinary = await import("@sparticuz/chromium");
    return {
      executablePath: await chromiumBinary.default.executablePath(),
      args: chromiumBinary.default.args,
    };
  } catch {
    // @sparticuz/chromium not installed
    return null;
  }
}

/**
 * Launch a browser, automatically detecting whether to use serverless or regular Playwright.
 * In serverless environments with @sparticuz/chromium, uses playwright-core.
 * Otherwise uses regular playwright.
 */
export async function launchBrowser(): Promise<Browser> {
  const serverlessChromium = await getServerlessChromium();

  if (serverlessChromium) {
    // Use playwright-core with @sparticuz/chromium
    const { chromium: playwrightCore } = await import("playwright-core");
    return playwrightCore.launch({
      executablePath: serverlessChromium.executablePath,
      args: serverlessChromium.args,
      headless: true,
    });
  }

  // Use regular playwright (existing behavior)
  return chromium.launch();
}
