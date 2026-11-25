/** Source-pinned focused mode of measure-browser.mjs. Never replaces an existing run. */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { gunzipSync } from "node:zlib";
import { rolldown } from "rolldown";
import { chromium } from "playwright";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
import { exclusiveDirectory } from "./run-support.mjs";

const option = (args, name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
async function fingerprints(paths) {
  return Promise.all([...paths].sort().map(async (path) => ({ path, sha256: sha(await readFile(path)) })));
}

/** Also used by resource diagnostics. Entry/harness stay current; package source is selected explicitly. */
export async function prepareRuntimeBundle({ entry, sourceRoot, repoRoot, output, define = {} }) {
  sourceRoot = await realpath(sourceRoot);
  repoRoot = await realpath(repoRoot);
  await exclusiveDirectory(output);
  const sourceAlias = (id) => {
    // Package subpath exports need not share the source filename.
    if (id === "@superimg/core/edge") return join(sourceRoot, "packages/superimg-core/src/index.edge.ts");
    const [, name, ...subpath] = id.split("/");
    const base = join(sourceRoot, "packages", `superimg-${name}`, "src");
    const suffix = subpath.join("/") || "index";
    for (const path of [join(base, `${suffix}.ts`), join(base, suffix, "index.ts"), join(base, `${suffix}.tsx`)]) if (existsSync(path)) return path;
    throw new Error(`No source entry for ${id}`);
  };
  const files = new Set();
  const bundle = await rolldown({
    input: entry, platform: "browser", transform: { define },
    onwarn(warning, defaultHandler) {
      if (warning.code === "UNRESOLVED_IMPORT" || warning.code === "MISSING_GLOBAL_NAME") throw new Error(warning.message);
      defaultHandler(warning);
    },
    plugins: [{
      name: "qualified-runtime-source",
      async resolveId(id, importer) {
        if (id.startsWith("@superimg/")) return sourceAlias(id);
        if ((id.startsWith(".") || isAbsolute(id)) && importer) {
          const absolute = resolve(dirname(importer), id);
          if (absolute.startsWith(join(repoRoot, "packages") + "/")) {
            const selected = sourceRoot + absolute.slice(repoRoot.length);
            for (const path of [selected, selected.replace(/\.js$/, ".ts"), selected.replace(/\.js$/, ".tsx")]) if (existsSync(path)) return path;
          }
        }
        if (importer?.startsWith(sourceRoot + "/") && sourceRoot !== repoRoot && !id.startsWith(".") && !isAbsolute(id)) {
          // Frozen source has no node_modules. Resolve the same installed dependency
          // from the corresponding current package and record its exact bytes.
          return this.resolve(id, repoRoot + importer.slice(sourceRoot.length), { skipSelf: true });
        }
        return null;
      },
      buildEnd() { for (const id of this.getModuleIds()) if (isAbsolute(id) && existsSync(id)) files.add(id); },
    }],
  });
  try {
    const generated = await bundle.generate({ format: "iife", name: "SuperImgRuntimeBench", codeSplitting: false, minify: false, sourcemap: true });
    const chunk = generated.output.find((item) => item.type === "chunk");
    if (!chunk) throw new Error("Runtime benchmark emitted no executable chunk");
    await writeFile(join(output, "browser.js"), chunk.code);
    if (chunk.map) await writeFile(join(output, "browser.js.map"), chunk.map.toString());
    const inputs = await fingerprints(files);
    const require = createRequire(join(repoRoot, "tooling/benchmarks/package.json"));
    const metadata = {
      schemaVersion: 1, sourceRoot, repoRoot, entry, createdAt: new Date().toISOString(),
      revision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim(),
      node: process.version, rolldown: require("rolldown/package.json").version,
      bundleSha256: sha(chunk.code), inputs, inputFingerprint: sha(JSON.stringify(inputs)),
      lockfileSha256: sha(await readFile(join(repoRoot, "pnpm-lock.yaml"))),
      harness: await fingerprints([entry, new URL(import.meta.url).pathname, join(repoRoot, "tooling/benchmarks/scripts/measure-browser.mjs"), join(repoRoot, "tooling/benchmarks/scripts/run-support.mjs")]),
    };
    await writeFile(join(output, "identity.json"), JSON.stringify(metadata, null, 2));
    return metadata;
  } finally { await bundle.close(); }
}

export async function runRuntimeBenchmark(args, { packageRoot, repoRoot }) {
  const sourceRoot = resolve(option(args, "--source", repoRoot));
  const outputArg = option(args, "--output", null);
  if (!outputArg) throw new Error("--runtime requires --output NEW_DIRECTORY; existing runs are never overwritten");
  const output = resolve(outputArg);
  let bundleDirectory = option(args, "--bundle", null);
  if (!bundleDirectory) {
    if (!args.includes("--prepare-only")) throw new Error("Prepare with --prepare-only, then run --bundle PREPARED_DIRECTORY --output NEW_RUN_DIRECTORY");
    await prepareRuntimeBundle({ entry: join(packageRoot, "fixtures/browser-entry.ts"), sourceRoot, repoRoot,
      output, define: { __SUPERIMG_RUNTIME_BENCH__: "true" } });
    console.log(JSON.stringify({ prepared: output })); return;
  }
  bundleDirectory = resolve(bundleDirectory);
  if (args.includes("--prepare-only")) throw new Error("--bundle and --prepare-only are mutually exclusive");
  await exclusiveDirectory(output);
  const identity = JSON.parse(await readFile(join(bundleDirectory, "identity.json"), "utf8"));
  const code = await readFile(join(bundleDirectory, "browser.js"));
  if (sha(code) !== identity.bundleSha256) throw new Error("Prepared browser bundle changed");
  const frames = gunzipSync(await readFile(join(repoRoot, "tests/integration/fixtures/lemon-performance/scene-frames.json.gz")));
  const fixtureSha256 = sha(frames);
  const html = '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#stage{width:440px;height:763px;position:relative}</style><div id="stage"></div><script>window.__sceneFrames=' + frames.toString().replaceAll("<", "\\u003c") + '</script><script src="/browser.js"></script>';
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", request.url === "/browser.js" ? "text/javascript" : "text/html");
    response.end(request.url === "/browser.js" ? code : html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 440, height: 763 }, deviceScaleFactor: 3 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => typeof window.__superimgRuntimeBench?.pipeline === "function");
    const cdp = await page.context().newCDPSession(page);
    const result = { schemaVersion: 1, recordedAt: new Date().toISOString(), identity,
      bundleDirectory, fixtureSha256, browser: browser.version(), node: process.version,
      executionHarness: await fingerprints([new URL(import.meta.url).pathname, join(packageRoot, "scripts/measure-browser.mjs"), join(packageRoot, "scripts/run-support.mjs")]),
      environment: { platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model,
        viewport: { width: 440, height: 763, dpr: 3 }, cache: "local no-store; new browser process", build: "source-linked unminified IIFE" },
      order: args.includes("--reverse") ? "reverse" : "forward", diagnostic: args.includes("--diagnostic"), focused: args.includes("--review-focused"), runs: [], errors };
    const progress = async (run) => { result.runs.push(run); await writeFile(join(output, "results.json"), JSON.stringify(result, null, 2)); console.log(JSON.stringify({ rate: run.rate, operation: run.operation, kind: run.kind, count: run.count, median: run.pipeline?.median })); };
    const rates = args.includes("--diagnostic") ? [4] : [1, 4];
    for (const rate of rates) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      if (args.includes("--diagnostic")) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
      if (!result.focused) {
        await progress({ rate, operation: "semantic", values: await page.evaluate(() => window.__superimgRuntimeBench.semanticScaling()) });
        await progress({ rate, operation: "history", values: await page.evaluate(() => window.__superimgRuntimeBench.historyScaling()) });
      }
      const cases = result.focused ? [
        ["typed-changed", 100], ["typed-unchanged", 100],
        ...[100, 1000, 5000].map((count) => ["interactive-changed", count]),
        ["interactive-unchanged", 100],
        ...[10, 50, 100, 250].map((count) => ["shared", count]),
      ] : [
        ...["raw-changed", "raw-repeat", "raw-unchanged", "typed-changed", "typed-unchanged", "interactive-changed", "interactive-unchanged"].map((kind) => [kind, 100]),
        ["interactive-changed", 1000], ["interactive-changed", 5000],
        ...[10, 50, 100, 250].map((count) => ["shared", count]),
      ];
      if (args.includes("--reverse")) cases.reverse();
      for (const [kind, count] of cases) await progress({ rate, operation: "pipeline", ...await page.evaluate(([kind, count, diagnostic]) => window.__superimgRuntimeBench.pipeline(kind, count, diagnostic), [kind, count, result.diagnostic]) });
      if (result.diagnostic) { const { profile } = await cdp.send("Profiler.stop"); await writeFile(join(output, "runtime.cpuprofile"), JSON.stringify(profile)); }
    }
    if (errors.length) throw new Error(errors.join("\n"));
    if (sha(await readFile(join(bundleDirectory, "browser.js"))) !== identity.bundleSha256) throw new Error("Prepared bundle changed during measurement");
    result.bundleUnchanged = true;
    result.completed = true;
    await writeFile(join(output, "results.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ complete: output }));
  } finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
}
