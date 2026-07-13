#!/usr/bin/env node
/**
 * Assert each platform closure is dependency-self-contained.
 *
 * A downstream consumer copies these dist files verbatim, so their runtime import
 * graph may reference only the host-provided externals below — everything else must
 * be inlined by the build (see platformDeps in @superimg/build-config/bundle-deps).
 *
 * Usage:
 *   node check-platform-self-contained.mjs [packageRoot]
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  collectLineImports,
  isCommentLine,
  LINE_IMPORT_RE,
} from "./scan-imports.mjs";

const ROOT = resolve(process.argv[2] ?? process.cwd());
const DIST = join(ROOT, "dist");

/** Platform closure entry points (relative to dist/). */
const PLATFORM_ROOTS = {
  edge: "index.edge.js",
  player: "player.js",
  reactHook: "react/compile.js",
  compiler: "bundler-browser.js",
  capabilityCode: "chunks/browser/code.js",
  capabilityKatex: "chunks/browser/katex.js",
  capabilityLottie: "chunks/browser/lottie.js",
  capabilityMermaid: "chunks/browser/mermaid.js",
  capabilityRough: "chunks/browser/rough.js",
  capabilityThree: "chunks/browser/three.js",
};

/** Host-provided externals allowed in every platform closure. */
const ALLOWED = [
  (spec) => spec === "react" || spec.startsWith("react/"),
  (spec) => spec === "react-dom" || spec.startsWith("react-dom/"),
  (spec) => spec === "@resvg/resvg-wasm",
];

/** The dynamic bundler legitimately externalizes @rolldown/browser. */
const ALLOWED_BY_ROOT = {
  compiler: [(spec) => spec === "@rolldown/browser"],
};

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}

/** Walk the relative import graph from a platform root, collecting bare specifiers. */
function scanClosure(rootRel) {
  const seen = new Set();
  const bareBySpec = new Map(); // spec -> Set<file>

  function walk(rel) {
    if (seen.has(rel)) return;
    const abs = join(DIST, rel);
    if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`platform graph missing file: ${rel}`);
    }
    seen.add(rel);

    const src = readFileSync(abs, "utf8");
    for (const line of src.split("\n")) {
      const trimmed = line.trimStart();
      if (isCommentLine(trimmed)) continue;

      const found = new Set();
      collectLineImports(trimmed, found);
      for (const spec of found) record(spec, rel);
    }

    // Recurse into relative .js imports only.
    for (const line of src.split("\n")) {
      const m = line.trimStart().match(LINE_IMPORT_RE);
      if (!m) continue;
      const spec = m[1];
      if (!isRelative(spec)) continue;
      const next = resolve(dirname(abs), spec);
      if (!next.startsWith(DIST) || !next.endsWith(".js")) continue;
      walk(next.slice(DIST.length + 1));
    }
  }

  function record(spec, file) {
    if (isRelative(spec)) return;
    if (!bareBySpec.has(spec)) bareBySpec.set(spec, new Set());
    bareBySpec.get(spec).add(file);
  }

  walk(rootRel);
  return { files: seen, bareBySpec };
}

const errors = [];

for (const [key, rootRel] of Object.entries(PLATFORM_ROOTS)) {
  const abs = join(DIST, rootRel);
  if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) {
    console.error(`✗ check-platform-self-contained: missing ${rootRel} — run tsdown first`);
    process.exit(1);
  }

  const allowed = [...ALLOWED, ...(ALLOWED_BY_ROOT[key] ?? [])];
  const { files, bareBySpec } = scanClosure(rootRel);

  let rootErrors = 0;
  for (const [spec, where] of bareBySpec) {
    if (allowed.some((fn) => fn(spec))) continue;
    rootErrors++;
    errors.push(`${key} (${rootRel}): disallowed bare import "${spec}" in ${[...where].sort().join(", ")}`);
  }

  if (rootErrors === 0) {
    console.log(`✓ ${key}: ${files.size} files, self-contained`);
  }
}

if (errors.length) {
  console.error("✗ check-platform-self-contained failed:");
  for (const e of errors) console.error(`    ${e}`);
  console.error(
    "\n  Platform closures may import only react/react-dom (+ jsx/client subpaths), " +
      "@resvg/resvg-wasm, and @rolldown/browser (compiler only).\n" +
      "  Add the offending package to platformAlwaysBundle in @superimg/build-config/bundle-deps.",
  );
  process.exit(1);
}

console.log("✓ check-platform-self-contained: all platform closures OK");
