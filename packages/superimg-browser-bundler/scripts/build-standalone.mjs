#!/usr/bin/env node
/**
 * Bundle initBundler + bundleTemplateBrowser with @rolldown/browser inlined.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const ENTRY = join(ROOT, "src", "index.ts");

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
});

const chunk = result.output?.[0];
if (!chunk?.code) {
  throw new Error("rolldown produced no output for browser-bundler");
}

writeFileSync(join(DIST, "browser-bundler.js"), chunk.code);

const dts = `export { initBundler, bundleTemplateBrowser } from "superimg/bundler";
export type { TemplateBundle } from "@superimg/types";
`;
writeFileSync(join(DIST, "browser-bundler.d.ts"), dts);

console.log(`✓ browser-bundler: ${join(DIST, "browser-bundler.js")} (${chunk.code.length} bytes)`);