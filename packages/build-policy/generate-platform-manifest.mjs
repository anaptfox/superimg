#!/usr/bin/env node
/**
 * Emit dist/platform-manifest.json for Gumbo fetch + hash verification.
 *
 * Usage:
 *   node generate-platform-manifest.mjs [superimgRoot]
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(process.argv[2] ?? join(__dirname, "..", "superimg"));
const DIST = join(ROOT, "dist");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const LINE_IMPORT_RE =
  /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|)['"]([^'"]+)['"]/;

const PLATFORM_ROOTS = {
  edge: "index.edge.js",
  player: "player.js",
  reactHook: "react/compile.js",
  compiler: "bundler-browser.js",
};

function sha256File(absPath) {
  const bytes = readFileSync(absPath);
  return `sha256-${createHash("sha256").update(bytes).digest("hex")}`;
}

function walkRelativeGraph(entryRel, seen = new Set()) {
  if (seen.has(entryRel)) return seen;
  const abs = join(DIST, entryRel);
  if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`platform graph missing file: ${entryRel}`);
  }
  seen.add(entryRel);

  const src = readFileSync(abs, "utf8");
  for (const line of src.split("\n")) {
    const trimmed = line.trimStart();
    const match = trimmed.match(LINE_IMPORT_RE);
    if (!match) continue;
    const spec = match[1];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const nextAbs = resolve(dirname(abs), spec);
    if (!nextAbs.startsWith(DIST) || !nextAbs.endsWith(".js")) continue;
    walkRelativeGraph(nextAbs.slice(DIST.length + 1), seen);
  }
  return seen;
}

function hashFiles(files) {
  const hashes = {};
  for (const file of [...files].sort()) {
    hashes[file] = sha256File(join(DIST, file));
  }
  return hashes;
}

function rolldownBrowserHash() {
  const rolldownPkgPath = join(ROOT, "node_modules", "@rolldown", "browser", "package.json");
  const rolldownPkg = JSON.parse(readFileSync(rolldownPkgPath, "utf8"));
  const entry = rolldownPkg.module ?? rolldownPkg.main ?? "dist/index.js";
  return sha256File(join(ROOT, "node_modules", "@rolldown", "browser", entry));
}

const closures = {};
for (const [key, root] of Object.entries(PLATFORM_ROOTS)) {
  closures[key] = [...walkRelativeGraph(root)].sort();
}

const allFiles = new Set(Object.values(closures).flat());

const manifest = {
  version: PKG.version,
  edge: closures.edge,
  player: closures.player,
  reactHook: closures.reactHook,
  compiler: {
    files: closures.compiler,
    rolldownBrowserVersion:
      PKG.dependencies?.["@rolldown/browser"] ??
      PKG.peerDependencies?.["@rolldown/browser"] ??
      null,
    hashes: {
      ...hashFiles(closures.compiler),
      "@rolldown/browser": rolldownBrowserHash(),
    },
  },
  hashes: hashFiles(allFiles),
  compilerStandalone: null,
};

const standaloneRoot = join(__dirname, "..", "superimg-browser-bundler");
const standaloneDist = join(standaloneRoot, "dist", "browser-bundler.js");
if (statSync(standaloneDist, { throwIfNoEntry: false })?.isFile()) {
  const standalonePkg = JSON.parse(
    readFileSync(join(standaloneRoot, "package.json"), "utf8"),
  );
  manifest.compilerStandalone = {
    package: standalonePkg.name,
    version: standalonePkg.version,
    files: ["browser-bundler.js"],
    hashes: {
      "browser-bundler.js": sha256File(standaloneDist),
    },
  };
}

const outPath = join(DIST, "platform-manifest.json");
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ platform-manifest: ${outPath} (${allFiles.size} hashed files)`);