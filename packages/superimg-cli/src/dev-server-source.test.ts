import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashBytes } from "@superimg/core";
import type { TemplateBundle } from "@superimg/types";
import { startDevServer, type DevServer, type DevServerOptions } from "./dev-server.js";

const fixture = vi.hoisted(() => ({ root: "" }));
// Exercise the current compiler source while the shared render-stack build is
// deferred until the parallel CLI changes have settled.
vi.mock("@superimg/core/bundler", async () => {
  const compilerSource = new URL("../../superimg-core/src/bundler/bundler.js", import.meta.url).pathname;
  return import(compilerSource);
});
let server: DevServer | undefined;
afterEach(async () => {
  await server?.close(); server = undefined;
  if (fixture.root) await rm(fixture.root, { recursive: true, force: true });
});

async function setup(options: Omit<DevServerOptions, "port"> = {}) {
  fixture.root = await realpath(await mkdtemp(join(tmpdir(), "superimg-dev-source-")));
  await writeFile(join(fixture.root, "package.json"), '{"type":"module"}');
  const entry = join(fixture.root, "city.media.ts");
  const helper = join(fixture.root, "camera.ts");
  await writeFile(helper, 'export function camera() { return "look toward sky"; }');
  await writeFile(entry, source());
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Expected test port");
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  server = await startDevServer(entry, { ...options, port: address.port, projectRoot: fixture.root });
  return { entry, helper, origin: new URL(server.url).origin };
}
function source(extra = "") {
  return `import { video, Html } from "@foxworth/superimg";
    import { camera } from "./camera";
    ${extra}
    export default video({ size: { width: 320, height: 180 }, fps: 4, duration: "1s",
      render() { return Html({ width: "fill", height: "fill", html: "<p>" + camera() + "</p>" }); }
    });`;
}
async function bundle(origin: string, fresh = false): Promise<TemplateBundle & { generation: number; moduleUrl: string }> {
  const response = await fetch(`${origin}/api/template-bundle${fresh ? "?reload=1" : ""}`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { const value = await read(); if (accept(value)) return value; } catch { /* compile may still be settling */ }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Timed out waiting for fresh helper bundle");
}

describe("imported dev source freshness", { timeout: 20000 }, () => {
  it("returns companion module metadata without changing entry source identity", async () => {
    const { entry, origin } = await setup();
    await writeFile(join(entry, "..", "dynamic.ts"), 'export const value = "dynamic";');
    await writeFile(entry, source('export async function loadCamera() { return (await import("./dynamic")).value; }'));
    const result = await bundle(origin, true);
    expect(result.source?.revision).toBe(hashBytes(result.code));
    expect(result.outputSetIdentity).toBeTruthy();
    expect(result.outputs?.filter(output => output.type === "chunk").length).toBeGreaterThan(1);
    const moduleUrl = result.moduleUrl;
    const entryResponse = await fetch(new URL(moduleUrl, origin));
    expect(await entryResponse.text()).toBe(result.code);
    const companion = result.outputs!.find(output => output.type === "chunk" && !output.isEntry)!;
    const companionResponse = await fetch(new URL(companion.fileName, new URL(moduleUrl, origin)));
    expect(companionResponse.status).toBe(200);
    expect(await companionResponse.text()).toBe(companion.type === "chunk" ? companion.code : "");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`${origin}/api/config`);
      const value = await page.evaluate(`import(${JSON.stringify(new URL(moduleUrl, origin).href)}).then(module => module.loadCamera())`);
      expect(value).toBe("dynamic");
    } finally { await browser.close(); }
  });
  it("updates a helper-only camera edit, exposes both compiled identities, and rebuilds manual Reload", async () => {
    const { helper, origin } = await setup();
    const first = await bundle(origin);
    expect(first.dependencies).toContain(helper);
    expect(first.source?.revision).toBe(hashBytes(first.code));
    // Let the dependency watcher finish installing before the helper edit.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await writeFile(helper, 'export function camera() { return "look toward rooftops"; }');
    const watched = await eventually(() => bundle(origin), (value) => value.source?.revision !== first.source?.revision);
    expect(watched.code).toContain("look toward rooftops");
    const ir = await (await fetch(`${origin}/api/ir`)).json() as { media: { hashes: { programHash: string } }; source: { revision: string }; previewSource: { revision: string } };
    expect(ir.source.revision).toBe(ir.media.hashes.programHash);
    expect(ir.previewSource.revision).toBe(watched.source?.revision);
    const reloaded = await bundle(origin, true);
    expect(reloaded.generation).toBeGreaterThan(watched.generation);
    expect(reloaded.source?.revision).toBe(watched.source?.revision);
    expect(reloaded.code).toContain("look toward rooftops");
  });

  it("recovers when a watched helper is deleted and recreated without restart", async () => {
    const { helper, origin } = await setup();
    await bundle(origin);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await rm(helper);
    await eventually(() => fetch(`${origin}/api/template-bundle`), (response) => response.status === 500);
    await writeFile(helper, 'export function camera() { return "restored route"; }');
    expect((await eventually(() => bundle(origin), (value) => value.code.includes("restored route"))).code).toContain("restored route");
  });

  it("recovers when a missing relative helper is added after a failed compile", async () => {
    const { entry, origin } = await setup();
    await bundle(origin);
    await mkdir(join(fixture.root, "parts"));
    await writeFile(entry, source('import "./parts/heading";'));
    expect((await fetch(`${origin}/api/template-bundle?reload=1`)).status).toBe(500);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const added = join(fixture.root, "parts", "heading.ts");
    await writeFile(added, 'console.log("heading-ready");');
    const restored = await eventually(() => bundle(origin), (value) => value.code.includes("heading-ready"));
    expect(restored.dependencies).toContain(added);
  });

  it("reloads automatically when an imported *.script.md file is saved", async () => {
    const { entry, origin } = await setup();
    const scriptPath = join(fixture.root, "reel.script.md");
    const v1 = [
      "```shot id=open hold=2",
      "Opening view.",
      "```",
      "",
      "```speech at=0.2..1.4",
      "who: chick",
      "",
      "First draft.",
      "```",
      "",
    ].join("\n");
    await writeFile(scriptPath, v1);
    await writeFile(
      entry,
      `import { video, Html } from "@foxworth/superimg";
        import script from "./reel.script.md";
        const shot = script.blocks.find((b) => b.kind === "shot");
        const speech = script.blocks.find((b) => b.kind === "speech");
        export default video({
          size: { width: 320, height: 180 },
          fps: 4,
          duration: \`\${shot?.hold ?? 1}s\`,
          render() {
            return Html({
              width: "fill",
              height: "fill",
              html: [script.hash, script.editHash, speech?.lines[0] ?? ""].join("|"),
            });
          },
        });`,
    );
    const first = await bundle(origin, true);
    expect(first.dependencies).toContain(scriptPath);
    expect(first.code).toContain("First draft.");
    // Wait briefly for dependencyWatcher to attach to the new *.script.md file.
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Timing-only edit reloads the bundle and changes duration/editHash.
    const v2 = v1.replace("hold=2", "hold=4");
    await writeFile(scriptPath, v2);
    const retimed = await eventually(
      () => bundle(origin),
      (value) => value.source?.revision !== first.source?.revision,
    );
    expect(retimed.code).toMatch(/"?hold"?:\s*4/);
    const retimedConfig = await (await fetch(`${origin}/api/config`)).json() as { duration: number };
    expect(retimedConfig.duration).toBe(4);

    // Word edit reloads the bundle with the updated line.
    const v3 = v2.replace("First draft.", "Second draft.");
    await writeFile(scriptPath, v3);
    const rewritten = await eventually(
      () => bundle(origin),
      (value) => value.code.includes("Second draft."),
    );
    expect(rewritten.source?.revision).not.toBe(retimed.source?.revision);
  });
});


it("serves selected named/default exports with common compiler identities and a source-matched frame report", async () => {
  const { entry, origin } = await setup({ edition: "square", variantId: "night", entryId: "chosen-entry", entryData: { title: "chosen" } });
  await writeFile(entry, `import { video, Html } from "@foxworth/superimg";
    export const authored = video({ size: { width: 320, height: 180 }, duration: "1s", fps: 4,
      sample: { title: "authored", accent: "base" }, variants: { night: { accent: "moon" } }, editions: { square: { size: { width: 108, height: 108 } } },
      render(ctx) { return Html({ width: "fill", height: "fill", html: ctx.data.title }); }
    }); export const marker = "preserved"; export default authored;`);
  const selected = await bundle(origin, true);
  const module = await import(`data:text/javascript;base64,${Buffer.from(selected.code).toString("base64")}`);
  expect(module.authored.sample.title).toBe("authored");
  expect(module.default.sample).toMatchObject({ title: "chosen", accent: "moon" });
  expect(module.default.config).toMatchObject({ width: 108, height: 108 });
  expect(module.marker).toBe("preserved");
  const config = await (await fetch(`${origin}/api/config`)).json();
  const baseConfig = await (await fetch(`${origin}/api/config?variantId=default&editionId=default`)).json();
  const selectedAgain = await (await fetch(`${origin}/api/config?variantId=night&editionId=square`)).json();
  const ir = await (await fetch(`${origin}/api/ir`)).json();
  const inspected = await (await fetch(`${origin}/api/inspect?frame=2`)).json();
  expect(config.inputIdentity).toBe(selected.inputIdentity);
  expect(config).toMatchObject({ width: 108, height: 108, variantId: "night", editionId: "square" });
  expect(baseConfig).toMatchObject({ width: 320, height: 180, variantId: "default", editionId: "default" });
  expect(selectedAgain).toMatchObject({ width: 108, height: 108, variantId: "night", editionId: "square" });
  expect(ir.inputIdentity).toBe(selected.inputIdentity);
  expect(inspected.inputIdentity).toBe(selected.inputIdentity);
  expect(inspected.source).toEqual(selected.source);
  expect(inspected.frame).toBe(2);
  expect(inspected.report.config).toMatchObject({ width: 108, height: 108 });
  expect(config.variants).toEqual([{ id: "night" }]);
  expect(config.editions).toEqual([{ id: "square" }]);
  const coordinates = { entryId: "chosen-entry", variantId: "night", editionId: "square" };
  expect(inspected.report.coordinates).toEqual([coordinates]);
  expect(inspected.selection).toEqual({ coordinates, projectionCoordinates: { variantId: "default", editionId: "default" } });
  expect(inspected.report.findings.length).toBeGreaterThan(0);
  for (const finding of inspected.report.findings) if (finding.coordinates) expect(finding.coordinates).toEqual(coordinates);
  expect(inspected.report.coverage.samples).toContainEqual(expect.objectContaining({ frame: 2, coordinates }));
  expect(inspected.report.metadata.samples).toContainEqual(expect.objectContaining({ frame: 2, coordinates, coverage: expect.objectContaining({ samples: expect.arrayContaining([expect.objectContaining({ frame: 2, coordinates })]) }) }));
  expect(inspected.report.metadata?.renderedLayout).toBeUndefined();
  expect((await fetch(`${origin}/api/inspect?frame=-1`)).status).toBe(400);
  expect((await fetch(`${origin}/api/inspect?frame=1.2`)).status).toBe(400);
});

it("returns structured parser diagnostics from the config route after a failed edit", async () => {
  const { entry, origin } = await setup();
  await bundle(origin);
  await writeFile(entry, '// 😀\nexport default (;');
  await fetch(`${origin}/api/template-bundle?reload=1`);
  const config = await (await fetch(`${origin}/api/config`)).json();
  expect(config.error.code).toBe("MEDIA_SOURCE_PARSE_ERROR");
  expect(config.error.details.compilerDiagnostics).toContainEqual(expect.objectContaining({ code: "MEDIA_SOURCE_PARSE_ERROR", stage: "source", line: 2, labels: expect.any(Array) }));
});
