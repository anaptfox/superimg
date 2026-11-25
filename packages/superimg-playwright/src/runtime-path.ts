//! SuperImg-owned Playwright browsers directory.
//! Resolve a durable absolute path. Callers must invoke `applyBrowsersDirectory()`
//! immediately before `import("playwright")` or a Playwright CLI fork.
//! Importing this module does not mutate `process.env`.

import { homedir, tmpdir, userInfo } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export type BrowsersPathSource = "superimg" | "playwright" | "default";

export interface ResolvedBrowsersDirectory {
  path: string;
  source: BrowsersPathSource;
  /** Raw PLAYWRIGHT_BROWSERS_PATH when it was set but not durable. */
  ignoredPlaywrightPath: string | null;
}

export interface RuntimePathEnv {
  superimgBrowsersPath?: string | undefined;
  playwrightBrowsersPath?: string | undefined;
  xdgCacheHome?: string | undefined;
  localAppData?: string | undefined;
  tmpdir: string;
  accountHome: string;
  platform: NodeJS.Platform;
}

export function readRuntimePathEnv(): RuntimePathEnv {
  return {
    superimgBrowsersPath: process.env.SUPERIMG_BROWSERS_PATH,
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
    xdgCacheHome: process.env.XDG_CACHE_HOME,
    localAppData: process.env.LOCALAPPDATA,
    tmpdir: tmpdir(),
    accountHome: accountHome(),
    platform: process.platform,
  };
}

/** Account profile home — passwd / user profile, not `$HOME`. */
export function accountHome(): string {
  try {
    const fromAccount = userInfo().homedir;
    if (fromAccount) return fromAccount;
  } catch {
    // userInfo() can throw in restricted environments
  }
  return homedir();
}

export function isDurableBrowsersPath(value: string | undefined, tmp: string): boolean {
  if (!value || value === "0") return false;
  if (!isAbsolute(value)) return false;
  return !isInsideDirectory(value, tmp);
}

export function isInsideDirectory(target: string, root: string): boolean {
  const resolvedTarget = resolve(target);
  const resolvedRoot = resolve(root);
  if (resolvedTarget === resolvedRoot) return true;
  const rel = relative(resolvedRoot, resolvedTarget);
  return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

export function accountPlaywrightCache(
  home: string,
  platform: NodeJS.Platform,
  options: { xdgCacheHome?: string; localAppData?: string; tmpdir?: string } = {},
): string {
  const tmp = options.tmpdir ?? tmpdir();
  if (platform === "darwin") {
    return join(home, "Library", "Caches", "ms-playwright");
  }
  if (platform === "win32") {
    if (isDurableBrowsersPath(options.localAppData, tmp)) {
      return join(options.localAppData!, "ms-playwright");
    }
    return join(home, "AppData", "Local", "ms-playwright");
  }
  if (isDurableBrowsersPath(options.xdgCacheHome, tmp)) {
    return join(options.xdgCacheHome!, "ms-playwright");
  }
  return join(home, ".cache", "ms-playwright");
}

function ignoredPlaywrightPath(env: RuntimePathEnv): string | null {
  const raw = env.playwrightBrowsersPath;
  if (raw === undefined || raw === "") return null;
  if (isDurableBrowsersPath(raw, env.tmpdir)) return null;
  return raw;
}

export function resolveBrowsersDirectory(
  env: RuntimePathEnv = readRuntimePathEnv(),
): ResolvedBrowsersDirectory {
  const ignored = ignoredPlaywrightPath(env);
  if (isDurableBrowsersPath(env.superimgBrowsersPath, env.tmpdir)) {
    return {
      path: resolve(env.superimgBrowsersPath!),
      source: "superimg",
      ignoredPlaywrightPath: ignored,
    };
  }
  if (isDurableBrowsersPath(env.playwrightBrowsersPath, env.tmpdir)) {
    return {
      path: resolve(env.playwrightBrowsersPath!),
      source: "playwright",
      ignoredPlaywrightPath: null,
    };
  }
  return {
    path: accountPlaywrightCache(env.accountHome, env.platform, {
      ...(env.xdgCacheHome !== undefined ? { xdgCacheHome: env.xdgCacheHome } : {}),
      ...(env.localAppData !== undefined ? { localAppData: env.localAppData } : {}),
      tmpdir: env.tmpdir,
    }),
    source: "default",
    ignoredPlaywrightPath: ignored,
  };
}

/**
 * Pin Playwright's registry to SuperImg's durable directory.
 * Must run before `import("playwright")` — 1.62.1 snapshots the registry at load.
 */
export function applyBrowsersDirectory(
  env: RuntimePathEnv = readRuntimePathEnv(),
): ResolvedBrowsersDirectory {
  const resolved = resolveBrowsersDirectory(env);
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolved.path;
  return resolved;
}
