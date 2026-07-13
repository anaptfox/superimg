#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(packageRoot, "dist");

const owners = [
  { name: "node", root: join(packageRoot, ".build", "node") },
  { name: "define", root: join(packageRoot, ".build", "define") },
  { name: "edge", root: join(packageRoot, ".build", "edge") },
  { name: "browser", root: join(packageRoot, ".build", "browser") },
];

const identicalCollisionAllowlist = new Set([]);

function filesUnder(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesUnder(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

for (const owner of owners) {
  if (!statSync(owner.root, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(
      `Missing ${owner.name} staging output at ${relative(packageRoot, owner.root)}. ` +
        `Run the Turborepo superimg build target.`,
    );
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const claimed = new Map();
for (const owner of owners) {
  for (const source of filesUnder(owner.root)) {
    const destinationRelative = relative(owner.root, source);
    // Keep build-stage maps for local debugging, but do not publish them. The
    // assembled dist is the package boundary measured by npm pack.
    if (destinationRelative.endsWith(".map")) continue;
    const existing = claimed.get(destinationRelative);
    if (existing) {
      const identical = digest(existing.source) === digest(source);
      if (!identicalCollisionAllowlist.has(destinationRelative) || !identical) {
        throw new Error(
          `Build output collision at ${destinationRelative}: ${existing.owner} and ${owner.name}`,
        );
      }
      continue;
    }

    const destination = join(outputRoot, destinationRelative);
    mkdirSync(dirname(destination), { recursive: true });
    if (destinationRelative.endsWith(".js") || destinationRelative.endsWith(".d.ts")) {
      const content = readFileSync(source, "utf8").replace(
        /\n?\/\/[#@]\s*sourceMappingURL=[^\n]+\s*$/,
        "\n",
      );
      writeFileSync(destination, content);
    } else {
      cpSync(source, destination);
    }
    claimed.set(destinationRelative, { owner: owner.name, source });
  }
}

if (!existsSync(join(outputRoot, "index.js"))) {
  throw new Error("Assembled package is missing dist/index.js");
}

console.log(`Assembled ${claimed.size} files from ${owners.length} isolated build targets.`);
