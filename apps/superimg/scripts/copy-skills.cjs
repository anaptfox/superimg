#!/usr/bin/env node
// Copy skills folder from repo root into apps/superimg for published package
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..", "..", "..");
const src = join(root, "skills");
const dest = join(__dirname, "..", "skills");

if (existsSync(src)) {
  cpSync(src, dest, { recursive: true });
}
