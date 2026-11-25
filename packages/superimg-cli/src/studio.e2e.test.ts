import { chromium } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { startDevServer, type DevServer } from "../dist/dev-server.js";

describe("assembled Studio export and conversion", () => {
  let server: DevServer | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  afterEach(async () => { await browser?.close(); await server?.close(); });

  it("exports, pauses/resumes, downloads, inspects, trims and converts through the UI", async () => {
    server = await startDevServer(fileURLToPath(new URL("./__fixtures__/studio.media.ts", import.meta.url)), { port: 4779 });
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url);
    await page.locator("#export").click();
    await page.locator('.export-fmt-btn[data-format="webm"]').click();
    const created = page.waitForResponse((response) => response.url().endsWith("/api/media/jobs") && response.request().method() === "POST");
    await page.locator("#export-start").click();
    const response = await created;
    expect(response.status(), await response.text()).toBe(202);
    await page.locator("#export-pause").click();
    await expect.poll(() => page.locator("#export-pause").textContent(), { timeout: 15_000 }).toContain("Resume");
    await page.reload();
    await page.locator("#export").click();
    await expect.poll(() => page.locator("#export-pause").textContent(), { timeout: 15_000 }).toContain("Resume");
    await page.locator("#export-pause").focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.locator("#export-panel").getAttribute("data-state"), { timeout: 30_000 }).toBe("done");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-download").click();
    const download = await downloadPromise;
    const bytes = new Uint8Array(await readFile((await download.path())!));
    const inspected = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
    try {
      expect(await (await inspected.getPrimaryVideoTrack())!.getCodec()).toBe("vp9");
      expect(await inspected.computeDuration()).toBeCloseTo(4, 1);
    } finally { inspected.dispose(); }

    await page.locator("#export-new").click();
    await page.locator("#export-file").setInputFiles({ name: "captured.webm", mimeType: "video/webm", buffer: Buffer.from(bytes) });
    await expect.poll(() => page.locator("#export-video-track").isEnabled(), { timeout: 15_000 }).toBe(true);
    await page.locator("#export-video-start").fill("1");
    await page.locator("#export-video-end").fill("2");
    await page.locator('.export-fmt-btn[data-format="mkv"]').click();
    await page.locator("#export-start").click();
    await expect.poll(() => page.locator("#export-panel").getAttribute("data-state"), { timeout: 30_000 }).toBe("done");
    const convertedDownload = page.waitForEvent("download");
    await page.locator("#export-download").click();
    const converted = new Input({ source: new BufferSource(new Uint8Array(await readFile((await (await convertedDownload).path())!))), formats: ALL_FORMATS });
    try {
      expect(await converted.getVideoTracks()).toHaveLength(1);
      expect(await converted.computeDuration()).toBeCloseTo(1, 1);
    } finally { converted.dispose(); }
    await page.locator("#export-new").click();
    await page.locator("#export-runtime").selectOption("browser");
    await page.locator("#export-file").setInputFiles({ name: "local.webm", mimeType: "video/webm", buffer: Buffer.from(bytes) });
    await expect.poll(() => page.locator("#export-video-track").isEnabled()).toBe(true);
    await page.locator("#export-video-start").fill("1");
    await page.locator("#export-video-end").fill("2");
    await page.locator('.export-fmt-btn[data-format="webm"]').click();
    await page.locator("#export-start").click();
    await expect.poll(() => page.locator("#export-panel").getAttribute("data-state"), { timeout: 30_000 }).toBe("done");
    const localDownload = page.waitForEvent("download");
    await page.locator("#export-download").click();
    const local = new Input({ source: new BufferSource(new Uint8Array(await readFile((await (await localDownload).path())!))), formats: ALL_FORMATS });
    try { expect(await local.computeDuration()).toBeCloseTo(1, 1); } finally { local.dispose(); }
    await page.locator("#export-new").click();
    await page.locator("#export-clear-file").click();
    await page.locator('.export-fmt-btn[data-format="mkv"]').click();
    await page.locator("#export-start").click();
    await expect.poll(() => page.locator("#export-panel").getAttribute("data-state"), { timeout: 30_000 }).toBe("done");
    const browserExport = page.waitForEvent("download");
    await page.locator("#export-download").click();
    const authored = new Input({ source: new BufferSource(new Uint8Array(await readFile((await (await browserExport).path())!))), formats: ALL_FORMATS });
    try { expect(await authored.computeDuration()).toBeCloseTo(4, 1); } finally { authored.dispose(); }
    expect(errors).toEqual([]);
  }, 90_000);
});
