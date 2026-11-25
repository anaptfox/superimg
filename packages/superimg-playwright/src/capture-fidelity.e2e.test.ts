import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import type { RenderJob, VideoEncoder } from "@superimg/types";
import { PlaywrightEngine } from "./playwright-engine.js";
import { RenderSession } from "./render-session.js";
import { PlaywrightRasterizer } from "./adapters.js";
import { applyBrowsersDirectory } from "./runtime-path.js";

let browser: Browser;
beforeAll(async () => {
  applyBrowsersDirectory();
  browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] });
});
afterAll(async () => { await browser?.close(); });

async function fixture(dpr = 1) {
  const context = await browser.newContext({ viewport: { width: 128, height: 64 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  const renderer = new PlaywrightRasterizer(page, true);
  return { page, renderer };
}
async function pixels(png: Buffer) { return sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); }
function colorLeft(data: Buffer, width: number, color: "red" | "blue") {
  let left = width;
  for (let p = 0; p < data.length; p += 4) {
    if (color === "red" ? data[p]! > 240 && data[p + 1]! < 15 && data[p + 2]! < 15
      : data[p]! < 15 && data[p + 1]! < 15 && data[p + 2]! > 240) left = Math.min(left, (p / 4) % width);
  }
  return left;
}
const animation = `<style>@keyframes travel{from{transform:translateX(0px)}to{transform:translateX(96px)}}
.square{position:absolute;left:0;width:8px;height:8px;animation:travel 1s linear both}</style>
<div class="square" style="top:8px;background:red"></div><div class="square" style="top:32px;background:blue;animation-iteration-count:infinite"></div>`;

async function stalled(page: Page, pattern: string, loaded?: () => void) {
  await page.route(pattern, () => { loaded?.(); /* Intentionally never fulfill; page disposal cancels the request. */ });
}

describe("Chromium capture fidelity", () => {
  it("measures typography and SVG geometry at the exact prepared authored frame", async () => {
    const { renderer } = await fixture();
    try {
      await renderer.init({ width: 128, height: 64, mode: "animation", format: "png", capture: { dpr: 1 } });
      const observed = await renderer.inspectFrame(`${animation}<svg width="128" height="64"><text data-si-node="label" x="10" y="24" style="font:16px Arial;fill:rgb(17,34,51)">Sales</text></svg>`, { time: 0.25 });
      const label = observed.nodes.find(node => node.id === "label")!;
      expect(label.typography).toMatchObject({ "font-size": "16px", fill: "rgb(17, 34, 51)" });
      expect(label.svg?.textLength).toBeGreaterThan(0);
      expect(label.svg?.bounds?.x).toBeCloseTo(10, 1);
      const square = observed.nodes.find(node => node.tag === "div" && node.bounds.y === 8)!;
      expect(square.bounds.x).toBeCloseTo(24, 1);
      expect(observed.coverage).toMatchObject({ truncated: false, maxNodes: 800, maxTextLength: 120 });
    } finally { await renderer.dispose(); }
  });

  it.each(["css", "device"] as const)("matches ordinary lossless PNG pixels for alpha, fractional crop and %s density", async (scale) => {
    const { page, renderer } = await fixture(2);
    const region = { x: 8.5, y: 4.5, width: 32, height: 16 };
    try {
      await renderer.init({ width: 128, height: 64, format: "png", capture: { dpr: 2, scale, region } });
      const fast = await renderer.rasterize(`<div style="position:absolute;left:12px;top:8px;width:15px;height:8px;background:rgba(255,0,0,.5)"></div>`, { alpha: true });
      const reference = await page.screenshot({ type: "png", clip: region, scale, omitBackground: true, animations: "allow", caret: "hide" });
      const actual = await pixels(fast);
      const expected = await pixels(reference);
      expect([actual.info.width, actual.info.height]).toEqual(scale === "device" ? [64, 32] : [32, 16]);
      expect(actual.data).toEqual(expected.data);
      expect(actual.data[3]).toBe(0);
      expect(actual.data.some((value, index) => index % 4 === 3 && value > 0 && value < 255)).toBe(true);
      // Alpha override must not bleed into a later opaque frame on the same page.
      const opaque = await pixels(await renderer.rasterize("<div></div>"));
      expect([...opaque.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
    } finally { await renderer.dispose(); }
  });

  it("samples finite and looping animations at exact times including a reverse seek", async () => {
    const { renderer } = await fixture();
    try {
      await renderer.init({ width: 128, height: 64, mode: "animation", format: "png", capture: { dpr: 1 } });
      for (const [time, expected] of [[0.75, 72], [0.25, 24], [1 / 3, 32]] as const) {
        const shot = await pixels(await renderer.rasterize(animation, { time }));
        expect(colorLeft(shot.data, shot.info.width, "red")).toBe(expected);
        expect(colorLeft(shot.data, shot.info.width, "blue")).toBe(expected);
      }
    } finally { await renderer.dispose(); }
  });

  it("keeps frame-mode animation suppression and hides the caret without changing authored styles", async () => {
    const { page, renderer } = await fixture();
    try {
      await renderer.init({ width: 128, height: 64, format: "png", capture: { dpr: 1 } });
      const shot = await pixels(await renderer.rasterize(animation.replace("translateX(0px)", "translateX(12px)")));
      expect(colorLeft(shot.data, shot.info.width, "red")).toBe(96);
      expect(colorLeft(shot.data, shot.info.width, "blue")).toBe(0);
      const caret = await pixels(await renderer.rasterize(`<input id="input" style="color:transparent;caret-color:red;border:0;background:white;width:120px;height:48px;font-size:32px"><script>document.getElementById('input').focus()</script>`));
      expect(colorLeft(caret.data, caret.info.width, "red")).toBe(caret.info.width);
      expect(await page.locator("#input").evaluate((el) => getComputedStyle(el).caretColor)).toBe("rgb(255, 0, 0)");
    } finally { await renderer.dispose(); }
  });

  it("waits for delayed CSS background and SVG image pixels", async () => {
    const { page, renderer } = await fixture();
    try {
      const redSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>`;
      await page.route("https://capture.test/red.svg", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        await route.fulfill({ contentType: "image/svg+xml", body: redSvg });
      });
      await renderer.init({ width: 128, height: 64, format: "png", capture: { dpr: 1 } });
      const shot = await pixels(await renderer.rasterize(`<div style="width:32px;height:32px;background-image:url('https://capture.test/red.svg')"></div><svg style="position:absolute;left:32px;top:0" width="32" height="32"><image width="32" height="32" href="https://capture.test/red.svg"/></svg>`));
      for (const x of [16, 48]) expect([...shot.data.subarray((16 * 128 + x) * 4, (16 * 128 + x) * 4 + 4)]).toEqual([255, 0, 0, 255]);
    } finally { await renderer.dispose(); }
  });

  it.each([
    `<img src="https://capture.test/missing.png">`,
    `<img data-superimg-wait="hero" src="https://capture.test/missing.png">`,
    `<div style="width:32px;height:32px;background-image:url('https://capture.test/missing.png')"></div>`,
    `<svg width="32" height="32"><image width="32" height="32" href="https://capture.test/missing.png"/></svg>`,
  ])("fails required image errors instead of exporting incomplete pixels: %s", async (html) => {
    const { page, renderer } = await fixture();
    try {
      await page.route("https://capture.test/missing.png", (route) => route.fulfill({ status: 404, body: "missing" }));
      await renderer.init({ width: 128, height: 64, format: "png" });
      await expect(renderer.rasterize(html)).rejects.toThrow(/Image failed to load/);
      expect(page.isClosed()).toBe(true);
    } finally { await renderer.dispose(); }
  });

  it("fails a required font download", async () => {
    const { page, renderer } = await fixture();
    try {
      await page.route("https://capture.test/missing.woff2", (route) => route.fulfill({ status: 404, body: "missing" }));
      await renderer.init({ width: 128, height: 64, format: "png", inlineCss: ["@font-face{font-family:Probe;src:url('https://capture.test/missing.woff2')}"] });
      await expect(renderer.rasterize('<span style="font-family:Probe">Text</span>')).rejects.toThrow(/Font failed to load/);
    } finally { await renderer.dispose(); }
  });

  it("bounds script and image waits with one deadline", async () => {
    const { page, renderer } = await fixture();
    try {
      await page.route("https://capture.test/slow.js", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 160));
        await route.fulfill({ contentType: "text/javascript", body: "window.loaded = true" });
      });
      await stalled(page, "https://capture.test/hanging.png");
      await renderer.init({ width: 128, height: 64, format: "png", readiness: { timeoutMs: 350 } });
      const start = performance.now();
      await expect(renderer.rasterize('<script src="https://capture.test/slow.js"></script><img src="https://capture.test/hanging.png">')).rejects.toThrow(/timeout/);
      expect(performance.now() - start).toBeLessThan(1000);
      expect(page.isClosed()).toBe(true);
    } finally { await renderer.dispose(); }
  });

  it("aborts a pending external script and releases the page", async () => {
    const { page, renderer } = await fixture();
    const controller = new AbortController();
    try {
      await stalled(page, "https://capture.test/hanging.js", () => controller.abort());
      await renderer.init({ width: 128, height: 64, format: "png" });
      await expect(renderer.rasterize('<script src="https://capture.test/hanging.js"></script>', { signal: controller.signal })).rejects.toMatchObject({ code: "aborted" });
      expect(page.isClosed()).toBe(true);
    } finally { await renderer.dispose(); }
  });

  it("forwards capture DPR into actual parallel browser contexts", async () => {
    const templateBundle = await bundleTemplateCodeWithMap(`
      import { define, Html } from "@foxworth/superimg";
      export default define({
        config: { fps: 10, duration: 0.2, width: 64, height: 32 },
        render() { return Html({ width: "fill", height: "fill", html: '<div style="width:64px;height:32px;background:blue"></div>' }); }
      });
    `, { sourcefile: "parallel-density.media.ts" });
    const job: RenderJob = { templateBundle, width: 64, height: 32, fps: 10, duration: 0.2, encoding: { format: "png", capture: { dpr: 2, scale: "device" } } };
    for (const concurrency of [1, 2]) {
      const engine = new PlaywrightEngine();
      const dimensions: number[][] = [];
      const encoder: VideoEncoder<Buffer> = {
        async init() {},
        async addFrame(frame) { const { info } = await pixels(frame); dimensions.push([info.width, info.height]); },
        async finalize() { return new Uint8Array([1]); },
        async dispose() {},
      };
      const session = new RenderSession({ concurrency, engine: {
        init: () => engine.init(),
        createAdapters: (options) => ({ renderer: engine.createAdapters(options).renderer, encoder }),
        createParallelRenderers: (count, options) => engine.createParallelRenderers(count, options),
        dispose: () => engine.dispose(),
      } });
      try {
        await session.render(job);
        expect(dimensions.length).toBeGreaterThan(0);
        expect(dimensions.every(([width, height]) => width === 128 && height === 64)).toBe(true);
      } finally { await session.close(); }
    }
  }, 20_000);

  it("uses JPEG when requested, but alpha always forces PNG", async () => {
    const { renderer } = await fixture();
    try {
      await renderer.init({ width: 128, height: 64, format: "mp4", capture: { intermediate: "jpeg", jpegQuality: 95 } });
      const html = '<div style="width:128px;height:64px;background:blue"></div>';
      const jpeg = await renderer.rasterize(html);
      expect((await sharp(jpeg).metadata()).format).toBe("jpeg");
      const png = await renderer.rasterize(html, { alpha: true, intermediate: "jpeg" });
      expect((await sharp(png).metadata()).format).toBe("png");
    } finally { await renderer.dispose(); }
  });

  it.each(["script", "font"])("bounds a stalled %s without waiting for its network request to finish", async (kind) => {
    const { page, renderer } = await fixture();
    try {
      await stalled(page, "https://capture.test/stalled.*");
      await renderer.init({ width: 128, height: 64, format: "png", readiness: { timeoutMs: 250 },
        ...(kind === "font" ? { inlineCss: ["@font-face{font-family:Stalled;src:url('https://capture.test/stalled.woff2')}"] } : {}),
      });
      const html = kind === "font" ? '<span style="font-family:Stalled">Text</span>' : '<script src="https://capture.test/stalled.js"></script>';
      await expect(renderer.rasterize(html)).rejects.toThrow(/timeout/);
      expect(page.isClosed()).toBe(true);
    } finally { await renderer.dispose(); }
  });

  it("rejects Display-P3 instead of silently producing sRGB", async () => {
    const { renderer } = await fixture();
    try {
      await expect(renderer.init({ width: 128, height: 64, capture: { colorProfile: "display-p3" } })).rejects.toThrow(/sRGB only/);
    } finally { await renderer.dispose(); }
  });
});
