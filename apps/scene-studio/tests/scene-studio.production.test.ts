import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { preview, type PreviewServer } from "vite";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = resolve(appRoot, "dist/index.html");
let server: PreviewServer;
let browser: Browser;
let baseUrl: string;

beforeAll(async () => {
  if (!existsSync(distIndex)) {
    throw new Error(`Scene Studio production artifact is missing: ${distIndex}`);
  }
  server = await preview({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
    logLevel: "error",
    preview: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Scene Studio preview server did not expose a TCP address");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function openBuiltStudio(
  options: {
    reducedMotion?: "reduce" | "no-preference";
    trackViewTransitions?: boolean;
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  const page = await context.newPage();
  if (options.trackViewTransitions) {
    await page.addInitScript(() => {
      type ViewTransitionOptions = { update: () => void | Promise<void> };
      type ViewTransitionDocument = Document & {
        startViewTransition?: (options: ViewTransitionOptions) => unknown;
      };
      const transitionDocument = document as ViewTransitionDocument;
      const startViewTransition = transitionDocument.startViewTransition?.bind(document);
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
  await page.locator(".live-dot.is-ready").waitFor({ timeout: 20_000 });
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

async function expectStudy02Ready(page: Page) {
  await expect.poll(() => page.locator("h1").textContent()).toBe("Study02");
  await page.locator(".live-dot.is-ready").waitFor({ timeout: 20_000 });
  await art(page).locator(".scene-root").waitFor({ timeout: 20_000 });
  await expect(art(page).locator(".scene-root").evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  )).resolves.toMatch(/rgba?\(\s*11,\s*13,\s*18/);
}

describe("built Scene Studio in Chromium", () => {
  it("runs Study02 from the built production artifact with native transitions", async () => {
    const { context, page, errors } = await openBuiltStudio({ trackViewTransitions: true });
    try {
      const initialTransitions = await viewTransitionCount(page);
      await page.locator('[data-node-id="family-photo"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("family-photo");
      await expect.poll(() => viewTransitionCount(page)).toBeGreaterThan(initialTransitions);

      const selectionTransitions = await viewTransitionCount(page);
      await page.locator('[data-artwork-id="study-02"]').click();
      await expectStudy02Ready(page);
      await expect.poll(() => viewTransitionCount(page)).toBeGreaterThan(selectionTransitions);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it("keeps built Study02 navigation and selection transition-free for reduced motion", async () => {
    const { context, page, errors } = await openBuiltStudio({
      reducedMotion: "reduce",
      trackViewTransitions: true,
    });
    try {
      expect(await viewTransitionCount(page)).toBe(0);
      await page.locator('[data-artwork-id="study-02"]').click();
      await expectStudy02Ready(page);
      expect(await viewTransitionCount(page)).toBe(0);

      await page.locator('[data-node-id="caption.hold"]').click();
      await expect.poll(() => page.locator("[data-testid=selected-node-id]").textContent())
        .toBe("caption.hold");
      expect(await viewTransitionCount(page)).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
});
