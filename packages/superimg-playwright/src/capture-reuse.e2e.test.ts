import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { PlaywrightRasterizer } from "./adapters.js";
import { applyBrowsersDirectory } from "./runtime-path.js";
let browser: Browser;
beforeAll(async () => { applyBrowsersDirectory(); browser = await chromium.launch({ headless: true, args: ["--force-color-profile=srgb"] }); });
afterAll(async () => { await browser?.close(); });
async function fixture() {
 const page = await browser.newPage({ viewport: { width: 80, height: 40 } });
 const stages: string[] = [];
 const renderer = new PlaywrightRasterizer(page, true, undefined, { onTiming: event => stages.push(event.stage) });
 await renderer.init({ width: 80, height: 40, format: "png", capture: { dpr: 1, cache: true } });
 return { page, renderer, captures: () => stages.filter(stage => stage === "capture").length };
}
const red = '<div style="width:80px;height:40px;background:red"></div>';
async function pixel(bytes: Buffer) { return [...(await sharp(bytes).ensureAlpha().raw().toBuffer()).subarray(0, 4)]; }
describe("prepared static frame reuse", () => {
 it("carries script taint from a non-cache job into a later pooled-page renderer", async () => {
  const page = await browser.newPage({viewport:{width:80,height:40}});
  const first = new PlaywrightRasterizer(page);
  await first.init({width:80,height:40,format:'png'});
  await first.rasterize('<script>window.setTimeout(()=>{},0)</script>'+red);
  await first.dispose();
  let captures=0;const second=new PlaywrightRasterizer(page,true,undefined,{onTiming:event=>{if(event.stage==='capture')captures++;}});
  try{await second.init({width:80,height:40,format:'png',capture:{cache:true}});await second.rasterize(red);await second.rasterize(red);expect(captures).toBe(2);}
  finally{await second.dispose();}
 });
 it("invalidates on a replacement FontFace with identical descriptors", async () => {
  const f = await fixture();try {
   const bytes=readFileSync(new URL('../../superimg-core/assets/fonts/Inter-400.ttf',import.meta.url)).toString('base64');
   const source=`url(data:font/ttf;base64,${bytes})`;
   await f.page.evaluate(async src => { const font = new FontFace('ReuseFixture',src);await font.load();document.fonts.add(font); },source);
   const html='<span style="font:20px ReuseFixture">Test</span>';
   await f.renderer.rasterize(html);await f.renderer.rasterize(html);expect(f.captures()).toBe(1);
   await f.page.evaluate(async src => { document.fonts.clear();const font = new FontFace('ReuseFixture',src);await font.load();document.fonts.add(font); },source);
   await f.renderer.rasterize(html);expect(f.captures()).toBe(2);
  } finally { await f.renderer.dispose(); }
 });
 it("invalidates capture encoding and reinitialization", async () => {
  const f = await fixture();try {
   await f.renderer.rasterize(red);await f.renderer.rasterize(red,{alpha:true});expect(f.captures()).toBe(2);
   await f.renderer.init({width:80,height:40,format:'png',capture:{cache:true,dpr:1}});
   await f.renderer.rasterize(red);expect(f.captures()).toBe(3);
  } finally { await f.renderer.dispose(); }
 });
 it("reuses only after readiness and owns returned bytes", async () => {
  const f = await fixture();try {
   const first = await f.renderer.rasterize(red, { time: 0 }); const expected = Buffer.from(first);first.fill(0);
   const second = await f.renderer.rasterize(red, { time: 1 }); expect(second).toEqual(expected);expect(f.captures()).toBe(1);
   second.fill(0);expect(await f.renderer.rasterize(red)).toEqual(expected);expect(f.captures()).toBe(1);
  } finally { await f.renderer.dispose(); }
 });
 it("observes same-markup CSSOM and geometry changes", async () => {
  const f = await fixture();try {
   const html='<div class="box" style="width:80px;height:40px"></div>';
   await f.page.addStyleTag({ content: '.box{background:red}' });
   expect(await pixel(await f.renderer.rasterize(html))).toEqual([255,0,0,255]);
   await f.page.evaluate(() => { const sheet = [...document.styleSheets].at(-1)!; sheet.insertRule('.box{background:blue}', sheet.cssRules.length); });
   expect(await pixel(await f.renderer.rasterize(html))).toEqual([0,0,255,255]);expect(f.captures()).toBe(2);
  } finally { await f.renderer.dispose(); }
 });
 it("supports local SVG gradients but never image resources", async () => {
  const f = await fixture();try {
   const svg='<svg width="80" height="40"><defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="80" height="40" fill="url(#g)"/></svg>';
   await f.renderer.rasterize(svg);await f.renderer.rasterize(svg);expect(f.captures()).toBe(1);
   const image='<div style="width:80px;height:40px;background-image:url(\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E\')"></div>';
   await f.renderer.rasterize(image);await f.renderer.rasterize(image);expect(f.captures()).toBe(3);
  } finally { await f.renderer.dispose(); }
 });
 it("does not reuse canvas, authored scripts, or later frames of a tainted lease", async () => {
  const f = await fixture();try {
   const html='<script>window.setTimeout(()=>{},0);document.currentScript?.remove()</script>'+red;
   await f.renderer.rasterize(html);await f.renderer.rasterize(red);await f.renderer.rasterize(red);expect(f.captures()).toBe(3);
   await f.renderer.init({ width:80,height:40,format:'png',capture:{cache:true,dpr:1} });
   const canvas='<canvas width="80" height="40"></canvas>';
   await f.renderer.rasterize(canvas);await f.renderer.rasterize(canvas);expect(f.captures()).toBe(5);
   await f.renderer.rasterize(red);await f.renderer.rasterize(red);expect(f.captures()).toBe(7);
  } finally { await f.renderer.dispose(); }
 });
 it("does not reuse CSS animation or serve cached pixels after cancellation", async () => {
  const f = await fixture();try {
   const animation='<style>@keyframes color{from{background:red}to{background:blue}}</style><div style="width:80px;height:40px;animation:color 1s both"></div>';
   await f.renderer.rasterize(animation);await f.renderer.rasterize(animation);expect(f.captures()).toBe(2);
   await f.renderer.rasterize(red);const controller=new AbortController();controller.abort();
   await expect(f.renderer.rasterize(red,{signal:controller.signal})).rejects.toBeDefined();
  } finally { await f.renderer.dispose(); }
 });
});
