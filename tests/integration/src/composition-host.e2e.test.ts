import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlayerPresentation } from "@foxworth/superimg/player";
import type { ProgramActionEvent } from "@foxworth/superimg/player/program";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const fixture = join(repoRoot, "tests/integration/fixtures/composition/presentation-app.ts");

let browser: Browser;
let server: Server;
let origin = "";
let root = "";
let files: Set<string>;

describe("retained composition browser host", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "superimg-composition-host-"));
    const bundle = await rolldown({ input: fixture, platform: "browser" });
    try {
      const result = await bundle.write({ format: "es", dir: root, entryFileNames: "app.js", codeSplitting: false });
      if (!result.output.some(item => item.type === "chunk" && item.isEntry && item.fileName === "app.js")) throw new Error("Composition fixture did not produce app.js");
      files = new Set(result.output.map(item => item.fileName));
    } finally {
      await bundle.close();
    }
    await writeFile(join(root, "index.html"), `<!doctype html><style>body{margin:0}#travel{height:1800px}#player{position:sticky;top:0;width:320px;height:180px}#controls{position:fixed;right:8px;bottom:8px;z-index:1}</style><section id="travel"><div id="player"></div></section><div id="controls"><button id="branch">branch</button><button id="advanced">advanced</button><button id="direct">direct</button><button id="lesson">lesson</button></div><script type="module" src="/app.js"></script>`);
    server = createServer(async (request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname.slice(1) || "index.html";
      if (path !== "index.html" && !files.has(path)) { response.statusCode = 404; response.end(); return; }
      response.setHeader("content-type", path.endsWith(".js") ? "text/javascript" : "text/html");
      response.end(await readFile(join(root, path)));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
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
    await rm(root, { recursive: true, force: true });
  });

  it("navigates a named route and scroll-seeks the single retained timeline in Chromium", async () => {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    for (const path of files) if (path !== "app.js" && path.endsWith(".js")) {
      const response = await page.request.get(`${origin}/${path}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/javascript");
    }
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin);
    await page.waitForFunction(() => document.body.dataset.ready !== undefined);
    const readiness = await page.locator("body").evaluate((body) => ({
      ready: body.dataset.ready,
      error: body.dataset.error,
    }));
    const diagnostic = await page.evaluate(() => window.__compositionAcceptance.diagnostic());
    expect(readiness.ready, `${readiness.error}\n${JSON.stringify(diagnostic)}`).toBe("success");
    await expect.poll(() => state(page).then((value) => value.preparedLeafPaths)).toEqual([
      "intro", "branch/basic", "outro", "direct", "lesson",
    ]);
    // The player paints into a same-origin iframe. Assert actual browser
    // output, not only the host session's bookkeeping.
    const frame = page.frameLocator("#player iframe");
    await expect.poll(() => frame.locator("body").innerText()).toContain("INTRO:0");
    await page.locator("#branch").click();
    await expect.poll(() => state(page).then((value) => value.currentId)).toBe("branch");
    await expect.poll(() => frame.locator("body").innerText()).toContain("BASIC:0");
    await page.locator("#advanced").click();
    await expect.poll(() => state(page).then((value) => value.session.routes.branch)).toBe("advanced");
    await expect.poll(() => frame.locator("body").innerText()).toContain("ADVANCED:0");
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect.poll(() => state(page).then((value) => value.currentFrame)).toBeGreaterThan(10);
    await expect.poll(() => state(page).then((value) => value.currentId)).toBe("branch");
    await expect.poll(() => frame.locator("body").innerText()).toContain("ADVANCED:");
    // Scroll owns the clock while it is moving. Return to a stable position
    // before testing an explicit host seek to a different named part.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => state(page).then((value) => value.currentFrame)).toBe(0);
    await page.locator("#direct").click();
    await expect.poll(() => state(page).then((value) => value.currentId)).toBe("direct");
    const directVideo = frame.locator("video");
    await expect.poll(() => directVideo.count()).toBe(1);
    await expect.poll(() => directVideo.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
    expect(await directVideo.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBe(0);
    // Decode the browser's displayed video frame. A ready video element alone
    // would not prove that caller-owned bytes reached the native clip surface.
    const directPixel = await directVideo.evaluate((element) => {
      const video = element as HTMLVideoElement;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(video, 0, 0);
      const [r, g, b] = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      return { r, g, b };
    });
    expect(directPixel.r).toBeGreaterThan(200);
    expect(directPixel.g).toBeLessThan(50);
    expect(directPixel.b).toBeGreaterThan(100);
    await page.locator("#lesson").click();
    await expect.poll(() => state(page).then((value) => value.currentId)).toBe("lesson");
    await expect.poll(() => frame.locator("body").innerText()).toContain("Accept");
    const accepted = (await state(page)).presentation;
    await frame.locator("#accept").click();
    await expect.poll(() => state(page).then((value) => value.actions)).toHaveLength(1);
    await expect.poll(() => state(page).then((value) => value.actions[0])).toMatchObject({
      path: "lesson", action: "accept", nodeId: "accept", frame: accepted.accepted!.frame,
      presentation: { generation: accepted.generation, revision: accepted.accepted!.revision, frame: accepted.accepted!.frame, sceneId: "lesson" },
    });
    await page.evaluate(() => window.__compositionAcceptance.setScene("lesson", { state: "selected" }));
    await expect.poll(() => state(page).then((value) => value.session.interactive.lesson?.activeState)).toBe("selected");
    expect(errors).toEqual([]);
    await page.evaluate(() => window.__compositionAcceptance.dispose());
    await page.close();
  });
});

interface CompositionState {
  currentFrame: number;
  currentId: string | null;
  preparedLeafPaths: string[];
  presentation: PlayerPresentation;
  actions: ProgramActionEvent[];
  session: { routes: Record<string, string>; interactive: Record<string, { activeState?: string }> };
}

async function state(page: import("playwright").Page): Promise<CompositionState> {
  return page.evaluate(() => window.__compositionAcceptance.state());
}

declare global {
  interface Window {
    __compositionAcceptance: {
      state(): CompositionState;
      diagnostic(): unknown;
      setScene(path: string, scene: unknown): Promise<void>;
      dispose(): void;
    };
  }
}
