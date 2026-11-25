import { createServer, type Server, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const heldFonts = new Map<string, Set<ServerResponse>>();
let browser: Browser;
let server: Server;
let origin = "";
let root = "";
let font: Buffer;

describe("interactive foundation through built public entries", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "superimg-interactive-foundation-"));
    const bundle = await rolldown({
      input: join(repoRoot, "tests/integration/fixtures/interactive-foundation/app.ts"),
      platform: "browser",
    });
    let inputs: string[];
    try {
      const { output } = await bundle.generate({ format: "es", minify: true, codeSplitting: false });
      const app = output.find((file) => file.type === "chunk" && file.isEntry);
      if (!app || app.type !== "chunk") throw new Error("Interactive fixture did not produce an entry");
      inputs = Object.keys(app.modules).map((file) => relative(repoRoot, file).replaceAll("\\", "/"));
      await writeFile(join(root, "app.js"), app.code);
      await writeFile(join(root, "meta.json"), JSON.stringify({ inputs }));
    } finally { await bundle.close(); }
    // Public package exports resolve their built artifacts; source aliases would
    // conceal missing assembly or downstream export regressions.
    const libraryInputs = inputs.filter((name) => /(^|\/)packages\/superimg(?:-|\/)/.test(name));
    expect(libraryInputs.length).toBeGreaterThan(0);
    expect(libraryInputs.filter((name) => !name.startsWith("packages/") || !name.includes("/dist/"))).toEqual([]);
    font = await readFile(join(repoRoot, "packages/superimg-blitz/rust/assets/DejaVuSans.woff2"));
    await writeFile(join(root, "index.html"), `<!doctype html><style>body{margin:0;display:flex;gap:12px}section{width:420px;height:220px;position:relative}</style><section id="left"></section><section id="right"></section><script type="module" src="/app.js"></script>`);
    server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://fixture.local");
      response.setHeader("cache-control", "no-store");
      if (url.pathname === "/font.woff2") {
        response.setHeader("content-type", "font/woff2");
        const key = url.searchParams.get("key") ?? "normal";
        if (key.startsWith("hold")) {
          const waiting = heldFonts.get(key) ?? new Set<ServerResponse>();
          waiting.add(response);
          heldFonts.set(key, waiting);
          response.on("close", () => waiting.delete(response));
        } else response.end(font);
        return;
      }
      if (url.pathname === "/release") {
        const key = url.searchParams.get("key")!;
        for (const waiting of heldFonts.get(key) ?? []) waiting.end(font);
        heldFonts.delete(key);
        response.end("released");
        return;
      }
      if (url.pathname === "/badge.svg" || url.pathname === "/unused-badge.svg") {
        response.setHeader("content-type", "image/svg+xml");
        response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="${url.pathname === "/badge.svg" ? "#e43280" : "#00ff00"}"/></svg>`);
        return;
      }
      const path = url.pathname === "/app.js" ? "app.js" : "index.html";
      response.setHeader("content-type", path === "app.js" ? "text/javascript" : "text/html");
      void readFile(join(root, path)).then((bytes) => response.end(bytes), (error) => { response.statusCode = 500; response.end(String(error)); });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP fixture server");
    origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
    for (const responses of heldFonts.values()) for (const response of responses) response.end(font);
    heldFonts.clear();
    if (server) await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Node keeps active fixture HTTP connections alive after browser teardown.
      server.closeAllConnections();
    });
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("uses caller resources visibly and retains them through complete projection updates", async () => {
    const page = await open();
    const frame = page.frameLocator("#left iframe");
    await page.evaluate(() => window.__interactiveFoundation.inspect("left"));
    const resource = await frame.locator("#badge").evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 80; canvas.height = 40;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return { pixel: Array.from(context.getImageData(40, 20, 1, 1).data), src: image.src, width: image.naturalWidth };
    });
    expect(resource).toMatchObject({ pixel: [228, 50, 128, 255], width: 80 });
    expect(new URL(resource.src).pathname).toBe("/badge.svg");
    expect(await frame.locator("#asset-width").innerText()).toBe("80");
    const fontEvidence = await frame.locator("#font-probe").evaluate(async (element) => {
      await document.fonts.ready;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      const style = getComputedStyle(element);
      context.font = `28px ${style.fontFamily}`;
      const custom = context.measureText(element.textContent!).width;
      context.font = "28px monospace";
      return { family: style.fontFamily, loaded: document.fonts.check("28px CallerFontnormal"), custom, fallback: context.measureText(element.textContent!).width, actual: element.getBoundingClientRect().width };
    });
    expect(fontEvidence.family).toContain("CallerFontnormal");
    expect(fontEvidence.loaded).toBe(true);
    expect(Math.abs(fontEvidence.custom - fontEvidence.fallback)).toBeGreaterThan(5);
    expect(fontEvidence.actual).toBeCloseTo(fontEvidence.custom, 0);
    await page.evaluate(() => window.__interactiveFoundation.act("left", "trading"));
    const before = await state(page, "left");
    await page.evaluate(() => window.__interactiveFoundation.update("left", "Updated"));
    const after = await state(page, "left");
    expect(after.presentation.generation).toBe(before.presentation.generation);
    expect(after.presentation.accepted!.revision).toBeGreaterThan(before.presentation.accepted!.revision);
    expect(after.presentation.accepted!.frame).toBe(before.presentation.accepted!.frame);
    expect(after.step).toBe("trading");
    expect(after.isPlaying).toBe(false);
    expect(await frame.locator("#label").innerText()).toBe("Updated");
    expect(await frame.locator("#badge").evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth === 80)).toBe(true);
    expect(await frame.locator("#font-probe").evaluate(() => document.fonts.check("28px CallerFontnormal"))).toBe(true);
    await close(page);
  });

  it("dispatches native click and keyboard actions with accepted scene provenance", async () => {
    const page = await open();
    await page.evaluate(() => window.__interactiveFoundation.act("left", "trading"));
    const frame = page.frameLocator("#left iframe");
    await frame.locator("#reaction").click();
    await frame.locator("#reaction").press("Enter");
    const current = await state(page, "left");
    expect(current.actions).toHaveLength(2);
    for (const event of current.actions) {
      expect(event).toMatchObject({ action: "explain-reaction", nodeId: "reaction:alpha", frame: current.presentation.accepted!.frame, presentation: { generation: current.presentation.generation, revision: current.presentation.accepted!.revision, frame: current.presentation.accepted!.frame, sceneId: current.scene!.sceneId } });
    }
    expect(current.scene!.nodes.find((node) => node.id === "reaction:alpha")).toMatchObject({ metadata: { customerId: "alpha", label: "Alpha" } });
    const observed = await page.evaluate(() => window.__interactiveFoundation.inspect("left"));
    expect(observed.presented).toEqual(current.presentation.accepted);
    expect(observed.nodes.find((node) => node.id === "reaction:alpha")?.actions).toEqual(["explain-reaction"]);
    await close(page);
  });

  it("isolates two mounts of the same definition and keeps the surviving mount functional", async () => {
    const page = await open();
    const rightBefore = await state(page, "right");
    await page.evaluate(() => window.__interactiveFoundation.update("left", "LeftOnly"));
    expect(await page.frameLocator("#right iframe").locator("#label").innerText()).toBe("Beta");
    expect((await state(page, "right")).presentation).toEqual(rightBefore.presentation);
    await page.evaluate(() => window.__interactiveFoundation.dispose("left"));
    expect(await page.locator("#left iframe").count()).toBe(0);
    await page.frameLocator("#right iframe").locator("#reaction").click();
    expect((await state(page, "right")).actions).toHaveLength(1);
    expect((await state(page, "left")).actions).toHaveLength(0);
    await close(page);
  });

  it("retains last-good visual and semantic state after an invalid replacement", async () => {
    const page = await open();
    const before = await state(page, "left");
    const result = await page.evaluate(() => window.__interactiveFoundation.invalid("left"));
    expect(result.status).toBe("error");
    const after = await state(page, "left");
    expect(after.presentation.accepted).toEqual(before.presentation.accepted);
    expect(after.scene).toEqual(before.scene);
    expect(await page.frameLocator("#left iframe").locator("#label").innerText()).toBe("Alpha");
    await page.frameLocator("#left iframe").locator("#reaction").click();
    expect((await state(page, "left")).actions[0]?.nodeId).toBe("reaction:alpha");
    await close(page);
  });

  it("keeps last-good actions authoritative during a candidate and ignores a superseded load", async () => {
    const page = await open();
    const before = await state(page, "left");
    await page.evaluate(() => window.__interactiveFoundation.startLoad("left", "Slow", "holdSuperseded"));
    await expect.poll(() => heldFonts.get("holdSuperseded")?.size ?? 0).toBeGreaterThan(0);
    expect((await state(page, "left")).scene).toEqual(before.scene);
    await page.frameLocator("#left iframe:visible").locator("#reaction").click();
    const during = await state(page, "left");
    expect(during.actions).toHaveLength(1);
    expect(during.actions[0]).toMatchObject({ nodeId: "reaction:alpha", presentation: { generation: before.presentation.generation, revision: before.presentation.accepted!.revision, frame: before.presentation.accepted!.frame, sceneId: before.scene!.sceneId } });
    await page.evaluate(() => window.__interactiveFoundation.load("left", "Newest", "newest"));
    await page.request.get(`${origin}/release?key=holdSuperseded`);
    await expect.poll(() => state(page, "left").then((value) => value.outcomes.some((outcome) => outcome.label === "Slow"))).toBe(true);
    expect(await page.frameLocator("#left iframe").locator("#label").innerText()).toBe("Newest");
    const accepted = await state(page, "left");
    expect(accepted.scene!.nodes.find((node) => node.role === "reaction")?.metadata.label).toBe("Newest");
    await page.frameLocator("#left iframe").locator("#reaction").click();
    expect((await state(page, "left")).actions[1]?.presentation.generation).toBe(accepted.presentation.generation);
    await close(page);
  });

  it("accepts newest data and discards a pending candidate after disposal", async () => {
    const page = await open();
    // Both calls are issued without awaiting the first repaint.
    await page.evaluate(async () => {
      const first = window.__interactiveFoundation.update("right", "Intermediate");
      const last = window.__interactiveFoundation.update("right", "Final");
      await Promise.allSettled([first, last]);
    });
    expect(await page.frameLocator("#right iframe").locator("#label").innerText()).toBe("Final");
    expect((await state(page, "right")).scene!.nodes.find((node) => node.role === "reaction")?.metadata.label).toBe("Final");
    await page.evaluate(() => window.__interactiveFoundation.startLoad("left", "DisposedCandidate", "holdDisposed"));
    await expect.poll(() => heldFonts.get("holdDisposed")?.size ?? 0).toBeGreaterThan(0);
    const before = await state(page, "left");
    await page.evaluate(() => window.__interactiveFoundation.dispose("left"));
    await page.request.get(`${origin}/release?key=holdDisposed`);
    await expect.poll(() => state(page, "left").then((value) => value.outcomes.some((outcome) => outcome.label === "DisposedCandidate"))).toBe(true);
    const after = await state(page, "left");
    expect(after.presentation.disposed).toBe(true);
    expect(after.scenes).toEqual(before.scenes);
    expect(await page.locator("#left iframe").count()).toBe(0);
    await page.frameLocator("#right iframe").locator("#reaction").press("Space");
    expect((await state(page, "right")).actions[0]?.nodeId).toBe("reaction:final");
    await close(page);
  });

  it("keeps paused controls and native keyboard actions usable with reduced motion", async () => {
    const page = await open(true);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    const initial = await state(page, "left");
    expect(initial.isPlaying).toBe(false);
    await page.evaluate(() => window.__interactiveFoundation.act("left", "trading"));
    const trading = await state(page, "left");
    expect(trading.step).toBe("trading");
    expect(trading.presentation.accepted!.frame).toBeGreaterThan(initial.presentation.accepted!.frame);
    await page.frameLocator("#left iframe").locator("#reaction").press("Space");
    expect((await state(page, "left")).actions).toHaveLength(1);
    expect((await state(page, "left")).isPlaying).toBe(false);
    await close(page);
  });

  it("prepares authoritative math/svg packs for aliased interactive renderers through public exports", async () => {
    const page = await open();
    const loaded = await page.evaluate(() => window.__interactiveFoundation.capabilities("left"));
    expect(loaded.status, JSON.stringify(loaded)).toBe("success");
    const frame = page.frameLocator("#left iframe");
    expect(await frame.locator("#capability-value").innerText()).toBe("0");
    const initialShape = await frame.locator("#capability-shape").getAttribute("d");
    expect(initialShape).toContain("M40,32");
    const before = await state(page, "left");
    expect(before.scene!.nodes.find((node) => node.id === "reaction:capability")).toMatchObject({ metadata: { label: "Capability", packValue: 0 } });
    await page.evaluate(() => window.__interactiveFoundation.act("left", "trading"));
    await page.evaluate(() => window.__interactiveFoundation.update("left", "CapabilityUpdated", true));
    expect(await frame.locator("#capability-value").innerText()).toBe("1");
    expect(await frame.locator("#capability-shape").getAttribute("d")).toContain("M40,16");
    const updated = await state(page, "left");
    expect(updated.presentation.generation).toBe(before.presentation.generation);
    expect(updated.presentation.accepted!.revision).toBeGreaterThan(before.presentation.accepted!.revision);
    expect(updated.scene!.nodes.find((node) => node.role === "reaction")).toMatchObject({ metadata: { label: "CapabilityUpdated", packValue: 1 } });
    await frame.locator("#reaction").click();
    await frame.locator("#reaction").press("Enter");
    const acted = await state(page, "left");
    expect(acted.actions).toHaveLength(2);
    for (const event of acted.actions) expect(event).toMatchObject({
      action: "explain-reaction", nodeId: "reaction:capabilityupdated",
      frame: updated.presentation.accepted!.frame,
      presentation: { generation: updated.presentation.generation, revision: updated.presentation.accepted!.revision, frame: updated.presentation.accepted!.frame, sceneId: updated.scene!.sceneId },
    });
    const inspected = await page.evaluate(() => window.__interactiveFoundation.inspect("left"));
    expect(inspected.presented).toEqual(updated.presentation.accepted);
    expect(inspected.nodes.find((node) => node.id === "reaction:capabilityupdated")?.actions).toEqual(["explain-reaction"]);
    await close(page);
  });

  it("honors an authoritative empty stamp instead of inferring or eagerly preparing packs", async () => {
    const page = await open();
    const before = await state(page, "left");
    const result = await page.evaluate(() => window.__interactiveFoundation.capabilities("left", true));
    expect(result.status, JSON.stringify(result)).toBe("error");
    expect(JSON.stringify(result)).toMatch(/not.prepared|capability|pack/i);
    const after = await state(page, "left");
    expect(after.presentation.accepted).toEqual(before.presentation.accepted);
    expect(after.scene).toEqual(before.scene);
    expect(await page.frameLocator("#left iframe").locator("#label").innerText()).toBe("Alpha");
    await page.frameLocator("#left iframe").locator("#reaction").press("Enter");
    expect((await state(page, "left")).actions[0]?.nodeId).toBe("reaction:alpha");
    await close(page);
  });
});

async function open(reducedMotion = false) {
  const page = await browser.newPage({ viewport: { width: 900, height: 500 }, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  await page.goto(origin);
  await page.waitForFunction(() => document.body.dataset.ready !== undefined);
  expect(await page.locator("body").getAttribute("data-ready"), await page.locator("body").getAttribute("data-error") ?? "").toBe("success");
  return page;
}

async function close(page: Page) {
  await page.evaluate(() => window.__interactiveFoundation.disposeAll());
  await page.close();
}

async function state(page: Page, id: "left" | "right") {
  return page.evaluate((instanceId) => window.__interactiveFoundation.state(instanceId), id);
}

type InstanceState = {
  presentation: { generation: number; requestedFrame: number | null; accepted: { frame: number; revision: number } | null; isPending?: boolean; isReady: boolean; disposed: boolean };
  scene: { sceneId: string; nodes: Array<{ id: string; role: string; metadata: { customerId?: string; label?: string } }> } | null;
  step: string | null;
  isPlaying: boolean;
  actions: Array<{ action: string; nodeId: string; frame: number; presentation: { generation: number; revision: number; frame: number; sceneId: string } }>;
  scenes: unknown[];
  outcomes: Array<{ label: string; status: string }>;
};

declare global {
  interface Window {
    __interactiveFoundation: {
      state(id: "left" | "right"): InstanceState;
      load(id: "left" | "right", label: string, key?: string): Promise<{ status: string }>;
      startLoad(id: "left" | "right", label: string, key: string): void;
      update(id: "left" | "right", label: string, selected?: boolean): Promise<void>;
      invalid(id: "left" | "right"): Promise<{ status: string }>;
      capabilities(id: "left" | "right", empty?: boolean): Promise<{ status: string }>;
      act(id: "left" | "right", step: string): Promise<void>;
      inspect(id: "left" | "right"): Promise<{ presented: { frame: number; revision: number } | null; nodes: Array<{ id: string; actions: string[] }> }>;
      dispose(id: "left" | "right"): void;
      disposeAll(): void;
    };
  }
}
