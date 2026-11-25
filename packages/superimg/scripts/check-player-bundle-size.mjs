#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Packed qualification can point at the unpacked artifact, without workspace aliases.
const packedRoot = process.env.SUPERIMG_PLAYER_PACKAGE_ROOT;
const packedPackage = packedRoot ? JSON.parse(readFileSync(resolve(packedRoot, "package.json"), "utf8")) : null;
const packedResolver = packedRoot ? [{
  name: "packed-superimg",
  resolveId(source) {
    if (source !== "@foxworth/superimg" && !source.startsWith("@foxworth/superimg/")) return null;
    const key = source === "@foxworth/superimg" ? "." : `./${source.slice("@foxworth/superimg/".length)}`;
    const target = packedPackage.exports[key];
    if (!target) throw new Error(`Packed superimg has no export ${key}`);
    return resolve(packedRoot, typeof target === "string" ? target : target.browser ?? target.import ?? target.default);
  },
}] : [];

const fixtures = [
  {
    name: "createDomPlayer",
    file: "test-fixtures/player-size/consumer.js",
    // 35 KB → 38 KB (library-first WS3-b): layout now measures with real font
    // metrics and paint follows layout's line breaks. The browser-free still
    // lane (SVG lowering, TTF parser) stays out of this graph. Follow-up: the
    // static Code highlighter import (~2 KB gzip) could move out.
    budget: 38_000,
  },
  {
    name: "createDomPlayer + minimal bundled scene",
    file: "test-fixtures/player-size/minimal-consumer.js",
    budget: 45_000,
  },
];

const forbidden = [
  ["Boundary", /@foxworth(?:\+|[/\\])boundary/],
  ["React", /(?:^|[/\\])(?:react|react-dom)(?:[/\\]|$)/],
  ["Zustand", /(?:^|[/\\])zustand(?:[/\\]|$)/],
  ["DOMPurify", /(?:^|[/\\])dompurify(?:[/\\]|$)/],
  ["D3", /(?:^|[/\\])d3-[^/\\]+(?:[/\\]|$)/],
  ["date-fns", /(?:^|[/\\])date-fns(?:[/\\]|$)/],
  ["authoring/compiler", /packages[/\\]superimg-core[/\\]src[/\\](?:bundler|source-analysis|export)[/\\]/],
  ["browser runtime/compiler/adapters", /[/\\]chunks[/\\]browser[/\\]/],
  ["interactive runtime", /[/\\](?:interactive[/\\]player|react[/\\]|superimg-interactive[/\\]src[/\\](?:controller|InteractivePlayer))/],
  ["inspection", /[/\\](?:inspection|index\.inspection)(?:[/\\.]|$)/],
  ["driven playback", /[/\\]player-(?:drive|hover|nav)(?:[/\\.]|$)/],
  ["interactions", /packages[/\\](?:superimg-interactions|superimg-cli|superimg-runtime)[/\\]/],
];

function eagerChunks(output) {
  const chunks = new Map(
    output
      .filter((item) => item.type === "chunk")
      .map((chunk) => [chunk.fileName, chunk]),
  );
  const entry = [...chunks.values()].find((chunk) => chunk.isEntry);
  if (!entry) throw new Error("Player size fixture did not produce an entry chunk");

  const eager = new Map();
  const visit = (chunk) => {
    if (eager.has(chunk.fileName)) return;
    eager.set(chunk.fileName, chunk);
    for (const imported of chunk.imports) {
      const dependency = chunks.get(imported);
      if (dependency) visit(dependency);
    }
  };
  visit(entry);
  return [...eager.values()];
}

async function measure(fixture) {
  const bundle = await rolldown({
    input: resolve(packageRoot, fixture.file),
    platform: "browser",
    plugins: packedResolver,
  });
  try {
    const generated = await bundle.generate({
      format: "es",
      minify: true,
      sourcemap: false,
      codeSplitting: true,
      entryFileNames: "entry.js",
      chunkFileNames: "chunks/[name].js",
    });
    const eager = eagerChunks(generated.output);
    const gzipBytes = eager.reduce(
      (total, chunk) => total + gzipSync(chunk.code, { level: 9 }).byteLength,
      0,
    );
    const modules = new Set(eager.flatMap((chunk) => Object.keys(chunk.modules)));
    const moduleBytes = new Map();
    for (const chunk of eager) {
      for (const [id, details] of Object.entries(chunk.modules)) {
        moduleBytes.set(id, (moduleBytes.get(id) ?? 0) + (details.renderedLength ?? 0));
      }
    }
    const violations = forbidden.flatMap(([label, pattern]) => {
      const match = [...modules].find((id) => pattern.test(id));
      return match ? [`${label}: ${match}`] : [];
    });

    return {
      name: fixture.name,
      gzipBytes,
      budget: fixture.budget,
      eagerChunks: eager.map((chunk) => chunk.fileName),
      moduleCount: modules.size,
      largestModules: [...moduleBytes]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 12)
        .map(([id, bytes]) => ({ id, bytes })),
      violations,
    };
  } finally {
    await bundle.close();
  }
}

// These are complete executed first-play budgets, in addition to the unchanged
// 38 KB / 45 KB eager budgets. SVG includes the existing sanitizer boundary.
// Measured 57.7 KB with the SVG purifier present; allow bounded growth.
const firstPlayBudgets = { minimal: 65_000, vector: 65_000 };

async function measureFirstPlay() {
  const bundle = await rolldown({
    input: resolve(packageRoot, "test-fixtures/player-size/first-play-consumer.js"),
    platform: "browser", plugins: packedResolver,
  });
  let server;
  let browser;
  try {
    const generated = await bundle.generate({ format: "es", minify: true,
      sourcemap: false, codeSplitting: true, entryFileNames: "entry.js",
      chunkFileNames: "chunks/[name].js" });
    const chunks = new Map(generated.output.filter((item) => item.type === "chunk")
      .map((chunk) => [chunk.fileName, chunk]));
    server = createServer((request, response) => {
      const path = new URL(request.url, "http://localhost").pathname.slice(1);
      if (path === "") {
        response.setHeader("Content-Type", "text/html");
        response.end('<div id="stage" style="width:640px;height:360px"></div><script type="module" src="/entry.js"></script>');
        return;
      }
      const chunk = chunks.get(path);
      if (!chunk) { response.writeHead(404); response.end(); return; }
      response.setHeader("Content-Type", "text/javascript");
      response.end(`(globalThis.__loadedPlayerChunks ??= new Set()).add(${JSON.stringify(path)});\n${chunk.code}`);
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    if (process.env.SUPERIMG_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.SUPERIMG_BROWSERS_PATH;
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const measurements = [];
    for (const [name, budget] of Object.entries(firstPlayBudgets)) {
      const page = await browser.newPage();
      try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof globalThis.__superimgFirstPlay === "function");
        const readiness = await page.evaluate((purified) => globalThis.__superimgFirstPlay(purified), name === "vector");
        if (name === "vector" && !readiness.html.includes("<path")) throw new Error("Vector fixture did not render its path");
        const loaded = await page.evaluate(() => [...globalThis.__loadedPlayerChunks]);
        const executed = loaded.map((name) => {
          const chunk = chunks.get(name);
          if (!chunk) throw new Error(`Unknown executed chunk ${name}`);
          return chunk;
        });
        const modules = [...new Set(executed.flatMap((chunk) => Object.keys(chunk.modules)))];
        // Purification is required for SVG. Its bytes count in the budget.
        const violations = forbidden.filter(([label]) => label !== "DOMPurify").flatMap(([label, pattern]) => {
          const match = modules.find((id) => pattern.test(id));
          return match ? [`${label}: ${match}`] : [];
        });
        measurements.push({ name: `first play: ${name}`, budget,
          gzipBytes: executed.reduce((total, chunk) => total + gzipSync(chunk.code, { level: 9 }).byteLength, 0),
          executedChunks: loaded, moduleCount: modules.length, violations,
          readiness: { readyMs: readiness.readyMs, firstPlayMs: readiness.firstPlayMs, acceptedFrame: readiness.accepted.frame } });
      } finally { await page.close(); }
    }
    return measurements;
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await bundle.close();
  }
}

const measurements = [];
for (const fixture of fixtures) measurements.push(await measure(fixture));

measurements.push(...await measureFirstPlay());

console.log(JSON.stringify({ measurements }, null, 2));

const failures = measurements.flatMap((measurement) => [
  ...(measurement.gzipBytes > measurement.budget
    ? [
        `${measurement.name}: ${measurement.gzipBytes} bytes gzip exceeds ${measurement.budget}`,
      ]
    : []),
  ...measurement.violations.map(
    (violation) => `${measurement.name}: closure contains ${violation}`,
  ),
]);

if (failures.length > 0) {
  throw new Error(`Player bundle acceptance failed:\n${failures.join("\n")}`);
}
