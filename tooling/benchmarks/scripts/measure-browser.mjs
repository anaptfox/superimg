#!/usr/bin/env node

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rolldown } from "rolldown";
import sharp from "sharp";

import { createBenchmarkRun, evaluateCeilings, summarize, assertCompatibleBaseline } from "./run-support.mjs";
import { captureMarkerEvidence, waitForAcceptedMarker, waitForFailedMarker } from "./hmr-acceptance.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
if (process.argv.includes("--resources")) {
  await import("./measure-runtime-resources.mjs");
  process.exit(0);
}
if (process.argv.includes("--runtime")) {
  const { runRuntimeBenchmark } = await import("./runtime-browser.mjs");
  await runRuntimeBenchmark(process.argv.slice(2), { packageRoot, repoRoot });
  process.exit(0);
}
const check = process.argv.includes("--check");
const budgets = JSON.parse(await readFile(join(packageRoot, "performance-budgets.json"), "utf8"));

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
  const bundle = await rolldown({
    input: join(packageRoot, "fixtures/browser-entry.ts"),
    transform: { define: { __SUPERIMG_RUNTIME_BENCH__: "false" } },
  });
  try {
    const generated = await bundle.generate({ format: "iife", name: "SuperImgBench", minify: true, codeSplitting: false });
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

const run = await createBenchmarkRun({ kind: "browser", packageRoot, repoRoot, harness: new URL(import.meta.url), harnessFiles: [new URL("./hmr-acceptance.mjs", import.meta.url), new URL("../fixtures/browser-entry.ts", import.meta.url), new URL("../fixtures/browser-capture.ts", import.meta.url)], workload: { viewport: { width: 640, height: 480, dpr: 1 }, captureSamples: 20, hmrSamples: 5, browser: "installed Chromium; normal CPU", inspectionSurface: "dev-preview", hmrEvidence: "one guarded viewport PNG per accepted marker; same-byte media crop; stale syntax-failure diagnostics" }, buildPaths: (await readdir(join(repoRoot, "packages"))).map(name => `packages/${name}/dist`) });
let browser;
let page;
try {
const launchStarted = performance.now();
browser = await chromium.launch();
if (run.baseline) assertCompatibleBaseline({ identity: run.identity, browserVersion: browser.version() }, run.baseline);
console.error("browser: chromium launched");
const chromiumLaunchMs = performance.now() - launchStarted;
page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
const browserCode = await browserBundle();
const setupBenchPage = async () => {
  await page.goto('data:text/html,<div id="player"></div><div id="fixture" style="width:320px;height:180px"></div>', { waitUntil: "load" });
  await page.addScriptTag({ content: browserCode });
  await page.waitForFunction(() => typeof window.__superimgBench?.benchmarkPlayer === "function");
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
await run.checkpoint({ browserVersion: browser.version(), playerRaw: player, snapdomRaw: snapdom });
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
await run.checkpoint({ chromiumLaunchMs, headlessCaptureRaw: captureMs, parity });

// End-to-end HMR ends only when the real preview accepts matching compiled
// source and presents the marker inside its committed media iframe.
const hmrMs = [];
const hmrCapturedMs = [];
const hmrScreenshotMs = [];
const hmrAccepted = [];
let hmrRecovery;
const fixtureRoot = await mkdtemp(join(tmpdir(), "superimg-hmr-"));
const hmrEvidenceDirectory = join(run.directory, "hmr");
let devServer;
let hmrPage;
try {
  await mkdir(join(fixtureRoot, "videos"), { recursive: true });
  await writeFile(join(fixtureRoot, "package.json"), '{"type":"module"}\n');
  const templatePath = join(fixtureRoot, "videos/bench.media.ts");
  const source = (marker) => `import { define, Frame, Fill, Html } from "@foxworth/superimg"; export default define({config:{width:320,height:180,fps:30,duration:1},render(){return Frame({width:"fill",height:"fill"},Fill({color:"#f4f1ea"}),Html({width:"fill",height:"fill",html:'<div data-bench-marker="${marker}" style="width:100%;height:100%;display:grid;place-items:center;font:32px Arial;color:#111827">${marker}</div>'}))}});`;
  await writeFile(templatePath, source("marker-0"));
  const previousCwd = process.cwd();
  try {
    process.chdir(fixtureRoot);
    const { startDevServer } = await import("@foxworth/superimg-cli/dev-server");
    devServer = await startDevServer(templatePath, { port: await freePort() });
  } finally { process.chdir(previousCwd); }
  console.error("browser: HMR server started");
  hmrPage = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  await hmrPage.goto(devServer.url);
  const baseline = await waitForAcceptedMarker(hmrPage, "marker-0");
  const baselinePixels = await captureMarkerEvidence(hmrPage, "marker-0", { directory: hmrEvidenceDirectory, expectedSource: baseline.after.source });
  hmrAccepted.push({ ...baseline, pixels: baselinePixels });
  await run.checkpoint({ hmrRaw: hmrMs, hmrAccepted });
  if (baselinePixels.status !== "accepted") throw new Error(`Baseline HMR capture rejected: ${baselinePixels.reportPath}`);
  for (let i = 1; i <= 5; i += 1) {
    const marker = `marker-${i}`;
    const started = performance.now();
    await writeFile(templatePath, source(marker));
    const accepted = await waitForAcceptedMarker(hmrPage, marker);
    hmrMs.push(performance.now() - started);
    const pixels = await captureMarkerEvidence(hmrPage, marker, { directory: hmrEvidenceDirectory, expectedSource: accepted.after.source, editStarted: started });
    hmrAccepted.push({ ...accepted, pixels });
    await run.checkpoint({ hmrRaw: hmrMs, hmrCapturedRaw: hmrCapturedMs, hmrScreenshotRaw: hmrScreenshotMs, hmrAccepted });
    if (pixels.status !== "accepted") throw new Error(`HMR capture rejected: ${pixels.reportPath}`);
    if (pixels.media.sha256 === hmrAccepted.at(-2).pixels.media.sha256) throw new Error(`Accepted ${marker} did not change captured media pixels`);
    hmrCapturedMs.push(pixels.timings.editToCapturedMs);
    hmrScreenshotMs.push(pixels.timings.screenshotMs);
    await run.checkpoint({ hmrRaw: hmrMs, hmrCapturedRaw: hmrCapturedMs, hmrScreenshotRaw: hmrScreenshotMs, hmrAccepted });
  }
  const retainedSource = hmrAccepted.at(-1).after.source;
  await writeFile(templatePath, 'export default video({ render( {');
  let failed;
  try { failed = await waitForFailedMarker(hmrPage, "marker-5", retainedSource); }
  catch (error) { await run.checkpoint({ hmrFailureWait: { evidence: error.evidence, ...error.failureWait } }); throw error; }
  if (JSON.stringify(failed.after.source) !== JSON.stringify(retainedSource) || failed.visibleMarker !== "marker-5") throw new Error("Syntax error did not retain the last accepted visible media");
  const stalePixels = await captureMarkerEvidence(hmrPage, "marker-5", { directory: hmrEvidenceDirectory, name: "syntax-failure", expectedSource: retainedSource, diagnostic: true });
  hmrRecovery = { failed, stalePixels, retainedSource };
  await run.checkpoint({ hmrRecovery });
  if (stalePixels.status !== "diagnostic") throw new Error(`Stale HMR diagnostic capture rejected: ${stalePixels.reportPath}`);
  const recoveryStarted = performance.now();
  await writeFile(templatePath, source("marker-recovered"));
  const recovered = await waitForAcceptedMarker(hmrPage, "marker-recovered");
  const recoveryAcceptedMs = performance.now() - recoveryStarted;
  if (JSON.stringify(recovered.after.source) === JSON.stringify(retainedSource)) throw new Error("Recovered preview kept the old source identity");
  const recoveredPixels = await captureMarkerEvidence(hmrPage, "marker-recovered", { directory: hmrEvidenceDirectory, expectedSource: recovered.after.source, editStarted: recoveryStarted });
  hmrRecovery = { ...hmrRecovery, recovered, recoveredPixels, editToAcceptedMs: recoveryAcceptedMs };
  await run.checkpoint({ hmrRecovery });
  if (recoveredPixels.status !== "accepted") throw new Error(`Recovered HMR capture rejected: ${recoveredPixels.reportPath}`);
  if (recoveredPixels.media.sha256 === hmrAccepted.at(-1).pixels.media.sha256) throw new Error("Recovered source did not change captured media pixels");
  console.error("browser: HMR measured");
} finally {
  await hmrPage?.close();
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
browser = undefined;

const result = {
  schemaVersion: 0,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, browser: "chromium" },
  chromiumLaunchMs: +chromiumLaunchMs.toFixed(2),
  player: { firstFrameMs: +player.firstFrameMs.toFixed(2), scrub: summarize(player.scrubMs) },
  snapdom: { coldMs: +snapdom.coldMs.toFixed(2), warm: summarize(snapdom.warmMs) },
  headlessCapture: summarize(captureMs),
  hmr: { ...summarize(hmrMs), endpoint: "edit to accepted visible marker; excludes screenshot work", captured: { ...summarize(hmrCapturedMs), endpoint: "edit to guarded viewport screenshot completion; crop/file work follows" }, viewportScreenshot: summarize(hmrScreenshotMs), accepted: hmrAccepted, recovery: hmrRecovery },
  stress: { frames: 300, rssGrowthMb: +stressRssGrowthMb.toFixed(2) },
  parity,
  correctness: { passed: true, checks: ["Player and SnapDOM operations completed", "guarded accepted HMR pixels changed for every source edit", "failed edit retained stale pixels", "recovery accepted new source and pixels", "300 capture operations completed"] },
  measurement: "real browser host wall-clock stages; raw samples/median/range; p95 omitted below 100 samples",
  budgetKeys: "Legacy *P95Ms limits use quick maximum when the sample count is below 100",
};
await run.checkpoint(result);
console.log(JSON.stringify(result, null, 2));

if (check) {
  const upper = stats => stats.p95 ?? stats.max;
  const tailLabel = stats => stats.p95 === undefined ? "quick maximum (legacy p95 ceiling)" : "p95";
  const timing = [
    ["Chromium launch", result.chromiumLaunchMs, budgets.browser.chromiumLaunchMs],
    ["player first frame", result.player.firstFrameMs, budgets.browser.playerFirstFrameP95Ms],
    [`player scrub ${tailLabel(result.player.scrub)}`, upper(result.player.scrub), budgets.browser.playerScrubP95Ms],
    [`SnapDOM warm ${tailLabel(result.snapdom.warm)}`, upper(result.snapdom.warm), budgets.browser.snapdomWarmP95Ms],
    ["headless capture p50", result.headlessCapture.p50, budgets.browser.headlessCaptureP50Ms],
    [`headless capture ${tailLabel(result.headlessCapture)}`, upper(result.headlessCapture), budgets.browser.headlessCaptureP95Ms],
    [`HMR ${tailLabel(result.hmr)}`, upper(result.hmr), budgets.browser.hmrP95Ms],
  ];
  const parityChecks = [];
  for (const [kind, metric] of Object.entries(result.parity)) {
    parityChecks.push([`${kind} mean channel delta`, metric.meanChannelDelta, budgets.parity.maxMeanChannelDelta]);
    parityChecks.push([`${kind} differing pixel ratio`, metric.differingPixelRatio, budgets.parity.maxDifferingPixelRatio]);
    parityChecks.push([`${kind} width error`, Math.abs(metric.width - 320), 0], [`${kind} height error`, Math.abs(metric.height - 180), 0]);
    if (kind === "alpha") parityChecks.push(["alpha mismatched pixels", metric.alphaMismatchPixels, 0]);
  }
  result.correctness.parity = evaluateCeilings(parityChecks);
  result.correctness.passed = result.correctness.parity.passed;
  result.budgets = { timing: evaluateCeilings(timing), resources: evaluateCeilings([["stress RSS growth", result.stress.rssGrowthMb, budgets.browser.maxStressRssGrowthMb]]) };
  await run.checkpoint(result);
  const errors = [result.correctness.parity, ...Object.values(result.budgets)].flatMap(group => group.checks.filter(item => !item.passed).map(item => `${item.label}: ${item.actual} > ${item.limit}`));
  if (errors.length) {
    console.error(`Browser performance/parity budgets failed:\n- ${errors.join("\n- ")}`);
    throw new Error("Browser budgets/parity failed; see retained result");
  }
  console.log("Browser performance and parity budgets passed.");
}

await run.complete({ ...result, measurement: "real browser host wall-clock stages; raw samples/median/range; p95 omitted below 100 samples", budgetKeys: "Legacy *P95Ms limits use quick maximum when the sample count is below 100" });
console.error(`Evidence: ${run.directory}`);
} catch (error) {
  try { if (page && !page.isClosed()) await page.screenshot({ path: join(run.directory, "failure.png") }); } catch { /* Failure diagnostics cannot replace the original failure. */ }
  await run.fail(error); throw error;
} finally { await browser?.close(); }
