#!/usr/bin/env node
/**
 * Assert the superimg edge graph is workerd-safe.
 *
 * Usage:
 *   node check-workerd-compat.mjs [packageRoot]
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { collectSourceImports } from "./scan-imports.mjs";

const ROOT = resolve(process.argv[2] ?? process.cwd());
const DIST = join(ROOT, "dist");
const WORKER_ROOTS = {
  edge: "runtime.edge.js",
  html: "runtime/html.js",
};

const FORBIDDEN_IMPORTS = new Set([
  "rolldown",
  "oxc-parser",
  "sharp",
  "vite",
  "@rolldown/browser",
]);

function walkRelativeGraph(entryFile, seen = new Set()) {
  const rel = entryFile.startsWith(DIST) ? entryFile.slice(DIST.length + 1) : entryFile;
  if (seen.has(rel)) return seen;
  seen.add(rel);

  const abs = join(DIST, rel);
  const src = readFileSync(abs, "utf8");
  for (const spec of collectSourceImports(src)) {
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const next = resolve(dirname(abs), spec);
    if (!next.endsWith(".js")) continue;
    const nextRel = next.slice(DIST.length + 1);
    walkRelativeGraph(nextRel, seen);
  }
  return seen;
}

function scanFile(relPath) {
  const src = readFileSync(join(DIST, relPath), "utf8");
  return [...collectSourceImports(src)].filter(
    (specifier) => specifier.startsWith("node:") || FORBIDDEN_IMPORTS.has(specifier),
  );
}

const errors = [];
const graphs = {};

for (const [name, root] of Object.entries(WORKER_ROOTS)) {
  const absolute = join(DIST, root);
  if (!statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
    console.error(`✗ check-workerd-compat: missing ${absolute} — run tsdown first`);
    process.exit(1);
  }
  const graph = [...walkRelativeGraph(root)].sort();
  graphs[name] = graph;
  for (const file of graph) {
    const hits = scanFile(file);
    for (const hit of hits) {
      errors.push(`${name}:${file}: forbidden import "${hit}"`);
    }
  }
}

// Conservative downstream closure policies treat any `env.foo`/`env[...]`
// access as ambient authority, including lexically local variables. Keep that
// compatibility marker explicit until those policies become binding-aware.
const HTML_CAPABILITY_PATTERNS = [
  ["direct fetch", /\bfetch\s*\(/u],
  ["conservative env policy", /\benv\s*(?:\.|\[)/u],
  ["process authority", /\bprocess\b/u],
  ["Deno authority", /\bDeno\s*\./u],
  ["Bun authority", /\bBun\s*\./u],
  ["import.meta env", /\bimport\.meta\.env\b/u],
  ["CommonJS require", /\brequire\s*\(/u],
  ["Node buffer", /\bBuffer\b/u],
  ["Node dirname", /\b__dirname\b/u],
  ["Node filename", /\b__filename\b/u],
  ["font network loader", /resolveFontBuffers|fonts\.googleapis\.com/u],
  // The base stdlib intentionally contains a missing("katex") capability
  // marker. Detect the parser implementation/module, not that inert label.
  ["KaTeX parser", /env\.handler|katex(?:\.mjs|\.js)["']/u],
];

for (const file of graphs.html) {
  const source = readFileSync(join(DIST, file), "utf8");
  for (const specifier of collectSourceImports(source)) {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
      errors.push(`html:${file}: disallowed bare import "${specifier}"`);
    }
  }
  for (const [label, pattern] of HTML_CAPABILITY_PATTERNS) {
    if (pattern.test(source)) errors.push(`html:${file}: forbidden ${label}`);
  }
}

if (errors.length) {
  console.error("✗ check-workerd-compat failed:");
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}

console.log(
  `✓ check-workerd-compat: edge graph OK (${graphs.edge.length} files); pure HTML graph OK (${graphs.html.length} files, no forbidden capabilities or downstream compatibility markers)`,
);
