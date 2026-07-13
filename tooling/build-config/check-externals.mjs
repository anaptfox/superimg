#!/usr/bin/env node
/**
 * Verify tsdown bundle policy against dist/ output.
 *
 * Usage:
 *   node check-externals.mjs --profile superimg|cli|core [packageRoot]
 */

import { builtinModules } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { profiles } from "./bundle-deps.mjs";
import { collectLineImports, isCommentLine } from "./scan-imports.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let profileName = "superimg";
let rootArg;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--profile" && args[i + 1]) {
    profileName = args[++i];
  } else if (!args[i].startsWith("-")) {
    rootArg = args[i];
  }
}

const policy = profiles[profileName];
if (!policy) {
  console.error(`Unknown profile "${profileName}". Use: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

const { alwaysBundle, neverBundle } = policy;
const ROOT = resolve(rootArg ?? join(__dirname, "..", profileName === "superimg" ? "superimg" : profileName === "cli" ? "superimg-cli" : "superimg-core"));
const DIST = join(ROOT, "dist");
const PKG_PATH = join(ROOT, "package.json");

const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

const SKIP_FILES = [
  /^index\.bundler-.*\.js$/,
  /^plugin\.shared-.*\.js$/,
  /^plugin-.*\.js$/,
  /^plugin\.js$/,
  /^bundler-browser\.js$/,
];

function walkJs(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "dev-ui") continue;
    if (SKIP_FILES.some((re) => re.test(entry))) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkJs(p, out);
    else if (entry.endsWith(".js")) out.push(p);
  }
  return out;
}

function topLevel(spec) {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : spec;
  }
  return spec.split("/")[0];
}

function matchesPattern(spec, entry) {
  if (typeof entry === "string") {
    return spec === entry || spec.startsWith(`${entry}/`);
  }
  return entry.test(spec);
}

function matchesAny(spec, patterns) {
  return patterns.some((entry) => matchesPattern(spec, entry));
}

function addExternal(specs, spec) {
  if (spec.startsWith(".") || spec.startsWith("/")) return;
  if (BUILTINS.has(spec) || BUILTINS.has(topLevel(spec))) return;
  specs.add(spec);
}

function collectDistExternals() {
  const specs = new Set();
  for (const file of walkJs(DIST)) {
    const src = readFileSync(file, "utf8");
    for (const line of src.split("\n")) {
      const trimmed = line.trimStart();
      if (isCommentLine(trimmed)) continue;
      const found = new Set();
      collectLineImports(trimmed, found);
      for (const spec of found) addExternal(specs, spec);
    }
  }
  return specs;
}

const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
]);

const errors = [];
const warnings = [];

const neverRoots = new Set(
  neverBundle.filter((e) => typeof e === "string").map(topLevel),
);

for (const root of [...neverRoots].sort()) {
  if (root.startsWith("@superimg/")) continue;
  if (!declared.has(root)) {
    errors.push(`neverBundle includes "${root}" but it is not declared in package.json`);
  }
}

if (!statSync(DIST, { throwIfNoEntry: false })) {
  console.error(`✗ check-externals: dist/ not found at ${DIST} — run tsdown first`);
  process.exit(1);
}

const distExternals = collectDistExternals();

for (const spec of [...distExternals].sort()) {
  const root = topLevel(spec);

  if (root.startsWith("@superimg/")) continue;
  if (root === "superimg") continue;

  if (matchesAny(spec, alwaysBundle)) {
    errors.push(
      `dist imports "${spec}" but it is in alwaysBundle — bundle config may be wrong`,
    );
    continue;
  }

  if (!matchesAny(spec, neverBundle)) {
    errors.push(`dist imports "${spec}" but it is not listed in neverBundle`);
    continue;
  }

  if (!declared.has(root)) {
    errors.push(`dist imports "${spec}" (neverBundle) but "${root}" is missing from package.json`);
  }
}

const distRoots = new Set([...distExternals].map(topLevel));
for (const entry of neverBundle) {
  if (typeof entry !== "string") continue;
  const root = topLevel(entry);
  if (root.startsWith("@superimg/")) continue;
  const covered = distRoots.has(root) || [...distExternals].some((s) => matchesPattern(s, entry));
  if (!covered) {
    warnings.push(`neverBundle lists "${entry}" but dist/ has no import of it (possibly dead config)`);
  }
}

if (warnings.length) {
  console.warn(`⚠ check-externals [${profileName}] warnings:`);
  for (const w of warnings) console.warn(`    ${w}`);
}

// Browser client graph must not import node: builtins (Turbopack / client bundles).
// Walk the relative import closure from each browser client ENTRY (stable names);
// this automatically covers shared chunks (dist/chunks/*) without hardcoding them.
if (profileName === "superimg") {
  const NODE_IMPORT_RE = /(?:^|\n)\s*import\s+[^'"]*['"]node:/;
  const REL_IMPORT_RE =
    /^(?:import|export)\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+|)['"](\.[^'"]+)['"]/;
  const BROWSER_CLIENT_ENTRIES = [
    "index.browser.js",
    "bundler-browser.js",
    "player.js",
    "react/index.js",
    "react/player.js",
    "react/compile.js",
    "react/session.js",
  ];

  const DEFAULT_PREVIEW_ENTRIES = [
    "index.browser.js",
    "player.js",
    "react/index.js",
    "react/player.js",
  ];

  const FORBIDDEN_IN_PREVIEW = [
    /@rolldown\/browser/,
    /\bbundler-browser(?:\.js)?\b/,
    /\bbundler\.worker(?:\.js)?\b/,
    /@superimg\/browser-export/,
    /\bmediabunny\b/,
    /@zumer\/snapdom/,
  ];

  function walkClientGraph(rel, seen) {
    if (seen.has(rel)) return;
    const abs = join(DIST, rel);
    if (!statSync(abs, { throwIfNoEntry: false })?.isFile()) return;
    seen.add(rel);
    const src = readFileSync(abs, "utf8");
    if (NODE_IMPORT_RE.test(src)) {
      errors.push(`${rel} must not import node: builtins (browser client graph)`);
    }
    for (const line of src.split("\n")) {
      const m = line.trimStart().match(REL_IMPORT_RE);
      if (!m) continue;
      const next = resolve(dirname(abs), m[1]);
      if (!next.startsWith(DIST) || !next.endsWith(".js")) continue;
      walkClientGraph(next.slice(DIST.length + 1), seen);
    }
  }

  const seen = new Set();
  for (const entry of BROWSER_CLIENT_ENTRIES) walkClientGraph(entry, seen);

  const previewSeen = new Set();
  for (const entry of DEFAULT_PREVIEW_ENTRIES) walkClientGraph(entry, previewSeen);
  for (const rel of previewSeen) {
    const src = readFileSync(join(DIST, rel), "utf8");
    for (const pattern of FORBIDDEN_IN_PREVIEW) {
      if (pattern.test(src)) {
        errors.push(
          `${rel} must not reference ${pattern} (default preview graph — use @superimg/browser-export or superimg/bundler opt-in entries)`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(`✗ check-externals [${profileName}] failed:`);
  for (const e of errors) console.error(`    ${e}`);
  process.exit(1);
}

console.log(
  `✓ check-externals [${profileName}]: ${neverBundle.length} neverBundle / ${alwaysBundle.length} alwaysBundle — ${distExternals.size} dist externals OK`,
);
