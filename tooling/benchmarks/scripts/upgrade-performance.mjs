#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import { createBenchmarkRun } from "./run-support.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..", "..");
const node = process.execPath;
const runs = 5;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function command(args, cwd = repoRoot) {
  const started = performance.now();
  const result = spawnSync(node, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  return {
    command: [node, ...args],
    cwd,
    exitStatus: result.status,
    signal: result.signal,
    elapsedMs: Number((performance.now() - started).toFixed(2)),
    stderr: result.stderr.trim() || undefined,
    stdout: result.stdout.trim() || undefined,
  };
}

function benchmark(label, args, cwd) {
  const warmup = command(args, cwd);
  const samples = Array.from({ length: runs }, () => command(args, cwd));
  return {
    label,
    warmup,
    samples,
    medianMs: median(samples.filter((sample) => sample.exitStatus === 0).map((sample) => sample.elapsedMs)),
    allSucceeded: samples.every((sample) => sample.exitStatus === 0),
  };
}

const conversionProgram = String.raw`
import { performance } from "node:perf_hooks";
import { createNodeRuntimeAdapter } from "@superimg/node/runtime";
import { createRuntime, inspectFile, startConversion } from "@superimg/core/runtime";
import { AudioSample, AudioSampleSource, BufferTarget, Mp4OutputFormat, Output, Quality, VideoSample, VideoSampleSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";

registerMediabunnyServer();
const variant = process.argv[1];
const target = new BufferTarget();
const fixture = new Output({ format: new Mp4OutputFormat(), target });
const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") });
const audio = new AudioSampleSource({ codec: "aac", quality: new Quality("low") });
fixture.addVideoTrack(video); fixture.addAudioTrack(audio);
await fixture.start();
for (let frame = 0; frame < 60; frame += 1) {
  const sample = new VideoSample(new Uint8Array(64 * 64 * 4), { format: "RGBA", codedWidth: 64, codedHeight: 64, timestamp: frame / 30, duration: 1 / 30 });
  await video.add(sample); sample.close();
}
const audioSample = new AudioSample({ data: new Float32Array(16_000), format: "f32", sampleRate: 8_000, numberOfChannels: 1, timestamp: 0 });
await audio.add(audioSample); audioSample.close();
await fixture.finalize();
const bytes = new Uint8Array(target.buffer);
const runtime = createRuntime(createNodeRuntimeAdapter());
try {
  const inspection = await inspectFile(runtime, { kind: "bytes", bytes, mimeType: "video/mp4" });
  const videoTrack = inspection.tracks.find((track) => track.kind === "video");
  const audioTracks = inspection.tracks.filter((track) => track.kind === "audio");
  if (!videoTrack) throw new Error("Fixture has no video track");
  const started = performance.now();
  const artifact = await startConversion(runtime, {
    sources: [{ id: "fixture", input: { kind: "bytes", bytes, mimeType: "video/mp4" } }],
    video: { sourceId: "fixture", trackId: videoTrack.id },
    audio: audioTracks.map((track, index) => ({ id: "audio-" + index, sourceId: "fixture", trackId: track.id })),
    format: variant === "prores" ? "mov" : "mp4",
    resize: { width: 96, height: 96 },
    ...(variant === "prores" ? { encoding: { video: { codec: "prores", quality: "very-high" }, audio: { codec: "aac", quality: "high" } } } : {}),
  }).result;
  console.log(JSON.stringify({ conversionMs: Number((performance.now() - started).toFixed(2)), byteLength: artifact.byteLength, durationSeconds: artifact.durationSeconds, tracks: artifact.tracks }));
  await artifact.dispose();
} finally { await runtime.dispose(); }
`;

function conversionRun(variant) {
  const result = command(["--input-type=module", "-e", conversionProgram, variant], join(repoRoot, "packages/superimg-node"));
  const lastLine = result.stdout?.split("\n").at(-1);
  let metrics;
  try { metrics = lastLine === undefined ? undefined : JSON.parse(lastLine); } catch { metrics = undefined; }
  return {
    ...result,
    command: [node, "--input-type=module", "-e", "<embedded conversion fixture>", variant],
    stderr: result.stderr?.split("\n").at(0),
    metrics,
  };
}

function conversionBenchmark(variant) {
  const warmup = conversionRun(variant);
  const samples = Array.from({ length: 3 }, () => conversionRun(variant));
  return {
    fixture: "2 seconds, 60 x 64x64 RGBA frames, one 8 kHz mono audio track; 96x96 resize forces video transcode",
    variant,
    warmup,
    samples,
    medianWallMs: median(samples.filter((sample) => sample.exitStatus === 0).map((sample) => sample.elapsedMs)),
    medianConversionMs: median(samples.filter((sample) => sample.exitStatus === 0 && sample.metrics !== undefined).map((sample) => sample.metrics.conversionMs)),
    allSucceeded: samples.every((sample) => sample.exitStatus === 0),
  };
}

const authoredExportProgram = String.raw`
import { performance } from "node:perf_hooks";
import { video, Html } from "@foxworth/superimg";
import { createNodeRuntimeAdapter } from "@superimg/node/runtime";
import { createRuntime, startExport } from "@superimg/core/runtime";
const media = video({ size: { width: 64, height: 64 }, duration: "2s", fps: 30, render: () => Html({ html: '<div style="width:64px;height:64px;background:#36c"></div>' }) });
const runtime = createRuntime(createNodeRuntimeAdapter());
try {
  const started = performance.now();
  const job = startExport(runtime, media, { for: ["64x64.webm"], encoding: { video: { codec: "vp9", quality: "low" } } });
  const bundle = await job.result;
  try {
    const artifact = bundle.artifacts[0]; if (!artifact) throw new Error("No authored export artifact");
    console.log(JSON.stringify({ exportMs: Number((performance.now() - started).toFixed(2)), frames: 60, outputBytes: artifact.byteLength }));
  } finally { await bundle.dispose(); await job.dispose(); }
} finally { await runtime.dispose(); }
`;

function authoredExportRun() {
  const result = command(["--input-type=module", "-e", authoredExportProgram], join(repoRoot, "packages/superimg"));
  const lastLine = result.stdout?.split("\n").at(-1); let metrics;
  try { metrics = lastLine === undefined ? undefined : JSON.parse(lastLine); } catch { metrics = undefined; }
  return { ...result, command: [node, "--input-type=module", "-e", "<public authored export fixture>"], metrics };
}

function authoredExportBenchmark() {
  const warmup = authoredExportRun(); const samples = Array.from({ length: 3 }, authoredExportRun);
  return { fixture: "public superimg video()+Html(), 64x64, 2 seconds, 30 fps, VP9 WebM via Node Chromium", warmup, samples, medianWallMs: median(samples.filter((sample) => sample.exitStatus === 0).map((sample) => sample.elapsedMs)), medianExportMs: median(samples.filter((sample) => sample.exitStatus === 0 && sample.metrics !== undefined).map((sample) => sample.metrics.exportMs)), allSucceeded: samples.every((sample) => sample.exitStatus === 0) };
}

async function historicalBuild(path) {
  if (!existsSync(path)) return { path, status: "absent" };
  const text = await readFile(path, "utf8");
  return {
    path,
    status: "present",
    tasks: text.match(/Tasks:\s+(\d+ successful, \d+ total)/)?.[1] ?? null,
    timeSeconds: Number(text.match(/Time:\s+([0-9.]+)s/)?.[1]) || null,
  };
}

async function installedMediaVersions() {
  const pnpm = join(repoRoot, "node_modules/.pnpm");
  const names = await readdir(pnpm);
  return names.filter((name) => name.startsWith("mediabunny@") || name.startsWith("@mediabunny+")).sort();
}

const tsConfig = "packages/superimg-core/tsconfig.json";
const evidence = await createBenchmarkRun({ kind: "upgrade-review", packageRoot: resolve(scriptDir, ".."), repoRoot, harness: new URL(import.meta.url), workload: { runs, kind: "historical upgrade qualification; hardcoded compiler/historical paths, inspect individual status" }, buildPaths: (await readdir(join(repoRoot, "packages"))).map(name => `packages/${name}/dist`) });
try {
const ts6 = benchmark("TypeScript 6.0.3 JavaScript compiler", [
  "node_modules/.pnpm/typescript@6.0.3/node_modules/typescript/bin/tsc", "-p", tsConfig, "--noEmit",
]);
const ts7 = benchmark("TypeScript 7.0.2 native compiler", [
  "node_modules/@typescript/native/bin/tsc", "-p", tsConfig, "--noEmit",
]);

const report = {
  schemaVersion: 0,
  recordedAt: new Date().toISOString(),
  environment: { node: process.version, platform: `${process.platform}-${process.arch}`, runs, warmFileSystem: true },
  compiler: { tsconfig: tsConfig, ts6, ts7 },
  nodeConversion: {
    defaultMp4: conversionBenchmark("mp4"),
    nativeProRes: conversionBenchmark("prores"),
  },
  authoredExportCurrentOnly: authoredExportBenchmark(),
  historicalBuilds: {
    before: await historicalBuild("/tmp/superimg-upgrade-baseline/build-network.log"),
    currentCandidate: await historicalBuild("/tmp/superimg-upgrade-build-4.log"),
  },
  historicalMediaBaseline: {
    status: "absent",
    installedMediabunnyPackages: await installedMediaVersions(),
    note: "Only the current 1.55.7 Mediabunny packages are retained under node_modules/.pnpm; no older installed media adapter can be measured without mutating dependencies.",
  },
};

await evidence.complete(report);
console.log(JSON.stringify(report, null, 2));

console.error(`Evidence: ${evidence.directory}`);
} catch (error) { await evidence.fail(error); throw error; }
