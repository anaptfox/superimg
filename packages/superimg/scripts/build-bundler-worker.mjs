#!/usr/bin/env node
/**
 * Emit a self-contained dist/bundler.worker.js for Vite/Webpack consumers.
 * Inlines @superimg/browser-bundler so worker rebundling does not pull
 * @rolldown/browser as an external with top-level await.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const ENTRY = join(ROOT, "src", "react", "hooks", "bundler.worker.ts");

mkdirSync(DIST, { recursive: true });

const bundle = await rolldown({
  input: ENTRY,
  platform: "browser",
  resolve: {
    conditionNames: ["browser", "import", "module", "default"],
  },
});

const result = await bundle.generate({
  format: "esm",
  codeSplitting: false,
});

const chunk = result.output?.[0];
if (!chunk?.code) {
  throw new Error("rolldown produced no output for bundler.worker");
}

writeFileSync(join(DIST, "bundler.worker.js"), chunk.code);

const dts = `/** Prebuilt Rolldown WASM worker — import via superimg/bundler.worker */\n`;
writeFileSync(join(DIST, "bundler.worker.d.ts"), dts);

console.log(
  `✓ bundler.worker: ${join(DIST, "bundler.worker.js")} (${chunk.code.length} bytes)`,
);