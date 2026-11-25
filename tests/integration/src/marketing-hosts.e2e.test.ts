import { createRequire } from "node:module";
import type { Server as HttpServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appsRoot = join(repoRoot, "examples", "apps");
const fixturesRoot = join(repoRoot, "tests", "integration", "fixtures", "marketing-hosts");
const timeout = 150_000;

type ViteServer = {
  httpServer: HttpServer | null;
  listen(): Promise<void>;
  close(): Promise<void>;
};
type ViteRuntime = { createServer(options: Record<string, unknown>): Promise<ViteServer> };
type Snapshot = {
  generation: number;
  totalFrames: number;
  presented: { frame: number; revision: number } | null;
  clock: { owner: string; isPlaying: boolean };
  readiness: { status: string; error: string | null };
  geometry: { surface: { x: number; y: number; width: number; height: number }; frame: unknown };
  disposed: boolean;
};

let browser: Browser;
const servers: ViteServer[] = [];
const pages = new Set<Page>();
const origins = new Map<string, string>();

async function startVite(appName: "lockup-pointer" | "lockup-scroll"): Promise<string> {
  const appRoot = join(appsRoot, appName);
  const requireFromApp = createRequire(join(appRoot, "package.json"));
  const viteEntry = requireFromApp.resolve("vite");
  const vite = await import(pathToFileURL(viteEntry).href) as ViteRuntime;
  const server = await vite.createServer({
    configFile: join(appRoot, "vite.config.ts"),
    root: appRoot,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error(`Vite did not expose an address for ${appName}`);
  return `http://127.0.0.1:${address.port}`;
}

async function open(appName: "lockup-pointer" | "lockup-scroll"): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  pages.add(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.goto(origins.get(appName)!, { waitUntil: "domcontentloaded" });
  await page.locator("#player iframe").waitFor({ state: "attached", timeout: 30_000 });
  await attachInspection(page);
  await page.waitForFunction(async () => {
    const inspection = (window as unknown as { superimgInspection?: { inspect(input: { surfaceId: string }): Promise<Snapshot> } }).superimgInspection;
    if (!inspection) return false;
    try { return (await inspection.inspect({ surfaceId: "marketing-lockup" })).presented !== null; }
    catch { return false; }
  }, null, { timeout: 30_000 });
  return { page, errors };
}

async function attachInspection(page: Page): Promise<void> {
  const fixture = pathToFileURL(join(fixturesRoot, "attach.ts")).pathname;
  await page.addScriptTag({
    type: "module",
    url: new URL(`/@fs${fixture}`, page.url()).href,
  });
  await page.waitForFunction(() => Boolean((window as unknown as { superimgInspection?: unknown }).superimgInspection));
}

async function inspect(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const inspection = (window as unknown as { superimgInspection: { inspect(input: { surfaceId: string }): Promise<Snapshot> } }).superimgInspection;
    return inspection.inspect({ surfaceId: "marketing-lockup" });
  });
}

async function seekAccepted(page: Page, frame: number): Promise<Snapshot> {
  return page.evaluate(async (selectedFrame) => {
    const inspection = (window as unknown as {
      superimgInspection: {
        inspect(input: { surfaceId: string }): Promise<Snapshot>;
        setMode(input: { surfaceId: string; expectedGeneration: number; mode: "inspection" }): Promise<Snapshot>;
        seek(input: { surfaceId: string; expectedGeneration: number; frame: number }): Promise<Snapshot>;
      };
    }).superimgInspection;
    const before = await inspection.inspect({ surfaceId: "marketing-lockup" });
    const held = await inspection.setMode({ surfaceId: "marketing-lockup", expectedGeneration: before.generation, mode: "inspection" });
    return inspection.seek({ surfaceId: "marketing-lockup", expectedGeneration: held.generation, frame: selectedFrame });
  }, frame);
}

async function resumeLive(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const inspection = (window as unknown as {
      superimgInspection: {
        inspect(input: { surfaceId: string }): Promise<Snapshot>;
        setMode(input: { surfaceId: string; expectedGeneration: number; mode: "live" }): Promise<Snapshot>;
      };
    }).superimgInspection;
    const current = await inspection.inspect({ surfaceId: "marketing-lockup" });
    await inspection.setMode({ surfaceId: "marketing-lockup", expectedGeneration: current.generation, mode: "live" });
  });
}

async function expectIframeArtwork(page: Page): Promise<void> {
  await expect.poll(() => page.locator("#player iframe").count()).toBe(1);
  const frame = page.frameLocator("#player iframe");
  await expect.poll(() => frame.locator("svg").count()).toBe(1);
  await expect.poll(() => frame.locator("svg path").count()).toBeGreaterThan(0);
  const box = await frame.locator("svg").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);
}

async function captureHeldPresentation(page: Page, accepted: Snapshot): Promise<void> {
  expect(accepted.presented).not.toBeNull();
  expect(accepted.readiness).toMatchObject({ status: "ready", error: null });
  expect(accepted.clock.owner).toBe("inspection");
  const png = await page.screenshot();
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const after = await inspect(page);
  expect(after.generation).toBe(accepted.generation);
  expect(after.presented).toEqual(accepted.presented);
  expect(after.readiness).toMatchObject({ status: "ready", error: null });
  expect(after.clock.owner).toBe("inspection");
}

async function disposePublicInspection(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as { disposeMarketingHost(): void }).disposeMarketingHost());
  await expect.poll(() => page.locator("#player iframe").count()).toBe(0);
  await expect.poll(() => page.evaluate(async () => {
    try {
      await (window as unknown as { superimgInspection: { inspect(input: { surfaceId: string }): Promise<Snapshot> } }).superimgInspection.inspect({ surfaceId: "marketing-lockup" });
      return "still-mounted";
    } catch (error) { return (error as { code?: string }).code ?? "unknown-error"; }
  })).toBe("DISPOSED");
}

async function reloadAndReattach(page: Page): Promise<Snapshot> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#player iframe").waitFor({ state: "attached", timeout: 30_000 });
  await attachInspection(page);
  await page.waitForFunction(async () => {
    const inspection = (window as unknown as { superimgInspection?: { inspect(input: { surfaceId: string }): Promise<Snapshot> } }).superimgInspection;
    if (!inspection) return false;
    try { return (await inspection.inspect({ surfaceId: "marketing-lockup" })).presented !== null; }
    catch { return false; }
  }, null, { timeout: 30_000 });
  return inspect(page);
}

describe("actual marketing lockup browser hosts", { timeout, hookTimeout: timeout }, () => {
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const [pointer, scroll] = await Promise.all([startVite("lockup-pointer"), startVite("lockup-scroll")]);
    origins.set("lockup-pointer", pointer);
    origins.set("lockup-scroll", scroll);
  }, timeout);

  afterAll(async () => {
    await Promise.all([...pages].map((page) => page.close().catch(() => undefined)));
    await browser?.close();
    await Promise.all(servers.map(async (server) => {
      server.httpServer?.closeAllConnections();
      await server.close();
    }));
  }, timeout);

  it("drives the real pointer host, responds to resize and reduced motion, then disposes and reloads", async () => {
    const { page, errors } = await open("lockup-pointer");
    try {
      const initial = await inspect(page);
      expect(initial.clock.owner).toBe("pointer");
      const held = await seekAccepted(page, Math.floor(initial.totalFrames / 2));
      expect(held).toMatchObject({ presented: { frame: Math.floor(initial.totalFrames / 2) }, clock: { owner: "inspection", isPlaying: false }, readiness: { status: "ready", error: null } });
      await expectIframeArtwork(page);
      await captureHeldPresentation(page, held);
      await resumeLive(page);

      const initialWidth = (await inspect(page)).geometry.surface.width;
      const bounds = await page.locator("#player").boundingBox();
      expect(bounds).not.toBeNull();
      await page.mouse.move(bounds!.x + bounds!.width * 0.78, bounds!.y + bounds!.height / 2);
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBeGreaterThan(initial.totalFrames / 2);
      expect((await inspect(page)).clock.owner).toBe("pointer");

      await page.setViewportSize({ width: 560, height: 720 });
      await expect.poll(async () => (await inspect(page)).geometry.surface.width, { timeout: 10_000 }).toBeLessThan(initialWidth);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBe(0);
      const reducedBounds = await page.locator("#player").boundingBox();
      await page.mouse.move(reducedBounds!.x + reducedBounds!.width * 0.9, reducedBounds!.y + reducedBounds!.height / 2);
      await page.waitForTimeout(150);
      expect((await inspect(page)).presented?.frame).toBe(0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.mouse.move(reducedBounds!.x + reducedBounds!.width * 0.75, reducedBounds!.y + reducedBounds!.height / 2);
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBeGreaterThan(0);

      await disposePublicInspection(page);
      const reloaded = await reloadAndReattach(page);
      expect(reloaded.presented).not.toBeNull();
      await expectIframeArtwork(page);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      pages.delete(page);
    }
  }, timeout);

  it("scroll-seeks the real sticky host, responds to resize and reduced motion, then disposes and reloads", async () => {
    const { page, errors } = await open("lockup-scroll");
    try {
      const initial = await inspect(page);
      expect(initial.clock.owner).toBe("scroll");
      const held = await seekAccepted(page, Math.floor(initial.totalFrames / 3));
      expect(held).toMatchObject({ presented: { frame: Math.floor(initial.totalFrames / 3) }, clock: { owner: "inspection", isPlaying: false }, readiness: { status: "ready", error: null } });
      await expectIframeArtwork(page);
      await captureHeldPresentation(page, held);
      await resumeLive(page);

      const initialHeight = (await inspect(page)).geometry.surface.height;
      await page.setViewportSize({ width: 1100, height: 650 });
      await expect.poll(async () => (await inspect(page)).geometry.surface.height, { timeout: 10_000 }).toBeLessThan(initialHeight);
      const scrollTarget = await page.evaluate(() => {
        const section = document.querySelector<HTMLElement>(".story")!;
        const surface = document.querySelector<HTMLElement>("#player")!;
        return section.offsetTop + (section.offsetHeight - surface.offsetHeight) * 0.68;
      });
      await page.evaluate((top) => window.scrollTo(0, top), scrollTarget);
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBeGreaterThan(initial.totalFrames / 2);
      expect((await inspect(page)).clock.owner).toBe("scroll");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBe(0);
      await page.evaluate((top) => window.scrollTo(0, top + 250), scrollTarget);
      await page.waitForTimeout(150);
      expect((await inspect(page)).presented?.frame).toBe(0);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await expect.poll(async () => (await inspect(page)).presented?.frame ?? -1, { timeout: 10_000 }).toBeGreaterThan(initial.totalFrames / 2);

      await disposePublicInspection(page);
      const reloaded = await reloadAndReattach(page);
      expect(reloaded.presented).not.toBeNull();
      await expectIframeArtwork(page);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      pages.delete(page);
    }
  }, timeout);
});
