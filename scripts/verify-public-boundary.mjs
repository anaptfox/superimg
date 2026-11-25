#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const violations = [];
const join = (...parts) => parts.join("");

const forbiddenPaths = [
  join(".", "private"),
  join("internal", "-docs"),
  join("private", "-tools"),
  join("apps/", "desktop"),
  join("apps/", "habitat"),
  join("docs/", "internal"),
  join("docs/", "research"),
  join("docs/", "design"),
  join("brand/", "concepts"),
];

const forbiddenContent = [
  { label: "personal absolute path", pattern: new RegExp(join("/Users/", "fox/"), "i") },
  { label: "downstream product reference", pattern: new RegExp(`\\b${join("gum", "bo")}\\b`, "i") },
  { label: "downstream environment variable", pattern: new RegExp(join("GUM", "BO_"), "i") },
  { label: "private desktop product", pattern: new RegExp(join("SuperImg ", "Desktop|Temporal ", "Studio"), "i") },
  { label: "private package identifier", pattern: new RegExp(join("@superimg/", "desktop"), "i") },
  { label: "private key material", pattern: new RegExp(join("BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY")) },
  { label: "GitHub token", pattern: new RegExp(join("gh", "[oprsu]_[A-Za-z0-9_]{30,}")) },
  { label: "GitHub fine-grained token", pattern: new RegExp(join("github", "_pat_[A-Za-z0-9_]{40,}")) },
  { label: "AWS access key", pattern: new RegExp(join("AKIA", "[A-Z0-9]{16}")) },
  { label: "provider secret", pattern: new RegExp(join("(?<![A-Za-z0-9_])(?:sk|xai)-", "[A-Za-z0-9_-]{24,}")) },
];

function git(args, { allowFailure = false, encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, { cwd: root, encoding, maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr || result.stdout || "git command failed\n");
    process.exit(1);
  }
  return result;
}

function splitNul(value) {
  return value.split("\0").filter(Boolean);
}

function isForbiddenPath(path) {
  return forbiddenPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// Preserve the exact wire and filesystem contracts used by installed hosts.
const supportedContractLines = {
  "packages/superimg/scripts/assemble-builds.mjs":
    `const sourceDomain = Buffer.from("${join("gum", "bo")}.linked-source/v1\\0");`,
  "packages/superimg-cli/src/cli/utils/desktop-client.ts":
    `  return join(base, "${join("SuperImg ", "Desktop")}", "desktop-connection.json");`,
};

function inspectText(path, text, scope) {
  if (Object.hasOwn(supportedContractLines, path)) {
    text = text.split("\n").filter((line) => line !== supportedContractLines[path]).join("\n");
  }
  for (const rule of forbiddenContent) {
    if (rule.pattern.test(text)) violations.push(`${scope}: ${path}: ${rule.label}`);
  }
}

function additionsByPath(patch) {
  const additions = new Map();
  let path;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ b/")) {
      path = line.slice("+++ b/".length);
      if (!additions.has(path)) additions.set(path, []);
    } else if (path && line.startsWith("+") && !line.startsWith("+++")) {
      additions.get(path).push(line.slice(1));
    }
  }
  return additions;
}

function inspectWorkingFile(path, addedContent) {
  const url = new URL(path, `file://${root}/`);
  if (!existsSync(url)) return;
  if (isForbiddenPath(path)) {
    violations.push(`working tree: forbidden path ${path}`);
    return;
  }
  try {
    if (addedContent !== undefined) {
      inspectText(path, addedContent, "working tree");
      return;
    }
    const bytes = readFileSync(url);
    if (bytes.includes(0)) return;
    inspectText(path, bytes.toString("utf8"), "working tree");
  } catch (error) {
    violations.push(`working tree: cannot read ${path}: ${error.message}`);
  }
}

const privateLab = git(["config", "--bool", "--get", "superimg.privateLab"], {
  allowFailure: true,
}).stdout.trim();
if (privateLab === "true") {
  console.log("Public boundary verification skipped in the guarded private lab.");
  process.exit(0);
}

const localMain = git(["rev-parse", "--verify", "main^{commit}"], { allowFailure: true });
const baseRef = process.env.PUBLIC_BASE_REF || (localMain.status === 0 ? "main" : "origin/main");
const baseExists = git(["rev-parse", "--verify", `${baseRef}^{commit}`], { allowFailure: true });
const untracked = splitNul(
  git(["ls-files", "--others", "--exclude-standard", "-z"]).stdout,
);
let candidates;
let workingAdditions;
if (baseExists.status === 0) {
  const changedSinceBase = splitNul(
    git(["diff", "--name-only", "-z", baseRef, "--"]).stdout,
  );
  candidates = [...new Set([...changedSinceBase, ...untracked])];
  workingAdditions = additionsByPath(
    git(["diff", "--no-ext-diff", "--no-renames", "--unified=0", baseRef, "--"]).stdout,
  );
} else {
  // Keep the local scan useful in shallow or detached checkouts without a base ref.
  candidates = splitNul(
    git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).stdout,
  );
}
for (const path of candidates) {
  const trackedAgainstBase = baseExists.status === 0 && !untracked.includes(path);
  inspectWorkingFile(path, trackedAgainstBase ? (workingAdditions.get(path) ?? []).join("\n") : undefined);
}

if (baseExists.status === 0) {
  const commits = git(["rev-list", `${baseRef}..HEAD`]).stdout.trim().split("\n").filter(Boolean);
  for (const commit of commits) {
    const changed = splitNul(
      git(["diff-tree", "--no-commit-id", "--name-only", "--diff-filter=AMCR", "-r", "-z", commit]).stdout,
    );
    for (const path of changed) {
      if (isForbiddenPath(path)) {
        violations.push(`${commit}: forbidden path ${path}`);
        continue;
      }
    }
    const patch = git([
      "show",
      "--root",
      "--format=",
      "--no-ext-diff",
      "--no-renames",
      "--unified=0",
      commit,
    ]);
    const additions = additionsByPath(patch.stdout);
    for (const [path, lines] of additions) inspectText(path, lines.join("\n"), commit);
  }
}

if (violations.length > 0) {
  console.error("Public boundary verification failed:\n");
  for (const violation of [...new Set(violations)].sort()) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Public boundary verified (${candidates.length} candidate files, base ${baseRef}).`);
