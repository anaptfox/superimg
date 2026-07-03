#!/usr/bin/env node
/**
 * Assert @superimg/runtime* and @superimg/player stay React-free.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const TARGETS = [
  join(ROOT, "superimg-runtime"),
  join(ROOT, "superimg-runtime-web"),
  join(ROOT, "superimg-player"),
];

const REACT_IMPORT_RE =
  /from\s+['"](?:react(?:\/[^'"]*)?|react-dom(?:\/[^'"]*)?)['"]/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry)) out.push(p);
  }
  return out;
}

const errors = [];

for (const pkgRoot of TARGETS) {
  const src = join(pkgRoot, "src");
  if (!statSync(src, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of walk(src)) {
    const content = readFileSync(file, "utf8");
    if (REACT_IMPORT_RE.test(content)) {
      errors.push(`${file} imports react — keep playback substrate framework-agnostic`);
    }
  }
}

if (errors.length) {
  console.error("✗ check-no-react failed:");
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}

console.log(`✓ check-no-react: ${TARGETS.length} packages scanned — no React imports`);