#!/usr/bin/env node

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rolldown } from "rolldown";
import sharp from "sharp";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const check = process.argv.includes("--check");
const budgets = JSON.parse(await readFile(join(packageRoot, "performance-budgets.json"), "utf8"));

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
}
function summary(values) {
  return { samples: values.length, p50: +percentile(values, .5).toFixed(2), p95: +percentile(values, .95).toFixed(2) };
}
async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}
async function browserBundle() {
  const bundle = await rolldown({ input: join(packageRoot, "fixtures/browser-entry.ts") });
  try {
    const generated = await bundle.generate({ format: "iife", name: "SuperImgBench", minify: true });
    return generated.output[0].code;
  } finally {
    await bundle.close();
  }
}
function comparePixels(a, b, threshold) {
  if (a.length !== b.length) throw new Error(`Pixel buffers differ in length: ${a.length} vs ${b.length}`);
  let total = 0;
  let differing = 0;
  let alphaMismatchPixels = 0;
  for (let i = 0; i < a.length; i += 4) {
    let pixelDiff = false;
    for (let c = 0; c < 4; c += 1) {
      const delta = Math.abs(a[i + c] - b[i + c]);
      total += delta;
      if (delta > threshold) pixelDiff = true;
    }
    if (pixelDiff) differing += 1;
    if (a[i + 3] !== b[i + 3]) alphaMismatchPixels += 1;
  }
  return {
    meanChannelDelta: total / a.length,
    differingPixelRatio: differing / (a.length / 4),
    alphaMismatchPixels,
  };
}

const launchStarted = performance.now();
const browser = await chromium.launch();
console.error("browser: chromium launched");
const chromiumLaunchMs = performance.now() - launchStarted;
const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
const browserCode = await browserBundle();
const setupBenchPage = async () => {
  await page.goto('data:text/html,<div id="player"></div><div id="fixture" style="width:320px;height:180px"></div>', { waitUntil: "load" });
  await page.addScriptTag({ content: browserCode });
};
await setupBenchPage();

let player;
for (let attempt = 0; attempt < 3; attempt += 1) {
  try {
    player = await page.evaluate(() => window.__superimgBench.benchmarkPlayer(12));
    break;
  } catch (error) {
    if (attempt === 2 || !String(error).includes("Execution context was destroyed")) throw error;
    await setupBenchPage();
  }
}
if (!player) throw new Error("Player benchmark did not produce a result");
const snapdom = await page.evaluate(() => window.__superimgBench.benchmarkSnapdom(10));
console.error("browser: player and SnapDOM measured");
const captureMs = [];
for (let i = 0; i < 20; i += 1) {
  const started = performance.now();
  await page.locator("#fixture > :first-child").screenshot({ type: "png", omitBackground: true });
  captureMs.push(performance.now() - started);
}

const parity = {};
for (const kind of ["opaque", "alpha", "svg", "transform", "image", "media"]) {
  await page.evaluate((fixture) => window.__superimgBench.setFixture(fixture), kind);
  const snap = await page.evaluate((fixture) => window.__superimgBench.captureSnap(fixture), kind);
  const png = await page.locator("#fixture > :first-child").screenshot({ type: "png", omitBackground: true });
  const playwrightRaw = await sharp(png).ensureAlpha().raw().toBuffer();
  parity[kind] = {
    width: snap.width,
    height: snap.height,
    ...comparePixels(Uint8Array.from(snap.data), playwrightRaw, budgets.parity.channelThreshold),
  };
}
console.error("browser: runtime parity measured");
await page.evaluate(() => window.__superimgBench.setFixture("svg"));
const svgMarkup = await page.locator("#fixture svg").evaluate((element) => element.outerHTML).catch(() => null);
if (svgMarkup) {
  const { rasterize } = await import(join(repoRoot, "packages/superimg-core/dist/rendering/resvg-rasterizer.node.js"));
  const resvgPng = await rasterize(svgMarkup, { width: 320, height: 180, background: "white" });
  const playwrightPng = await page.locator("#fixture svg").screenshot({ type: "png", omitBackground: true });
  const [resvgRaw, playwrightRaw] = await Promise.all([
    sharp(resvgPng).ensureAlpha().raw().toBuffer(),
    sharp(playwrightPng).ensureAlpha().raw().toBuffer(),
  ]);
  parity.resvgSvg = { width: 320, height: 180, ...comparePixels(resvgRaw, playwrightRaw, budgets.parity.channelThreshold) };
}
console.error("browser: Resvg parity measured");

// End-to-end HMR: edit a temporary *.media.ts, receive the dev-server reload,
// re-bundle it, and wait until the browser presents the new marker.
const hmrMs = [];
const fixtureRoot = await mkdtemp(join(tmpdir(), "superimg-hmr-"));
let devServer;
try {
  await mkdir(join(fixtureRoot, "videos"), { recursive: true });
  await writeFile(join(fixtureRoot, "package.json"), '{"type":"module"}\n');
  const templatePath = join(fixtureRoot, "videos/bench.media.ts");
  const source = (marker) => `import { define } from "superimg"; export default define({config:{width:320,height:180,fps:30,duration:1},render(){return '<div data-bench-marker="${marker}">${marker}</div>'}});`;
  await writeFile(templatePath, source("marker-0"));
  const previousCwd = process.cwd();
  process.chdir(fixtureRoot);
  const { startDevServer } = await import(join(repoRoot, "packages/superimg-cli/dist/server.js"));
  devServer = await startDevServer(templatePath, { port: await freePort() });
  process.chdir(previousCwd);
  console.error("browser: HMR server started");
  const hmrPage = await browser.newPage({ viewport: { width: 640, height: 480 } });
  await hmrPage.goto(devServer.url);
  const waitForBundleMarker = (marker) => hmrPage.waitForFunction(async (value) => {
    const code = await fetch('/api/template?bench=' + Date.now()).then((response) => response.text());
    if (!code.includes(value)) return false;
    document.body.textContent = value;
    return true;
  }, marker, { timeout: 10_000, polling: 10 });
  await waitForBundleMarker("marker-0");
  for (let i = 1; i <= 5; i += 1) {
    const marker = `marker-${i}`;
    const started = performance.now();
    await writeFile(templatePath, source(marker));
    await waitForBundleMarker(marker);
    hmrMs.push(performance.now() - started);
  }
  await hmrPage.close();
  console.error("browser: HMR measured");
} finally {
  await devServer?.close();
  await rm(fixtureRoot, { recursive: true, force: true });
}

const rssBefore = process.memoryUsage().rss;
for (let i = 0; i < 300; i += 1) {
  await page.evaluate((frame) => window.__superimgBench.setFixture(frame % 2 ? "opaque" : "transform"), i);
  await page.locator("#fixture > :first-child").screenshot({ type: "png", omitBackground: true });
  if ((i + 1) % 50 === 0) console.error(`browser: stress ${i + 1}/300`);
}
const stressRssGrowthMb = Math.max(0, (process.memoryUsage().rss - rssBefore) / 1048576);
await browser.close();

const result = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, browser: "chromium" },
  chromiumLaunchMs: +chromiumLaunchMs.toFixed(2),
  player: { firstFrameMs: +player.firstFrameMs.toFixed(2), scrub: summary(player.scrubMs) },
  snapdom: { coldMs: +snapdom.coldMs.toFixed(2), warm: summary(snapdom.warmMs) },
  headlessCapture: summary(captureMs),
  hmr: summary(hmrMs),
  stress: { frames: 300, rssGrowthMb: +stressRssGrowthMb.toFixed(2) },
  parity,
};
await mkdir(join(packageRoot, ".results"), { recursive: true });
await writeFile(join(packageRoot, ".results/browser.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));

if (check) {
  const errors = [];
  const assert = (label, actual, limit) => { if (actual > limit) errors.push(`${label}: ${actual} > ${limit}`); };
  assert("Chromium launch", result.chromiumLaunchMs, budgets.browser.chromiumLaunchMs);
  assert("player first frame", result.player.firstFrameMs, budgets.browser.playerFirstFrameP95Ms);
  assert("player scrub p95", result.player.scrub.p95, budgets.browser.playerScrubP95Ms);
  assert("SnapDOM warm p95", result.snapdom.warm.p95, budgets.browser.snapdomWarmP95Ms);
  assert("headless capture p50", result.headlessCapture.p50, budgets.browser.headlessCaptureP50Ms);
  assert("headless capture p95", result.headlessCapture.p95, budgets.browser.headlessCaptureP95Ms);
  assert("HMR p95", result.hmr.p95, budgets.browser.hmrP95Ms);
  assert("stress RSS growth", result.stress.rssGrowthMb, budgets.browser.maxStressRssGrowthMb);
  for (const [kind, metric] of Object.entries(result.parity)) {
    assert(`${kind} mean channel delta`, metric.meanChannelDelta, budgets.parity.maxMeanChannelDelta);
    assert(`${kind} differing pixel ratio`, metric.differingPixelRatio, budgets.parity.maxDifferingPixelRatio);
    if (metric.width !== 320 || metric.height !== 180) errors.push(`${kind}: dimensions ${metric.width}x${metric.height}`);
    if (kind === "alpha" && metric.alphaMismatchPixels !== 0) errors.push(`alpha: ${metric.alphaMismatchPixels} alpha pixels differ`);
  }
  if (errors.length) {
    console.error(`Browser performance/parity budgets failed:\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("Browser performance and parity budgets passed.");
}
