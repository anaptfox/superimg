#!/usr/bin/env node
// Run after `just build-render`. Capture/encode stage measurements use the same
// 24-frame scene as the rendering review; timings are descriptive, not CI gates.
import { readdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { cpus, totalmem } from "node:os";
import { join, resolve } from "node:path";
import { createBenchmarkRun, summarize as summary } from "./run-support.mjs";
import { performance } from "node:perf_hooks";
import { PlaywrightEngine } from "../../../packages/superimg-playwright/dist/engine.js";
import { resolveCaptureDefaults } from "../../../packages/superimg-types/dist/index.js";

const require = createRequire(new URL("../../../packages/superimg-playwright/package.json", import.meta.url));
const sharp = require("sharp");
const packageRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(packageRoot, "../..");
const run = await createBenchmarkRun({ kind: "render-fidelity", packageRoot, repoRoot, harness: new URL(import.meta.url), workload: { frames: 24, fps: 30, measurement: "descriptive capture/encode stages; no CI timing gate" }, buildPaths: (await readdir(join(repoRoot, "packages"))).map(name => `packages/${name}/dist`) });
const directory = run.directory;
try {
const frames = 24;
const fps = 30;
const clock = () => performance.now();

function scene(w, h, i) {
  return `<div style="position:absolute;inset:0;background:linear-gradient(115deg,#020617,#344766);font-family:Arial;color:#fff;overflow:hidden">
    <div style="position:absolute;left:${w * .05}px;top:${h * .12}px;font-size:${w / 24}px;font-weight:bold">SuperImg / render fidelity</div>
    <div style="position:absolute;left:${w * .05}px;top:${h * .26}px;font-size:${w / 75}px;color:#8cc8ff">Fine text, colored edges, curves and gradients — frame ${i}</div>
    <svg width="${w}" height="${h}" style="position:absolute;inset:0"><path d="M ${w * .05} ${h * .68} C ${w * .25} ${h * .23}, ${w * .42} ${h * .97}, ${w * .76} ${h * .44}" fill="none" stroke="#ff477d" stroke-width="2"/><circle cx="${w * .78 + i * 3}" cy="${h * .48}" r="${h * .18}" fill="#28d7bb"/></svg>
    <div style="position:absolute;left:${w * .05}px;top:${h * .80}px;width:${w * .45}px;height:${h * .06}px;background:repeating-linear-gradient(90deg,#ff0000 0px,#ff0000 1px,#0000ff 1px,#0000ff 2px)"></div>
  </div>`;
}

const scenarios = [
  { name: "1080-jpeg95", width: 1920, height: 1080, capture: { intermediate: "jpeg", jpegQuality: 95 } },
  { name: "1080-png", width: 1920, height: 1080, capture: { intermediate: "png" } },
  { name: "4k-png", width: 3840, height: 2160, capture: { intermediate: "png" } },
  { name: "4k-jpeg95", width: 3840, height: 2160, capture: { intermediate: "jpeg", jpegQuality: 95 } },
  { name: "1080-dpr2-css-png", width: 1920, height: 1080, capture: { intermediate: "png", dpr: 2, scale: "css" } },
  { name: "1080-dpr2-device-png", width: 1920, height: 1080, capture: { intermediate: "png", dpr: 2, scale: "device" } },
];
const results = {
  environment: { node: process.version, cpu: cpus()[0].model, cores: cpus().length, ramGiB: totalmem() / 2 ** 30 },
  frames, fps, directory, scenarios: [],
};
const engine = new PlaywrightEngine({ perRenderContext: true });
try {
  await engine.init();
  for (const scenario of scenarios) {
    const encoding = { format: "mp4", video: { codec: "avc", quality: "very-high", latencyMode: "quality" }, capture: scenario.capture };
    const capture = resolveCaptureDefaults("mp4", scenario.capture, false);
    const { renderer, encoder } = engine.createAdapters({ encoding });
    const row = { ...scenario, captureMs: [], encodeAddMs: [], capturedBytes: 0 };
    const started = clock();
    try {
      await renderer.init({ width: scenario.width, height: scenario.height, fps, fonts: [], inlineCss: ["*{margin:0;box-sizing:border-box}"], stylesheets: [], mode: "frame", dpr: capture.dpr, capture, format: "mp4" });
      await encoder.init({ width: scenario.width, height: scenario.height, fps, encoding, durationSeconds: frames / fps });
      for (let i = 0; i < frames; i++) {
        const html = scene(scenario.width, scenario.height, i);
        let before = clock();
        const pixels = await renderer.rasterize(html, { time: i / fps, alpha: false });
        row.captureMs.push(clock() - before);
        row.capturedBytes += pixels.length;
        if (i === 0) {
          const metadata = await sharp(pixels).metadata();
          row.captureMetadata = { width: metadata.width, height: metadata.height, depth: metadata.depth, channels: metadata.channels };
          await writeFile(join(directory, `${scenario.name}.${capture.intermediate === "png" ? "png" : "jpg"}`), pixels);
        }
        before = clock();
        await encoder.addFrame(pixels, i / fps);
        row.encodeAddMs.push(clock() - before);
      }
      const before = clock();
      const bytes = await encoder.finalize();
      row.finalizeMs = clock() - before;
      row.outputBytes = bytes.length;
      await writeFile(join(directory, `${scenario.name}.mp4`), bytes);
    } finally {
      await Promise.allSettled([renderer.dispose(), encoder.dispose()]);
    }
    row.elapsedMs = clock() - started;
    row.captureSummary = summary(row.captureMs.slice(1));
    row.encodeAddSummary = summary(row.encodeAddMs.slice(1));
    results.scenarios.push(row);
    await run.checkpoint(results);
    await writeFile(join(directory, "benchmark.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ ...row, captureMs: undefined, encodeAddMs: undefined }));
  }
} finally { await engine.dispose(); }
console.log(`Report: ${join(directory, "benchmark.json")}`);

await run.complete(results);
} catch (error) { await run.fail(error); throw error; }
