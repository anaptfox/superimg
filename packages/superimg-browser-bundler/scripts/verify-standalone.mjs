#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "dist", "browser-bundler.js");
const src = readFileSync(OUT, "utf8");

const forbidden = [
  /from\s+["']@rolldown\/browser["']/,
  /import\s*\(\s*["']@rolldown\/browser["']\s*\)/,
  /from\s+["']node:/,
  /import\s*\(\s*["']node:/,
];

const errors = forbidden.filter((re) => re.test(src)).map((re) => String(re));

if (errors.length) {
  console.error("✗ browser-bundler verify failed — externals remain:");
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}

if (!src.includes("bundleTemplateBrowser") || !src.includes("initBundler")) {
  console.error("✗ browser-bundler verify failed — missing exports");
  process.exit(1);
}

console.log("✓ browser-bundler verify: standalone artifact OK");