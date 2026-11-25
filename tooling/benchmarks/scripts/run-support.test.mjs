import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { assertCompatibleBaseline, createBenchmarkRun, evaluateCeilings, summarize } from "./run-support.mjs";

test("quick observations retain raw median/range without an unsupported tail claim", () => {
  assert.deepEqual(summarize([5, 1, 4, 2, 3]), { samples: 5, raw: [5, 1, 4, 2, 3], median: 3, p50: 3, min: 1, max: 5, range: [1, 5] });
  assert.equal(summarize([1, 3]).median, 2);
  assert.equal("p95" in summarize(Array.from({ length: 99 }, (_, i) => i)), false);
  assert.equal(summarize(Array.from({ length: 100 }, (_, i) => i + 1)).p95, 95);
  assert.throws(() => summarize([]));
});

test("baseline comparison allows intended source/build delta but rejects changed conditions", () => {
  const current = { identity: { kind: "quick", environment: { node: "test" }, lockfileSha256: "lock", harnessSha256: "harness", workload: { trials: 5 }, source: "candidate" } };
  const baseline = { completed: true, status: "completed", identity: { ...current.identity, source: "baseline" } };
  assert.doesNotThrow(() => assertCompatibleBaseline(current, baseline));
  assert.throws(() => assertCompatibleBaseline(current, { ...baseline, identity: { ...baseline.identity, lockfileSha256: "different" } }), /lockfileSha256 differs/);
  assert.throws(() => assertCompatibleBaseline(current, { ...baseline, completed: false }), /incomplete/);
});

test("budget failures retain correctness, raw observations and final fingerprints", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-bench-budget-"));
  try {
    await writeFile(join(root, "pnpm-lock.yaml"), "lock");
    await writeFile(join(root, "source.ts"), "source");
    const run = await createBenchmarkRun({ kind: "fixture", packageRoot: root, repoRoot: root, harness: new URL(import.meta.url), sourcePaths: ["source.ts"], argv: ["--output", join(root, "run")] });
    const timing = evaluateCeilings([["latency", 20, 10]]);
    assert.equal(timing.passed, false);
    assert.equal(evaluateCeilings([["invalid", NaN, 10]]).passed, false);
    await run.checkpoint({ correctness: { passed: true }, timing, samples: [20] });
    await run.fail(new Error("timing ceiling exceeded"));
    const receipt = JSON.parse(await readFile(join(root, "run/result.json")));
    assert.equal(receipt.status, "failed");
    assert.equal(receipt.correctness.passed, true);
    assert.deepEqual(receipt.samples, [20]);
    assert.equal(receipt.identity.source.fingerprint, receipt.after.source.fingerprint);
    assert.ok(receipt.processWallTimeMs > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("run directories cannot be replaced and source changes leave a failed receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-bench-support-"));
  try {
    await writeFile(join(root, "pnpm-lock.yaml"), "lock");
    await writeFile(join(root, "source.ts"), "before");
    const args = { kind: "fixture", packageRoot: root, repoRoot: root, harness: new URL(import.meta.url), sourcePaths: ["source.ts"], argv: ["--output", join(root, "run")] };
    const run = await createBenchmarkRun(args);
    await assert.rejects(createBenchmarkRun(args), { code: "EEXIST" });
    await run.checkpoint({ samples: [1, 2, 3] });
    await writeFile(join(root, "source.ts"), "after");
    await assert.rejects(run.complete({}), /source\/build changed/);
    const receipt = JSON.parse(await readFile(join(root, "run/result.json")));
    assert.equal(receipt.status, "failed");
    assert.deepEqual(receipt.samples, [1, 2, 3]);
    assert.notEqual(receipt.identity.source.fingerprint, receipt.after.source.fingerprint);
  } finally { await rm(root, { recursive: true, force: true }); }
});
