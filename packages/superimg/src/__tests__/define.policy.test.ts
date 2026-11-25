import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { collectSourceImports } from "@superimg/build-config/scan-imports";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "..", "dist");

const FORBIDDEN = ["node:", "rolldown", "oxc-parser", "sharp", "vite", "@rolldown/browser"];

function walkRelativeGraph(entryRel: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entryRel)) return seen;
  const abs = join(distRoot, entryRel);
  seen.add(entryRel);
  const src = readFileSync(abs, "utf8");
  for (const spec of collectSourceImports(src)) {
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const nextAbs = resolve(dirname(abs), spec);
    if (!nextAbs.endsWith(".js")) continue;
    walkRelativeGraph(nextAbs.slice(distRoot.length + 1), seen);
  }
  return seen;
}

describe("superimg authoring-root policy", () => {
  it("index.d.ts exports public names, not rolldown chunk aliases", () => {
    const dts = readFileSync(join(distRoot, "index.d.ts"), "utf8");
    // The node entry must own dist/index.d.ts — not be overwritten by a browser
    // shared chunk (which exports single-letter aliases like `define as N`).
    expect(dts).not.toMatch(/\bdefine\s+as\s+N\b/);
    expect(dts).toMatch(/export\s*\{[^}]*\bdefine\b[^}]*\}/);

    // The public export line must use real names — no single-letter aliases and
    // no collision-deduped names (e.g. `Medium$1`). The removed fix-index-dts.mjs
    // band-aid produced exactly these; the chunk-naming fix must not.
    const exportLine = dts.split("\n").filter((l) => l.startsWith("export {")).pop() ?? "";
    expect(exportLine).not.toMatch(/\b\w+\$\d+\b/);
    expect(exportLine).not.toMatch(/\s+as\s+[A-Za-z_$][\w$]?\b/);
  });

  it("exports authoring helpers without operational internals", async () => {
    const mod = await import(pathToFileURL(join(distRoot, "index.js")).href);
    expect(mod.define).toBeTypeOf("function");
    expect(mod.defineConfig).toBeUndefined();
    expect(mod.video).toBeTypeOf("function");
    expect(mod.image).toBeTypeOf("function");
    expect(mod.svg).toBeTypeOf("function");
    expect(mod.ogImage).toBeTypeOf("function");
    expect(mod.collection).toBeTypeOf("function");
    expect(mod.listCollectionEntries).toBeTypeOf("function");
    expect(mod.planNarration).toBeTypeOf("function");
    expect(mod.sequence).toBeTypeOf("function");
    expect(mod.time).toBeTypeOf("function");
    expect(mod.compileTemplate).toBeUndefined();
    expect(mod.compose).toBeUndefined();
  });

  it("authoring root graph has no forbidden imports", () => {
    const graph = walkRelativeGraph("index.js");
    const hits: string[] = [];
    for (const file of graph) {
      const src = readFileSync(join(distRoot, file), "utf8");
      for (const banned of FORBIDDEN) {
        if (src.includes(`"${banned}`) || src.includes(`'${banned}`)) {
          hits.push(`${file}: ${banned}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("default preview graph (react/index) has no forbidden imports", () => {
    const graph = walkRelativeGraph("react/index.js");
    const hits: string[] = [];
    for (const file of graph) {
      const src = readFileSync(join(distRoot, file), "utf8");
      for (const banned of FORBIDDEN) {
        if (src.includes(`"${banned}`) || src.includes(`'${banned}`)) {
          hits.push(`${file}: ${banned}`);
        }
      }
      if (src.includes("bundler-browser")) {
        hits.push(`${file}: opt-in entry leak`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("platform-manifest.json", () => {
  it("exists with hashed platform closures", () => {
    const manifestPath = join(distRoot, "platform-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    expect(manifest.version).toBeTruthy();
    expect(manifest.edge.length).toBeGreaterThan(0);
    expect(manifest.html.length).toBeGreaterThan(0);
    expect(manifest.browser.length).toBeGreaterThan(0);
    expect(manifest.reactHook.length).toBeGreaterThan(0);
    expect(manifest.compiler.files.length).toBeGreaterThan(0);
    expect(manifest.compiler.rolldownBrowserVersion).toBeTruthy();
    expect(manifest.compilerStandalone).toBeUndefined();
    for (const file of manifest.edge) {
      expect(statSync(join(distRoot, file)).isFile()).toBe(true);
      expect(manifest.hashes[file]).toMatch(/^sha256-/);
    }
  });
});
