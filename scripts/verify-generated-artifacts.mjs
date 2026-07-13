#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const forbidden = [
  "apps/docs/public/playground/examples",
  "apps/docs/public/playground/assets",
  "apps/docs/public/playground/.build-cache.json",
  "apps/docs/lib/video/examples/from-templates.ts",
  "apps/docs/lib/video/examples/from-builtins.ts",
];

const result = spawnSync("git", ["ls-files", "--", ...forbidden], {
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || "Unable to inspect tracked generated artifacts.\n");
  process.exit(result.status ?? 1);
}

const tracked = result.stdout.split("\n").filter(Boolean);
if (tracked.length > 0) {
  console.error(
    [
      "Generated playground output must not be committed:",
      ...tracked.map((file) => `- ${file}`),
      "Run docs generation locally; only source templates and source assets belong in Git.",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("Generated playground output is untracked.");
