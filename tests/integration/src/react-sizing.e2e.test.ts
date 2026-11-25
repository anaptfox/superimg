import { createServer, type Server } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {} from "../../../packages/superimg/test-fixtures/player-size/react-sizing-consumer.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let browser: Browser;
let server: Server;
let origin: string;

describe("React resizing through the built public Player", { timeout: 60_000, hookTimeout: 60_000 }, () => {
  beforeAll(async () => {
    const bundle = await rolldown({
      input: join(repoRoot, "packages/superimg/test-fixtures/player-size/react-sizing-consumer.ts"),
      platform: "browser",
      transform: { define: { "process.env.NODE_ENV": JSON.stringify("production") } },
    });
    let app: string;
    try {
      const { output } = await bundle.generate({ format: "es", minify: true, codeSplitting: false });
      const chunk = output.find((file) => file.type === "chunk" && file.isEntry);
      if (!chunk || chunk.type !== "chunk") throw new Error("React sizing fixture has no entry");
      app = chunk.code;
      const inputs = Object.keys(chunk.modules).map((file) => relative(repoRoot, file).replaceAll("\\", "/"));
      const library = inputs.filter((file) => /^packages\/superimg(?:-|\/)/.test(file) && !file.includes("/test-fixtures/"));
      expect(library.length).toBeGreaterThan(0);
      expect(library.filter((file) => !file.includes("/dist/"))).toEqual([]);
    } finally { await bundle.close(); }
    server = createServer((request, response) => {
      response.setHeader("cache-control", "no-store");
      response.setHeader("content-type", request.url === "/app.js" ? "text/javascript" : "text/html");
      response.end(request.url === "/app.js" ? app : '<!doctype html><style>body{margin:20px;background:#edf1f2}#stage{width:800px;height:450px}</style><div id="stage"></div><script type="module" src="/app.js"></script>');
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
    if (server) await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Node keeps active fixture HTTP connections alive after browser teardown.
      server.closeAllConnections();
    });
  });

  it("preserves accepted frames, playback, and iframe identity across equal sizes and numeric resizes", async () => {
    const page = await browser.newPage({ viewport: { width: 860, height: 520 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      await page.goto(origin);
      await page.waitForFunction(() => window.__reactSizing?.state().loads === 1);
      const initial = await page.evaluate(() => window.__reactSizing.seek(17));
      expect(initial.runtime).toMatchObject({ width: 320, height: 180, currentFrame: 17, isPlaying: false });
      for (let index = 0; index < 3; index++) {
        const equal = await page.evaluate(() => window.__reactSizing.render({ width: 320, height: 180 }));
        expect(equal).toMatchObject({ playerId: initial.playerId, iframeId: initial.iframeId, iframeCount: 1, loads: 1, errors: [] });
        expect(equal.accepted).toEqual(initial.accepted);
      }

      await page.evaluate(() => window.__reactSizing.render({ width: 640, height: 360 }, "Resized"));
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().runtime?.width)).toBe(640);
      const resized = await page.evaluate(() => window.__reactSizing.state());
      expect(resized).toMatchObject({ playerId: initial.playerId, iframeId: initial.iframeId, iframeCount: 1, loads: 1, errors: [], runtime: { width: 640, height: 360, currentFrame: 17, isPlaying: false } });
      expect(resized.accepted!.revision).toBe(initial.accepted!.revision + 1);
      const frame = page.frameLocator("#stage iframe");
      expect(await frame.locator("#dimensions").isVisible()).toBe(true);
      const box = await page.locator("#stage iframe").boundingBox();
      expect(box?.width).toBeGreaterThan(600);
      expect(box?.height).toBeGreaterThan(300);
      expect(await frame.locator("#dimensions").innerText()).toBe("640 × 360");
      expect(await frame.locator("#label").innerText()).toBe("Resized");
      expect(await frame.locator("#frame").innerText()).toBe("Frame 17");

      const evidence = process.env.SUPERIMG_REACT_SIZING_EVIDENCE;
      if (evidence) {
        await mkdir(evidence, { recursive: true });
        await page.screenshot({ path: join(evidence, "react-resized.png") });
      }

      await page.evaluate(() => window.__reactSizing.render({ width: 666, height: 360 }));
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().errors.length)).toBe(1);
      const rejected = await page.evaluate(() => window.__reactSizing.state());
      expect(rejected.errors).toEqual(["Fixture rejected dimensions"]);
      expect(rejected.accepted).toEqual(resized.accepted);
      expect(rejected.runtime).toMatchObject({ width: 640, height: 360, currentFrame: 17 });
      expect(await frame.locator("#dimensions").innerText()).toBe("640 × 360");

      await page.evaluate(() => window.__reactSizing.play());
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().runtime?.currentFrame ?? 0)).toBeGreaterThan(17);
      await page.evaluate(() => window.__reactSizing.render({ width: 800, height: 450 }));
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().runtime?.width)).toBe(800);
      const playing = await page.evaluate(() => window.__reactSizing.state());
      expect(playing).toMatchObject({ playerId: initial.playerId, iframeId: initial.iframeId, loads: 1, runtime: { isPlaying: true } });
      expect(playing.runtime!.currentFrame).toBeGreaterThan(17);
      await page.evaluate(() => window.__reactSizing.pause());

      await page.evaluate(() => window.__reactSizing.render(null));
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().loads)).toBe(2);
      const automatic = await page.evaluate(() => window.__reactSizing.state());
      expect(automatic.runtime).toMatchObject({ width: 320, height: 180 });
      expect(automatic.playerId).not.toBe(initial.playerId);
      await page.evaluate(() => window.__reactSizing.render({ width: 800, height: 450 }));
      await expect.poll(() => page.evaluate(() => window.__reactSizing.state().loads)).toBe(3);
      const explicit = await page.evaluate(() => window.__reactSizing.state());
      expect(explicit.runtime).toMatchObject({ width: 800, height: 450 });
      expect(explicit.playerId).not.toBe(automatic.playerId);
      expect(explicit.iframeCount).toBe(1);
      expect(pageErrors).toEqual([]);
      expect(await page.evaluate(() => window.__reactSizing.unmount().iframeCount)).toBe(0);
      if (evidence) await writeFile(join(evidence, "react-sizing-results.json"), JSON.stringify({ initial, resized, rejected, playing, automatic, explicit, pageErrors }, null, 2));
    } finally { await page.close(); }
  });
});
