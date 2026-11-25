//! Public Chromium runtime API for SuperImg's Playwright renderer.

import { SuperImgError, type JsonObject } from "@superimg/types";
import {
  applyBrowsersDirectory,
  type BrowsersPathSource,
} from "./runtime-path.js";
import { BrowserInstallError, installBrowser, type InstallOptions } from "./runtime-install.js";
import {
  findHeadlessShellPresence,
  getChromium,
} from "./runtime-probe.js";

export { BrowserInstallError, installBrowser };
export type { InstallOptions };

export type { BrowsersPathSource };

export interface BrowserStatus {
  /** True when headless Chromium launched successfully. */
  installed: boolean;
  /** True when a headless-shell revision dir contains INSTALLATION_COMPLETE. */
  markerPresent: boolean;
  /** Path to the headless-shell binary, or null if not found. */
  executablePath: string | null;
  /** Durable registry SuperImg applied for this process. */
  browsersPath: string;
  /** Why that registry was chosen. */
  browsersPathSource: BrowsersPathSource;
  /** PLAYWRIGHT_BROWSERS_PATH that was set but not durable (0, relative, or tmp). */
  ignoredPlaywrightPath: string | null;
  platform: "darwin" | "linux" | "win32";
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

export class BrowserNotInstalledError extends SuperImgError {
  readonly installCommand: string;
  readonly browsersPath: string | null;

  constructor(details: { browsersPath?: string | null; cause?: unknown } = {}) {
    const installCommand = getBrowserInstallCommand();
    const browsersPath = details.browsersPath ?? null;
    const payload: JsonObject = { installCommand };
    if (typeof browsersPath === "string") payload.browsersPath = browsersPath;
    super(
      "SuperImg Chromium runtime is not installed",
      "CHROMIUM_MISSING",
      payload,
      "Install the Chromium runtime with `superimg setup` or call setup().",
      undefined,
      details.cause !== undefined ? { cause: details.cause } : undefined,
    );
    this.name = "BrowserNotInstalledError";
    this.installCommand = installCommand;
    this.browsersPath = browsersPath;
  }
}

export class BrowserLaunchDeniedError extends SuperImgError {
  readonly browsersPath: string;

  constructor(details: { browsersPath: string; cause?: unknown }) {
    const installCommand = getBrowserInstallCommand();
    super(
      "SuperImg Chromium runtime is installed but could not launch",
      "CHROMIUM_LAUNCH_DENIED",
      { browsersPath: details.browsersPath, installCommand },
      "Chromium is installed but could not launch. Do not re-run `superimg setup` or setup(); leave the sandbox that blocked the binary.",
      undefined,
      details.cause !== undefined ? { cause: details.cause } : undefined,
    );
    this.name = "BrowserLaunchDeniedError";
    this.browsersPath = details.browsersPath;
  }
}

/** Chromium section of a doctor report. Marker present and launch failed means launch-denied. */
export function chromiumHealth(status: Pick<BrowserStatus, "installed" | "markerPresent" | "executablePath" | "browsersPath">): {
  status: "ok" | "missing" | "launch-denied";
  executablePath?: string;
  browsersPath: string;
  installCommand: string;
} {
  const health = status.installed ? "ok" : status.markerPresent ? "launch-denied" : "missing";
  return {
    status: health,
    ...(status.executablePath ? { executablePath: status.executablePath } : {}),
    browsersPath: status.browsersPath,
    installCommand: getBrowserInstallCommand(),
  };
}

/**
 * Map a failed Chromium launch.
 * Launch-denied reuses the marker already reported by checkBrowserStatus.
 * Missing reuses Playwright's "Executable doesn't exist" message.
 * Any other failure is returned unchanged.
 */
export function chromiumLaunchError(
  error: unknown,
  launch: { browsersPath: string; markerPresent: boolean },
): unknown {
  if (launch.markerPresent) {
    return new BrowserLaunchDeniedError({ browsersPath: launch.browsersPath, cause: error });
  }
  if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
    return new BrowserNotInstalledError({ browsersPath: launch.browsersPath, cause: error });
  }
  return error;
}

export function getBrowserInstallCommand(): string {
  return "superimg setup";
}

export async function checkBrowserStatus(): Promise<BrowserStatus> {
  const resolved = applyBrowsersDirectory();
  const presence = findHeadlessShellPresence(resolved.path);
  const platform = process.platform as "darwin" | "linux" | "win32";
  const architecture = process.arch;

  let installed = false;
  try {
    const chromium = await getChromium();
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    installed = true;
  } catch {
    installed = false;
  }

  return {
    installed,
    markerPresent: presence.markerPresent,
    executablePath: presence.executablePath,
    browsersPath: resolved.path,
    browsersPathSource: resolved.source,
    ignoredPlaywrightPath: resolved.ignoredPlaywrightPath,
    platform,
    architecture,
  };
}

/**
 * Ensure the Playwright browser is installed.
 *
 * - Launch ok, or marker present: return (do not re-download).
 * - Missing and autoInstall: install into the SuperImg-owned registry.
 * - Missing and not autoInstall: throw BrowserNotInstalledError.
 */
export async function ensureBrowser(options: EnsureBrowserOptions = {}): Promise<void> {
  const { autoInstall = false, onProgress, timeout } = options;
  const status = await checkBrowserStatus();

  if (status.installed || status.markerPresent) {
    onProgress?.("Browser already installed");
    return;
  }

  if (!autoInstall) {
    throw new BrowserNotInstalledError({ browsersPath: status.browsersPath });
  }

  await installBrowser({
    ...(onProgress !== undefined ? { onProgress } : {}),
    ...(timeout !== undefined ? { timeout } : {}),
  });
}

export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL,
  );
}
