#!/usr/bin/env node
import { builtinModules } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PKG_PATH = join(ROOT, "package.json");

const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

function walkJs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "dev-ui") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkJs(p, out);
    else if (entry.endsWith(".js")) out.push(p);
  }
  return out;
}

function topLevel(spec) {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : spec;
  }
  return spec.split("/")[0];
}

const importRe =
  /(?:^|\n|;)\s*(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+)['"]([^'"]+)['"]/g;
const dynamicRe = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const requireRe = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

const found = new Set();
for (const file of walkJs(DIST)) {
  const src = readFileSync(file, "utf8");
  for (const re of [importRe, dynamicRe, requireRe]) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("/")) continue;
      if (BUILTINS.has(spec)) continue;
      found.add(topLevel(spec));
    }
  }
}

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);

const missing = [...found].filter((s) => !declared.has(s)).sort();
const unused = [...declared]
  .filter((s) => !found.has(s) && !s.startsWith("@superimg/") && !s.startsWith("@types/"))
  .sort();

if (missing.length) {
  console.error("✗ check-deps: bundled CLI imports modules not declared in package.json:");
  for (const s of missing) console.error(`    ${s}`);
  console.error("Add them to dependencies (or peerDependencies/optionalDependencies).");
  process.exit(1);
}

if (unused.length) {
  console.warn("⚠ check-deps: declared dependencies not imported by bundled CLI:");
  for (const s of unused) console.warn(`    ${s}`);
}

console.log(`✓ check-deps: ${found.size} runtime imports all declared.`);
