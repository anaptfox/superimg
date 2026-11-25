#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { createBenchmarkRun, evaluateCeilings, summarize } from "./run-support.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const check = process.argv.includes("--check");
const budgets = JSON.parse(await readFile(join(packageRoot, "performance-budgets.json"), "utf8"));

function runNodeImport(specifier) {
  const script = `const s=performance.now();await import(${JSON.stringify(specifier)});console.log(JSON.stringify({ms:performance.now()-s,rssMb:process.memoryUsage().rss/1048576}))`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    // Resolve declared benchmark dependencies from their owning workspace.
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (child.status !== 0) throw new Error(child.stderr || `Failed to import ${specifier}`);
  return JSON.parse(child.stdout.trim());
}

function runCli(args) {
  const started = performance.now();
  const child = spawnSync(process.execPath, ["packages/superimg-cli/dist/cli.js", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (child.status !== 0) throw new Error(child.stderr || `CLI failed: ${args.join(" ")}`);
  return { ms: performance.now() - started, stdout: child.stdout, stderr: child.stderr };
}

async function walk(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

const run = await createBenchmarkRun({ kind: "quick", packageRoot, repoRoot, harness: new URL(import.meta.url), harnessFiles: [join(repoRoot, "examples/basics/hello-world/hello-world.media.ts")], workload: { trials: 5, cache: "fresh Node process; OS filesystem cache uncontrolled" }, buildPaths: (await readdir(join(repoRoot, "packages"))).map(name => `packages/${name}/dist`) });
try {
const imports = {};
for (const [name, specifier] of Object.entries({
  root: "@foxworth/superimg",
  player: "@foxworth/superimg/player",
  runtime: "@foxworth/superimg/runtime",
  interactions: "@foxworth/superimg-interactions",
})) {
  const samples = Array.from({ length: 5 }, () => runNodeImport(specifier));
  imports[name] = {
    ...summarize(samples.map((sample) => sample.ms)),
    observations: samples,
    maxRssMb: Number(Math.max(...samples.map((sample) => sample.rssMb)).toFixed(2)),
  };
  await run.checkpoint({ imports });
}

const cli = {};
for (const [name, args] of Object.entries({ help: ["--help"], listShallow: ["list", "--shallow"], inspectSummary: ["inspect", "examples/basics/hello-world/hello-world.media.ts", "--summary"] })) {
  const observations = Array.from({ length: 5 }, () => runCli(args));
  cli[name] = { ...summarize(observations.map(sample => sample.ms)), observations };
  await run.checkpoint({ imports, cli });
}

const pack = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
  cwd: join(repoRoot, "packages/superimg"),
  encoding: "utf8",
  env: { ...process.env, npm_config_cache: "/tmp/superimg-npm-cache" },
});
if (pack.status !== 0) throw new Error(pack.stderr || "npm pack --dry-run failed");
const packed = JSON.parse(pack.stdout)[0];
const distFiles = await walk(join(repoRoot, "packages/superimg/dist"));
const packageMetrics = {
  tarballBytes: packed.size,
  unpackedBytes: packed.unpackedSize,
  files: packed.entryCount,
  sourceMapFiles: distFiles.filter((file) => file.endsWith(".map")).length,
};

const result = {
  schemaVersion: 0,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, warm: false },
  imports,
  cli,
  package: packageMetrics,
  correctness: { passed: true, checks: ["all imports completed", "all CLI operations exited zero", "package manifest read"] },
  measurement: "five fresh Node processes per operation; median/range and quick maximum, no p95 estimate",
  budgetKeys: "Existing *P95Ms keys are compatibility ceilings evaluated against the five-sample maximum",
};
await run.checkpoint(result);
console.log(JSON.stringify(result, null, 2));

if (check) {
  const timing = [
    ["root import quick max (legacy p95 ceiling)", imports.root.max, budgets.runtime.rootImportP95Ms],
    ["player import quick max (legacy p95 ceiling)", imports.player.max, budgets.runtime.playerImportP95Ms],
    ["runtime import quick max (legacy p95 ceiling)", imports.runtime.max, budgets.runtime.runtimeImportP95Ms],
    ["interactions import quick max (legacy p95 ceiling)", imports.interactions.max, budgets.runtime.interactionsImportP95Ms],
    ["CLI help quick max (legacy p95 ceiling)", cli.help.max, budgets.runtime.cliHelpP95Ms],
    ["list --shallow quick max (legacy p95 ceiling)", cli.listShallow.max, budgets.runtime.listShallowP95Ms],
    ["inspect --summary quick max (legacy p95 ceiling)", cli.inspectSummary.max, budgets.runtime.inspectSummaryP95Ms],
  ];
  const resources = Object.keys(imports).map(name => [`${name} import RSS`, imports[name].maxRssMb, budgets.runtime[`${name}ImportMaxRssMb`]]);
  const structural = [
    ["package tarball", packageMetrics.tarballBytes, budgets.package.maxTarballBytes],
    ["package unpacked", packageMetrics.unpackedBytes, budgets.package.maxUnpackedBytes],
    ["published source maps", packageMetrics.sourceMapFiles, budgets.package.maxSourceMapFiles],
  ];
  result.budgets = { timing: evaluateCeilings(timing), resources: evaluateCeilings(resources), structural: evaluateCeilings(structural) };
  await run.checkpoint(result);
  const errors = Object.values(result.budgets).flatMap(group => group.checks.filter(item => !item.passed).map(item => `${item.label}: ${item.actual} > ${item.limit}`));
  if (errors.length) {
    console.error(`Quick performance budgets failed:\n- ${errors.join("\n- ")}`);
    throw new Error("Quick budgets failed; see retained result");
  }
  console.log("Quick performance budgets passed.");
}

await run.complete({ ...result, measurement: "five fresh Node processes per operation; median/range and quick maximum, no p95 estimate", budgetKeys: "Existing *P95Ms keys are compatibility ceilings evaluated against the five-sample maximum" });
console.error(`Evidence: ${run.directory}`);
} catch (error) { await run.fail(error); throw error; }
