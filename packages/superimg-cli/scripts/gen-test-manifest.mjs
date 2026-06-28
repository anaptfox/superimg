#!/usr/bin/env node
// Generates a manifest.json for smoke-testing the container handler locally.
// Usage: node scripts/gen-test-manifest.mjs <template-path> [output-path]
// Example: node scripts/gen-test-manifest.mjs ../../examples/basics/compose-demo/intro.media.ts

import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");

const templatePathArg = process.argv[2];
if (!templatePathArg) {
  console.error("Usage: node scripts/gen-test-manifest.mjs <template-path> [output-path]");
  process.exit(1);
}

const templatePath = resolve(templatePathArg);
const outputPath = resolve(process.argv[3] ?? "manifest.json");

// Import directly from @superimg/core dist — avoids pulling in the full server
// bundle (which has mediabunny etc. as externals). Core's bundler.js only needs
// rolldown, which IS in superimg-cli/node_modules.
const coreDist = `${pkgRoot}/node_modules/@superimg/core/dist`;
const { bundleTemplate, extractInlineSourceMap } = await import(`${coreDist}/bundler.js`);
const { extractTemplateMetadata } = await import(`${coreDist}/template-metadata.js`);

console.log(`Bundling ${templatePath}...`);
const code = await bundleTemplate(templatePath);
const sourceMap = extractInlineSourceMap(code) ?? {
  version: 3, sources: [templatePath], names: [], mappings: "",
};

const bundle = { code, sourceMap, sourceFile: templatePath };

console.log("Extracting metadata...");
// extractTemplateMetadata needs the raw TS/JS source, not the bundled IIFE
const rawSource = readFileSync(templatePath, "utf-8");
const meta = await extractTemplateMetadata(rawSource);

const parsed = {
  templateCode: code,
  metadata: {
    hasRenderExport: meta?.hasRenderExport ?? false,
    hasDefaultExport: meta?.hasDefaultExport ?? true,
  },
  templateConfig: meta?.config ?? {},
  resolvedAssets: [],
  config: meta?.config ?? {},
};

const templateName = templatePath
  .replace(/\\/g, "/")
  .replace(/^.*examples\//, "")
  .replace(/\.media\.(ts|js)$/, "");

const manifest = { [templateName]: { bundle, parsed } };
writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log(`Manifest written to ${outputPath} (template: "${templateName}")`);
