import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  platformAlwaysBundle,
  platformNeverBundle,
  superimgAlwaysBundle,
  superimgNeverBundle,
} from "@superimg/build-config/bundle-deps";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

export const stdlibEntries = {
  scene: "src/scene.ts",
  "stdlib/code": "../superimg-stdlib/src/code.ts",
  "stdlib/easing": "../superimg-stdlib/src/easing.ts",
  "stdlib/math": "../superimg-stdlib/src/math.ts",
  "stdlib/text": "../superimg-stdlib/src/text.ts",
  "stdlib/arrange": "../superimg-stdlib/src/arrange/index.ts",
};

export const sharedDeps = {
  alwaysBundle: superimgAlwaysBundle,
  neverBundle: superimgNeverBundle,
};

/** Self-contained platform builds (edge/browser/player/react-compile). */
export const platformDeps = {
  alwaysBundle: platformAlwaysBundle,
  neverBundle: platformNeverBundle,
};

const require = createRequire(fileURLToPath(import.meta.url));

/**
 * Neutral (edge/workerd) platform does not read package.json `main` by default,
 * so packages with only `main` (no `exports`/`module`) resolve as unresolved
 * bare imports and get externalized — defeating deps.alwaysBundle. Alias them to
 * their concrete entrypoint so platform builds can inline them.
 */
export const platformAlias = {
  "path-data-parser": require.resolve("path-data-parser"),
  // roughjs publishes main/module fields but no exports map. Neutral builds do
  // not resolve that package root reliably, so point at its ESM artifact.
  roughjs: require.resolve("roughjs/bundled/rough.esm.js"),
  "source-map-js": require.resolve("source-map-js"),
  // Saxes only declares a CommonJS main; neutral builds otherwise leave an
  // unresolved bare import even though the platform closure must be portable.
  saxes: require.resolve("saxes"),
};

export const sharedDefine = {
  __SUPERIMG_VERSION__: JSON.stringify(pkg.version),
};
