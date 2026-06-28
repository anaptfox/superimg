import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { superimgAlwaysBundle, superimgNeverBundle } from "../build-policy/bundle-deps.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));

export const stdlibEntries = {
  "stdlib/code": "../superimg-stdlib/src/code.ts",
  "stdlib/easing": "../superimg-stdlib/src/easing.ts",
  "stdlib/math": "../superimg-stdlib/src/math.ts",
  "stdlib/text": "../superimg-stdlib/src/text.ts",
  "stdlib/cue": "../superimg-stdlib/src/cue/index.ts",
};

export const sharedDeps = {
  alwaysBundle: superimgAlwaysBundle,
  neverBundle: superimgNeverBundle,
};

export const sharedDefine = {
  __SUPERIMG_VERSION__: JSON.stringify(pkg.version),
};