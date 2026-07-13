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
  engines?: Record<string, string>;
};

describe("superimg package boundary", () => {
  it("does not expose export or runtime-web subpaths", () => {
    const keys = Object.keys(pkg.exports ?? {});
    expect(keys).toContain("./server");
    expect(keys).not.toContain("./export");
    expect(keys).not.toContain("./runtime-web");
    expect(keys).not.toContain("./react/export");
  });

  it("resolves every root condition to the authoring-only entry", () => {
    const root = pkg.exports?.["."] as Record<string, unknown>;
    for (const condition of [
      "react-server",
      "edge-light",
      "workerd",
      "deno",
      "worker",
      "browser",
      "node",
      "import",
      "default",
    ]) {
      expect(root[condition]).toBe("./dist/index.js");
    }
    expect(pkg.engines?.node).toBe(">=22.12.0");
  });

  it("does not install browser-export/CLI-only runtimes from root superimg", () => {
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
      "vite",
      "ws",
    ]) {
      expect(installed[name]).toBeUndefined();
    }
    // sharp is a lazily-imported, optional dependency of superimg/server's
    // still-image (webp/jpeg) encoding path only.
    expect(pkg.optionalDependencies?.sharp).toBeDefined();
  });
});
