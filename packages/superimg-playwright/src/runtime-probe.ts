//! Headless-shell presence for SuperImg's Playwright runtime.
//! `chromium.executablePath()` is full Chromium — SuperImg installs --only-shell.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isModuleNotFoundError } from "@superimg/core/errors";
import { applyBrowsersDirectory } from "./runtime-path.js";

const SHELL_DIR_PREFIX = "chromium_headless_shell-";
const MARKER_NAME = "INSTALLATION_COMPLETE";
const SHELL_BINARIES = new Set([
  "chrome-headless-shell",
  "chrome-headless-shell.exe",
  "headless_shell",
]);

export interface HeadlessShellPresence {
  markerPresent: boolean;
  revisionDir: string | null;
  executablePath: string | null;
}

export async function getChromium(): Promise<typeof import("playwright").chromium> {
  try {
    applyBrowsersDirectory();
    const pw = await import("playwright");
    return pw.chromium;
  } catch (err: unknown) {
    if (isModuleNotFoundError(err)) {
      throw new Error("SuperImg's internal Playwright runtime is not installed.");
    }
    throw err;
  }
}

export function findHeadlessShellPresence(registry: string): HeadlessShellPresence {
  const revisionDir = findHeadlessShellRevisionDir(registry);
  if (!revisionDir) {
    return { markerPresent: false, revisionDir: null, executablePath: null };
  }
  return {
    markerPresent: true,
    revisionDir,
    executablePath: walkForShellBinary(revisionDir, 0),
  };
}

export function findHeadlessShellRevisionDir(registry: string): string | null {
  if (!existsSync(registry)) return null;
  let names: string[];
  try {
    names = readdirSync(registry);
  } catch {
    return null;
  }
  for (const name of names) {
    if (!name.startsWith(SHELL_DIR_PREFIX)) continue;
    const dir = join(registry, name);
    if (existsSync(join(dir, MARKER_NAME))) return dir;
  }
  return null;
}

function walkForShellBinary(dir: string, depth: number): string | null {
  if (depth > 3) return null;
  let entries: import("node:fs").Dirent<string>[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && SHELL_BINARIES.has(entry.name)) return full;
    if (entry.isDirectory()) {
      const found = walkForShellBinary(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function probeHeadlessShellLaunch(): Promise<boolean> {
  applyBrowsersDirectory();
  try {
    const chromium = await getChromium();
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
