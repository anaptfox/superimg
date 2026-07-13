#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function version(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8")).version;
}

const publicVersion = version("packages/superimg/package.json");
const cliVersion = version("packages/superimg-cli/package.json");

if (publicVersion !== cliVersion) {
  throw new Error(
    `Ship-together version mismatch: superimg=${publicVersion}, @superimg/cli=${cliVersion}`,
  );
}

console.log(`Ship-together package versions match (${publicVersion}).`);
