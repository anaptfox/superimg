#!/usr/bin/env node

import { readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

import { createBenchmarkRun } from "./run-support.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");

let commandIndex = 0;
const commands = [];
function run(args) {
  return new Promise((resolveRun, reject) => {
    const start = performance.now();
    const child = spawn("pnpm", args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, pnpm_config_verify_deps_before_run: "false" } });
    const stdout = [], stderr = [];
    child.stdout.on("data", bytes => { stdout.push(bytes); process.stdout.write(bytes); });
    child.stderr.on("data", bytes => { stderr.push(bytes); process.stderr.write(bytes); });
    child.once("error", reject);
    child.once("close", async (code, signal) => {
      const index = ++commandIndex;
      const elapsedMs = Math.round(performance.now() - start);
      try {
        await writeFile(join(evidence.directory, `command-${index}.stdout`), Buffer.concat(stdout));
        await writeFile(join(evidence.directory, `command-${index}.stderr`), Buffer.concat(stderr));
        commands.push({ command: ["pnpm", ...args], code, signal, elapsedMs });
        await evidence.checkpoint({ commands });
      } catch (error) { reject(error); return; }
      if (code !== 0) {
        reject(new Error(`pnpm ${args.join(" ")} failed (${signal ?? code})`));
        return;
      }
      resolveRun(elapsedMs);
    });
  });
}

const evidence = await createBenchmarkRun({ kind: "build-cache", packageRoot, repoRoot, harness: new URL(import.meta.url), workload: { trials: 1, cold: "forced task execution; existing filesystem/compiler caches", warm: "Turbo cache reuse" }, buildPaths: (await readdir(join(repoRoot, "packages"))).map(name => `packages/${name}/dist`), allowBuildChange: true });
try {
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

await evidence.complete({ ...result, raw: [{ coldMs, warmMs }], measurement: "one forced-build/cache-reuse pair, descriptive; no percentile or clean-machine claim" });
console.log(JSON.stringify(result, null, 2));

console.error(`Evidence: ${evidence.directory}`);
} catch (error) { await evidence.fail(error); throw error; }
