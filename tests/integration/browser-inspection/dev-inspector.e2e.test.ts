import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { startDevServer, type DevServer } from "@foxworth/superimg-cli/dev-server";
import type { PreviewSnapshot } from "@foxworth/superimg/inspection";
import { repoRoot } from "./support/fixture-server.js";

const validSource = (marker: string, color: string) => `import { video, Frame, Fill, Html } from "@foxworth/superimg";
export const namedHelper = "mixed named/default export";
export default video({
  size: { width: 320, height: 180 }, fps: 4, duration: "1s",
  editions: { square: { size: { width: 160, height: 160 } } },
  render(ctx) { return Frame({ width: ctx.width, height: ctx.height },
    Fill({ color: "${color}" }),
    Html({ id: "subject", x: 12, y: 20, width: 136, height: 60,
      html: '<div data-si-node="reading" style="font:22px Arial;color:white">${marker}</div>' })
  ); }
});`;

async function freePort(): Promise<number> {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback port");
  await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function setup(source: string) {
  const root = await mkdtemp(join(tmpdir(), "superimg-dev-inspector-"));
  const path = join(root, "fixture.media.ts");
  const evidenceParent = join(repoRoot, "tests/integration/output/browser-inspection");
  await mkdir(evidenceParent, { recursive: true });
  const evidence = await mkdtemp(join(evidenceParent, "dev-inspector-"));
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(path, source);
  let server: DevServer | undefined;
  const previousCwd = process.cwd();
  try {
    process.chdir(root);
    server = await startDevServer(path, { edition: "square", port: await freePort() });
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
  finally { process.chdir(previousCwd); }
  return { root, path, evidence, server: server!, async close() { await server!.close(); await rm(root, { recursive: true, force: true }); } };
}

const snapshot = (page: Page): Promise<PreviewSnapshot> => page.evaluate("window.superimgInspection.inspect({surfaceId:'dev-preview'})");
async function selected(page: Page): Promise<PreviewSnapshot> {
  return page.evaluate("(async()=>{const api=window.superimgInspection;const before=await api.inspect({surfaceId:'dev-preview'});await api.setMode({surfaceId:'dev-preview',expectedGeneration:before.generation,mode:'inspection'});return api.seek({surfaceId:'dev-preview',expectedGeneration:before.generation,frame:0})})()");
}
async function waitForSource(page: Page, marker: string, previous?: string) {
  await expect.poll(async () => {
    const value = await snapshot(page).catch(() => null);
    const text = await page.locator("iframe").evaluateAll(frames => frames.flatMap(frame => {
      try { return [(frame as HTMLIFrameElement).contentDocument?.getElementById("root")?.textContent ?? ""]; } catch { return []; }
    })).catch(() => []);
    return value?.compilation?.status === "succeeded" && Boolean(value.source?.revision) && value.source?.revision !== previous && text.some(value => value.includes(marker));
  }, { timeout: 20_000 }).toBe(true);
  return selected(page);
}
async function capture(page: Page) {
  await page.locator("#inspector-capture").click();
  await expect.poll(() => page.locator("#inspector-capture-status").textContent(), { timeout: 20_000 }).toMatch(/^accepted capture/);
  await expect.poll(() => page.locator("#inspector-image").evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
}
async function saveEvidence(page: Page, directory: string, name: string) {
  const downloading = page.waitForEvent("download");
  await page.locator("#inspector-save").click();
  const download = await downloading;
  const path = join(directory, `${name}.json`);
  await download.saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}

describe("assembled ordinary dev preview inspector", () => {
  it("compiles mixed exports and square media, pairs captures/findings, compares actual pixels and recovers from syntax errors", async () => {
    const fixture = await setup(validSource("Before", "#dc2626"));
    let browser: Browser | undefined;
    let page: Page | undefined;
    let passed = false;
    const errors: string[] = [];
    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(fixture.server.url);
      const config = await (await page.request.get(new URL("/api/config", fixture.server.url).href)).json();
      await writeFile(join(fixture.evidence, "config.json"), JSON.stringify(config, null, 2));
      const bundleResponse = await page.request.get(new URL("/api/template-bundle", fixture.server.url).href);
      await writeFile(join(fixture.evidence, "template-bundle.json"), await bundleResponse.text());
      expect(config).toMatchObject({ width: 160, height: 160, editionId: "square" });
      await page.waitForFunction("Boolean(window.superimgInspection)", null, { timeout: 10_000 });
      const initial = await waitForSource(page, "Before");
      expect(initial).toMatchObject({ width: 160, height: 160, presented: { frame: 0 }, readiness: { status: "ready" }, compilation: { status: "succeeded" } });
      await expect.poll(() => page!.locator("#preview-container .paused-overlay").isVisible()).toBe(false);
      expect(await page.locator("#toast-container").evaluate(node => getComputedStyle(node).display)).toBe("none");
      await page.locator("#inspector-btn").click();
      await capture(page);
      const first = await saveEvidence(page, fixture.evidence, "first");
      expect(first).toMatchObject({ backend: "snapdom", visual: "unreviewed", report: { status: "accepted", freshness: { status: "matched" }, after: { source: initial.source, presented: { frame: 0 } } }, evidence: { actual: { width: 160, height: 160 }, context: { truncated: false } } });
      expect(first.evidence.geometry).toMatchObject({ w0: 160, h0: 160 });
      const image = Buffer.from(first.image.dataUrl.split(",")[1], "base64");
      const decoded = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height]).toEqual([160, 160]);
      for (const [x, y] of [[2, 2], [157, 157]]) expect([...decoded.data.subarray((y * 160 + x) * 4, (y * 160 + x) * 4 + 4)]).toEqual([220, 38, 38, 255]);
      let textInk = 0;
      for (let y = 18; y < 56; y++) for (let x = 10; x < 150; x++) {
        const offset = (y * 160 + x) * 4;
        if (decoded.data[offset]! > 235 && decoded.data[offset + 1]! > 235 && decoded.data[offset + 2]! > 235) textInk++;
      }
      expect(textInk, "White label ink must occupy its authored box, not a stretched zero-height root strip").toBeGreaterThan(10);
      await page.locator("#inspector-baseline").click();

      const reading = await page.locator("#inspector-node option").evaluateAll(options => options.map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent })).find(option => option.text?.includes("reading"))?.value);
      expect(reading).toBeTruthy();
      await page.locator("#inspector-node").selectOption(reading!);
      await expect.poll(() => page!.locator("#inspector-node-detail").textContent()).toContain('"font-size": "22px"');
      await expect.poll(() => page!.locator("#inspector-node-detail").textContent()).toContain('"clippingAncestors"');
      await expect.poll(() => page!.locator("#inspector-node-crop").evaluate(node => !(node as HTMLCanvasElement).hidden && (node as HTMLCanvasElement).width > 0)).toBe(true);
      const mediaBounds = (await snapshot(page)).geometry.content!;
      const inspectorBounds = await page.locator("#inspector-panel").boundingBox();
      expect(inspectorBounds).not.toBeNull();
      const overlap = Math.max(0, Math.min(mediaBounds.x + mediaBounds.width, inspectorBounds!.x + inspectorBounds!.width) - Math.max(mediaBounds.x, inspectorBounds!.x)) * Math.max(0, Math.min(mediaBounds.y + mediaBounds.height, inspectorBounds!.y + inspectorBounds!.height) - Math.max(mediaBounds.y, inspectorBounds!.y));
      expect(overlap, "Inspector chrome must never cover captured media").toBe(0);
      const viewport = await sharp(await page.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const mediaCorner = (Math.floor(mediaBounds.y + mediaBounds.height - 8) * viewport.info.width + Math.floor(mediaBounds.x + mediaBounds.width - 8)) * 4;
      expect([...viewport.data.subarray(mediaCorner, mediaCorner + 4)], "Real viewport media must remain unobscured by the inspector").toEqual([220, 38, 38, 255]);
      // Selecting a different inspector detail changes diagnostic UI only.
      await capture(page);
      await page.locator("#inspector-compare").click();
      await expect.poll(() => page!.locator("#inspector-diff-status").textContent()).toMatch(/^0 \/ 25600 media pixels changed/);
      const findings = await (await page.request.get(new URL("/api/inspect?frame=0", fixture.server.url).href)).json();
      const accepted = await snapshot(page);
      expect(findings).toMatchObject({ source: accepted.source, frame: accepted.presented?.frame });
      expect(findings.report.coverage.visual).toBe("unreviewed");
      await expect.poll(() => page!.locator("#inspector-findings").textContent()).toContain('"visual": "unreviewed"');
      await expect.poll(async () => JSON.parse((await page!.locator("#inspector-node-detail").textContent()) ?? "{}").findings?.state).toMatch(/^(available|partial)$/);
      await page.locator("#inspector-node").selectOption(JSON.stringify(["subject", null]));
      await expect.poll(async () => JSON.parse((await page!.locator("#inspector-node-detail").textContent()) ?? "{}").findings?.findings?.map((finding: { code: string }) => finding.code)).toContain("OPAQUE_REGION");
      await writeFile(join(fixture.evidence, "matched-findings.json"), JSON.stringify(findings, null, 2));

      await writeFile(fixture.path, validSource("After", "#2563eb"));
      const changed = await waitForSource(page, "After", initial.source?.revision);
      await capture(page);
      const second = await saveEvidence(page, fixture.evidence, "changed");
      expect(second.image.sha256).not.toBe(first.image.sha256);
      expect(changed.source?.revision).not.toBe(initial.source?.revision);
      await page.locator("#inspector-compare").click();
      await expect.poll(() => page!.locator("#inspector-diff-status").textContent()).toMatch(/^[1-9]\d* \/ 25600 media pixels changed/);

      await writeFile(fixture.path, 'export default video({ render( {');
      await expect.poll(async () => (await snapshot(page!)).compilation?.status, { timeout: 20_000 }).toBe("failed");
      const failed = await snapshot(page);
      expect(failed.source).toEqual(changed.source);
      expect(failed.presented?.frame).toBe(0);
      await expect.poll(() => page!.locator("#inspector-panel").getAttribute("data-freshness")).toBe("stale");
      const body = await page.request.get(new URL("/api/config", fixture.server.url).href);
      expect(body.status()).toBe(500);
      const diagnostic = await body.json();
      expect(diagnostic.error.code).toBeTruthy();
      expect(diagnostic.error.message).toBeTruthy();
      await expect.poll(() => page!.locator("#error-panel .error-panel-message").textContent()).toContain(diagnostic.error.message);
      expect(await page.locator("#error-panel").getAttribute("class")).not.toContain("hidden");
      await writeFile(join(fixture.evidence, "syntax-error.json"), JSON.stringify({ failed, diagnostic }, null, 2));
      const retained = await page.locator("iframe").evaluateAll(frames => frames.some(frame => (frame as HTMLIFrameElement).contentDocument?.getElementById("root")?.textContent?.includes("After")));
      expect(retained).toBe(true);

      await writeFile(fixture.path, validSource("Recovered", "#059669"));
      const recovered = await waitForSource(page, "Recovered", changed.source?.revision);
      expect(recovered.compilation?.status).toBe("succeeded");
      await expect.poll(() => page!.locator("#inspector-panel").getAttribute("data-freshness")).toBe("matched");
      expect(errors).toEqual([]);
      passed = true;
    } finally {
      if (page && !page.isClosed()) {
        await writeFile(join(fixture.evidence, "page.html"), await page.content());
        await writeFile(join(fixture.evidence, "browser-diagnostics.json"), JSON.stringify({ console: (await page.consoleMessages()).map(message => ({ type: message.type(), text: message.text() })), requests: (await page.requests()).map(request => ({ url: request.url(), failure: request.failure(), status: request.existingResponse()?.status() })) }, null, 2));
        await page.screenshot({ path: join(fixture.evidence, passed ? "final.png" : "failure.png") }).catch(() => undefined);
        await writeFile(join(fixture.evidence, "final-snapshot.json"), JSON.stringify(await snapshot(page).catch(error => ({ error: String(error) })), null, 2));
      }
      await writeFile(join(fixture.evidence, "receipt.json"), JSON.stringify({ passed, errors, browser: browser?.version(), source: await readFile(fixture.path, "utf8").catch(() => "unavailable") }, null, 2));
      try { await browser?.close(); } finally { await fixture.close(); }
    }
  });

  it("shows the structured config compiler diagnostic on an initially invalid source", async () => {
    const fixture = await setup('export default video({ render( {');
    let browser: Browser | undefined;
    let passed = false;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(fixture.server.url);
      const response = await page.request.get(new URL("/api/config", fixture.server.url).href);
      expect(response.status()).toBe(500);
      const diagnostic = await response.json();
      await expect.poll(() => page.locator(".superimg-overlay-message").textContent()).toContain(diagnostic.error.message);
      expect(await page.locator(".superimg-overlay-code").textContent()).toContain(diagnostic.error.code);
      expect(await page.locator("body").textContent()).not.toContain("Failed to load config");
      await writeFile(join(fixture.evidence, "initial-config-error.json"), JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: join(fixture.evidence, "initial-error.png") });
      passed = true;
    } finally {
      await writeFile(join(fixture.evidence, "receipt.json"), JSON.stringify({ passed, browser: browser?.version() }, null, 2));
      try { await browser?.close(); } finally { await fixture.close(); }
    }
  });
});
