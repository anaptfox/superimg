import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";
import { describe, expect, it } from "vitest";
import type { PreviewSnapshot } from "@foxworth/superimg/inspection";
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
  const startupUrl = output.match(/running at (https?:\/\/\S+)/i)?.[1] ?? url;
  return { child, url, startupUrl, output: () => output };
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>(resolveExit => child.once("exit", () => resolveExit())),
    delay(5_000).then(() => { child.kill("SIGKILL"); }),
  ]);
}

async function waitForSnapshot(page: Page, predicate: (snapshot: PreviewSnapshot) => boolean) {
  let last: PreviewSnapshot | null = null;
  let lastError: string | null = null;
  try {
    await expect.poll(async () => {
      try {
        const snapshot = await page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
        last = snapshot;
        lastError = null;
        return predicate(snapshot);
      } catch (error) {
        lastError = String(error);
        return false;
      }
    }, { timeout: 30_000 }).toBe(true);
  } catch (error) {
    const compact = last && {
      source: last.source,
      compilation: last.compilation,
      presented: last.presented,
      readiness: last.readiness,
      stepId: last.stepId,
      coordinates: last.coordinates,
      generation: last.generation,
      disposed: last.disposed,
    };
    throw new Error(`Preview snapshot did not reach the expected state. Last packet: ${JSON.stringify(compact)}; last error: ${lastError}`, { cause: error });
  }
  return page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
}

async function waitForText(page: Page, selector: string, text: string) {
  const expected = text.replace(/\s+/g, "");
  await expect.poll(async () => (await page.locator(selector).evaluateAll(nodes => nodes.flatMap(node => {
    if (node instanceof HTMLIFrameElement) return [node.contentDocument?.body.textContent ?? ""];
    return [node.textContent ?? ""];
  }).join(" ")).catch(() => "")).replace(/\s+/g, ""), { timeout: 30_000 }).toContain(expected);
}

async function selectPreview(page: Page, selector: "#preview-variant" | "#preview-edition", value: string) {
  await page.locator(selector).selectOption(value);
  await expect.poll(() => page.locator("#preview-selection-status").textContent(), { timeout: 30_000 }).toBe("Selection accepted");
}

async function writeCampaignFixture(root: string, sample: string, variant: string) {
  const original = await readFile(join(repoRoot, "examples/marketing/campaign-library/launch-card.media.ts"), "utf8");
  const art = await readFile(join(repoRoot, "examples/marketing/campaign-library/art.ts"), "utf8");
  await writeFile(join(root, "launch-card.media.ts"), original
    .replace('title: "Make room."', `title: "${sample}"`)
    .replace('teams: { title: "Build together." }', `teams: { title: "${variant}" }`));
  await writeFile(join(root, "art.ts"), art);
}

function semanticNode(snapshot: PreviewSnapshot, id: string) {
  const root = snapshot.semantic?.root as { nodes?: Array<{ id: string; metadata?: Record<string, unknown> }> } | undefined;
  return root?.nodes?.find(node => node.id === id)?.metadata;
}

describe("variant and interactive CLI dev preview", { timeout: 180_000 }, () => {
  it("keeps inspection available on a still while hiding playback and temporal scrubbing", async () => {
    await mkdir(join(repoRoot, "tests/integration/output"), { recursive: true });
    const root = await mkdtemp(join(repoRoot, "tests/integration/output/dev-preview-still-"));
    const mediaPath = join(root, "still.media.ts");
    await writeFile(mediaPath, `import { image, Frame, Fill, Text } from "@foxworth/superimg";
export default image({
  size: { width: 640, height: 360 },
  render(ctx) {
    return Frame({ id: "still-frame", width: ctx.width, height: ctx.height },
      Fill({ color: "#20233a" }),
      Text({ id: "still-label", variant: "title", color: "#f7f2e8" }, "Still preview"),
    );
  },
});
`);
    const server = await startCliDev(mediaPath);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(String(error)));
      await page.goto(server.startupUrl);
      const config = await (await page.request.get(`${server.url}/api/config`)).json();
      expect(config).toMatchObject({ previewKind: "media", sourceKind: "media", mediaKind: "image", width: 640, height: 360 });
      await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && Boolean(value.source?.revision));

      await expect.poll(() => page.locator(".si-deck").isVisible()).toBe(true);
      await expect.poll(() => page.locator("#inspector-btn").isVisible()).toBe(true);
      await page.locator("#inspector-btn").click();
      await expect.poll(() => page.locator("#inspector-panel").isVisible()).toBe(true);
      await expect.poll(() => page.locator("#play-pause").isVisible()).toBe(false);
      await expect.poll(() => page.locator(".si-scrub").isVisible()).toBe(false);
      await expect.poll(() => page.locator("#timeline-container").isVisible()).toBe(false);
      expect(pageErrors).toEqual([]);
    } finally {
      await browser?.close();
      await stop(server.child);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("selects campaign variant and square edition, retains public coordinates across reload/HMR, and recovers accepted output", async () => {
    await mkdir(join(repoRoot, "tests/integration/output"), { recursive: true });
    const root = await mkdtemp(join(repoRoot, "tests/integration/output/dev-preview-campaign-"));
    await writeCampaignFixture(root, "Make room.", "Build together.");
    const mediaPath = join(root, "launch-card.media.ts");
    const server = await startCliDev(mediaPath, ["--variant", "teams", "--edition", "square"]);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(String(error)));
      await page.goto(server.startupUrl);
      await expect.poll(() => page.locator("#preview-variant").inputValue()).toBe("teams");
      await expect.poll(() => page.locator("#preview-edition").inputValue()).toBe("square");
      await waitForText(page, "iframe", "Build together.");

      // Explicit default coordinates must override the CLI's startup defaults.
      await selectPreview(page, "#preview-variant", "default");
      await selectPreview(page, "#preview-edition", "default");
      await expect.poll(() => new URL(page.url()).searchParams.get("variantId")).toBe("default");
      await expect.poll(() => new URL(page.url()).searchParams.get("editionId")).toBe("default");
      const defaultConfig = await (await page.request.get(`${server.url}/api/config?variantId=default&editionId=default`)).json();
      expect(defaultConfig).toMatchObject({ width: 640, height: 360, variantId: "default", editionId: "default" });
      const defaultPreview = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.coordinates?.variantId === "default" && value.coordinates?.editionId === "default");
      expect(defaultPreview).toMatchObject({ width: 640, height: 360 });
      await waitForText(page, "iframe", "Make room.");

      await selectPreview(page, "#preview-variant", "teams");
      await selectPreview(page, "#preview-edition", "square");

      await expect.poll(() => new URL(page.url()).searchParams.get("variantId")).toBe("teams");
      await expect.poll(() => new URL(page.url()).searchParams.get("editionId")).toBe("square");
      const config = await (await page.request.get(`${server.url}/api/config?variantId=teams&editionId=square`)).json();
      expect(config).toMatchObject({ previewKind: "media", sourceKind: "media", width: 640, height: 640, variantId: "teams", editionId: "square" });
      expect(config.variants).toContainEqual({ id: "teams" });
      expect(config.editions).toContainEqual({ id: "square" });

      await page.waitForFunction("Boolean(window.superimgInspection)");
      const first = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && Boolean(value.source?.revision));
      const firstBundle = await (await page.request.get(`${server.url}/api/template-bundle?variantId=teams&editionId=square`)).json();
      expect(firstBundle.source).toMatchObject({ revision: first.source?.revision });
      expect(firstBundle.inputIdentity).toBeTruthy();
      expect(first.source?.revision).toBeTruthy();
      expect(first.coordinates).toMatchObject({ variantId: "teams", editionId: "square" });
      expect(first).toMatchObject({ width: 640, height: 640, compilation: { status: "succeeded" } });
      await expect(await page.locator("iframe").first().isVisible()).toBe(true);
      await waitForText(page, "iframe", "Build together.");
      const selectedGeometry = first.geometry.content;
      expect(selectedGeometry).toBeTruthy();
      expect(selectedGeometry?.width).toBeGreaterThan(0);
      expect(selectedGeometry?.height).toBeGreaterThan(0);

      await page.reload();
      await expect.poll(() => new URL(page.url()).searchParams.get("variantId")).toBe("teams");
      await expect.poll(() => new URL(page.url()).searchParams.get("editionId")).toBe("square");
      const reloaded = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && Boolean(value.source?.revision));
      expect(reloaded).toMatchObject({ width: 640, height: 640 });
      expect(reloaded.source).toEqual(first.source);
      await waitForText(page, "iframe", "Build together.");

      await writeCampaignFixture(root, "Make room.", "Work together.");
      const updated = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.source?.revision !== reloaded.source?.revision);
      expect(updated.coordinates).toMatchObject({ variantId: "teams", editionId: "square" });
      const updatedBundle = await (await page.request.get(`${server.url}/api/template-bundle?variantId=teams&editionId=square`)).json();
      expect(updatedBundle.inputIdentity).toBeTruthy();
      expect(updatedBundle.inputIdentity).not.toBe(firstBundle.inputIdentity);
      await expect.poll(() => new URL(page.url()).searchParams.get("variantId")).toBe("teams");
      await expect.poll(() => new URL(page.url()).searchParams.get("editionId")).toBe("square");
      await waitForText(page, "iframe", "Work together.");
      expect(updated.geometry.content).toMatchObject({ width: expect.any(Number), height: expect.any(Number) });

      await writeFile(mediaPath, 'export default image({ render( {');
      const failed = await waitForSnapshot(page, value => value.compilation?.status === "failed");
      expect(failed.source).toEqual(updated.source);
      expect(failed.presented?.frame).toBe(updated.presented?.frame);
      await waitForText(page, "iframe", "Work together.");
      const diagnostic = await page.request.get(`${server.url}/api/config?variantId=teams&editionId=square`);
      expect(diagnostic.status()).toBe(500);

      await writeCampaignFixture(root, "Make room.", "Recovered together.");
      const recovered = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.source?.revision !== updated.source?.revision);
      expect(recovered.coordinates).toMatchObject({ variantId: "teams", editionId: "square" });
      const recoveredBundle = await (await page.request.get(`${server.url}/api/template-bundle?variantId=teams&editionId=square`)).json();
      expect(recoveredBundle.inputIdentity).toBeTruthy();
      expect(recoveredBundle.inputIdentity).not.toBe(updatedBundle.inputIdentity);
      await waitForText(page, "iframe", "Recovered together.");
      expect(recovered.source?.revision).not.toBe(updated.source?.revision);
      expect(pageErrors).toEqual([]);
    } finally {
      await browser?.close();
      await stop(server.child);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("drives the real queue interactive preview controls, applies/resets data, and retains the accepted frame through invalid data", async () => {
    await mkdir(join(repoRoot, "tests/integration/output"), { recursive: true });
    const root = await mkdtemp(join(repoRoot, "tests/integration/output/dev-preview-interactive-"));
    for (const name of ["queue.media.ts", "model.ts"]) {
      await writeFile(join(root, name), await readFile(join(repoRoot, `examples/apps/queue-explainer/src/${name}`), "utf8"));
    }
    const mediaPath = join(root, "queue.media.ts");
    const server = await startCliDev(mediaPath);
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const pageErrors: string[] = [];
      page.on("pageerror", error => pageErrors.push(String(error)));
      await page.goto(server.startupUrl);
      await expect.poll(() => page.locator("#interactive-controls").isVisible(), { timeout: 30_000 }).toBe(true);
      const config = await (await page.request.get(`${server.url}/api/config`)).json();
      expect(config).toMatchObject({ previewKind: "interactive", sourceKind: "interactive", width: 1100, height: 620 });
      await page.waitForFunction("Boolean(window.superimgInspection)");
      const initial = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && Boolean(value.source?.revision));
      expect(initial.presented).not.toBeNull();
      expect(initial.coverage.dom).toBe("measured");
      const frame = initial.presented?.frame;
      const source = initial.source;
      expect(source?.revision).toBeTruthy();
      const prepared = await page.evaluate(async () => {
        const api = window.superimgInspection;
        const current = await api.inspect({ surfaceId: "dev-preview" });
        const inspection = await api.setMode({ surfaceId: "dev-preview", expectedGeneration: current.generation, mode: "inspection" });
        return api.seek({ surfaceId: "dev-preview", expectedGeneration: inspection.generation, frame: 0 });
      });
      expect(prepared.readiness.status).toBe("ready");
      expect(prepared.presented?.frame).toBe(0);
      await page.evaluate(async () => {
        const api = window.superimgInspection;
        const current = await api.inspect({ surfaceId: "dev-preview" });
        await api.setMode({ surfaceId: "dev-preview", expectedGeneration: current.generation, mode: "live" });
      });

      const step = page.locator("#interactive-step");
      await step.selectOption("compare");
      await expect.poll(() => page.locator("#interactive-step").inputValue()).toBe("compare");
      const compare = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.presented?.frame !== frame);
      expect(compare.source).toEqual(source);
      if (compare.clock.isPlaying) await page.locator("#play-pause").click();

      const data = page.locator("#interactive-data");
      await data.fill('{"workers":2,"arrivalRate":3}');
      await page.locator("#interactive-apply-data").click();
      const firstPatch = await waitForSnapshot(page, value => semanticNode(value, "workers")?.count === 2);
      expect(semanticNode(firstPatch, "workers")).toMatchObject({ count: 2 });
      await expect.poll(() => page.locator("iframe").evaluateAll(frames => frames.some(frame => frame.contentDocument?.body.textContent?.includes("2 of 2 workers")))).toBe(true);
      await data.fill('{"highlightBacklog":true}');
      await page.locator("#interactive-apply-data").click();
      await expect.poll(() => page.locator("#interactive-status").textContent()).toBe("Live data applied.");
      const patched = await waitForSnapshot(page, value => semanticNode(value, "backlog")?.highlighted === true && semanticNode(value, "workers")?.count === 2);
      expect(semanticNode(patched, "workers")).toMatchObject({ count: 2 });
      expect(semanticNode(patched, "backlog")).toMatchObject({ highlighted: true });
      await expect.poll(() => page.locator("iframe").evaluateAll(frames => frames.some(frame => frame.contentDocument?.body.textContent?.includes("2 of 2 workers")))).toBe(true);
      expect(patched.source).toEqual(source);

      const queueSource = await readFile(mediaPath, "utf8");
      await writeFile(mediaPath, queueSource.replace('const AMBER = "#a85f1c";', 'const AMBER = "#9a4f18";'));
      const hotUpdated = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.source?.revision !== source?.revision);
      expect(hotUpdated.source?.revision).not.toBe(source?.revision);
      const hotSemantic = await waitForSnapshot(page, value => semanticNode(value, "backlog")?.highlighted === true && semanticNode(value, "workers")?.count === 2);
      expect(semanticNode(hotSemantic, "workers")).toMatchObject({ count: 2 });
      expect(semanticNode(hotSemantic, "backlog")).toMatchObject({ highlighted: true });
      await expect.poll(() => page.locator("iframe").evaluateAll(frames => frames.some(frame => frame.contentDocument?.body.textContent?.includes("2 of 2 workers")))).toBe(true);

      await data.fill("{ malformed");
      await page.locator("#interactive-apply-data").click();
      await expect.poll(() => page.locator("#interactive-status").textContent()).toMatch(/^Data not applied:/);
      const retained = await page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
      expect(retained.source).toEqual(hotUpdated.source);
      expect(retained.presented?.frame).toBe(patched.presented?.frame);
      const recovered = await waitForSnapshot(page, value => value.compilation?.status === "succeeded"
        && value.source?.revision === hotUpdated.source?.revision
        && value.presented?.frame === patched.presented?.frame);
      expect(recovered.source).toEqual(hotUpdated.source);
      expect(recovered.presented?.frame).toBe(patched.presented?.frame);
      expect(semanticNode(recovered, "workers")).toMatchObject({ count: 2 });
      expect(semanticNode(recovered, "backlog")).toMatchObject({ highlighted: true });

      await page.locator("#interactive-step").selectOption("reflect");
      await expect.poll(() => page.locator("#interactive-step").inputValue()).toBe("reflect");
      const reflect = await waitForSnapshot(page, value => value.stepId === "reflect" && value.compilation?.status === "succeeded");
      const playbackStart = await page.evaluate(async () => {
        const api = window.superimgInspection;
        let current = await api.inspect({ surfaceId: "dev-preview" });
        if (current.clock.owner !== "inspection") current = await api.setMode({ surfaceId: "dev-preview", expectedGeneration: current.generation, mode: "inspection" });
        const selected = await api.seek({ surfaceId: "dev-preview", expectedGeneration: current.generation, frame: 0 });
        return api.setMode({ surfaceId: "dev-preview", expectedGeneration: selected.generation, mode: "live" });
      });
      expect(playbackStart.presented?.frame).toBe(0);
      expect(playbackStart.clock.owner).toBe("playback");
      if (!playbackStart.clock.isPlaying) await page.locator("#play-pause").click();
      let lastPlaybackState: unknown;
      try {
        await expect.poll(async () => {
        const value = await page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
        const button = page.locator("#play-pause");
        lastPlaybackState = {
          clock: value.clock,
          frame: value.presented?.frame,
          requestedFrame: value.requestedFrame,
          totalFrames: value.totalFrames,
          button: { disabled: await button.isDisabled(), title: await button.getAttribute("title"), playing: await button.getAttribute("data-playing") },
        };
        return Boolean((lastPlaybackState as { clock?: { isPlaying?: boolean }; frame?: number } | undefined)?.clock?.isPlaying)
          && (lastPlaybackState as { frame?: number } | undefined)?.frame !== playbackStart.presented?.frame;
        }, { timeout: 10_000 }).toBe(true);
      } catch {
        throw new Error(`Playback did not start from frame 0: ${JSON.stringify(lastPlaybackState)}`);
      }
      const playing = await page.evaluate(() => window.superimgInspection.inspect({ surfaceId: "dev-preview" }));
      expect(playing.clock.isPlaying).toBe(true);
      expect(playing.presented?.frame).not.toBe(playbackStart.presented?.frame);

      await page.locator("#interactive-reset").click();
      await expect.poll(async () => JSON.parse(await page.locator("#interactive-data").inputValue())).toEqual({});
      await expect.poll(() => page.locator("iframe").evaluateAll(frames => frames.some(frame => frame.contentDocument?.body.textContent?.includes("of 4 workers")))).toBe(true);
      await expect.poll(() => page.locator("#interactive-step").inputValue()).toBe("observe");
      const reset = await waitForSnapshot(page, value => value.compilation?.status === "succeeded" && value.source?.revision === hotUpdated.source?.revision && value.presented?.frame === 0);
      expect(reset.source).toEqual(hotUpdated.source);
      expect(reset.presented?.frame).toBe(0);
      expect(reset.clock.isPlaying).toBe(false);

      expect(pageErrors).toEqual([]);
    } finally {
      await browser?.close();
      await stop(server.child);
      await rm(root, { recursive: true, force: true });
    }
  });
});

declare global {
  interface Window {
    superimgInspection: {
      inspect(options: { surfaceId: string }): Promise<PreviewSnapshot>;
      setMode(options: { surfaceId: string; expectedGeneration: number; mode: "inspection" | "live" }): Promise<PreviewSnapshot>;
      seek(options: { surfaceId: string; expectedGeneration: number; frame: number }): Promise<PreviewSnapshot>;
    };
  }
}
