import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixture = join(repoRoot, "tests/integration/fixtures/story-host/story-host.ts");

type StoryState = {
  sourceIds: string[];
  manual: { ids: string[]; currentId: string | null; generation: number; frame: number; routes: Record<string, string>; leaves: string[]; sameProgram: boolean; nestedProgramRetained: boolean };
  timeline: { generation: number; frame: number; routes: Record<string, string>; leaves: string[]; sameProgram: boolean };
  selections: { manual: string; timeline: string };
};

let browser: Browser;
let server: Server;
let origin = "";
let tempRoot = "";
const pages = new Set<Page>();
let files: Set<string>;

describe("retained story browser host", { timeout: 90_000, hookTimeout: 90_000 }, () => {
  beforeAll(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "superimg-story-host-"));
    const bundle = await rolldown({ input: fixture, platform: "browser" });
    try {
      const result = await bundle.write({ format: "es", dir: tempRoot, entryFileNames: "app.js", codeSplitting: false });
      if (!result.output.some(item => item.type === "chunk" && item.isEntry && item.fileName === "app.js")) throw new Error("Story fixture did not produce app.js");
      files = new Set(result.output.map(item => item.fileName));
    } finally {
      await bundle.close();
    }
    await writeFile(join(tempRoot, "index.html"), `<!doctype html>
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>
        *{box-sizing:border-box}body{margin:0;background:#101820;color:#f4f1ea;font:16px/1.5 system-ui,sans-serif}
        main{width:min(100% - 32px,900px);margin:24px auto}section{margin:24px 0;padding:16px;border:1px solid #52645e}
        .player{position:relative;width:min(80vw,640px);aspect-ratio:16/9;background:#183a43;overflow:hidden}
        .travel{height:1800px;position:relative}.sticky{position:sticky;top:0;padding-top:12px}
        nav{display:flex;gap:8px;align-items:center;margin:12px 0}button{padding:8px 12px}
      </style>
      <main>
        <h1>Retained story host</h1>
        <section aria-labelledby="manual-title">
          <h2 id="manual-title">Manual pages</h2>
          <div id="manual" class="player"></div>
          <nav><button id="manual-previous" type="button">Previous</button><output id="manual-status" aria-live="polite"></output><button id="manual-next" type="button">Next</button><button id="manual-highlight" type="button">Use highlight route</button></nav>
        </section>
        <section class="travel" aria-labelledby="timeline-title">
          <h2 id="timeline-title">Timed story</h2>
          <div id="timeline" class="player sticky"></div>
          <nav><button id="timeline-highlight" type="button">Replace with highlight route</button></nav>
        </section>
      </main>
      <script type="module" src="/app.js"></script>`);
    server = createServer(async (request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname.slice(1) || "index.html";
      if (path !== "index.html" && !files.has(path)) { response.statusCode = 404; response.end(); return; }
      response.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : "text/html");
      response.end(await readFile(join(tempRoot, path)));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await Promise.all([...pages].map((page) => page.close().catch(() => undefined)));
    await browser?.close();
    if (server) await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  it("uses one retained Program for manual pages and timed delivery across route replacement, resize, reduced motion and disposal", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    pages.add(page);
    for (const path of files) if (path !== "app.js" && path.endsWith(".js")) {
      const response = await page.request.get(`${origin}/${path}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/javascript");
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => document.body.dataset.manualReady === "success" && document.body.dataset.timelineReady === "success");

    const initial = await state(page);
    expect(initial.sourceIds).toEqual(["opening", "chapter"]);
    expect(initial.manual).toMatchObject({ ids: ["opening", "chapter"], currentId: "opening", sameProgram: true });
    expect(initial.timeline).toMatchObject({
      sameProgram: true,
      routes: { "chapter/decision": "standard" },
      leaves: ["opening", "chapter/decision/standard", "chapter/ending"],
    });

    const manualFrame = page.frameLocator("#manual iframe");
    const timelineFrame = page.frameLocator("#timeline iframe");
    await expect.poll(() => manualFrame.locator("body").innerText()).toContain("OPENING:0");
    await expect.poll(() => timelineFrame.locator("body").innerText()).toContain("OPENING:0");

    await page.locator("#manual-next").click();
    await expect.poll(() => state(page).then((value) => value.manual.currentId)).toBe("chapter");
    await expect.poll(() => manualFrame.locator("body").innerText()).toContain("STANDARD:");
    expect(await state(page)).toMatchObject({
      manual: {
        routes: { decision: "standard" },
        nestedProgramRetained: true,
        leaves: ["decision/standard", "ending"],
      },
    });

    const manualGeneration = (await state(page)).manual.generation;
    await page.locator("#manual-highlight").click();
    await expect.poll(() => state(page).then((value) => value.manual.generation)).toBe(manualGeneration + 1);
    await expect.poll(() => manualFrame.locator("body").innerText()).toContain("HIGHLIGHT:0");
    expect(await state(page)).toMatchObject({
        manual: { ids: ["opening", "chapter"], currentId: "chapter", generation: manualGeneration + 1, routes: { decision: "highlight" }, nestedProgramRetained: true },
      selections: { manual: "highlight" },
    });

    const beforeTimelineReplace = (await state(page)).timeline;
    await page.locator("#timeline-highlight").click();
    await expect.poll(() => state(page).then((value) => value.timeline.generation)).toBe(beforeTimelineReplace.generation + 1);
    await expect.poll(() => timelineFrame.locator("body").innerText()).toContain("OPENING:0");
    expect(await state(page)).toMatchObject({
      timeline: {
        generation: beforeTimelineReplace.generation + 1,
        routes: { "chapter/decision": "highlight" },
        leaves: ["opening", "chapter/decision/highlight", "chapter/ending"],
        sameProgram: true,
      },
      selections: { timeline: "highlight" },
    });

    const firstBounds = await page.locator("#timeline iframe").boundingBox();
    expect(firstBounds).not.toBeNull();
    await page.setViewportSize({ width: 620, height: 720 });
    await expect.poll(async () => (await page.locator("#timeline iframe").boundingBox())?.width ?? 0).toBeLessThan(firstBounds!.width);

    await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>("#timeline")!;
      const section = surface.parentElement!;
      window.scrollTo(0, section.offsetTop + (section.offsetHeight - surface.offsetHeight) * 0.5);
    });
    await expect.poll(() => state(page).then((value) => value.timeline.frame), { timeout: 10_000 }).toBeGreaterThan(10);
    await expect.poll(() => timelineFrame.locator("body").innerText()).toContain("HIGHLIGHT:");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect.poll(() => state(page).then((value) => value.timeline.frame), { timeout: 10_000 }).toBe(0);
    await page.evaluate(() => {
      const surface = document.querySelector<HTMLElement>("#timeline")!;
      const section = surface.parentElement!;
      window.scrollTo(0, section.offsetTop + (section.offsetHeight - surface.offsetHeight) * 0.9);
    });
    await page.waitForTimeout(150);
    expect((await state(page)).timeline.frame).toBe(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect.poll(() => state(page).then((value) => value.timeline.frame), { timeout: 10_000 }).toBeGreaterThan(10);

    await page.evaluate(() => { window.__storyHost.disposeManual(); window.__storyHost.disposeTimeline(); });
    await expect.poll(() => page.locator("#manual iframe").count()).toBe(0);
    await expect.poll(() => page.locator("#timeline iframe").count()).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
    pages.delete(page);
  }, 90_000);
});

async function state(page: Page): Promise<StoryState> {
  return page.evaluate(() => window.__storyHost.inspect());
}

declare global {
  interface Window {
    __storyHost: {
      inspect(): StoryState;
      replaceManual(selection: string): Promise<string>;
      replaceTimeline(selection: string): Promise<string>;
      disposeManual(): void;
      disposeTimeline(): void;
    };
  }
}
