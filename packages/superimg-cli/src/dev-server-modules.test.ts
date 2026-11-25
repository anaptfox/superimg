import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "playwright";
import sharp from "sharp";
import { afterEach, expect, it, vi } from "vitest";
import { startDevServer, type DevServer } from "./dev-server.js";

const fixture = vi.hoisted(() => ({ root: "" }));
vi.mock("@superimg/core/bundler", async () => import(new URL("../../superimg-core/src/bundler/bundler.js", import.meta.url).pathname));
let server: DevServer | undefined;
afterEach(async () => { await server?.close(); server = undefined; if (fixture.root) await rm(fixture.root, { recursive: true, force: true }); });

it("serves library preview companion modules to a browser", async () => {
  fixture.root = await mkdtemp(join(tmpdir(), "superimg-library-modules-"));
  await writeFile(join(fixture.root, "package.json"), '{"type":"module"}');
  await writeFile(join(fixture.root, "helper.ts"), 'export const value = "library companion";');
  await writeFile(join(fixture.root, "reel.media.ts"), 'import { image, Text } from "@foxworth/superimg"; export async function load() { return (await import("./helper")).value; } export default image({ render: () => Text("ok") });');
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, { port: address.port, projectRoot: fixture.root });
  const origin = new URL(server.url).origin;
  const response = await fetch(`${origin}/api/videos/reel/template-bundle`);
  expect(response.status).toBe(200);
  const bundle = await response.json() as { moduleUrl: string };
  expect(bundle.moduleUrl).toMatch(/^\/api\/template-output\//);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/api/videos`);
    expect(await page.evaluate(`import(${JSON.stringify(new URL(bundle.moduleUrl, origin).href)}).then(module => module.load())`)).toBe("library companion");
  } finally { await browser.close(); }
}, 20000);

it("serves prepared native surface files and their dynamic companion in preview", async () => {
  fixture.root = await mkdtemp(join(tmpdir(), "superimg-library-native-"));
  await writeFile(join(fixture.root, "package.json"), '{"type":"module"}');
  await writeFile(join(fixture.root, "color.ts"), 'export const color = "red";');
  await writeFile(join(fixture.root, "world.ts"), 'export default { async create() { const { color } = await import("./color"); return color; } };');
  await writeFile(join(fixture.root, "reel.media.ts"), 'import { image, NativeSurface } from "@foxworth/superimg"; import world from "./world.ts?superimg-surface"; export default image({ render: () => NativeSurface({ id: "world", module: world, width: 10, height: 10, seconds: 0, data: {} }) });');
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(undefined, { port: address.port, projectRoot: fixture.root });
  const origin = new URL(server.url).origin;
  const response = await fetch(`${origin}/api/videos/reel/template-bundle`);
  expect(response.status).toBe(200);
  const bundle = await response.json() as { code: string; nativeModuleSets?: unknown };
  expect(bundle.nativeModuleSets).toBeUndefined();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/api/videos`);
    const value = await page.evaluate(async (code) => {
      const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
      try {
        const importModule = new Function("url", "return import(url)") as (url: string) => Promise<{ default: { config: { nativeModuleSets: Array<{ identity: string; moduleUrl: string }> }; create(): Promise<string> } }>;
        const media = (await importModule(url)).default;
        const prepared = media.config.nativeModuleSets[0];
        if (!prepared) throw new Error("Missing prepared native surface");
        const surface = prepared.moduleUrl.replace(`https://superimg-native.invalid/${prepared.identity}/`, `/api/template-output/${prepared.identity}/`);
        return await (await importModule(surface)).default.create();
      } finally { URL.revokeObjectURL(url); }
    }, bundle.code);
    expect(value).toBe("red");
  } finally { await browser.close(); }
}, 20000);

it("renders and recovers a source-authored native surface in the development Player", async () => {
  fixture.root = await mkdtemp(join(tmpdir(), "superimg-native-player-"));
  await writeFile(join(fixture.root, "package.json"), '{"type":"module"}');
  const world = join(fixture.root, "world.ts");
  const helper = join(fixture.root, "color.ts");
  const source = `import { color } from './color'; export default { create({ canvas }) { const ctx = canvas.getContext('2d'); return { sample() { ctx.fillStyle = color; ctx.fillRect(0, 0, 64, 64); }, dispose() {} }; } };`;
  const color = (value: string) => `export const color = '${value}';`;
  await writeFile(helper, color("red"));
  await writeFile(world, source);
  const entry = join(fixture.root, "reel.media.ts");
  await writeFile(entry, `import { image, NativeSurface } from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({ size: { width: 64, height: 64 }, nativeModuleSets: [world], render: () => NativeSurface({ id: 'world', module: world, width: 64, height: 64, seconds: 0, data: {} }) });`);
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  await new Promise<void>(resolve => listener.close(() => resolve()));
  server = await startDevServer(entry, { port: address.port, projectRoot: fixture.root });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(server.url);
    const canvas = page.frameLocator("iframe").locator("canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    const screenshotPixel = async () => {
      const { data, info } = await sharp(await canvas.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const offset = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
      return [...data.subarray(offset, offset + 3)];
    };
    await expect.poll(screenshotPixel, { timeout: 10000 }).toEqual([255, 0, 0]);
    await new Promise(resolve => setTimeout(resolve, 150));
    await writeFile(helper, color("blue"));
    await expect.poll(screenshotPixel, { timeout: 10000 }).toEqual([0, 0, 255]);
    await writeFile(world, "export default { broken: ;");
    await expect.poll(async () => (await fetch(new URL("/api/template-bundle", server!.url))).status, { timeout: 10000 }).toBe(500);
    expect(await canvas.count()).toBe(1);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => [...node.getContext("2d")!.getImageData(32, 32, 1, 1).data])).toEqual([0, 0, 255, 255]);
    await writeFile(helper, color("lime"));
    await writeFile(world, source);
    await expect.poll(screenshotPixel, { timeout: 10000 }).toEqual([0, 255, 0]);
    await rm(helper);
    await expect.poll(async () => (await fetch(new URL("/api/template-bundle", server!.url))).status, { timeout: 10000 }).toBe(500);
    expect(await canvas.evaluate((node: HTMLCanvasElement) => [...node.getContext("2d")!.getImageData(32, 32, 1, 1).data])).toEqual([0, 255, 0, 255]);
    await writeFile(helper, color("red"));
    await expect.poll(screenshotPixel, { timeout: 10000 }).toEqual([255, 0, 0]);
  } finally { await browser.close(); }
}, 45000);
