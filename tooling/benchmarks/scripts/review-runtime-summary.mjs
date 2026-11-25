/** Offline first-review summary. No measurement, build, or browser effects. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const base = process.argv[2];
if (!base) throw new Error("Usage: node review-runtime-summary.mjs RAW_RUNTIME_DIRECTORY");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const runs = await Promise.all(["run-1-elevated", "run-2", "run-3"].map((name) => readJson(join(base, name, "results.json"))));
const diagnostic = await readJson(join(base, "diagnostic/results.json"));
const identity = runs[0].identity;
if (runs.some((run) => !run.completed || !run.bundleUnchanged || run.errors.length || run.identity.bundleSha256 !== identity.bundleSha256)) throw new Error("Incomplete or mismatched baseline");
const rows = runs[0].runs.map((item) => {
  const processes = runs.map((run) => run.runs.find((other) => other.rate === item.rate && other.kind === item.kind && other.count === item.count));
  const medians = processes.map((run) => run.pipeline.median);
  return { rate: item.rate, kind: item.kind, count: item.count, processMediansMs: medians,
    processMedianRangeMs: [Math.min(...medians), Math.max(...medians)],
    ...(processes.every(run => run.pipeline.count >= 100) ? { processP95Ms: processes.map(run => run.pipeline.p95) } : {}),
    mountMs: processes.map((run) => run.mountMs), warmup: item.warmup, samplesPerProcess: item.pipeline.count };
});
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const checks = await Promise.all([...identity.inputs, ...identity.harness,
  { path: join(identity.repoRoot, "pnpm-lock.yaml"), sha256: identity.lockfileSha256 },
].map(async ({ path, sha256 }) => ({ path, expected: sha256, actual: hash(await readFile(path)) })));
const drift = checks.filter((check) => check.expected !== check.actual);
const profile = await readJson(join(base, "diagnostic/runtime.cpuprofile"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const self = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const frame = nodes.get(profile.samples[i]).callFrame;
  const key = `${frame.functionName || "(anonymous)"} ${frame.url}:${frame.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + profile.timeDeltas[i]);
}
const summary = { units: "milliseconds unless explicitly named otherwise", rows,
  stagesOverlap: "evaluate includes context/render/lower/semantic; present includes geometry/sanitize/morph; never sum stage medians",
  diagnostic: diagnostic.runs.map(({ kind, count, warmStages }) => ({ kind, count, warmStages })),
  identity: { revision: identity.revision, bundleSha256: identity.bundleSha256, inputFingerprint: identity.inputFingerprint,
    browser: runs[0].browser, node: runs[0].node, environment: runs[0].environment },
  sourceVerification: { verifiedAt: new Date().toISOString(), checked: checks.length, drift },
  cpuSelfTop: [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([frame, microseconds]) => ({ frame, milliseconds: microseconds / 1000 })),
};
await writeFile(join(base, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ output: join(base, "summary.json"), sourceDrift: drift, rows: rows.map(({ rate, kind, count, processMedianRangeMs }) => ({ rate, kind, count, processMedianRangeMs })),
  diagnosticStages: diagnostic.runs.map(({ kind, count, warmStages }) => ({ kind, count, stages: Object.fromEntries(Object.entries(warmStages).map(([key, value]) => [key, value.median])) })), cpuSelfTop: summary.cpuSelfTop.slice(0, 12) }, null, 2));
