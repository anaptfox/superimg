// Exercise built distributions in a disposable consumer, without private workspace
// packages or the CLI. External dependencies are linked from the local install.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { collectSourceImports } from "../tooling/build-config/scan-imports.mjs";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const root = mkdtempSync(join(tmpdir(), "superimg-public-consumer-"));
const modules = join(root, "node_modules");
const facades = [
  ["@foxworth/superimg", "superimg"],
  ["@foxworth/superimg-node", "superimg-node-public"],
  ["@foxworth/superimg-interactions", "superimg-interactions-public"],
];

// Check each manifest before combining dependencies in the execution fixture.
// Otherwise another facade can accidentally supply an undeclared dependency.
function assertDeclaredExternals(directory, manifest) {
  const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies }));
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!/\.[cm]?js$/.test(entry.name)) continue;
      for (const specifier of collectSourceImports(readFileSync(file, "utf8"))) {
        if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:") || builtinModules.includes(specifier)) continue;
        const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
        if (name !== manifest.name && !declared.has(name)) throw new Error(`${manifest.name}: undeclared external ${specifier} in ${file}`);
      }
    }
  }
  visit(directory);
}

try {
  const dependencies = new Set();
  for (const [name, folder] of facades) {
    const source = join(repo, "packages", folder);
    const dest = join(modules, name);
    mkdirSync(dest, { recursive: true });
    cpSync(join(source, "dist"), join(dest, "dist"), { recursive: true });
    cpSync(join(source, "package.json"), join(dest, "package.json"));
    const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
    assertDeclaredExternals(join(source, "dist"), manifest);
    for (const dep of Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })) {
      if (!facades.some(([facade]) => facade === dep) && !(manifest.peerDependenciesMeta?.[dep]?.optional && !(dep in (manifest.dependencies ?? {})))) dependencies.add(dep);
    }
  }
  const search = [join(repo, "node_modules"), ...readdirSync(join(repo, "packages")).map((name) => join(repo, "packages", name, "node_modules"))];
  for (const dep of dependencies) {
    const source = search.map((dir) => join(dir, dep)).find(existsSync);
    if (!source) throw new Error(`Local install missing declared dependency: ${dep}`);
    const dest = join(modules, dep);
    mkdirSync(resolve(dest, ".."), { recursive: true });
    symlinkSync(source, dest, "dir");
  }
  writeFileSync(join(root, "card.media.ts"), 'import { image, Frame, Fill, Text } from "@foxworth/superimg"; export default image({ size: { width: 320, height: 180 }, render: () => Frame({ id: "stage", width: 320, height: 180 }, Fill({ color: "#0f172a" }), Frame({ id: "title", x: 10, y: 20 }, Text({ color: "#fff" }, "Consumer"))) });');
  writeFileSync(join(root, "direct.mjs"), `
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { init } from "@foxworth/superimg/runtime";
import { NodeEditEngine, NodeEditError, compileNodeEditableSource } from "@foxworth/superimg-node/edit";
import { exportNodeArrangement } from "@foxworth/superimg-node/arrangement";
import { compileNodeMediaSource, checkCompiledSource, loadNodeMediaValue } from "@foxworth/superimg-node/source";
import { captureValueReview } from "@foxworth/superimg-node/review";
const root = new URL(".", import.meta.url).pathname;
const engine = new NodeEditEngine({ projectRoot: root, compileSource: args => compileNodeEditableSource(root, args) });
const before = await readFile(new URL("card.media.ts", import.meta.url), "utf8");
const bindings = await engine.bindings("card.media.ts", {});
assert.ok(bindings.sourceHashes["card.media.ts"]);
await assert.rejects(engine.plan({ schemaVersion: 0, source: "card.media.ts", kind: "set-node-transform", target: { nodeId: "title", xBindingId: "title#x", yBindingId: "title#y" }, value: { x: 30, y: 40 }, expected: { intentHash: "stale", sourceHashes: { "card.media.ts": "stale" } } }, {}), e => e instanceof NodeEditError && e.code === "SOURCE_STALE");
assert.equal(await readFile(new URL("card.media.ts", import.meta.url), "utf8"), before);
const request = { pattern: "aligned-intervals", spec: { question: "Overlap?", workRemoved: "Compare", evidence: "observation", size: { width: 1920, height: 1080 }, timeRef: { unit: "s", origin: 0 }, tracks: [{ id: "a", label: "A", intervals: [{ start: 0, end: 4 }] }, { id: "b", label: "B", intervals: [{ start: 2, end: 8 }] }], motion: { phase: "reveal", revealIds: ["b"], predict: "tick" } } };
const runtime = await init();
try {
  const compiled = await compileNodeMediaSource(root, "card.media.ts");
  const checked = await checkCompiledSource({ projectRoot: root, compiled, runtime });
  assert.ok(checked.report);
  const loaded = await loadNodeMediaValue(root, "card.media.ts");
  const review = await captureValueReview(loaded.value, { runtime });
  try { assert.equal(review.packet.visual.status, "unreviewed"); } finally { await review.dispose(); }
  const { bundle } = await exportNodeArrangement(runtime, request, { for: [{ id: "still", format: "png", width: 1920, height: 1080 }], at: 0.5 });
  try {
    const bytes = await bundle.artifacts[0].bytes();
    assert.deepEqual([...bytes.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  } finally { await bundle.dispose(); }
} finally { await runtime.dispose(); }
`);
  // Prove direct Node operations do not need the Boundary package even when
  // the interaction facade is also present for the following interaction test.
  const boundary = join(modules, "@foxworth/boundary");
  const heldBoundary = `${boundary}.held`;
  renameSync(boundary, heldBoundary);
  try { execFileSync(process.execPath, [join(root, "direct.mjs")], { cwd: root, stdio: "inherit" }); }
  finally { renameSync(heldBoundary, boundary); }
  writeFileSync(join(root, "consumer.mjs"), `
import assert from "node:assert/strict";
import { discoverMediaSources } from "@foxworth/superimg-node/project";
import { compileNodeMediaSource, loadNodeMediaValue } from "@foxworth/superimg-node/source";
import { discoverMediaSources as discoverFromInteractions, createNodeMediaInteractionMount } from "@foxworth/superimg-interactions";
const root = new URL(".", import.meta.url).pathname;
assert.deepEqual(discoverMediaSources(root).map(x => x.relativePath), ["card.media.ts"]);
assert.deepEqual(discoverFromInteractions(root).map(x => x.relativePath), ["card.media.ts"]);
assert.equal(typeof createNodeMediaInteractionMount, "function");
const prepared = await compileNodeMediaSource(root, "card.media.ts");
assert.ok(prepared.bundle && prepared.compiled);
assert.ok((await loadNodeMediaValue(root, "card.media.ts")).value);
`);
  execFileSync(process.execPath, [join(root, "consumer.mjs")], { cwd: root, stdio: "inherit" });
  console.log("Isolated public distribution consumers passed (local external dependencies linked).");
} finally {
  rmSync(root, { recursive: true, force: true });
}
