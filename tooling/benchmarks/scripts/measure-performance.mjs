#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const check = process.argv.includes("--check");

function percentile(values, quantile) {
  if (values.length === 0) return 0;
  const index = Math.floor((values.length - 1) * quantile);
  return values[index];
}

function resolveRelativeImport(from, specifier) {
  const candidate = resolve(dirname(from), specifier);
  if (extname(candidate)) return candidate;
  return `${candidate}.js`;
}

function entryClosure(root, entry) {
  const importRe = /(?:import|export)\s+(?:[^'\"]*?from\s*)?['\"]([^'\"]+)['\"]/g;
  const seen = new Set();

  function walk(absolute) {
    if (seen.has(absolute) || !existsSync(absolute)) return;
    seen.add(absolute);
    const source = readFileSync(absolute, "utf8");
    for (const match of source.matchAll(importRe)) {
      const specifier = match[1];
      if (!specifier?.startsWith(".")) continue;
      const next = resolveRelativeImport(absolute, specifier);
      if (next.startsWith(root) && next.endsWith(".js")) walk(next);
    }
  }

  walk(join(root, entry));
  const files = [...seen].sort();
  const combined = Buffer.concat(files.map((file) => readFileSync(file)));
  return {
    entry,
    files: files.map((file) => relative(root, file)),
    rawBytes: combined.length,
    gzipBytes: gzipSync(combined).length,
  };
}

async function measureBundles() {
  const root = join(repoRoot, "packages/superimg/dist");
  return {
    player: entryClosure(root, "player.js"),
    reactPlayer: entryClosure(root, "react/player.js"),
    reactCompile: entryClosure(root, "react/compile.js"),
    reactSession: entryClosure(root, "react/session.js"),
  };
}

async function measureDocs() {
  const docsRoot = join(repoRoot, "apps/docs");
  const statsPath = join(docsRoot, ".next/diagnostics/route-bundle-stats.json");
  const rows = JSON.parse(await readFile(statsPath, "utf8"));
  return Object.fromEntries(
    rows.map((row) => {
      const chunks = row.firstLoadChunkPaths.map((chunk) =>
        readFileSync(join(docsRoot, chunk)),
      );
      return [
        row.route,
        {
          rawBytes: row.firstLoadUncompressedJsBytes,
          gzipBytes: chunks.reduce((total, chunk) => total + gzipSync(chunk).length, 0),
          chunks: row.firstLoadChunkPaths.length,
        },
      ];
    }),
  );
}

async function measureExamples() {
  const docsRoot = join(repoRoot, "apps/docs");
  const manifests = await Promise.all([
    readFile(join(docsRoot, "lib/video/examples/from-templates.ts"), "utf8"),
    readFile(join(docsRoot, "lib/video/examples/from-builtins.ts"), "utf8"),
  ]);
  const urls = manifests.flatMap((source) =>
    [...source.matchAll(/bundledUrl:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
  const bundles = [];
  for (const url of urls) {
    const bytes = await readFile(join(docsRoot, "public", url.replace(/^\//, "")));
    const id = url.split("/")[3] ?? "unknown";
    bundles.push({ id, rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  }
  bundles.sort((a, b) => a.gzipBytes - b.gzipBytes);
  const gzipValues = bundles.map((bundle) => bundle.gzipBytes);
  return {
    count: bundles.length,
    totalRawBytes: bundles.reduce((total, bundle) => total + bundle.rawBytes, 0),
    totalGzipBytes: bundles.reduce((total, bundle) => total + bundle.gzipBytes, 0),
    p50GzipBytes: percentile(gzipValues, 0.5),
    p75GzipBytes: percentile(gzipValues, 0.75),
    p95GzipBytes: percentile(gzipValues, 0.95),
    max: bundles.at(-1) ?? null,
  };
}

function assertBudget(errors, label, actual, limit) {
  if (actual > limit) errors.push(`${label}: ${actual} > ${limit}`);
}

const result = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, warm: true },
  bundles: await measureBundles(),
  docsRoutes: await measureDocs(),
  examples: await measureExamples(),
};

const resultDir = join(packageRoot, ".results");
await mkdir(resultDir, { recursive: true });
await writeFile(
  join(resultDir, "catalog.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));

if (check) {
  const budgets = JSON.parse(
    await readFile(join(packageRoot, "performance-budgets.json"), "utf8"),
  );
  const errors = [];
  for (const [name, limit] of Object.entries(budgets.bundles)) {
    assertBudget(errors, `bundles.${name}.gzipBytes`, result.bundles[name].gzipBytes, limit);
  }
  for (const [route, limit] of Object.entries(budgets.docsRoutes)) {
    const measured = result.docsRoutes[route];
    if (!measured) errors.push(`docsRoutes.${route}: missing measurement`);
    else assertBudget(errors, `docsRoutes.${route}.gzipBytes`, measured.gzipBytes, limit);
  }
  assertBudget(errors, "examples.totalGzipBytes", result.examples.totalGzipBytes, budgets.examples.totalGzipBytes);
  assertBudget(errors, "examples.p75GzipBytes", result.examples.p75GzipBytes, budgets.examples.p75GzipBytes);
  assertBudget(errors, "examples.p95GzipBytes", result.examples.p95GzipBytes, budgets.examples.p95GzipBytes);
  assertBudget(errors, "examples.max.gzipBytes", result.examples.max?.gzipBytes ?? 0, budgets.examples.maxGzipBytes);
  if (errors.length > 0) {
    console.error(`Performance budgets failed:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Performance budgets passed.");
}
