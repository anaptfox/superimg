#!/usr/bin/env node
/**
 * Assert the superimg edge graph is workerd-safe.
 *
 * Usage:
 *   node check-workerd-compat.mjs [packageRoot]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(process.argv[2] ?? join(__dirname, "..", "superimg"));
const DIST = join(ROOT, "dist");
const EDGE_ROOT = join(DIST, "index.edge.js");

const FORBIDDEN_STATIC_RE =
  /(?:^|\n)\s*(?:import\s+(?:[^'"]*\s+from\s+)?|export\s+(?:[^'"]*\s+from\s+)?)['"](node:[^'"]+|rolldown|oxc-parser|sharp|vite|@rolldown\/browser)['"]/g;
const FORBIDDEN_DYNAMIC_RE =
  /import\s*\(\s*['"](node:[^'"]+|rolldown|oxc-parser|sharp|vite|@rolldown\/browser)['"]\s*\)/g;

const LINE_IMPORT_RE =
  /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|)['"]([^'"]+)['"]/;

function walkRelativeGraph(entryFile, seen = new Set()) {
  const rel = entryFile.startsWith(DIST) ? entryFile.slice(DIST.length + 1) : entryFile;
  if (seen.has(rel)) return seen;
  seen.add(rel);

  const abs = join(DIST, rel);
  const src = readFileSync(abs, "utf8");
  for (const line of src.split("\n")) {
    const trimmed = line.trimStart();
    const match = trimmed.match(LINE_IMPORT_RE);
    if (!match) continue;
    const spec = match[1];
    if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
    const next = resolve(dirname(abs), spec);
    if (!next.endsWith(".js")) continue;
    const nextRel = next.slice(DIST.length + 1);
    walkRelativeGraph(nextRel, seen);
  }
  return seen;
}

function scanFile(relPath) {
  const hits = [];
  const src = readFileSync(join(DIST, relPath), "utf8");

  for (const re of [FORBIDDEN_STATIC_RE, FORBIDDEN_DYNAMIC_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(src))) {
      hits.push(match[1] ?? match[0]);
    }
  }
  return hits;
}

if (!statSync(EDGE_ROOT, { throwIfNoEntry: false })?.isFile()) {
  console.error(`✗ check-workerd-compat: missing ${EDGE_ROOT} — run tsdown first`);
  process.exit(1);
}

const graph = [...walkRelativeGraph("index.edge.js")].sort();
const errors = [];

for (const file of graph) {
  const hits = scanFile(file);
  for (const hit of hits) {
    errors.push(`${file}: forbidden import "${hit}"`);
  }
}

if (errors.length) {
  console.error("✗ check-workerd-compat failed:");
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}

console.log(
  `✓ check-workerd-compat: edge graph OK (${graph.length} files, no node:/rolldown/oxc-parser/sharp/vite)`,
);