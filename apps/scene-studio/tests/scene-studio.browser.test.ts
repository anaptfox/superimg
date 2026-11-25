import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let server: ViteDevServer;
let browser: Browser;
let baseUrl: string;

beforeAll(async () => {
  server = await createServer({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("Scene Studio Vite server did not expose a TCP address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function openStudio(
  options: {
    width?: number;
    height?: number;
    reducedMotion?: "reduce" | "no-preference";
    trackViewTransitions?: boolean;
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 1440, height: options.height ?? 1100 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  const page = await context.newPage();
  if (options.trackViewTransitions) {
    await page.addInitScript(() => {
      type ViewTransitionOptions = {
        update: () => void | Promise<void>;
        types?: ReadonlyArray<string>;
      };
      type ViewTransitionDocument = Document & {
        startViewTransition?: (options: ViewTransitionOptions) => unknown;
      };
      const viewTransitionDocument = document as ViewTransitionDocument;
      const startViewTransition = viewTransitionDocument.startViewTransition?.bind(document);
      (window as Window & { __sceneStudioViewTransitionCount?: number })
        .__sceneStudioViewTransitionCount = 0;
      if (!startViewTransition) return;
      Object.defineProperty(document, "startViewTransition", {
        configurable: true,
        value(options: ViewTransitionOptions) {
          const sceneStudioWindow = window as Window & {
            __sceneStudioViewTransitionCount?: number;
          };
          sceneStudioWindow.__sceneStudioViewTransitionCount =
            (sceneStudioWindow.__sceneStudioViewTransitionCount ?? 0) + 1;
          return startViewTransition(options);
        },
      });
    });
  }
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await expect.poll(async () => ({
    ready: await page.locator(".live-dot.is-ready").count(),
    score: await page.locator("[data-testid=runtime-score]").textContent(),
    errors,
  }), { timeout: 20_000 }).toMatchObject({ ready: 1, errors: [] });
  const transport = page.locator(".artwork-player-surface iframe");
  await transport.waitFor({ timeout: 20_000 });
  await expect.poll(() => transport.count(), { timeout: 2_000 }).toBe(1);
  return { context, page, errors } satisfies {
    context: BrowserContext;
    page: Page;
    errors: string[];
  };
}

const art = (page: Page) => page.frameLocator(".artwork-player-surface iframe");

async function viewTransitionCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as Window & { __sceneStudioViewTransitionCount?: number })
      .__sceneStudioViewTransitionCount ?? 0,
  );
}

describe("Scene Studio in Chromium", () => {
  it("opens as a finished artwork backed by the semantic wallet graph", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await expect(page.title()).resolves.toContain("Living Canvas");
      await expect(page.locator("h1").textContent()).resolves.toBe("The Weight of a Choice");
      await expect(page.locator("[data-testid=artwork-player]").getAttribute("data-active-state"))
        .resolves.toBe("encounter");

      const countText = await page.locator("[data-testid=node-count]").textContent();
      expect(Number.parseInt(countText ?? "0", 10)).toBeGreaterThan(18);
      await art(page).locator('[data-si-node="wallet"]').waitFor();
      await art(page).locator('[data-si-node="money"]').waitFor();
      await art(page).locator('[data-si-node="family-photo"]').waitFor();
      await art(page).locator('[data-si-node="address"]').waitFor();
      await art(page).locator('[data-si-node="edition-label"]').waitFor();
      await art(page).locator('[data-si-node="runtime-mark"]').waitFor();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("moves through all six named states and keeps one screen narration active", async () => {
    const { context, page, errors } = await openStudio();
    try {
      for (const state of [
        "inventory",
        "temptation",
        "recognition",
        "return",
        "afterimage",
      ]) {
        await page.locator(`[data-state-id="${state}"]`).click();
        await page.locator(`[data-testid=artwork-player][data-active-state="${state}"]`).waitFor();
        const caption = art(page).locator(`[data-si-node="caption.${state}"]`);
        await expect.poll(
          () => caption.evaluate((node) => window.getComputedStyle(node).opacity),
          { timeout: 2_000 },
        ).toBe("1");
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("queries meaning and selects nodes through the real runtime", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await page.locator('[data-query-role="evidence"]').click();
      await expect.poll(() => page.locator("[data-testid=query-result]").textContent())
        .toContain("→ 3");
      await page.locator('[data-node-id="family-photo"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("family-photo");
      await expect(page.locator("[data-testid=runtime-score]").textContent())
        .resolves.toContain('scene.set("family-photo", { animation: { type: "pulse" } })');
      await art(page).locator('[data-si-node="family-photo"][data-si-animation="pulse"]').waitFor();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("uses React transitions for semantic selection and artwork navigation", async () => {
    const { context, page, errors } = await openStudio({ trackViewTransitions: true });
    try {
      await expect(page.evaluate(() => typeof document.startViewTransition)).resolves.toBe("function");
      const initialTransitions = await viewTransitionCount(page);

      await page.locator('[data-node-id="family-photo"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("family-photo");
      await expect.poll(() => viewTransitionCount(page)).toBeGreaterThan(initialTransitions);

      const selectionTransitions = await viewTransitionCount(page);
      await page.locator('[data-artwork-id="study-02"]').click();
      await page.locator(".live-dot.is-ready").waitFor({ timeout: 20_000 });
      await expect.poll(() => page.locator("h1").textContent()).toBe("Study02");
      await expect.poll(() => viewTransitionCount(page)).toBeGreaterThan(selectionTransitions);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("updates surfaces and editions in place without losing camera, meaning or selection", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await page.locator('[data-state-id="recognition"]').click();
      await page.locator('[data-testid=artwork-player][data-active-state="recognition"]').waitFor();
      const iframe = await page.locator(".artwork-player-surface iframe").elementHandle();
      const cameraBefore = await page.locator('[data-testid="camera-readout"]').textContent();
      await page.locator('[data-testid="camera-zoom-in"]').click();
      await expect.poll(() => page.locator('[data-testid="camera-readout"]').textContent()).not.toBe(cameraBefore);
      const camera = await page.locator('[data-testid="camera-readout"]').textContent();
      const selected = await page.locator('[data-testid="selected-node-id"]').textContent();
      const baselineIds = await art(page).locator("[data-si-node]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-si-node")),
      );

      for (const renderer of ["letterpress", "blueprint", "nocturne"]) {
        await page.locator(`[data-renderer-id="${renderer}"]`).click();
        await art(page).locator(`style[data-scene-renderer="${renderer}"]`).waitFor({
          state: "attached",
        });
        const ids = await art(page).locator("[data-si-node]").evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-si-node")),
        );
        expect(ids).toEqual(baselineIds);
        expect(await iframe!.evaluate(node => node.isConnected && node === document.querySelector(".artwork-player-surface iframe"))).toBe(true);
        expect(await page.locator('[data-testid="camera-readout"]').textContent()).toBe(camera);
        expect(await page.locator('[data-testid="selected-node-id"]').textContent()).toBe(selected);
        await expect(page.locator("[data-testid=artwork-player]").getAttribute("data-active-state"))
          .resolves.toBe("recognition");
      }
      await page.locator('[data-edition-id="square"]').click();
      await expect.poll(() => art(page).locator("#scale-wrapper").evaluate(node => ({
        width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight,
      }))).toEqual({ width: 1080, height: 1080 });
      expect(await iframe!.evaluate(node => node.isConnected && node === document.querySelector(".artwork-player-surface iframe"))).toBe(true);
      expect(await page.locator('[data-testid="camera-readout"]').textContent()).toBe(camera);
      expect(await page.locator('[data-testid="selected-node-id"]').textContent()).toBe(selected);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("moves world space while the screen-space caption remains fixed", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await page.locator('[data-state-id="recognition"]').click();
      await page.locator('[data-testid=artwork-player][data-active-state="recognition"]').waitFor();
      await page.waitForTimeout(850);
      const readRect = (selector: string) => art(page).locator(selector).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const walletBefore = await readRect('[data-si-node="wallet.shell"]');
      const captionBefore = await readRect('[data-si-node="caption"]');

      await page.locator("[data-testid=camera-zoom-in]").click();
      await page.waitForTimeout(900);
      const walletAfter = await readRect('[data-si-node="wallet.shell"]');
      const captionAfter = await readRect('[data-si-node="caption"]');

      expect(Math.abs(walletAfter.width - walletBefore.width)).toBeGreaterThan(4);
      expect(Math.abs(captionAfter.x - captionBefore.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(captionAfter.y - captionBefore.y)).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("plays a guided reading and yields immediately to manual direction", async () => {
    const { context, page, errors } = await openStudio();
    try {
      await page.locator(".guided-button").click();
      await expect(page.locator(".guided-button").getAttribute("aria-pressed"))
        .resolves.toBe("true");
      await page.locator('[data-testid=artwork-player][data-active-state="inventory"]')
        .waitFor({ timeout: 6_000 });

      await page.locator('[data-state-id="return"]').click();
      await expect(page.locator(".guided-button").getAttribute("aria-pressed"))
        .resolves.toBe("false");
      await page.waitForTimeout(4_000);
      await expect(page.locator("[data-testid=artwork-player]").getAttribute("data-active-state"))
        .resolves.toBe("return");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("is responsive, reduced-motion aware, and produces a substantial hero capture", async () => {
    const { context, page, errors } = await openStudio({
      width: 390,
      height: 844,
      reducedMotion: "reduce",
      trackViewTransitions: true,
    });
    try {
      await expect(page.locator(".guided-button").isDisabled()).resolves.toBe(true);
      expect(await viewTransitionCount(page)).toBe(0);
      await page.locator('[data-edition-id="portrait"]').click();
      await page.locator(".artwork-stage.edition-portrait").waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const screenshot = await page.screenshot({ fullPage: true });
      expect(screenshot.byteLength).toBeGreaterThan(60_000);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("commits reduced-motion artwork navigation without a native transition", async () => {
    const { context, page, errors } = await openStudio({
      reducedMotion: "reduce",
      trackViewTransitions: true,
    });
    try {
      expect(await viewTransitionCount(page)).toBe(0);
      await page.locator('[data-artwork-id="study-02"]').click();
      await expect.poll(() => page.locator("h1").textContent()).toBe("Study02");
      expect(await viewTransitionCount(page)).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("preserves the live scene when the reduced-motion preference changes", async () => {
    const { context, page, errors } = await openStudio({ trackViewTransitions: true });
    try {
      await page.locator('[data-state-id="recognition"]').click();
      await page.locator('[data-testid=artwork-player][data-active-state="recognition"]').waitFor();
      await page.locator('[data-node-id="family-photo"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("family-photo");
      await page.locator("[data-testid=camera-zoom-in]").click();
      await expect.poll(() => page.locator("[data-testid=camera-readout]").textContent())
        .not.toContain("z 1.00");
      await page.waitForTimeout(900);
      const cameraBefore = await page.locator("[data-testid=camera-readout]").textContent();
      const iframeBefore = await page.locator(".artwork-player-surface iframe").elementHandle();
      expect(iframeBefore).not.toBeNull();

      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect.poll(() => page.locator(".guided-button").isDisabled()).toBe(true);
      const initialTransitions = await viewTransitionCount(page);

      await expect(page.locator("[data-testid=artwork-player]").getAttribute("data-active-state"))
        .resolves.toBe("recognition");
      await expect(page.locator("[data-testid=selected-node-id]").textContent())
        .resolves.toBe("family-photo");
      await expect(page.locator("[data-testid=camera-readout]").textContent())
        .resolves.toBe(cameraBefore);
      await expect.poll(() => iframeBefore?.evaluate((node) => (
        node.isConnected && node === document.querySelector(".artwork-player-surface iframe")
      ))).toBe(true);

      await page.locator('[data-node-id="wallet"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("wallet");
      await expect.poll(() => viewTransitionCount(page)).toBe(initialTransitions);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps sample edition text and artwork permalinks across registry switch", async () => {
    const { context, page, errors } = await openStudio();
    try {
      // Living Canvas sample edition must not be overwritten by meta.title
      const editionText = await art(page)
        .locator('[data-si-node="edition-label"]')
        .evaluate((node) => node.textContent?.trim() ?? "");
      expect(editionText).toMatch(/Study No\. 01/i);
      expect(editionText.toLowerCase()).not.toContain(
        "the weight of a choice / the weight of a choice",
      );

      await expect
        .poll(() => new URL(page.url()).searchParams.get("artwork"))
        .toBe("living-canvas");

      await page.locator('[data-artwork-id="study-02"]').click();
      await page.locator(".live-dot.is-ready").waitFor({ timeout: 20_000 });
      await expect.poll(() => page.locator("h1").textContent()).toBe("Study02");
      // Artwork id updates in a React transition before its replacement player
      // document is necessarily ready. Bind the next interaction to that document.
      await art(page).locator(".scene-root").waitFor({ timeout: 20_000 });
      await expect
        .poll(() => new URL(page.url()).searchParams.get("artwork"))
        .toBe("study-02");

      // Act/surface churn must not drop the artwork param
      await page.locator('[data-state-id="hold"]').click();
      await page
        .locator('[data-testid=artwork-player][data-active-state="hold"]')
        .waitFor();
      expect(new URL(page.url()).searchParams.get("artwork")).toBe("study-02");

      const rootBg = await art(page)
        .locator(".scene-root")
        .evaluate((node) => getComputedStyle(node).backgroundColor);
      // Dark stage (#0b0d12 ≈ rgb(11,13,18)), not white/light default
      expect(rootBg).toMatch(/rgba?\(\s*11,\s*13,\s*18/);

      const captionPosition = await art(page)
        .locator(".art-caption")
        .first()
        .evaluate((node) => getComputedStyle(node).position);
      expect(captionPosition).toBe("absolute");

      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
