import { expect, it } from "vitest";
import { chromium } from "playwright";
import { preview } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

// Opt-in diagnostic run: existing browser suite remains unaffected.
it.skipIf(process.env.SUPERIMG_STUDIO_PERF !== "1")("records production Studio interaction baselines", async () => {
  const root = resolve(import.meta.dirname, "..");
  const output = process.env.SUPERIMG_STUDIO_PERF_DIR;
  if (!output) throw new Error("Set SUPERIMG_STUDIO_PERF_DIR to a fresh evidence directory");
  for (const name of ["baseline.json", "studio-0.png", "studio-1.png", "studio-2.png"]) {
    if (existsSync(resolve(output, name))) throw new Error(`Evidence already exists: ${resolve(output, name)}; choose a fresh SUPERIMG_STUDIO_PERF_DIR`);
  }
  mkdirSync(output, { recursive: true });
  const fingerprint = () => [...["../../packages/superimg-interactive/src/InteractivePlayer.tsx", "../../packages/superimg-interactive/src/scene-controller.ts", "tests/scene-studio.performance.browser.test.ts", "tests/scene-studio.performance.test.ts", "tests/scene-studio.performance.config.ts"], ...["dist", "src"].flatMap(directory => readdirSync(resolve(root, directory), { recursive: true, withFileTypes: true }).filter(item => item.isFile()).map(item => resolve(item.parentPath, item.name)))].map(path => ({ path, sha256: createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex") }));
  const beforeSources = fingerprint();
  if (process.env.SUPERIMG_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.SUPERIMG_BROWSERS_PATH;
  const server = await preview({ root, configFile: resolve(root, "vite.config.ts"), logLevel: "error", preview: { host: "127.0.0.1", port: 0 } });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const rows: unknown[] = [];
  const pageErrors: { run: number; operation: string; message: string }[] = [];
  let completed = false;
  let failure: string | undefined;
  const buildLogs = ["build-render.log", "build-studio.log", "check-final.log"].map(name => ({ name, ...(existsSync(resolve(output, "..", name)) ? { sha256: createHash("sha256").update(readFileSync(resolve(output, "..", name))).digest("hex"), modifiedAt: statSync(resolve(output, "..", name)).mtime.toISOString() } : { missing: true }) }));
  try {
    browser = await chromium.launch({ headless: true });
    for (let run = 0; run < 3; run++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      let currentOperation = "navigation";
      page.on("pageerror", error => pageErrors.push({ run, operation: currentOperation, message: error.message }));
      const address = server.httpServer.address();
      if (!address || typeof address === "string") throw new Error("Missing preview TCP address");
      const start = performance.now();
      await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: "domcontentloaded" });
      await page.locator(".live-dot.is-ready").waitFor();
      const art = page.frameLocator(".artwork-player-surface iframe");
      await art.locator('[data-si-node="wallet.shell"]').waitFor();
      rows.push({ run, operation: "navigation-to-ready-and-artwork", driverMs: performance.now() - start });
      for (const operation of ["act", "camera", "filter", "surface", "edition"] as const) {
        currentOperation = operation;
        const oldFrame = await page.locator(".artwork-player-surface iframe").elementHandle();
        const cameraBefore = await page.locator('[data-testid="camera-readout"]').textContent();
        const selectedBefore = await page.locator('[data-testid="selected-node-id"]').textContent();
        const bounds = () => art.locator('[data-si-node="wallet.shell"]').evaluate(node => {
          const rect = node.getBoundingClientRect();
          const caption = node.ownerDocument.querySelector('[data-si-node="caption"]')!.getBoundingClientRect();
          return { worldWidth: rect.width, captionX: caption.x, captionY: caption.y };
        });
        const boundsBefore = await bounds();
        const before = performance.now();
        if (operation === "act") {
          await page.locator('[data-state-id="recognition"]').click();
          await page.locator('[data-testid="artwork-player"][data-active-state="recognition"]').waitFor();
          await expect.poll(() => art.locator('[data-si-node="caption.recognition"]').evaluate(node => getComputedStyle(node).opacity)).toBe("1");
        } else if (operation === "camera") {
          await page.locator('[data-testid="camera-zoom-in"]').click();
          await expect.poll(() => page.locator('[data-testid="camera-readout"]').textContent()).not.toBe(cameraBefore);
          await expect.poll(async () => Math.abs((await bounds()).worldWidth - boundsBefore.worldWidth)).toBeGreaterThan(4);
          const after = await bounds();
          expect(Math.abs(after.captionX - boundsBefore.captionX)).toBeLessThanOrEqual(1);
          expect(Math.abs(after.captionY - boundsBefore.captionY)).toBeLessThanOrEqual(1);
        } else if (operation === "filter") {
          await page.locator('[data-query-role="evidence"]').click();
          await expect.poll(() => page.locator('[data-testid="query-result"]').textContent()).toContain("→ 3");
          expect(await page.locator('[data-node-id="family-photo"]').count()).toBe(1);
        } else {
          await page.locator(operation === "surface" ? '[data-renderer-id="letterpress"]' : '[data-edition-id="square"]').click();
          await page.locator(".live-dot.is-ready").waitFor();
          if (operation === "surface") await art.locator('style[data-scene-renderer="letterpress"]').waitFor({ state: "attached" });
          else {
            await expect(page.locator('[data-edition-id="square"]').getAttribute("aria-pressed")).resolves.toBe("true");
            await expect.poll(() => art.locator("#scale-wrapper").evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))).toEqual({ width: 1080, height: 1080 });
          }
          await expect.poll(() => art.locator('[data-si-node="caption.recognition"]').evaluate(node => getComputedStyle(node).opacity)).toBe("1");
        }
        const driverMs = performance.now() - before;
        const selectedAfter = await page.locator('[data-testid="selected-node-id"]').textContent();
        if (operation === "surface" || operation === "edition") {
          expect(selectedAfter).toBe(selectedBefore);
          expect(await oldFrame!.evaluate(node => node.isConnected && node === document.querySelector(".artwork-player-surface iframe"))).toBe(true);
          expect(await page.locator('[data-testid="camera-readout"]').textContent()).toBe(cameraBefore);
        }
        rows.push({ run, operation, driverMs, iframePreserved: await oldFrame?.evaluate(node => node.isConnected && node === document.querySelector(".artwork-player-surface iframe")), cameraBefore, cameraAfter: await page.locator('[data-testid="camera-readout"]').textContent(), selectedBefore, selectedAfter, boundsBefore, boundsAfter: await bounds(), state: await page.locator('[data-testid="artwork-player"]').getAttribute("data-active-state"), nodes: await page.locator('[data-testid="node-count"]').textContent() });
      }
      writeFileSync(resolve(output, `studio-${run}.png`), await page.screenshot({ fullPage: true }), { flag: "wx" });
      currentOperation = "act-dispatch-diagnostic";
      // Separate diagnostic action: inspect React's private fiber to observe the
      // real controller, without adding a production probe or timing this run.
      const attached = await page.evaluate(() => {
        const shell = document.querySelector(".studio-shell");
        if (!shell) return false;
        const key = Object.keys(shell).find(key => key.startsWith("__reactFiber$"));
        if (!key) return false;
        // Private React internals are diagnostic-only; failure stays explicit.
        let fiber = (shell as any)[key];
        while (fiber && !fiber.memoizedProps?.artwork) fiber = fiber.return;
        let hook = fiber?.memoizedState;
        while (hook) {
          const controller = hook.memoizedState?.current?.controller;
          if (controller?.scene) {
            const scene = controller.scene;
            const original = scene.use.bind(scene);
            (window as any).__studioPerfUses = [];
            scene.use = (state: string) => {
              (window as any).__studioPerfUses.push(state);
              return original(state);
            };
            return true;
          }
          hook = hook.next;
        }
        return false;
      });
      if (attached) {
        await page.locator('[data-state-id="return"]').click();
        await expect.poll(() => art.locator('[data-si-node="caption.return"]').evaluate(node => getComputedStyle(node).opacity)).toBe("1");
        // Observe the React requestedAct effect, after the visible condition.
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const calls = await page.evaluate(() => (window as any).__studioPerfUses);
        expect(calls).toEqual(["return"]);
        rows.push({ run, operation: "act-dispatch-diagnostic", calls, probe: "private React fiber hook controller; excluded from timing" });
      } else rows.push({ run, operation: "act-dispatch-diagnostic", observed: false, reason: "private React controller hook was unavailable" });
      await context.close();
    }
    expect(pageErrors).toEqual([]);
    completed = true;
  } catch (error) {
    failure = error instanceof Error ? error.stack : String(error);
    throw error;
  } finally {
    try {
      const afterSources = fingerprint();
      if (JSON.stringify(afterSources) !== JSON.stringify(beforeSources)) { completed = false; failure = "Source or artifact drift during run"; }
      writeFileSync(resolve(output, "baseline.json"), JSON.stringify({ completed, status: completed ? pageErrors.length ? "completed-with-pageerrors" : "completed" : "failed-partial", failure, pageErrors, buildLogs, browser: browser?.version(), viewport: [1440, 1100], reducedMotion: "reduce", mode: "production preview", cache: "3 fresh contexts in one browser process; navigation fetches not explicitly cache-disabled", boundary: "Playwright driver action through DOM semantic/readiness condition; includes automation/polling, not accepted-frame, paint or INP latency", rows, beforeSources, afterSources }, null, 2), { flag: "wx" });
      expect(afterSources).toEqual(beforeSources);
    } finally {
      try { await browser?.close(); }
      finally { await server.close(); }
    }
  }
}, 120_000);
