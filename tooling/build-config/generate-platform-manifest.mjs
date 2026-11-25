#!/usr/bin/env node
/**
 * Emit dist/platform-manifest.json for host fetch + hash verification.
 *
 * Usage:
 *   node generate-platform-manifest.mjs [superimgRoot]
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { collectSourceImports } from "./scan-imports.mjs";

const ROOT = resolve(process.argv[2] ?? process.cwd());
const DIST = join(ROOT, "dist");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const PLATFORM_ROOTS = {
  charts: "charts.js",
  edge: "runtime.edge.js",
  html: "runtime/html.js",
  browser: "runtime.browser.js",
  browserExport: "browser-export.js",
  player: "player.js",
  playerDom: "player/dom.js",
  interactiveDefine: "interactive/define.js",
  interactivePlayer: "interactive/player.js",
  interactiveReact: "react/interactive.js",
  inspection: "inspection.js",
  inspectionBoundary: "inspection/boundary.js",
  reactHook: "react/compile.js",
  compiler: "bundler-browser.js",
};

// These chunks are loaded on demand by stdlib-capabilities.ts. They are not
// reachable through the static Player closure, but hosts still need their
// complete relative-import graph and hashes when it mirrors the browser runtime.
const CAPABILITY_ROOTS = {
  code: "chunks/browser/code.js",
  katex: "chunks/browser/katex.js",
  lottie: "chunks/browser/lottie.js",
  mermaid: "chunks/browser/mermaid.js",
  rough: "chunks/browser/rough.js",
  three: "chunks/browser/three.js",
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
  for (const spec of collectSourceImports(src)) {
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

const capabilities = {};
for (const [key, root] of Object.entries(CAPABILITY_ROOTS)) {
  const files = [...walkRelativeGraph(root)].sort();
  capabilities[key] = { files, hashes: hashFiles(files) };
}

const allFiles = new Set([
  ...Object.values(closures).flat(),
  ...Object.values(capabilities).flatMap((entry) => entry.files),
]);

const manifest = {
  version: PKG.version,
  edge: closures.edge,
  html: closures.html,
  browser: closures.browser,
  browserExport: closures.browserExport,
  player: closures.player,
  playerDom: closures.playerDom,
  interactiveDefine: closures.interactiveDefine,
  interactivePlayer: closures.interactivePlayer,
  interactiveReact: closures.interactiveReact,
  inspection: closures.inspection,
  inspectionBoundary: {
    files: closures.inspectionBoundary,
    externals: ["@foxworth/boundary", "@foxworth/boundary/program"],
  },
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
  capabilities,
  hashes: hashFiles(allFiles),
};

const outPath = join(DIST, "platform-manifest.json");
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`✓ platform-manifest: ${outPath} (${allFiles.size} hashed files)`);
