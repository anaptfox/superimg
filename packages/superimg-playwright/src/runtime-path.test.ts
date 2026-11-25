import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join, resolve } from "node:path";
import {
  accountPlaywrightCache,
  applyBrowsersDirectory,
  isDurableBrowsersPath,
  isInsideDirectory,
  resolveBrowsersDirectory,
  type RuntimePathEnv,
} from "./runtime-path.js";

const TMP = resolve("/var/folders/xx/cursor-tmp");
const HOME = resolve("/Users/tester");

function env(partial: Partial<RuntimePathEnv> = {}): RuntimePathEnv {
  return {
    tmpdir: TMP,
    accountHome: HOME,
    platform: "darwin",
    ...partial,
  };
}

describe("isInsideDirectory", () => {
  it("treats the root itself as inside", () => {
    expect(isInsideDirectory(TMP, TMP)).toBe(true);
  });

  it("treats nested paths as inside", () => {
    expect(isInsideDirectory(join(TMP, "playwright"), TMP)).toBe(true);
  });

  it("rejects siblings", () => {
    expect(isInsideDirectory(resolve("/var/folders/yy/other"), TMP)).toBe(false);
  });
});

describe("isDurableBrowsersPath", () => {
  it("rejects empty, 0, and relative paths", () => {
    expect(isDurableBrowsersPath(undefined, TMP)).toBe(false);
    expect(isDurableBrowsersPath("0", TMP)).toBe(false);
    expect(isDurableBrowsersPath("ms-playwright", TMP)).toBe(false);
  });

  it("rejects paths under tmpdir", () => {
    expect(isDurableBrowsersPath(join(TMP, "playwright"), TMP)).toBe(false);
  });

  it("accepts an absolute ops path", () => {
    expect(isDurableBrowsersPath("/ms-playwright", TMP)).toBe(true);
  });
});

describe("accountPlaywrightCache", () => {
  it("uses Library/Caches on macOS", () => {
    expect(accountPlaywrightCache(HOME, "darwin")).toBe(
      join(HOME, "Library", "Caches", "ms-playwright"),
    );
  });

  it("uses .cache on Linux when XDG is unset", () => {
    expect(accountPlaywrightCache(HOME, "linux")).toBe(
      join(HOME, ".cache", "ms-playwright"),
    );
  });

  it("uses durable XDG_CACHE_HOME on Linux", () => {
    expect(
      accountPlaywrightCache(HOME, "linux", {
        xdgCacheHome: resolve("/ci/cache"),
        tmpdir: TMP,
      }),
    ).toBe(join(resolve("/ci/cache"), "ms-playwright"));
  });

  it("ignores tmp XDG_CACHE_HOME on Linux", () => {
    expect(
      accountPlaywrightCache(HOME, "linux", {
        xdgCacheHome: join(TMP, "xdg"),
        tmpdir: TMP,
      }),
    ).toBe(join(HOME, ".cache", "ms-playwright"));
  });

  it("uses durable LOCALAPPDATA on Windows", () => {
    expect(
      accountPlaywrightCache(HOME, "win32", {
        localAppData: join(HOME, "AppData", "Local"),
        tmpdir: TMP,
      }),
    ).toBe(join(HOME, "AppData", "Local", "ms-playwright"));
  });

  it("uses AppData/Local on Windows", () => {
    expect(accountPlaywrightCache(HOME, "win32")).toBe(
      join(HOME, "AppData", "Local", "ms-playwright"),
    );
  });
});

describe("resolveBrowsersDirectory", () => {
  it("prefers a durable SUPERIMG_BROWSERS_PATH", () => {
    expect(
      resolveBrowsersDirectory(
        env({
          superimgBrowsersPath: "/opt/superimg-browsers",
          playwrightBrowsersPath: "/ms-playwright",
        }),
      ),
    ).toEqual({
      path: resolve("/opt/superimg-browsers"),
      source: "superimg",
      ignoredPlaywrightPath: null,
    });
  });

  it("falls through a tmp SUPERIMG_BROWSERS_PATH to durable Playwright path", () => {
    expect(
      resolveBrowsersDirectory(
        env({
          superimgBrowsersPath: join(TMP, "superimg"),
          playwrightBrowsersPath: "/ms-playwright",
        }),
      ),
    ).toEqual({
      path: resolve("/ms-playwright"),
      source: "playwright",
      ignoredPlaywrightPath: null,
    });
  });

  it("falls through 0 and relative Playwright paths to the account cache", () => {
    expect(
      resolveBrowsersDirectory(
        env({
          playwrightBrowsersPath: "0",
        }),
      ),
    ).toEqual({
      path: join(HOME, "Library", "Caches", "ms-playwright"),
      source: "default",
      ignoredPlaywrightPath: "0",
    });

    expect(
      resolveBrowsersDirectory(
        env({
          playwrightBrowsersPath: "ms-playwright",
        }),
      ),
    ).toEqual({
      path: join(HOME, "Library", "Caches", "ms-playwright"),
      source: "default",
      ignoredPlaywrightPath: "ms-playwright",
    });
  });

  it("falls through a tmp Playwright remap to the account cache", () => {
    expect(
      resolveBrowsersDirectory(
        env({
          playwrightBrowsersPath: join(TMP, "cursor-sandbox-cache", "playwright"),
        }),
      ),
    ).toEqual({
      path: join(HOME, "Library", "Caches", "ms-playwright"),
      source: "default",
      ignoredPlaywrightPath: join(TMP, "cursor-sandbox-cache", "playwright"),
    });
  });

  it("uses the Linux account cache on linux", () => {
    expect(resolveBrowsersDirectory(env({ platform: "linux" }))).toEqual({
      path: join(HOME, ".cache", "ms-playwright"),
      source: "default",
      ignoredPlaywrightPath: null,
    });
  });

  it("uses durable XDG_CACHE_HOME as the Linux default", () => {
    expect(
      resolveBrowsersDirectory(
        env({
          platform: "linux",
          xdgCacheHome: resolve("/ci/cache"),
        }),
      ),
    ).toEqual({
      path: join(resolve("/ci/cache"), "ms-playwright"),
      source: "default",
      ignoredPlaywrightPath: null,
    });
  });
});

describe("applyBrowsersDirectory", () => {
  const original = process.env.PLAYWRIGHT_BROWSERS_PATH;

  beforeEach(() => {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = original;
  });

  it("does not change PLAYWRIGHT_BROWSERS_PATH when the module is imported", async () => {
    const previous = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const sentinel = "superimg-import-side-effect-sentinel";
    process.env.PLAYWRIGHT_BROWSERS_PATH = sentinel;
    try {
      vi.resetModules();
      await import("./runtime-path.js");
      expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(sentinel);
    } finally {
      vi.resetModules();
      if (previous === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
      else process.env.PLAYWRIGHT_BROWSERS_PATH = previous;
    }
  });

  it("assigns PLAYWRIGHT_BROWSERS_PATH to the resolved directory", () => {
    const resolved = applyBrowsersDirectory(
      env({ playwrightBrowsersPath: "/ms-playwright" }),
    );
    expect(resolved).toEqual({
      path: resolve("/ms-playwright"),
      source: "playwright",
      ignoredPlaywrightPath: null,
    });
    expect(process.env.PLAYWRIGHT_BROWSERS_PATH).toBe(resolve("/ms-playwright"));
  });
});
