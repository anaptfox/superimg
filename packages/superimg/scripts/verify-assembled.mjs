#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "dist/charts.js",
  "dist/charts.d.ts",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/film.js",
  "dist/film.d.ts",
  "dist/script.js",
  "dist/script.d.ts",
  "dist/takes.js",
  "dist/takes.d.ts",
  "dist/native-surface-imports.d.ts",
  "dist/internal/native-surface-browser.js",
  "dist/runtime.d.ts",
  "dist/runtime.node.js",
  "dist/runtime.browser.js",
  "dist/browser-export.js",
  "dist/browser-export.d.ts",
  "dist/browser-export.react-server.js",
  "dist/browser-export.react-server.d.ts",
  "dist/runtime.edge.js",
  "dist/runtime/html.js",
  "dist/runtime/html.d.ts",
  "dist/player.js",
  "dist/player/dom.js",
  "dist/player/dom.d.ts",
  "dist/interactive/define.js",
  "dist/interactive/define.d.ts",
  "dist/interactive/player.js",
  "dist/interactive/player.d.ts",
  "dist/react/interactive.js",
  "dist/react/interactive.d.ts",
  "dist/ir.js",
  "dist/ir.d.ts",
  "dist/ir/schema/media-ir.json",
  "dist/assets/fonts/Inter-400.ttf",
  "dist/assets/fonts/Inter-500.ttf",
  "dist/assets/fonts/Inter-700.ttf",
  "dist/assets/fonts/OFL.txt",
  "dist/assets/resvg/index_bg.wasm",
  "dist/platform-manifest.json",
];

const missing = required.filter(
  (path) => !statSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
);

const forbidden = [
  "dist/interactive.js",
  "dist/interactive.d.ts",
  "dist/runtime.node.d.ts",
  "dist/runtime.browser.d.ts",
  "dist/runtime.edge.d.ts",
].filter(
  (path) => statSync(join(root, path), { throwIfNoEntry: false })?.isFile(),
);

if (missing.length > 0) {
  throw new Error(`Assembled superimg package is incomplete:\n- ${missing.join("\n- ")}`);
}
if (forbidden.length > 0) {
  throw new Error(
    `Assembled superimg package contains condition-specific runtime declarations:\n- ${forbidden.join("\n- ")}`,
  );
}

const useClientEntries = [
  "dist/react/player.js",
  "dist/react/index.js",
  "dist/react/interactive.js",
  "dist/react/compile.js",
  "dist/react/session.js",
];
const missingUseClient = useClientEntries.filter((path) => {
  const firstLine = readFileSync(join(root, path), "utf8").split("\n", 1)[0]?.trim();
  return firstLine !== '"use client";' && firstLine !== "'use client';";
});
if (missingUseClient.length > 0) {
  throw new Error(
    `Client React entries must begin with "use client"; on line 1:\n- ${missingUseClient.join("\n- ")}`,
  );
}

console.log(`Verified assembled superimg package (${required.length} required artifacts, ${useClientEntries.length} "use client" entries).`);
