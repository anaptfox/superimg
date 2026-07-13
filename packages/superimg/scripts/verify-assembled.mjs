#!/usr/bin/env node

import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/index.edge.js",
  "dist/index.browser.js",
  "dist/define.js",
  "dist/platform-manifest.json",
];

const missing = required.filter(
  (path) => !statSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
);

if (missing.length > 0) {
  throw new Error(`Assembled superimg package is incomplete:\n- ${missing.join("\n- ")}`);
}

console.log(`Verified assembled superimg package (${required.length} required artifacts).`);
