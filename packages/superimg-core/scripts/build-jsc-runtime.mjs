#!/usr/bin/env node
//! Bundle the pure-JS __superimgNative runtime for Apple JavaScriptCore & Android QuickJS/Hermes.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const rolldown = resolve(repoRoot, "packages/superimg-core/node_modules/.bin/rolldown");
const entry = resolve(repoRoot, "packages/superimg-core/src/native/jsc-runtime-entry.ts");
const outFile = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(repoRoot, "packages/superimg-swift/Sources/SuperImg/Resources/superimg-jsc-runtime.js");

mkdirSync(dirname(outFile), { recursive: true });
execFileSync(rolldown, [entry, "--platform", "neutral", "--format", "iife", "--file", outFile], {
  cwd: repoRoot,
  stdio: "inherit",
});
