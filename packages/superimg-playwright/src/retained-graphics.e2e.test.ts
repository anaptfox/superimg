import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { build } from "esbuild";
import sharp from "sharp";
import { scene } from "@superimg/stdlib/compat/three";
import { lottie } from "@superimg/stdlib/viz/lottie";
import { PlaywrightRasterizer } from "./adapters.js";
import { PlaywrightEngine } from "./playwright-engine.js";
import { applyBrowsersDirectory } from "./runtime-path.js";
import { preloadThreeModule } from "./three-preload.js";
import { preloadLottieModule } from "./lottie-preload.js";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashTemplateOutputs } from "@superimg/core";

const sourceModule = (path: string) => import(fileURLToPath(new URL(path, import.meta.url)));
const { retainedResourcesScript } = await sourceModule("../../superimg-stdlib/src/viz/retained.ts");
const { NativeSurface } = await sourceModule("../../superimg-stdlib/src/tree/native-surface.ts");
const { lower } = await sourceModule("../../superimg-stdlib/src/tree/lower.ts");
const { bundleNativeSurfaceModule } = await sourceModule("../../superimg-core/src/bundler/bundler.ts");
const { SvgArtwork, svgDocument } = await sourceModule("../../superimg-stdlib/src/svg/document-artwork.ts");

let browser: Browser;
beforeAll(async () => {
  applyBrowsersDirectory();
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => { await browser?.close(); });

async function fixture() {
  const context = await browser.newContext({ viewport: { width: 64, height: 64 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const renderer = new PlaywrightRasterizer(page, true);
  await renderer.init({ width: 64, height: 64, format: "png", capture: { dpr: 2, scale: "device", intermediate: "png" } });
  return { page, renderer };
}
async function pixels(png: Buffer) { return sharp(png).ensureAlpha().raw().toBuffer(); }

async function bundleBridge(format: "esm" | "iife") {
  const entry = fileURLToPath(new URL("../../superimg-stdlib/src/viz/native-surface-browser.ts", import.meta.url));
  const { outputFiles } = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format,
    ...(format === "iife" && { globalName: "NativeBridge" }),
    logLevel: "silent",
    write: false,
  });
  return outputFiles[0]!.text;
}

describe("retained graphics islands", () => {
  it("preserves imported local blur filter pixels in Chromium", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><rect x="20" y="20" width="40" height="40" fill="red" filter="url(#blur)"/></svg>';
    const imported = lower(SvgArtwork({ document: svgDocument(new TextEncoder().encode(source)), id: "art", width: 80, height: 80 }), "svg");
    const page = await browser.newPage({ viewport: { width: 80, height: 80 }, deviceScaleFactor: 1 });
    try {
      const capture = async (markup: string) => {
        await page.setContent(`<style>html,body{margin:0}</style>${markup}`);
        return pixels(await page.screenshot());
      };
      expect(await capture(imported)).toEqual(await capture(source));
    } finally { await page.close(); }
  });
  it("preserves imported viewport cropping and local paint in Chromium", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 60" preserveAspectRatio="xMinYMax slice"><defs><radialGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></radialGradient><mask id="m"><rect width="120" height="60" fill="white"/><circle cx="15" cy="20" r="8" fill="black"/></mask></defs><rect width="120" height="60" fill="url(#g)" mask="url(#m)"/><text x="4" y="50" fill="white" font-size="10">Tea <tspan font-weight="bold">time</tspan></text></svg>';
    const imported = lower(SvgArtwork({ document: svgDocument(new TextEncoder().encode(source)), id: "art", width: 120, height: 120 }), "svg");
    const page = await browser.newPage({ viewport: { width: 120, height: 120 }, deviceScaleFactor: 1 });
    try {
      const capture = async (markup: string) => {
        await page.setContent(`<style>html,body{margin:0}</style>${markup}`);
        await page.evaluate(() => document.fonts.ready);
        return pixels(await page.screenshot());
      };
      expect(await capture(imported)).toEqual(await capture(source));
    } finally { await page.close(); }
  });
  it("preserves imported xlink reuse pixels", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 40 40" width="40" height="40"><defs><circle id="mark" cx="10" cy="10" r="8" fill="red"/></defs><use xlink:href="#mark" x="10" y="10"/></svg>';
    const imported = lower(SvgArtwork({ document: svgDocument(new TextEncoder().encode(source)), id: "reuse", width: 40, height: 40 }), "svg");
    const originalPixels = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer();
    const importedPixels = await sharp(Buffer.from(imported)).ensureAlpha().raw().toBuffer();
    expect(importedPixels).toEqual(originalPixels);
  });
  it("preserves imported pattern viewBox pixels", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40"><defs><pattern id="p" patternUnits="userSpaceOnUse" width="20" height="20" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/><rect width="5" height="5" fill="blue"/></pattern></defs><rect width="40" height="40" fill="url(#p)"/></svg>';
    const doc = svgDocument(new TextEncoder().encode(source));
    const imported = lower(SvgArtwork({ document: doc, id: "pattern", width: 40, height: 40 }), "svg");
    const originalPixels = await sharp(Buffer.from(source)).ensureAlpha().raw().toBuffer();
    const importedPixels = await sharp(Buffer.from(imported)).ensureAlpha().raw().toBuffer();
    expect(importedPixels).toEqual(originalPixels);
  });
  it("installs a prepared module closure through the engine capture configuration", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-engine-"));
    const engine = new PlaywrightEngine();
    try {
      const surface = join(directory, "world.ts"), helper = join(directory, "colors.ts");
      await writeFile(helper, 'export const color = "red";');
      await writeFile(surface, `export default { async create({ canvas }) { const { color } = await import('./colors'); const ctx = canvas.getContext('2d'); return { sample() { ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`);
      const bridge = fileURLToPath(new URL("../../superimg-stdlib/src/viz/native-surface-browser.ts", import.meta.url));
      const prepared = await bundleNativeSurfaceModule(surface, bridge);
      await engine.init();
      const rejected = engine.createAdapters({ encoding: { format: "png" } }).renderer;
      try {
        await expect(rejected.init({ width: 64, height: 64, format: "png", nativeModuleSets: [{ identity: "0".repeat(64), outputs: prepared.outputs }] })).rejects.toThrow(/does not match/);
      } finally { await rejected.dispose(); }
      const { renderer } = engine.createAdapters({ encoding: { format: "png" } });
      try {
        await renderer.init({ width: 64, height: 64, format: "png", nativeModuleSets: [{ identity: prepared.outputSetIdentity, outputs: prepared.outputs }] });
        const base = `https://superimg-native.invalid/${prepared.outputSetIdentity}/`;
        const module = { identity: prepared.outputSetIdentity, moduleUrl: base + prepared.surfaceEntry, bridgeUrl: base + prepared.bridgeEntry };
        const html = lower(NativeSurface({ id: "engine", module, width: 64, height: 64, seconds: 0, data: {} }), { width: 64, height: 64 });
        const raw = await sharp(await renderer.rasterize(html)).ensureAlpha().raw().toBuffer();
        expect([...raw.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
      } finally { await renderer.dispose(); }
    } finally { await engine.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 20000);
  it("captures compiler-prepared native module files with a dynamic companion", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-capture-"));
    const { renderer } = await fixture();
    try {
      const surface = join(directory, "world.ts"), helper = join(directory, "colors.ts");
      await writeFile(helper, 'export const color = "red";');
      await writeFile(surface, `export default { async create({ canvas }) { const { color } = await import('./colors'); const ctx = canvas.getContext('2d'); return { sample() { ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`);
      const bridge = fileURLToPath(new URL("../../superimg-stdlib/src/viz/native-surface-browser.ts", import.meta.url));
      const prepared = await bundleNativeSurfaceModule(surface, bridge);
      const base = await renderer.installNativeModuleFiles(prepared.outputSetIdentity, prepared.outputs);
      const changed = prepared.outputs.map((file: { type: string; fileName: string; code?: string }) => file.type === "chunk" && file.fileName === prepared.surfaceEntry ? { ...file, code: `${file.code}\n// changed` } : file);
      await expect(renderer.installNativeModuleFiles(prepared.outputSetIdentity, changed)).rejects.toThrow(/does not match/);
      const duplicated = [...prepared.outputs, prepared.outputs[0]];
      await expect(renderer.installNativeModuleFiles(hashTemplateOutputs(duplicated), duplicated)).rejects.toThrow(/Duplicate/);
      const module = { identity: prepared.outputSetIdentity, moduleUrl: base + prepared.surfaceEntry, bridgeUrl: base + prepared.bridgeEntry };
      const html = lower(NativeSurface({ id: "compiled", module, width: 64, height: 64, seconds: 0, data: {} }), { width: 64, height: 64 });
      const png = await renderer.rasterize(html);
      const raw = await sharp(png).ensureAlpha().raw().toBuffer();
      expect([...raw.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    } finally { await renderer.dispose(); await rm(directory, { recursive: true, force: true }); }
  }, 20000);
  it("reports native create failure and permits a fresh instance on a new capture page", async () => {
    const { renderer } = await fixture();
    try {
      const bundle = await bundleBridge("esm");
      const dataUrl = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
      const module = { identity: "recovery-v1", bridgeUrl: dataUrl(bundle), moduleUrl: dataUrl(`export default { create({ canvas }) { window.attempts = (window.attempts || 0) + 1; if (window.attempts === 1) throw new Error('create failed'); const ctx = canvas.getContext('2d'); return { sample() { ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`) };
      const frame = () => lower(NativeSurface({ id: "recovery", module, width: 64, height: 64, seconds: 0, data: {} }), { width: 64, height: 64 });
      await expect(renderer.rasterize(frame())).rejects.toThrow(/native surface failed/i);
      const fresh = await fixture();
      try {
        await fresh.page.evaluate("window.attempts = 1");
        const png = await fresh.renderer.rasterize(frame());
        expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        expect(await fresh.page.evaluate("window.attempts")).toBe(2);
      } finally { await fresh.renderer.dispose(); }
    } finally { await renderer.dispose(); }
  }, 20000);
  it("captures a prepared authored native surface through its readiness token", async () => {
    const { page, renderer } = await fixture();
    try {
      const bundle = await bundleBridge("esm");
      const dataUrl = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
      const module = { identity: "test-v1", bridgeUrl: dataUrl(bundle), moduleUrl: dataUrl(`export default { create({ canvas }) { window.surfaceCreates = (window.surfaceCreates || 0) + 1; const ctx = canvas.getContext('2d'); return { sample({ seconds }) { ctx.fillStyle = seconds > .5 ? 'red' : 'blue'; ctx.fillRect(0, 0, 64, 64); }, dispose() { window.surfaceDisposes = (window.surfaceDisposes || 0) + 1; } }; } };`) };
      const frame = (seconds: number) => lower(NativeSurface({ id: "art", module, width: 64, height: 64, seconds, data: {} }), { width: 64, height: 64 });
      const first = await pixels(await renderer.rasterize(frame(0)));
      const second = await pixels(await renderer.rasterize(frame(0.8)));
      await renderer.rasterize(frame(0.2));
      const repeat = await pixels(await renderer.rasterize(frame(0.8)));
      expect(first).not.toEqual(second); expect(second).toEqual(repeat);
      expect(await page.evaluate("window.surfaceCreates")).toBe(1);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.surfaceDisposes")).toBe(1);
    } finally { await renderer.dispose(); }
  }, 20000);
  it("waits for async assets, passes capture DPR and replaces resources when an asset changes", async () => {
    const { page, renderer } = await fixture();
    try {
      const bundle = await bundleBridge("esm");
      const dataUrl = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
      const module = { identity: "asset-test", bridgeUrl: dataUrl(bundle), moduleUrl: dataUrl(`export default {
        async create({canvas,width,height,dpr,assets}) {
          await new Promise(resolve => setTimeout(resolve, 40));
          const color = await (await fetch(assets.paint)).text();
          window.surfaceCreates = (window.surfaceCreates || 0) + 1; window.surfaceDpr = dpr;
          canvas.width = width * dpr; canvas.height = height * dpr;
          const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
          return { sample() { ctx.fillStyle = color; ctx.fillRect(0,0,width,height); },
            dispose() { window.surfaceDisposes = (window.surfaceDisposes || 0) + 1; } };
        } };`) };
      const frame = (paint: string) => lower(NativeSurface({ id: "art", module, width: 64, height: 64, seconds: 0, data: {}, wait: "custom-ready", assets: { paint: `data:text/plain,${paint}` } }), { width: 64, height: 64 });
      const red = await pixels(await renderer.rasterize(frame("red")));
      expect([...red.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
      expect(await page.evaluate("window.surfaceDpr")).toBe(2);
      expect(await page.evaluate("window.surfaceCreates")).toBe(1);
      await renderer.rasterize(frame("red"));
      expect(await page.evaluate("window.surfaceCreates")).toBe(1);
      const blue = await pixels(await renderer.rasterize(frame("blue")));
      expect([...blue.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
      expect(await page.evaluate("window.surfaceCreates")).toBe(2);
      expect(await page.evaluate("window.surfaceDisposes")).toBe(1);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.surfaceDisposes")).toBe(2);
    } finally { await renderer.dispose(); }
  }, 20000);
  it("disposes a non-waiting surface removed while its module is still loading", async () => {
    const { page, renderer } = await fixture();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      const bundle = await bundleBridge("esm");
      const dataUrl = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
      const module = { identity: "delayed", bridgeUrl: dataUrl(bundle), moduleUrl: dataUrl(`await new Promise(resolve => setTimeout(resolve, 300)); export default { create() { window.lateCreates = (window.lateCreates || 0) + 1; return { sample(){}, dispose(){} }; } };`) };
      const frame = lower(NativeSurface({ id: "art", module, width: 64, height: 64, seconds: 0, data: {}, wait: false }), { width: 64, height: 64 });
      await renderer.rasterize(frame);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.lateCreates || 0")).toBe(0);
      expect(errors).toEqual([]);
    } finally { await renderer.dispose(); }
  }, 20000);
  it("samples an ordinary native module through retained capture", async () => {
    const { page, renderer } = await fixture();
    try {
      const bundle = await bundleBridge("iife");
      await page.addScriptTag({ content: bundle });
      await page.evaluate(`window.nativeCreates = 0; window.nativeDisposes = 0;
        window.nativeModule = { create({ canvas }) { window.nativeCreates++; const ctx = canvas.getContext('2d');
          return { sample({ seconds }) { ctx.fillStyle = seconds > 0.5 ? 'red' : 'blue'; ctx.fillRect(0, 0, 64, 64); },
            async dispose() { window.nativeDisposes++; } }; } };`);
      const frame = (seconds: number) => `<canvas width="64" height="64" data-superimg-wait="native"></canvas><script>
        (async () => { const canvas = document.currentScript.previousElementSibling; ${retainedResourcesScript}
          try { await NativeBridge.sampleNativeSurface({ resources, key: 'native', moduleIdentity: 'v1', module: window.nativeModule,
            host: { canvas, width: 64, height: 64, dpr: 2, signal: new AbortController().signal, assets: {} }, frame: { seconds: ${seconds}, data: {} } });
            document.querySelector('canvas').removeAttribute('data-superimg-wait');
          } catch (error) { canvas.setAttribute('data-superimg-wait-error', String(error)); } })();</script>`;
      const a = await pixels(await renderer.rasterize(frame(0)));
      const b = await pixels(await renderer.rasterize(frame(0.8)));
      await renderer.rasterize(frame(0.2));
      const repeat = await pixels(await renderer.rasterize(frame(0.8)));
      expect(a).not.toEqual(b); expect(b).toEqual(repeat);
      expect(await page.evaluate("window.nativeCreates")).toBe(1);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.nativeDisposes")).toBe(1);
    } finally { await renderer.dispose(); }
  }, 20000);
  it("waits for asynchronous disposal before returning an absent frame", async () => {
    const { page, renderer } = await fixture();
    try {
      await page.evaluate(`${retainedResourcesScript}
        window.cleanupDone = false;
        resources.begin();
        resources.retain('async', 'v1', () => ({ dispose: () => new Promise(resolve => setTimeout(() => { window.cleanupDone = true; resolve(); }, 50)) }));
        resources.end();`);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.cleanupDone")).toBe(true);
    } finally { await renderer.dispose(); }
  });
  it("retains Three setup at DPR2 and seeks forward and backward absolutely", async () => {
    const { page, renderer } = await fixture();
    const errors: string[] = [];
    const external: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.route("**/*", async route => { external.push(route.request().url()); await route.abort(); });
      await preloadThreeModule(page);
      const setup = `window.setups = (window.setups || 0) + 1;
        scene.background = new THREE.Color(0x000000);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color:0xff0000}));
        scene.add(mesh);
        const dispose = renderer.dispose.bind(renderer);
        renderer.dispose = function() { window.disposals = (window.disposals || 0) + 1; dispose(); };`;
      const animate = "mesh.rotation.y = progress * Math.PI; mesh.position.x = (progress - 0.5) * 1.2;";
      const times = [0, 0.8, 0.2, 0.8];
      const retained: Buffer[] = [];
      for (const progress of times) retained.push(await pixels(await renderer.rasterize(scene({ width: 64, height: 64, progress, setup, animate }))));
      expect(await page.evaluate("window.setups")).toBe(1);
      expect(await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([128, 128]);
      expect(retained[0]).not.toEqual(retained[1]);
      expect(retained[1]).toEqual(retained[3]);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.disposals")).toBe(1);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    } finally { await renderer.dispose(); }
  }, 60_000);

  it.each(["svg", "canvas"] as const)("reuses Lottie %s, seeks absolutely, and destroys absent instances", async (kind) => {
    const { page, renderer } = await fixture();
    try {
      await preloadLottieModule(page, kind === "canvas");
      await page.evaluate(`(() => {
        const load = window.lottie.loadAnimation.bind(window.lottie);
        window.loads = 0; window.destroys = 0;
        window.lottie.loadAnimation = function(config) {
          window.loads++; const anim = load(config); const destroy = anim.destroy.bind(anim);
          anim.destroy = function() { window.destroys++; destroy(); }; return anim;
        };
      })()`);
      const data = { v: "5.13.0", fr: 30, ip: 0, op: 30, w: 64, h: 64, nm: "moving red", ddd: 0, assets: [], layers: [{
        ddd: 0, ind: 1, ty: 1, nm: "red", sr: 1, sw: 16, sh: 16, sc: "#ff0000", ip: 0, op: 30, st: 0, bm: 0,
        ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 1, k: [
          { t: 0, s: [8, 32, 0], e: [56, 32, 0], o: { x: 0.333, y: 0.333 }, i: { x: 0.667, y: 0.667 } },
          { t: 29, s: [56, 32, 0] },
        ] }, a: { a: 0, k: [8, 8, 0] }, s: { a: 0, k: [100, 100, 100] } },
      }] };
      const times = [0, 0.8, 0.2, 0.8];
      const retained: Buffer[] = [];
      for (const progress of times) retained.push(await pixels(await renderer.rasterize(lottie({ animationData: data, progress, width: 64, height: 64, renderer: kind }))));
      expect(await page.evaluate("window.loads")).toBe(1);
      expect(retained[0]).not.toEqual(retained[1]);
      if (kind === "canvas") expect(await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([128, 128]);
      await renderer.rasterize("<div></div>");
      expect(await page.evaluate("window.destroys")).toBe(1);
      for (let i = 0; i < times.length; i++) {
        const fresh = await pixels(await renderer.rasterize(lottie({ animationData: data, progress: times[i]!, width: 64, height: 64, renderer: kind, wait: `fresh-${i}` })));
        expect(fresh).toEqual(retained[i]);
      }
      await renderer.dispose();
    } finally { await renderer.dispose(); }
  }, 60_000);
});
