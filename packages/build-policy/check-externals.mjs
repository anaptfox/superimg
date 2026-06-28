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

const LINE_IMPORT_RE =
  /^import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+|)['"]([^'"]+)['"]/;
const LINE_EXPORT_RE =
  /^export\s+(?:type\s+)?(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/;
const LINE_DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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
      if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;

      const staticImport = trimmed.match(LINE_IMPORT_RE);
      if (staticImport) addExternal(specs, staticImport[1]);

      const sideEffect = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
      if (sideEffect) addExternal(specs, sideEffect[1]);

      const reExport = trimmed.match(LINE_EXPORT_RE);
      if (reExport) addExternal(specs, reExport[1]);

      LINE_DYNAMIC_RE.lastIndex = 0;
      let dynamic;
      while ((dynamic = LINE_DYNAMIC_RE.exec(trimmed))) {
        addExternal(specs, dynamic[1]);
      }
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

// Browser client graph must not import node: builtins (Turbopack / client bundles)
if (profileName === "superimg") {
  const NODE_IMPORT_RE = /(?:^|\n)\s*import\s+[^'"]*['"]node:/;
  const BROWSER_CLIENT_GRAPH = new Set([
    "rolldown-runtime.browser.js",
    "dist.js",
    "index.browser.js",
    "index2.browser.js",
    "player2.js",
    "Player3.js",
    "useCompiledTemplate.js",
    "bundler-browser.js",
    "react/index.js",
    "react/player.js",
  ]);

  for (const entry of readdirSync(DIST)) {
    if (!BROWSER_CLIENT_GRAPH.has(entry) && !/^plugin\.shared-.*\.js$/.test(entry)) {
      continue;
    }
    const filePath = join(DIST, entry);
    if (!statSync(filePath).isFile()) continue;
    const src = readFileSync(filePath, "utf8");
    if (NODE_IMPORT_RE.test(src)) {
      errors.push(`${entry} must not import node: builtins (browser client graph)`);
    }
  }

  for (const sub of ["react"]) {
    const subDir = join(DIST, sub);
    if (!statSync(subDir, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const entry of readdirSync(subDir)) {
      if (!entry.endsWith(".js")) continue;
      const rel = `${sub}/${entry}`;
      if (!BROWSER_CLIENT_GRAPH.has(rel)) continue;
      const src = readFileSync(join(subDir, entry), "utf8");
      if (NODE_IMPORT_RE.test(src)) {
        errors.push(`${rel} must not import node: builtins (browser client graph)`);
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