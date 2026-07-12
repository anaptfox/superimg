#!/usr/bin/env node
/**
 * Verify browser-virtuals.gen.ts is present and matches current source hash.
 *
 * Usage:
 *   node scripts/verify-browser-virtuals.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const genPath = join(pkgRoot, "src", "bundler", "browser-virtuals.gen.ts");

if (!existsSync(genPath)) {
  console.error("Error: browser-virtuals.gen.ts missing. Run: pnpm run build");
  process.exit(1);
}

const gen = readFileSync(genPath, "utf8");
const embeddedHash = gen.match(/source-hash:\s*([a-f0-9]+)/)?.[1];
if (!embeddedHash) {
  console.error("Error: browser-virtuals.gen.ts missing source-hash header");
  process.exit(1);
}

const { computeSourceHash } = await import(
  pathToFileURL(join(__dirname, "build-browser-virtuals.mjs")).href
);
const currentHash = computeSourceHash();

if (embeddedHash !== currentHash) {
  console.error("Error: browser virtual modules are stale!");
  console.error(`  Embedded hash: ${embeddedHash}`);
  console.error(`  Current hash:  ${currentHash}`);
  console.error("Run: pnpm run build");
  process.exit(1);
}

console.log(`Browser virtuals up to date (hash: ${currentHash})`);
