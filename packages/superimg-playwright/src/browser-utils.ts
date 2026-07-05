//! Browser detection and installation utilities for SuperImg's Playwright runtime

import { fork } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { isModuleNotFoundError } from "@superimg/core/errors";

const require = createRequire(import.meta.url);

/** Lazy-load chromium to avoid ERR_MODULE_NOT_FOUND when playwright is not installed. */
async function getChromium(): Promise<typeof import("playwright").chromium> {
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch (err: unknown) {
    if (isModuleNotFoundError(err)) {
      throw new Error("SuperImg's internal Playwright runtime is not installed.");
    }
    throw err;
  }
}

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
    super("SuperImg Chromium runtime is not installed");
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
  return "superimg setup";
}

/**
 * Check if the SuperImg Chromium runtime can launch.
 * This does not install anything.
 */
export async function checkBrowserStatus(): Promise<BrowserStatus> {
  const platform = process.platform as "darwin" | "linux" | "win32";
  const architecture = process.arch;
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH ?? null;

  let executablePath: string | null = null;
  let installed = false;

  try {
    const chromium = await getChromium();
    const browser = await chromium.launch({ headless: true });
    executablePath = browser.process()?.spawnfile ?? chromium.executablePath();
    await browser.close();
    installed = true;
  } catch {
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
  await installBrowser({
    ...(onProgress !== undefined ? { onProgress } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
  });
}

/**
 * Install the Playwright Chromium browser.
 * This will download and install even if the browser is already installed.
 */
export async function installBrowser(options: InstallOptions = {}): Promise<void> {
  const { onProgress, timeout = 300000 } = options;

  onProgress?.("Installing SuperImg Chromium headless shell...");

  let cliPath: string;
  try {
    cliPath = join(require.resolve("playwright/package.json"), "..", "cli.js");
  } catch {
    throw new Error("SuperImg's internal Playwright runtime is not installed.");
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const child = fork(cliPath, ["install", "--only-shell", "chromium"], {
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
          onProgress?.("SuperImg Chromium runtime installation complete");
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
