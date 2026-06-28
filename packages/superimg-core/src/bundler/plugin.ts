//! Server-side superimg bundler plugin (Node rolldown).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSuperimgPlugin } from "./plugin.shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUNDLED_STDLIB: Record<string, string> = {
  code: "dist/code.js",
  cue: "dist/cue/index.js",
  text: "dist/text.js",
};

function findStdlibPkgRoot(): string {
  const candidates = [
    resolve(__dirname, "../node_modules/@superimg/stdlib"),
    resolve(__dirname, "../../node_modules/@superimg/stdlib"),
  ];
  for (const root of candidates) {
    if (existsSync(resolve(root, "dist/code.js"))) return root;
  }
  return candidates[0]!;
}

const STDLIB_PKG_ROOT = findStdlibPkgRoot();

export function createSuperimgPlugin() {
  return buildSuperimgPlugin({
    resolveStdlibSubpath(sub) {
      const rel = BUNDLED_STDLIB[sub];
      return rel ? resolve(STDLIB_PKG_ROOT, rel) : "\0stdlib-noop";
    },
  });
}