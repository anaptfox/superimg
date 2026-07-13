#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readdir, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const check = process.argv.includes("--check");
const budgets = JSON.parse(await readFile(join(packageRoot, "performance-budgets.json"), "utf8"));

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
}

function summarize(values) {
  return {
    samples: values.length,
    p50: Number(percentile(values, 0.5).toFixed(2)),
    p95: Number(percentile(values, 0.95).toFixed(2)),
  };
}

function runNodeImport(specifier) {
  const script = `const s=performance.now();await import(${JSON.stringify(specifier)});console.log(JSON.stringify({ms:performance.now()-s,rssMb:process.memoryUsage().rss/1048576}))`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: repoRoot,
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
  return performance.now() - started;
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

const imports = {};
for (const [name, specifier] of Object.entries({ root: "superimg", player: "superimg/player", server: "superimg/server" })) {
  const samples = Array.from({ length: 5 }, () => runNodeImport(specifier));
  imports[name] = {
    ...summarize(samples.map((sample) => sample.ms)),
    maxRssMb: Number(Math.max(...samples.map((sample) => sample.rssMb)).toFixed(2)),
  };
}

const cli = {
  help: summarize(Array.from({ length: 5 }, () => runCli(["--help"]))),
  listShallow: summarize(Array.from({ length: 5 }, () => runCli(["list", "--shallow"]))),
  inspectSummary: summarize(Array.from({ length: 5 }, () => runCli([
    "inspect", "examples/basics/hello-world/hello-world.media.js", "--summary",
  ]))),
};

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
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, warm: false },
  imports,
  cli,
  package: packageMetrics,
};
await mkdir(join(packageRoot, ".results"), { recursive: true });
await writeFile(join(packageRoot, ".results/quick.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (check) {
  const errors = [];
  const assert = (label, actual, limit) => { if (actual > limit) errors.push(`${label}: ${actual} > ${limit}`); };
  assert("root import p95", imports.root.p95, budgets.runtime.rootImportP95Ms);
  assert("root import RSS", imports.root.maxRssMb, budgets.runtime.rootImportMaxRssMb);
  assert("player import p95", imports.player.p95, budgets.runtime.playerImportP95Ms);
  assert("player import RSS", imports.player.maxRssMb, budgets.runtime.playerImportMaxRssMb);
  assert("server import p95", imports.server.p95, budgets.runtime.serverImportP95Ms);
  assert("server import RSS", imports.server.maxRssMb, budgets.runtime.serverImportMaxRssMb);
  assert("CLI help p95", cli.help.p95, budgets.runtime.cliHelpP95Ms);
  assert("list --shallow p95", cli.listShallow.p95, budgets.runtime.listShallowP95Ms);
  assert("inspect --summary p95", cli.inspectSummary.p95, budgets.runtime.inspectSummaryP95Ms);
  assert("package tarball", packageMetrics.tarballBytes, budgets.package.maxTarballBytes);
  assert("package unpacked", packageMetrics.unpackedBytes, budgets.package.maxUnpackedBytes);
  assert("published source maps", packageMetrics.sourceMapFiles, budgets.package.maxSourceMapFiles);
  if (errors.length) {
    console.error(`Quick performance budgets failed:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Quick performance budgets passed.");
}
