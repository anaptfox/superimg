import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./verify-public-boundary.mjs", import.meta.url));
const personalPath = ["/Users/", "fox/private"].join("");

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "superimg-public-boundary-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  cpSync(script, join(root, "scripts/verify-public-boundary.mjs"));
  const run = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
  run(["init", "-q"]);
  run(["branch", "-m", "work"]);
  run(["config", "user.name", "Boundary Test"]);
  run(["config", "user.email", "boundary@example.test"]);
  writeFileSync(join(root, "baseline.txt"), "baseline\n");
  run(["add", "."]);
  run(["commit", "-qm", "base"]);
  run(["branch", "main"]);
  run(["branch", "public-base"]);
  return { root, run };
}

function verify(root, baseRef = "public-base") {
  return spawnSync("node", ["scripts/verify-public-boundary.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...(baseRef ? { PUBLIC_BASE_REF: baseRef } : { PUBLIC_BASE_REF: "" }) },
  });
}

test("ignores unchanged baseline violations and internal docs", (t) => {
  const { root, run } = fixture(t);
  mkdirSync(join(root, "docs/research"), { recursive: true });
  writeFileSync(join(root, "docs/research/internal.md"), "Research stays in the repository.\n");
  writeFileSync(join(root, "baseline.txt"), `example path: ${personalPath}\n`);
  run(["add", "."]);
  run(["commit", "-qm", "add existing internal material"]);
  run(["branch", "-f", "public-base"]);
  writeFileSync(join(root, "baseline.txt"), `example path: ${personalPath}\nupdated\n`);
  run(["add", "baseline.txt"]);
  run(["commit", "-qm", "edit around baseline example"]);

  const result = verify(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Public boundary verified/);
});

test("fails when a commit adds forbidden content", (t) => {
  const { root, run } = fixture(t);
  writeFileSync(join(root, "new.txt"), `new reference: ${personalPath}\n`);
  run(["add", "new.txt"]);
  run(["commit", "-qm", "add forbidden content"]);

  const result = verify(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /personal absolute path/);
});

test("uses local main as the default comparison base", (t) => {
  const { root, run } = fixture(t);
  writeFileSync(join(root, "baseline.txt"), `existing example: ${personalPath}\n`);
  run(["add", "baseline.txt"]);
  run(["commit", "-qm", "add existing baseline example"]);
  run(["branch", "-f", "main"]);
  writeFileSync(join(root, "baseline.txt"), `existing example: ${personalPath}\nupdated\n`);
  run(["add", "baseline.txt"]);
  run(["commit", "-qm", "edit around baseline example"]);

  const result = verify(root, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /base main/);
});

test("fails on forbidden content in an untracked working file", (t) => {
  const { root } = fixture(t);
  writeFileSync(join(root, "draft.txt"), `new reference: ${personalPath}\n`);

  const result = verify(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /working tree: draft.txt: personal absolute path/);
});

test("allows mask identifiers without treating an embedded provider prefix as a secret", (t) => {
  const { root, run } = fixture(t);
  const descriptor = "silhouette-with-followed-grains-and-camera-clearance";
  writeFileSync(join(root, "verification.py"), `MASK_ID = "mask-${descriptor}"\n`);

  const workingResult = verify(root);
  assert.equal(workingResult.status, 0, workingResult.stderr);

  run(["add", "verification.py"]);
  run(["commit", "-qm", "add model verification identifier"]);
  const committedResult = verify(root);
  assert.equal(committedResult.status, 0, committedResult.stderr);
});

for (const providerPrefix of ["sk", "xai"]) {
  test(`detects a standalone ${providerPrefix} provider secret in working files and commits`, (t) => {
    const { root, run } = fixture(t);
    const token = [providerPrefix, "abcdefghijklmnopqrstuvwxyz0123456789"].join("-");
    writeFileSync(join(root, "credentials.txt"), `token="${token}"\n`);

    const workingResult = verify(root);
    assert.equal(workingResult.status, 1);
    assert.match(workingResult.stderr, /working tree: credentials.txt: provider secret/);

    run(["add", "credentials.txt"]);
    run(["commit", "-qm", "add forbidden provider secret"]);
    const committedResult = verify(root);
    assert.equal(committedResult.status, 1);
    assert.match(committedResult.stderr, /provider secret/);
  });
}
