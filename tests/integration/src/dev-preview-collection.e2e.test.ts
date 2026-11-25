import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser } from "playwright";
import { describe, expect, it } from "vitest";
import { repoRoot } from "../browser-inspection/support/fixture-server.js";

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback port");
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return address.port;
}

async function startCliDev(mediaPath: string, args: string[] = []) {
  const port = await freePort();
  const cli = resolve(repoRoot, "packages/superimg-cli/dist/cli.js");
  const child = spawn(process.execPath, [cli, "dev", mediaPath, "--no-open", "--port", String(port), ...args], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout?.on("data", chunk => { output += String(chunk); });
  child.stderr?.on("data", chunk => { output += String(chunk); });
  const url = `http://127.0.0.1:${port}`;
  try {
    await expect.poll(async () => {
      if (child.exitCode !== null) throw new Error(`CLI dev exited early: ${output}`);
      try { return (await fetch(`${url}/api/config`)).status; } catch { return 0; }
    }, { timeout: 45_000, message: `Wait for CLI dev server; output: ${output}` }).toBe(200);
  } catch (error) {
    await stop(child);
    throw error;
  }
  return { child, url, startupUrl: output.match(/running at (https?:\/\/\S+)/i)?.[1] ?? url, output: () => output };
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>(resolveExit => child.once("exit", () => resolveExit())),
    delay(5_000).then(() => { child.kill("SIGKILL"); }),
  ]);
}

async function waitText(page: import("playwright").Page, text: string) {
  const expected = text.replace(/\s+/g, "");
  await expect.poll(() => page.locator("iframe").evaluateAll(frames => frames.map(frame => frame.contentDocument?.body.textContent ?? "").join(" ")).catch(() => "").then(value => value.replace(/\s+/g, "")), { timeout: 30_000 }).toContain(expected);
}

describe("collection CLI dev preview", { timeout: 180_000 }, () => {
  it("selects and exports exact startup snapshot entries, refreshes explicitly, and invalidates on source HMR", async () => {
    await mkdir(join(repoRoot, "tests/integration/output"), { recursive: true });
    const root = await mkdtemp(join(repoRoot, "tests/integration/output/dev-preview-collection-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module", private: true }));
    const fixtureRoot = join(repoRoot, "tests/integration/fixtures/collection-library");
    await Promise.all(["cards.media.ts", "entries.server.mjs", "rows.json"].map(async name =>
      writeFile(join(root, name), await readFile(join(fixtureRoot, name))),
    ));
    const mediaPath = join(root, "cards.media.ts");
    const mediaSource = await readFile(mediaPath, "utf8");
    await writeFile(mediaPath, mediaSource.replace(
      "size: { width: 160, height: 90 },",
      'size: { width: 160, height: 90 },\n  variants: { teams: { color: "#bfdbfe" } },\n  editions: { square: { size: { width: 90, height: 90 } } },',
    ));
    const server = await startCliDev(mediaPath, ["--entry", "south"]);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(String(error)));
      await page.goto(server.startupUrl);
      await expect.poll(() => page.locator("#collection-controls").isVisible(), { timeout: 30_000 }).toBe(true);
      await expect.poll(() => page.locator("#collection-entry").inputValue()).toBe("south");
      await waitText(page, "Frozen SOUTH copy");
      const initialConfig = await page.request.get(`${server.url}/api/config`).then(response => response.json()) as {
        collection?: { snapshotId: string; generation: number };
      };
      expect(initialConfig.collection?.snapshotId).toBeTruthy();
      expect(initialConfig.collection?.generation).toBe(0);
      const initialSnapshot = initialConfig.collection;
      if (!initialSnapshot) throw new Error("Collection preview did not expose its accepted startup snapshot");
      const count = join(root, "provider-count.txt");
      const providerCalls = async () => (await readFile(count, "utf8").catch(() => "")).length;
      expect(await providerCalls()).toBe(1);

      const appOrigin = new URL(server.startupUrl).origin;
      const session = await page.request.get(`${appOrigin}/api/media/session`).then(response => response.json()) as { token: string };
      expect(session.token).toBeTruthy();
      const unauthorized = await page.request.post(`${appOrigin}/api/collection/snapshot`, { data: {} });
      expect(unauthorized.status()).toBe(403);
      const wrongOrigin = await page.request.post(`${appOrigin}/api/collection/snapshot`, {
        data: {},
        headers: { origin: "https://untrusted.example", "x-superimg-session": session.token },
      });
      expect(wrongOrigin.status()).toBe(403);
      expect(await providerCalls()).toBe(1);

      await page.locator("#collection-entry").selectOption("north");
      await expect.poll(() => page.locator("#collection-entry").inputValue()).toBe("north");
      await waitText(page, "Frozen NORTH copy");
      await page.locator("#preview-variant").selectOption("teams");
      await page.locator("#preview-edition").selectOption("square");
      const scopedConfig = await page.request.get(`${server.url}/api/config?entryId=north&snapshotId=${initialSnapshot.snapshotId}&generation=${initialSnapshot.generation}&variantId=teams&editionId=square`).then(response => response.json());
      expect(scopedConfig).toMatchObject({ entryId: "north", variantId: "teams", editionId: "square", width: 90, height: 90 });
      await waitText(page, "Frozen NORTH copy");
      expect(await providerCalls()).toBe(1);

      await writeFile(join(root, "rows.json"), JSON.stringify([
        { id: "north", title: "Changed NORTH copy", color: "#fecaca" },
        { id: "south", title: "Changed SOUTH copy", color: "#fed7aa" },
        { id: "west", title: "Added WEST copy", color: "#fef08a" },
      ]));
      await page.locator("#export").click();
      await page.locator('.export-fmt-btn[data-format="html"]:visible').click();
      const exportResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/collection/export") && response.request().method() === "POST");
      await page.locator("#export-start").click();
      const exportResponse = await exportResponsePromise;
      const exportBody = await exportResponse.json();
      expect(exportResponse.status(), JSON.stringify(exportBody)).toBe(200);
      const receipt = exportBody as {
        publicationId: string;
        manifest: { sourceId?: string; entries?: Array<{ id: string }>; renditions?: Array<{ path: string; coordinates: Record<string, unknown> }> };
      };
      expect(receipt.manifest.sourceId).toBe("cards");
      await expect.poll(() => page.locator("#collection-export-status").textContent(), { timeout: 60_000 }).toMatch(/^Exported frozen entry/i);
      expect(await providerCalls()).toBe(1);

      const manifestPath = join(root, "output", receipt.publicationId, "export.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as typeof receipt.manifest;
      expect(manifest).toEqual(receipt.manifest);
      expect(manifest.sourceId).toBe("cards");
      // Entries retain the full snapshot provenance; renditions are the exact selection.
      expect(manifest.entries?.map(entry => entry.id)).toEqual(["north", "south"]);
      expect(manifest.renditions).toHaveLength(1);
      expect(manifest.renditions?.[0]?.coordinates).toMatchObject({ entryId: "north", variantId: "teams", editionId: "square" });
      const exported = await readFile(join(dirname(manifestPath), manifest.renditions?.[0]?.path ?? ""), "utf8");
      const visibleExport = exported.replace(/<br\s*\/?\s*>/gi, " ");
      expect(visibleExport).toContain("Frozen NORTH copy");
      expect(visibleExport).not.toContain("Changed NORTH copy");

      await page.locator("#export-panel-close").click();
      const previousStatus = await page.locator("#collection-status").textContent();
      await page.locator("#collection-refresh").click();
      await expect.poll(() => page.locator("#collection-status").textContent(), { timeout: 30_000 }).not.toBe(previousStatus);
      await expect.poll(providerCalls).toBe(2);
      await expect.poll(() => page.locator("#collection-entry").inputValue()).toBe("north");
      await waitText(page, "Changed NORTH copy");
      const refreshedConfig = await page.request.get(`${server.url}/api/config`).then(response => response.json()) as {
        collection?: { snapshotId: string; generation: number };
      };
      const refreshedSnapshot = refreshedConfig.collection;
      if (!refreshedSnapshot) throw new Error("Explicit refresh did not expose its accepted snapshot");

      const original = await readFile(mediaPath, "utf8");
      await writeFile(mediaPath, original.replace("width: 160, height: 90", "width: 164, height: 90"));
      await expect.poll(() => page.locator("#collection-status").textContent(), { timeout: 30_000 }).toMatch(/stale|refresh|invalid/i);
      await expect.poll(providerCalls).toBe(2);
      const staleConfig = await page.request.get(`${server.url}/api/template-bundle?entryId=north&snapshotId=${refreshedSnapshot.snapshotId}&generation=${refreshedSnapshot.generation}`);
      expect(staleConfig.status()).toBe(409);
      expect(pageErrors).toEqual([]);
    } finally {
      await browser?.close();
      await stop(server.child);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps empty bootstrap actionable, then recovers a stale saved URL by explicit refresh", async () => {
    await mkdir(join(repoRoot, "tests/integration/output"), { recursive: true });
    const root = await mkdtemp(join(repoRoot, "tests/integration/output/dev-preview-collection-recovery-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ type: "module", private: true }));
    const fixtureRoot = join(repoRoot, "tests/integration/fixtures/collection-library");
    await Promise.all(["cards.media.ts", "entries.server.mjs"].map(async name =>
      writeFile(join(root, name), await readFile(join(fixtureRoot, name))),
    ));
    const mediaPath = join(root, "cards.media.ts");
    const mediaSource = await readFile(mediaPath, "utf8");
    await writeFile(mediaPath, mediaSource.replace("size: { width: 160, height: 90 },", 'size: { width: 160, height: 90 },\n  sample: { id: "sample", title: "Empty collection", color: "#dbeafe" },'));
    const rowsPath = join(root, "rows.json");
    await writeFile(rowsPath, "[]");
    const server = await startCliDev(mediaPath);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(String(error)));
      await page.goto(server.startupUrl);

      // Collection controls must remain usable even though no player can be
      // created from an empty provider result.
      await expect.poll(() => page.locator("#collection-controls").isVisible(), { timeout: 30_000 }).toBe(true);
      await expect.poll(() => page.locator("#collection-entry").isDisabled()).toBe(true);
      await expect.poll(() => page.locator("#collection-status").textContent()).toMatch(/empty|no entries|refresh/i);
      await expect.poll(() => page.locator("#export").isDisabled()).toBe(true);
      const count = join(root, "provider-count.txt");
      const providerCalls = async () => (await readFile(count, "utf8").catch(() => "")).length;
      expect(await providerCalls()).toBe(1);

      const emptyRefresh = page.waitForResponse(response => response.url().endsWith("/api/collection/snapshot") && response.request().method() === "POST");
      await page.locator("#collection-refresh").click();
      const emptyResponse = await emptyRefresh;
      expect(emptyResponse.status()).toBe(422);
      await expect.poll(() => page.locator("#collection-status").textContent()).toMatch(/empty|no entries|providers must return at least one entry/i);
      await expect.poll(providerCalls).toBe(2);
      await expect.poll(() => page.locator("#collection-refresh").isEnabled()).toBe(true);

      await writeFile(rowsPath, JSON.stringify([{ id: "recovered", title: "Recovered entry", color: "#dcfce7" }]));
      const successfulRefresh = page.waitForResponse(response => response.url().endsWith("/api/collection/snapshot") && response.request().method() === "POST");
      await page.locator("#collection-refresh").click();
      const successResponse = await successfulRefresh;
      expect(successResponse.status()).toBe(200);
      await expect.poll(providerCalls).toBe(3);
      await expect.poll(() => page.locator("#collection-entry").inputValue()).toBe("recovered");
      await waitText(page, "Recovered entry");
      const acceptedConfig = await page.request.get(`${server.url}/api/config`).then(response => response.json()) as {
        collection?: { snapshotId: string; generation: number };
      };
      const acceptedSnapshot = acceptedConfig.collection;
      if (!acceptedSnapshot) throw new Error("Recovered collection snapshot was not exposed in preview config");

      const updatedSource = (await readFile(mediaPath, "utf8")).replace("width: 160, height: 90", "width: 164, height: 90");
      await writeFile(mediaPath, updatedSource);
      await expect.poll(async () => (await page.request.get(`${server.url}/api/template-bundle?entryId=recovered&snapshotId=${acceptedSnapshot.snapshotId}&generation=${acceptedSnapshot.generation}`)).status()).toBe(409);
      await page.reload();
      await expect.poll(() => page.locator("#collection-controls").isVisible(), { timeout: 30_000 }).toBe(true);
      await expect.poll(() => page.locator("#collection-status").textContent()).toMatch(/stale|refresh|snapshot/i);
      await expect.poll(() => page.locator("#export").isDisabled()).toBe(true);
      expect(await providerCalls()).toBe(3);

      const recoveryRefresh = page.waitForResponse(response => response.url().endsWith("/api/collection/snapshot") && response.request().method() === "POST");
      await page.locator("#collection-refresh").click();
      const recoveryResponse = await recoveryRefresh;
      expect(recoveryResponse.status()).toBe(200);
      await expect.poll(providerCalls).toBe(4);
      await expect.poll(() => page.locator("#collection-entry").inputValue()).toBe("recovered");
      await waitText(page, "Recovered entry");
      expect(pageErrors).toEqual([]);
    } finally {
      await browser?.close();
      await stop(server.child);
      await rm(root, { recursive: true, force: true });
    }
  });
});
