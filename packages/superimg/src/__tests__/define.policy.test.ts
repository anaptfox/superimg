import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distRoot = join(__dirname, "..", "..", "dist");

const FORBIDDEN = ["node:", "rolldown", "oxc-parser", "sharp", "vite", "@rolldown/browser"];

const LINE_IMPORT_RE =
  /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|)['"]([^'"]+)['"]/;

function walkRelativeGraph(entryRel: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entryRel)) return seen;
  const abs = join(distRoot, entryRel);
  seen.add(entryRel);
  const src = readFileSync(abs, "utf8");
  for (const line of src.split("\n")) {
    const match = line.trimStart().match(LINE_IMPORT_RE);
    if (!match) continue;
    const spec = match[1];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const nextAbs = resolve(dirname(abs), spec);
    if (!nextAbs.endsWith(".js")) continue;
    walkRelativeGraph(nextAbs.slice(distRoot.length + 1), seen);
  }
  return seen;
}

describe("superimg/define policy", () => {
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

  it("exports define helpers only", async () => {
    const mod = await import(pathToFileURL(join(distRoot, "define.js")).href);
    expect(mod.define).toBeTypeOf("function");
    expect(mod.defineConfig).toBeTypeOf("function");
    expect(mod.defineBatch).toBeTypeOf("function");
    expect(mod.compileTemplate).toBeUndefined();
    expect(mod.compose).toBeUndefined();
  });

  it("define graph has no forbidden imports", () => {
    const graph = walkRelativeGraph("define.js");
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
      if (src.includes("index.export") || src.includes("bundler-browser")) {
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
    expect(manifest.player.length).toBeGreaterThan(0);
    expect(manifest.reactHook.length).toBeGreaterThan(0);
    expect(manifest.compiler.files.length).toBeGreaterThan(0);
    expect(manifest.compiler.rolldownBrowserVersion).toBeTruthy();
    for (const file of manifest.edge) {
      expect(statSync(join(distRoot, file)).isFile()).toBe(true);
      expect(manifest.hashes[file]).toMatch(/^sha256-/);
    }
    expect(manifest.compilerStandalone?.hashes["browser-bundler.js"]).toMatch(/^sha256-/);
  });
});