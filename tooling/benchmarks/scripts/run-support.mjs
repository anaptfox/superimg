import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import os from "node:os";
import { performance } from "node:perf_hooks";

export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
export const argument = (argv, name) => {
  const index = argv.indexOf(name);
  if (index < 0) return undefined;
  if (!argv[index + 1] || argv[index + 1].startsWith("--")) throw new Error(`${name} requires a value`);
  return argv[index + 1];
};
export async function exclusiveDirectory(path) { await mkdir(dirname(path), { recursive: true }); await mkdir(path); }

/** Retain raw process observations; a five-observation quick probe has no p95. */
export function summarize(values) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw new Error("Expected finite benchmark samples");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { samples: values.length, raw: [...values], median, p50: median, min: sorted[0], max: sorted.at(-1), range: [sorted[0], sorted.at(-1)],
    ...(values.length >= 100 ? { p95: sorted[Math.ceil(values.length * .95) - 1] } : {}) };
}

/** Keep machine timing, structural size and correctness limits in separate groups. */
export function evaluateCeilings(entries) {
  const checks = entries.map(([label, actual, limit]) => ({ label, actual, limit, passed: Number.isFinite(actual) && actual <= limit }));
  return { passed: checks.every(check => check.passed), checks };
}

export async function fingerprintPaths(repoRoot, paths) {
  const rows = [];
  const walk = async path => {
    let info;
    try { info = await stat(path); } catch (error) { if (error.code === "ENOENT") { rows.push({ path: relative(repoRoot, path), sha256: null }); return; } throw error; }
    if (info.isDirectory()) {
      for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        if (["node_modules", ".git", ".results", ".turbo"].includes(entry.name)) continue;
        if (entry.isDirectory() || entry.isFile()) await walk(join(path, entry.name));
      }
    } else if (info.isFile()) rows.push({ path: relative(repoRoot, path), sha256: sha256(await readFile(path)) });
  };
  for (const path of [...new Set(paths)].sort()) await walk(resolve(repoRoot, path));
  rows.sort((a, b) => a.path.localeCompare(b.path));
  return { fingerprint: sha256(JSON.stringify(rows)), files: rows };
}

export function assertCompatibleBaseline(current, baseline) {
  const reasons = [];
  if (baseline.completed !== true || baseline.status !== "completed") reasons.push("baseline incomplete or failed");
  for (const field of ["kind", "environment", "lockfileSha256", "harnessSha256", "workload"]) {
    if (JSON.stringify(current.identity?.[field]) !== JSON.stringify(baseline.identity?.[field])) reasons.push(`${field} differs`);
  }
  if (current.browserVersion && current.browserVersion !== baseline.browserVersion) reasons.push("browserVersion differs");
  if (reasons.length) throw new Error(`Incompatible benchmark baseline: ${reasons.join("; ")}`);
}

/** Identity and failure record exist before any measured operation starts. */
export async function createBenchmarkRun({ kind, packageRoot, repoRoot, harness, harnessFiles = [], argv = process.argv.slice(2), workload = {}, buildPaths = [], sourcePaths, allowBuildChange = false }) {
  const directory = resolve(argument(argv, "--output") ?? join(packageRoot, ".results", kind, `${new Date().toISOString().replaceAll(":", "-")}-${process.pid}-${randomUUID().slice(0, 8)}`));
  await exclusiveDirectory(directory);
  const ownRelative = relative(repoRoot, directory);
  const sourceInventory = () => sourcePaths ?? [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "packages", "tooling", "scripts", "pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json", "justfile", "turbo.json"], { cwd: repoRoot }).toString().split("\0").filter(path => path && path !== ownRelative && !path.startsWith(`${ownRelative}/`)))];
  const source = await fingerprintPaths(repoRoot, sourceInventory());
  const build = await fingerprintPaths(repoRoot, buildPaths);
  const lockfileSha256 = sha256(await readFile(join(repoRoot, "pnpm-lock.yaml")));
  const support = await readFile(new URL(import.meta.url));
  const harnessSha256 = sha256(JSON.stringify((await Promise.all([harness, ...harnessFiles].map(async path => sha256(await readFile(path))))).concat(sha256(support))));
  const environment = { node: process.version, platform: os.platform(), arch: os.arch(), release: os.release(), cpu: os.cpus()[0]?.model ?? "unknown", cores: os.cpus().length, ramBytes: os.totalmem() };
  const identity = { kind, environment, lockfileSha256, harnessSha256, workload, source, build };
  const started = { schemaVersion: 1, recordedAt: new Date().toISOString(), directory, identity, completed: false, status: "running" };
  const write = value => writeFile(join(directory, "result.json"), `${JSON.stringify(value, null, 2)}\n`);
  await write(started);
  let result = started;
  const afterFingerprint = async () => ({ source: await fingerprintPaths(repoRoot, sourceInventory()), build: await fingerprintPaths(repoRoot, buildPaths) });
  const fail = async error => {
    if (!result.after) {
      try { result = { ...result, after: await afterFingerprint() }; }
      catch (fingerprintError) { result = { ...result, afterFingerprintError: String(fingerprintError) }; }
    }
    result = { ...result, completed: false, status: "failed", finishedAt: new Date().toISOString(), processWallTimeMs: performance.now(), error: { name: error?.name ?? "Error", message: error?.message ?? String(error), stack: error?.stack } };
    await write(result);
  };
  let baseline;
  try {
    const baselinePath = argument(argv, "--baseline");
    if (baselinePath) {
      const path = resolve(baselinePath);
      baseline = JSON.parse(await readFile((await stat(path)).isDirectory() ? join(path, "result.json") : path, "utf8"));
      assertCompatibleBaseline(started, baseline);
      result = { ...result, baseline: path };
    }
  } catch (error) { await fail(error); throw error; }
  return {
    directory, identity, baseline,
    async checkpoint(values) { result = { ...result, ...values }; await write(result); },
    async complete(values) {
      const after = await afterFingerprint();
      result = { ...result, ...values, after };
      if (after.source.fingerprint !== source.fingerprint || (!allowBuildChange && after.build.fingerprint !== build.fingerprint)) {
        const error = new Error("Benchmark source/build changed during measurement; result retained but rejected");
        await fail(error); throw error;
      }
      result = { ...result, completed: true, status: "completed", finishedAt: new Date().toISOString(), processWallTimeMs: performance.now() };
      await write(result);
      return result;
    },
    fail,
  };
}
