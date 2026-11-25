#!/usr/bin/env node
import { createRequire } from "node:module";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const outputRoot = join(packageRoot, "dist");

const sourceDomain = Buffer.from("gumbo.linked-source/v1\0");
const derivedComponents = new Set([
  "node_modules",
  "dist",
  "publish",
  "target",
  ".cache",
  "cache",
  ".turbo",
  ".pnpm-store",
  "coverage",
  "output",
  ".wrangler",
]);

function u64(value) {
  const encoded = Buffer.alloc(8);
  encoded.writeBigUInt64BE(BigInt(value));
  return encoded;
}

function comparePathComponents(left, right) {
  const leftParts = left.split("/");
  const rightParts = right.split("/");
  for (let index = 0; index < Math.min(leftParts.length, rightParts.length); index += 1) {
    const compared = Buffer.compare(Buffer.from(leftParts[index]), Buffer.from(rightParts[index]));
    if (compared !== 0) return compared;
  }
  return leftParts.length - rightParts.length;
}

function sourceTreeDigest() {
  const listed = execFileSync(
    "git",
    [
      "-c",
      "core.quotepath=false",
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
    ],
    { cwd: workspaceRoot },
  );
  const files = listed
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((file) => !file.split("/").some((part) => derivedComponents.has(part)))
    .sort(comparePathComponents);
  const digest = createHash("sha256").update(sourceDomain);
  for (const relative of files) {
    const absolute = join(workspaceRoot, relative);
    let kind;
    let bytes;
    try {
      const metadata = lstatSync(absolute);
      if (metadata.isFile()) {
        kind = Buffer.from("f");
        bytes = readFileSync(absolute);
      } else if (metadata.isSymbolicLink()) {
        kind = Buffer.from("l");
        bytes = Buffer.from(readlinkSync(absolute));
      } else {
        throw new Error(`Source identity only supports files and symlinks: ${relative}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      kind = Buffer.from("d");
      bytes = Buffer.alloc(0);
    }
    const name = Buffer.from(relative);
    digest.update(kind).update(u64(name.length)).update(name).update(u64(bytes.length)).update(bytes);
  }
  return `sha256:${digest.digest("hex")}`;
}

const owners = [
  { name: "node", root: join(packageRoot, ".build", "node") },
  { name: "define", root: join(packageRoot, ".build", "define") },
  { name: "edge", root: join(packageRoot, ".build", "edge") },
  { name: "browser", root: join(packageRoot, ".build", "browser") },
  { name: "player", root: join(packageRoot, ".build", "player") },
];

const identicalCollisionAllowlist = new Set([]);
const privateRuntimeDeclarations = new Set([
  "runtime.node.d.ts",
  "runtime.browser.d.ts",
  "runtime.edge.d.ts",
]);

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
    // All runtime conditions intentionally share dist/runtime.d.ts. The
    // condition-specific binders are implementation files, not declaration
    // surfaces, so keep their generated declarations out of the package.
    if (privateRuntimeDeclarations.has(destinationRelative)) continue;
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

// The source compiler owns this import query; make its value type available to
// ordinary TypeScript consumers without requiring a project-level declaration.
cpSync(join(packageRoot, "src", "native-surface-imports.d.ts"), join(outputRoot, "native-surface-imports.d.ts"));
mkdirSync(join(outputRoot, "internal"), { recursive: true });
cpSync(resolve(packageRoot, "../superimg-stdlib/dist/viz/native-surface-browser.js"), join(outputRoot, "internal", "native-surface-browser.js"));
const bridgeTypes = readFileSync(resolve(packageRoot, "../superimg-stdlib/dist/viz/native-surface-browser.d.ts"), "utf8");
const bridgeTypeImport = /^import \{ ([^\n{}]+) \} from "(?:@superimg\/types|\.\.\/index\d*\.js)";/;
const importedTypes = bridgeTypes.match(bridgeTypeImport)?.[1]
  .split(", ")
  .map((specifier) => specifier.replace(/^\w+ as /, ""))
  .sort();
if (importedTypes?.join(",") !== "NativeSurfaceFrame,NativeSurfaceHost,NativeSurfaceModule") {
  throw new Error("Native surface bridge declaration import changed; update the package assembly");
}
writeFileSync(join(outputRoot, "internal", "native-surface-browser.d.ts"), bridgeTypes.replace(bridgeTypeImport, 'import type { NativeSurfaceHost, NativeSurfaceModule, NativeSurfaceFrame } from "../index.js";').replace(/\n?\/\/[#@]\s*sourceMappingURL=[^\n]+\s*$/, "\n"));
const authoringDeclaration = join(outputRoot, "index.d.ts");
writeFileSync(authoringDeclaration, `/// <reference path="./native-surface-imports.d.ts" />\n${readFileSync(authoringDeclaration, "utf8")}`);

// Declaration bundling strips lib references from inlined workspace types.
// Restore the one required by Runtime and ExportBundle on every emitted
// declaration that directly names AsyncDisposable. Root authoring re-exports
// can reach these declarations through shared chunks without importing the
// dedicated runtime entry, so repairing runtime.d.ts alone is insufficient.
const runtimeDeclarationPath = join(outputRoot, "runtime.d.ts");
const disposableReference = '/// <reference lib="esnext.disposable" />\n\n';
if (!existsSync(runtimeDeclarationPath)) {
  throw new Error("Assembled package is missing dist/runtime.d.ts");
}
for (const declarationPath of filesUnder(outputRoot).filter((path) => path.endsWith(".d.ts"))) {
  const declaration = readFileSync(declarationPath, "utf8");
  if (declaration.includes("AsyncDisposable") && !declaration.startsWith(disposableReference)) {
    writeFileSync(declarationPath, `${disposableReference}${declaration}`);
  }
}

// Ship Media IR JSON Schema from single source of truth (core).
const schemaSrc = resolve(
  packageRoot,
  "..",
  "superimg-core",
  "src",
  "ir",
  "pure",
  "media-ir.schema.json",
);
const schemaDest = join(outputRoot, "ir", "schema", "media-ir.json");
if (!existsSync(schemaSrc)) {
  throw new Error(`Missing Media IR schema source: ${schemaSrc}`);
}
mkdirSync(dirname(schemaDest), { recursive: true });
cpSync(schemaSrc, schemaDest);

const fontsSrc = resolve(packageRoot, "..", "superimg-core", "assets", "fonts");
const fontsDest = join(outputRoot, "assets", "fonts");
if (!existsSync(fontsSrc)) {
  throw new Error(`Missing bundled font assets: ${fontsSrc}`);
}
mkdirSync(fontsDest, { recursive: true });
cpSync(fontsSrc, fontsDest, { recursive: true });

// resvg wasm ships beside the fonts so bundled apps (Next/Turbopack) can load it
// from the installed package at runtime.
const resvgWasmSrc = createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");
const resvgWasmDest = join(outputRoot, "assets", "resvg", "index_bg.wasm");
mkdirSync(dirname(resvgWasmDest), { recursive: true });
cpSync(resvgWasmSrc, resvgWasmDest);

console.log(`Assembled ${claimed.size} files from ${owners.length} isolated build targets.`);
console.log(`Copied Media IR schema → dist/ir/schema/media-ir.json`);
console.log(`Copied bundled fonts → dist/assets/fonts and resvg wasm → dist/assets/resvg`);

if (process.env.SUPERIMG_SOURCE_TREE_RECEIPT !== "omit") {
  const sourceReceipt = {
    version: 1,
    algorithm: "sha256",
    sourceDigest: sourceTreeDigest(),
  };
  writeFileSync(
    join(outputRoot, "source-tree-receipt.json"),
    `${JSON.stringify(sourceReceipt, null, 2)}\n`,
  );
  console.log(`Recorded source tree → dist/source-tree-receipt.json`);
}
