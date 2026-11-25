//! Install SuperImg's Chromium headless shell into the owned registry.

import { createRequire } from "node:module";
import { join } from "node:path";
import { SuperImgError, type JsonObject } from "@superimg/types";
import { applyBrowsersDirectory } from "./runtime-path.js";

const require = createRequire(import.meta.url);
const INSTALL_COMMAND = "superimg setup";

export class BrowserInstallError extends SuperImgError {
  readonly exitCode: number;
  readonly installCommand: string;
  readonly browsersPath: string | null;

  constructor(
    exitCode: number,
    message?: string,
    options?: { browsersPath?: string | null; cause?: unknown },
  ) {
    const browsersPath = options?.browsersPath ?? null;
    const payload: JsonObject = { exitCode, installCommand: INSTALL_COMMAND };
    if (typeof browsersPath === "string") payload.browsersPath = browsersPath;
    super(
      message ?? `Failed to install browser (exit code ${exitCode})`,
      "CHROMIUM_INSTALL_FAILED",
      payload,
      "Retry `superimg setup` or call setup() once the download can finish.",
      undefined,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "BrowserInstallError";
    this.exitCode = exitCode;
    this.installCommand = INSTALL_COMMAND;
    this.browsersPath = browsersPath;
  }
}

export interface InstallOptions {
  /** Callback for installation progress messages */
  onProgress?: (message: string) => void;
  /** Installation timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
}

export async function installBrowser(options: InstallOptions = {}): Promise<void> {
  const { onProgress, timeout = 300000 } = options;
  const resolved = applyBrowsersDirectory();

  onProgress?.("Installing SuperImg Chromium headless shell...");

  let cliPath: string;
  try {
    cliPath = join(require.resolve("playwright/package.json"), "..", "cli.js");
  } catch {
    throw new Error("SuperImg's internal Playwright runtime is not installed.");
  }

  const env = {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: resolved.path,
    PLAYWRIGHT_SKIP_BROWSER_GC: "1",
  };

  try {
    const specifier = "node:child_process";
    const childProcess = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ specifier);
    const forkProcess = childProcess[["f", "ork"].join("") as "fork"];
    await new Promise<void>((resolve, reject) => {
      const child = forkProcess(cliPath, ["install", "--only-shell", "chromium"], {
        stdio: onProgress ? "pipe" : "inherit",
        timeout,
        env,
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
          reject(new BrowserInstallError(code ?? 1, undefined, { browsersPath: resolved.path }));
        }
      });

      child.on("error", (err) => {
        reject(new BrowserInstallError(1, err.message, { browsersPath: resolved.path, cause: err }));
      });
    });
  } catch (err) {
    if (err instanceof BrowserInstallError) {
      throw err;
    }
    throw new BrowserInstallError(1, err instanceof Error ? err.message : String(err), {
      browsersPath: resolved.path,
      cause: err,
    });
  }
}
