#!/usr/bin/env node
// Phase 0: prove published Blitz wasm can rasterize HTML from Node with no NAPI.
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { BlitzEngine } from "../pkg/superimg_blitz.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const HTML = `<!doctype html>
<html>
<head>
<style>
  html, body { margin: 0; background: #0b0b12; color: #f4f4f5; font-family: sans-serif; }
  main {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
  }
  h1 { margin: 0; font-size: 64px; letter-spacing: -0.04em; color: #ffd166; }
</style>
</head>
<body>
  <main><h1>Blitz wasm</h1></main>
</body>
</html>`;

function run(label, width, height) {
  const engine = new BlitzEngine(width, height);
  const t0 = performance.now();
  const png = engine.rasterizePng(HTML, 0);
  const ms = performance.now() - t0;
  const outDir = join(root, "output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${label}.png`);
  writeFileSync(outPath, Buffer.from(png));
  return { label, width, height, ms: ms.toFixed(1), bytes: png.length, outPath };
}

const wasmPath = join(root, "pkg/superimg_blitz_bg.wasm");
const wasmBytes = statSync(wasmPath).size;

const small = run("spike-640x360", 640, 360);
const hd = run("spike-1920x1080", 1920, 1080);

console.log(
  JSON.stringify(
    {
      wasmBytes,
      wasmMiB: +(wasmBytes / 1024 / 1024).toFixed(2),
      frames: [small, hd],
    },
    null,
    2,
  ),
);
