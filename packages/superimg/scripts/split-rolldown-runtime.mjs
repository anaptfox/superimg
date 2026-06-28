#!/usr/bin/env node
/**
 * After sequential platform builds, preserve separate rolldown runtimes:
 * - rolldown-runtime.node.js  — full CJS interop (saved after node build)
 * - rolldown-runtime.browser.js — browser-safe (no node:module)
 * - rolldown-runtime.js — restored to node copy for CLI/server chunks
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");

const nodeRuntime = join(dist, "rolldown-runtime.node.js");
const browserRuntime = join(dist, "rolldown-runtime.js");
const browserRuntimeOut = join(dist, "rolldown-runtime.browser.js");
const defaultRuntime = join(dist, "rolldown-runtime.js");

let browserSrc = readFileSync(browserRuntime, "utf8");
browserSrc = browserSrc.replace(/^import "node:module";\n?/m, "");
writeFileSync(browserRuntimeOut, browserSrc);

copyFileSync(nodeRuntime, defaultRuntime);

const BROWSER_IMPORTERS = ["dist.js", "index.edge.js"];

for (const file of BROWSER_IMPORTERS) {
  const path = join(dist, file);
  let src = readFileSync(path, "utf8");
  const next = src.replaceAll(
    '"./rolldown-runtime.js"',
    '"./rolldown-runtime.browser.js"',
  );
  if (next === src) {
    throw new Error(`${file}: expected rolldown-runtime.js import to patch`);
  }
  writeFileSync(path, next);
}

console.log("split-rolldown-runtime: node + browser runtimes split");