import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
};

describe("superimg package boundary", () => {
  it("does not expose server, export, or runtime-web subpaths", () => {
    const keys = Object.keys(pkg.exports ?? {});
    expect(keys).not.toContain("./server");
    expect(keys).not.toContain("./export");
    expect(keys).not.toContain("./runtime-web");
    expect(keys).not.toContain("./react/export");
  });

  it("does not install server/browser-export runtimes from root superimg", () => {
    const installed = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.optionalDependencies ?? {}),
    };
    for (const name of [
      "@clack/prompts",
      "@hono/node-server",
      "@mediabunny/server",
      "@zumer/snapdom",
      "commander",
      "execa",
      "hono",
      "ink",
      "mediabunny",
      "playwright",
      "playwright-core",
      "sharp",
      "vite",
      "ws",
    ]) {
      expect(installed[name]).toBeUndefined();
    }
  });
});
