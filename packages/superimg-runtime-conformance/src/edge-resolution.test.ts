import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectSourceImports } from "@superimg/build-config/scan-imports";

const superimgRoot = fileURLToPath(new URL("../../superimg/", import.meta.url));
const superimgDist = resolve(superimgRoot, "dist");

describe("assembled workerd runtime resolution", () => {
  it("selects the document-only public edge binder without raw WASM", async () => {
    const manifest = JSON.parse(await readFile(`${superimgRoot}/package.json`, "utf8")) as {
      exports: Record<string, Record<string, string>>;
    };
    expect(manifest.exports["./runtime"]).toMatchObject({
      types: "./dist/runtime.d.ts",
      "edge-light": "./dist/runtime.edge.js",
      workerd: "./dist/runtime.edge.js",
      worker: "./dist/runtime.edge.js",
      browser: "./dist/runtime.browser.js",
      node: "./dist/runtime.node.js",
    });
    expect(manifest.exports["./runtime/html"]).toMatchObject({
      types: "./dist/runtime/html.d.ts",
      workerd: "./dist/runtime/html.js",
      browser: "./dist/runtime/html.js",
      node: "./dist/runtime/html.js",
    });

    const binder = await readFile(`${superimgRoot}/dist/runtime.edge.js`, "utf8");
    expect(binder).not.toContain("@resvg/resvg-wasm");
    expect(binder).not.toContain("index_bg.wasm");
  });

  it("keeps the assembled edge graph free of Node and native still dependencies", async () => {
    const paths = [
      `${superimgRoot}/dist/runtime.edge.js`,
      ...await javascriptFiles(`${superimgRoot}/dist/chunks/edge`),
    ];
    for (const path of paths) {
      const source = await readFile(path, "utf8");
      expect(source, path).not.toMatch(/(?:from\s*|import\s*\()\s*["'](?:node:|sharp(?:[/'"]|$))/);
      expect(source, path).not.toContain("@mediabunny/server");
      expect(source, path).not.toContain("node-av");
    }
  });

  it("keeps the pure HTML closure free of ambient capabilities", async () => {
    const files = await relativeGraph("runtime/html.js");
    for (const file of files) {
      const source = await readFile(`${superimgRoot}/dist/${file}`, "utf8");
      expect(source, file).not.toMatch(/\bfetch\s*\(/u);
      expect(source, file).not.toMatch(/\benv\s*(?:\.|\[)/u);
      expect(source, file).not.toMatch(/(?:from\s*|import\s*\()\s*["']node:/u);
      expect(source, file).not.toContain("fonts.googleapis.com");
      expect(source, file).not.toContain("env.handler");
    }
  });
});

async function relativeGraph(entry: string, seen = new Set<string>()): Promise<Set<string>> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const absolute = resolve(superimgDist, entry);
  const source = await readFile(absolute, "utf8");
  for (const specifier of collectSourceImports(source)) {
    if (!specifier.startsWith(".")) continue;
    const dependency = resolve(dirname(absolute), specifier);
    if (!dependency.endsWith(".js")) continue;
    await relativeGraph(dependency.slice(superimgDist.length + 1), seen);
  }
  return seen;
}

async function javascriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await javascriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}
