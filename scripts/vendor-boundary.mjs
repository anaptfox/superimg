#!/usr/bin/env node
//! Pull `@foxworth/boundary` directly from GitHub (`anaptfox/boundary`), build & pack
//! in a clean temporary checkout, vendor the tarball + receipt + `source.json` under
//! `vendor/boundary/<sha256>/`, update `pnpm-workspace.yaml`, install, and verify.

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  let ref = "main";
  let repo = "anaptfox/boundary";
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--ref" && argv[i + 1]) {
      ref = argv[++i];
    } else if (arg === "--repo" && argv[i + 1]) {
      repo = argv[++i];
    } else if (!arg.startsWith("-")) {
      if (ref === "main" && i === 0) ref = arg;
      else repo = arg;
    }
  }
  return { ref, repo, dryRun };
}

function run(cmd, args, cwd = root, stdio = "inherit") {
  return execFileSync(cmd, args, { cwd, stdio, encoding: "utf8" });
}

function cloneRepo(repo, targetDir) {
  const isFullUrl = /^(?:https?:\/\/|ssh:\/\/|git@|file:\/\/)/i.test(repo);
  if (!isFullUrl && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    try {
      run("gh", ["repo", "clone", repo, targetDir]);
      return `https://github.com/${repo}`;
    } catch {
      const httpsUrl = `https://github.com/${repo}.git`;
      run("git", ["clone", httpsUrl, targetDir]);
      return `https://github.com/${repo}`;
    }
  }
  run("git", ["clone", repo, targetDir]);
  return repo.replace(/\.git$/, "");
}

const { ref, repo, dryRun } = parseArgs(process.argv.slice(2));
const scratch = mkdtempSync(join(tmpdir(), "superimg-vendor-boundary-"));

try {
  const checkoutDir = join(scratch, "boundary");
  console.log(`→ Cloning ${repo} at ${ref} into ${checkoutDir}...`);
  const repoUrl = cloneRepo(repo, checkoutDir);

  try {
    run("git", ["checkout", "--detach", ref], checkoutDir);
  } catch {
    run("git", ["fetch", "--tags", "origin", ref], checkoutDir);
    run("git", ["checkout", "--detach", "FETCH_HEAD"], checkoutDir);
  }

  const commit = run("git", ["rev-parse", "HEAD"], checkoutDir, "pipe").trim();
  const dirty = run("git", ["status", "--porcelain"], checkoutDir, "pipe").trim().length > 0;
  console.log(`→ Checked out ${commit} (dirty=${dirty})`);

  console.log("→ Installing, building, and packing @foxworth/boundary...");
  run("pnpm", ["install", "--frozen-lockfile"], checkoutDir);
  run("node", ["./scripts/build/build-packages.mjs"], checkoutDir);
  run("node", ["./scripts/build/pack-packages.mjs"], checkoutDir);

  const distDir = join(checkoutDir, "dist", "boundary");
  const pkgJson = JSON.parse(readFileSync(join(distDir, "package.json"), "utf8"));
  const version = pkgJson.version;
  const tgzName = `foxworth-boundary-${version}.tgz`;
  const receiptName = `${tgzName}.receipt.json`;
  const receiptPath = join(distDir, receiptName);
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  const archiveSha = receipt.tarball.sha256.replace(/^sha256:/, "");

  console.log(`→ Packed @foxworth/boundary@${version}`);
  console.log(`  archiveSha256: ${receipt.tarball.sha256}`);
  console.log(`  contentDigest: ${receipt.contentDigest}`);
  console.log(`  bytes:         ${receipt.tarball.bytes}`);

  if (dryRun) {
    console.log("→ --dry-run set; leaving workspace unchanged.");
    process.exit(0);
  }

  const destDir = join(root, "vendor", "boundary", archiveSha);
  mkdirSync(destDir, { recursive: true });
  cpSync(join(distDir, tgzName), join(destDir, tgzName));
  cpSync(receiptPath, join(destDir, receiptName));
  writeFileSync(
    join(destDir, "source.json"),
    JSON.stringify(
      {
        package: "@foxworth/boundary",
        version,
        repository: repoUrl,
        sourceCommit: commit,
        sourceWorktreeDirty: dirty,
        archiveSha256: receipt.tarball.sha256,
        contentDigest: receipt.contentDigest,
        bytes: receipt.tarball.bytes,
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );

  const wsPath = join(root, "pnpm-workspace.yaml");
  const wsBefore = readFileSync(wsPath, "utf8");
  const nextSpec = `file:vendor/boundary/${archiveSha}/${tgzName}`;
  const wsAfter = wsBefore.replace(
    /file:vendor\/boundary\/[a-f0-9]+\/foxworth-boundary-[0-9A-Za-z.-]+\.tgz/,
    nextSpec,
  );
  if (wsBefore === wsAfter && !wsBefore.includes(nextSpec)) {
    throw new Error("Could not locate @foxworth/boundary override in pnpm-workspace.yaml");
  }
  writeFileSync(wsPath, wsAfter);

  const readmePath = join(root, "vendor", "boundary", "README.md");
  const readmeBefore = readFileSync(readmePath, "utf8");
  const readmeAfter = readmeBefore
    .replace(/Boundary [0-9]+\.[0-9]+\.[0-9]+ archive/, `Boundary ${version} archive`)
    .replace(/`anaptfox\/boundary` `main` `[a-f0-9]+`/, `\`anaptfox/boundary\` \`${ref}\` \`${commit.slice(0, 7)}\``)
    .replace(/declare `\^[0-9]+\.[0-9]+\.[0-9]+`/, `declare \`^${version}\``);
  writeFileSync(readmePath, readmeAfter);

  console.log("→ Running pnpm install...");
  run("pnpm", ["install"], root);

  console.log("→ Verifying pack receipt and installed content manifest...");
  const interactionsPkg = join(root, "packages", "superimg-interactions", "package.json");
  const req = createRequire(interactionsPkg);
  const boundaryPkgJson = req.resolve("@foxworth/boundary/package.json");
  const boundaryDir = dirname(boundaryPkgJson);
  const artifactUrl = pathToFileURL(join(boundaryDir, "dist", "artifact.js")).href;
  const { verifyPackReceipt, verifyContentManifest } = await import(artifactUrl);

  const verifiedReceipt = await verifyPackReceipt(join(destDir, receiptName));
  const verifiedContent = await verifyContentManifest(boundaryDir);
  if (verifiedContent.aggregateDigest !== receipt.contentDigest) {
    throw new Error(
      `Content digest mismatch: expected ${receipt.contentDigest}, got ${verifiedContent.aggregateDigest}`,
    );
  }
  console.log(
    `✓ Vendored and verified @foxworth/boundary@${version} (${commit.slice(0, 7)}) -> vendor/boundary/${archiveSha}/${tgzName}`,
  );
  console.log(`  verifiedReceipt: ${verifiedReceipt.receipt.tarball.sha256}`);
  console.log(`  verifiedContent: ${verifiedContent.aggregateDigest}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
