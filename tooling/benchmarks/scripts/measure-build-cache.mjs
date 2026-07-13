#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");

function run(args) {
  return new Promise((resolveRun, reject) => {
    const start = performance.now();
    const child = spawn("pnpm", args, { cwd: repoRoot, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        reject(new Error(`pnpm ${args.join(" ")} failed (${signal ?? code})`));
        return;
      }
      resolveRun(Math.round(performance.now() - start));
    });
  });
}

await run(["turbo:prepare"]);
const coldMs = await run([
  "exec",
  "turbo",
  "run",
  "build",
  "--filter=!docs",
  "--force",
  "--summarize",
]);
const warmMs = await run([
  "exec",
  "turbo",
  "run",
  "build",
  "--filter=!docs",
  "--summarize",
]);

const result = {
  recordedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  coldMs,
  warmMs,
  speedup: Number((coldMs / Math.max(1, warmMs)).toFixed(2)),
};

const resultDir = join(packageRoot, ".results");
await mkdir(resultDir, { recursive: true });
await writeFile(join(resultDir, "build-cache.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
