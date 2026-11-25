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
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  exports?: Record<string, unknown>;
  engines?: Record<string, string>;
};

describe("superimg package boundary", () => {
  it("exposes only the approved deep runtime surfaces", () => {
    const keys = Object.keys(pkg.exports ?? {});
    expect(keys).toEqual(
      expect.arrayContaining([".", "./runtime", "./runtime/html", "./player", "./inspection", "./inspection/boundary"]),
    );
    for (const removed of ["./define", "./node", "./browser", "./edge", "./server", "./adapters", "./bundler"]) {
      expect(keys).not.toContain(removed);
    }
  });

  it("keeps interactions off the package and runtime capability-honest", () => {
    expect(pkg.exports?.["./interactions"]).toBeUndefined();
    const runtime = pkg.exports?.["./runtime"] as Record<string, unknown>;
    expect(runtime.node).toBe("./dist/runtime.node.js");
    expect(runtime.browser).toBe("./dist/runtime.browser.js");
    expect(runtime.workerd).toBe("./dist/runtime.edge.js");
    const htmlRuntime = pkg.exports?.["./runtime/html"] as Record<string, unknown>;
    expect(htmlRuntime).toEqual({
      types: "./dist/runtime/html.d.ts",
      "edge-light": "./dist/runtime/html.js",
      workerd: "./dist/runtime/html.js",
      deno: "./dist/runtime/html.js",
      worker: "./dist/runtime/html.js",
      browser: "./dist/runtime/html.js",
      node: "./dist/runtime/html.js",
      import: "./dist/runtime/html.js",
      default: "./dist/runtime/html.js",
    });
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

  it("installs only the Node runtime required by the packed export CLI", () => {
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
      "playwright-core",
      "vite",
      "ws",
    ]) {
      expect(installed[name]).toBeUndefined();
    }
    expect(pkg.dependencies?.playwright).toBeUndefined();
    expect(pkg.dependencies?.["node-av"]).toBeUndefined();
    expect(pkg.peerDependencies?.playwright).toBe("catalog:");
    expect(pkg.peerDependencies?.["node-av"]).toBe("^6.1.1");
    for (const name of ["mediabunny", "@mediabunny/server", "@mediabunny/dts"]) {
      expect(pkg.peerDependencies?.[name]).toBe("catalog:");
      expect(pkg.peerDependenciesMeta?.[name]).toEqual({ optional: true });
    }
    expect(pkg.peerDependenciesMeta?.playwright).toEqual({ optional: true });
    expect(pkg.peerDependenciesMeta?.["node-av"]).toEqual({ optional: true });
    for (const foundation of [
      "@foxworth/boundary/program",
      "@foxworth/boundary/control",
    ]) {
      expect(pkg.peerDependencies?.[foundation]).toBeUndefined();
    }
    expect(pkg.peerDependencies?.["@foxworth/boundary/handoff"]).toBeUndefined();
    expect(pkg.peerDependencies?.["@ops-first/manifold"]).toBeUndefined();
    expect(pkg.dependencies?.["@foxworth/boundary"]).toBeUndefined();
    expect(pkg.peerDependencies?.["@foxworth/boundary"]).toBe("^0.2.0");
    expect(pkg.peerDependenciesMeta?.["@foxworth/boundary"]).toEqual({ optional: true });
    // sharp is initialized only by the Node runtime's binary still encoding path.
    expect(pkg.optionalDependencies?.sharp).toBeDefined();
  });
});
