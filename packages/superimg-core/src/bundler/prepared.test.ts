import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bundleMediaProgram, bundleMediaProgramPair, bundleNativeSurfaceModule, bundleTemplateESMWithMap, prepareMediaProgram } from "./bundler.js";
import { compileTemplate } from "../rendering/compiler.js";
import { hashTemplateOutputs } from "../ir/pure/serialize.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "superimg-prepared-")); directories.push(directory);
  const entry = join(directory, "card.media.ts");
  const helper = join(directory, "helper.ts");
  await writeFile(helper, 'export const title = "first";');
  await writeFile(entry, `import { image, Html } from "@foxworth/superimg";
    import { title } from "./helper";
    export const authored = image({ sample: { title, untouched: true }, size: { width: 320, height: 180 },
      editions: { square: { size: { width: 108, height: 108 } } },
      render(ctx) { return Html({ html: ctx.data.title }); } });
    export const label = "named export";
    export default authored;`);
  return { entry, helper };
}
async function moduleOf(code: string) { return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }

describe("prepared compiler projections", () => {
  it("freezes imported SVG bytes and tracks edits in a fresh build", async () => {
    const { entry } = await fixture();
    const art = join(entry, "..", "art.svg");
    await writeFile(art, '<svg xmlns="http://www.w3.org/2000/svg"><text>first</text></svg>');
    await writeFile(entry, 'import { image, Html } from "@foxworth/superimg"; import source from "./art.svg?superimg-svg"; export default image({ render: () => Html({ html: new TextDecoder().decode(source) }) });');
    const prepared = await prepareMediaProgram(entry);
    const first = await bundleMediaProgram(entry, { prepared });
    expect(first.dependencies).toContain(art);
    await writeFile(art, '<svg xmlns="http://www.w3.org/2000/svg"><text>second</text></svg>');
    const frozen = await bundleTemplateESMWithMap(entry, { prepared });
    expect(frozen.code).toContain("first");
    const fresh = await bundleMediaProgram(entry);
    expect(fresh.code).toContain("second");
    expect(fresh.inputIdentity).not.toBe(first.inputIdentity);
    await rm(art);
    await expect(bundleMediaProgram(entry)).rejects.toThrow();
  });
  it("prepares a static native surface import and attaches its closure to the selected media", async () => {
    const { entry } = await fixture();
    const directory = join(entry, "..");
    const surface = join(directory, "world.ts"), helper = join(directory, "color.ts");
    await writeFile(helper, 'export const color = "red";');
    await writeFile(surface, 'export default { async create() { return (await import("./color")).color; } };');
    await writeFile(entry, 'import { image, Html } from "@foxworth/superimg"; import world from "./world.ts?superimg-surface"; export default image({ render: () => Html({ html: world.moduleUrl }) });');
    const first = await bundleMediaProgram(entry);
    const compiled = compileTemplate(first);
    expect(compiled.error).toBeUndefined();
    const module = compiled.media?.config?.nativeModuleSets?.[0];
    expect(module?.identity).toMatch(/^[a-f0-9]{64}$/);
    expect(module?.outputs.length).toBeGreaterThan(2);
    expect(hashTemplateOutputs(module!.outputs)).toBe(module!.identity);
    const direct = await bundleNativeSurfaceModule(surface);
    expect(module!.outputs).toEqual(direct.outputs);
    expect(first.nativeModuleSets?.[0]?.outputs).toEqual(direct.outputs);
    expect(compileTemplate(first.code).error?.message).toMatch(/Missing prepared native surface module set/);
    const entryOutput = direct.outputs.find(output => output.type === "chunk" && output.isEntry);
    if (!entryOutput || entryOutput.type !== "chunk") throw new Error("Missing native entry");
    expect(first.code).not.toContain(entryOutput.code);
    const pair = await bundleMediaProgramPair(entry);
    expect(pair.iife.nativeModuleSets?.[0]?.identity).toBe(pair.esm.nativeModuleSets?.[0]?.identity);
    expect(pair.esm.code).not.toContain(entryOutput.code);
    expect(compileTemplate(pair.iife).media?.config?.nativeModuleSets?.[0]?.identity).toBe(module!.identity);
    expect(first.dependencies).toContain(await realpath(helper));
    await writeFile(helper, 'export const color = "blue";');
    const second = await bundleMediaProgram(entry);
    expect(second.inputIdentity).not.toBe(first.inputIdentity);
  });
  it("uses the packaged browser bridge when preparing a native module", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-bridge-")); directories.push(directory);
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    const surface = join(directory, "world.ts");
    await writeFile(surface, 'export default { create() { return { sample() {}, dispose() {} }; } };');
    const prepared = await bundleNativeSurfaceModule(surface);
    for (const output of prepared.outputs) await writeFile(join(directory, output.fileName), output.type === "chunk" ? output.code : output.source);
    const bridge = await import(pathToFileURL(join(directory, prepared.bridgeEntry)).href);
    expect(typeof bridge.sampleNativeSurface).toBe("function");
  });
  it("prepares both native entries and a dynamic companion as one complete file set", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-module-")); directories.push(directory);
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    const surface = join(directory, "world.ts"), bridge = join(directory, "bridge.ts"), helper = join(directory, "helper.ts");
    await writeFile(helper, 'export const value = "first";');
    await writeFile(surface, 'export default { async create() { return (await import("./helper")).value; } };');
    await writeFile(bridge, 'export function sample() { return "bridge"; }');
    const first = await bundleNativeSurfaceModule(surface, bridge);
    expect(first.outputs.filter(output => output.type === "chunk").length).toBeGreaterThan(2);
    expect(first.dependencies).toContain(await realpath(helper));
    for (const output of first.outputs) await writeFile(join(directory, output.fileName), output.type === "chunk" ? output.code : output.source);
    const loaded = await import(pathToFileURL(join(directory, first.surfaceEntry)).href);
    const loadedBridge = await import(pathToFileURL(join(directory, first.bridgeEntry)).href);
    expect(await loaded.default.create()).toBe("first");
    expect(loadedBridge.sample()).toBe("bridge");
    await writeFile(helper, 'export const value = "second";');
    expect((await bundleNativeSurfaceModule(surface, bridge)).outputSetIdentity).not.toBe(first.outputSetIdentity);
  });
  it("refuses a native module whose companion cannot be resolved", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-native-missing-")); directories.push(directory);
    const surface = join(directory, "world.ts"), bridge = join(directory, "bridge.ts");
    await writeFile(surface, 'import { value } from "./missing"; export default { create: () => value };');
    await writeFile(bridge, 'export function sample() {}');
    await expect(bundleNativeSurfaceModule(surface, bridge)).rejects.toThrow(/missing|resolve/i);
    await writeFile(surface, 'import { value } from "nonexistent-superimg-native-fixture"; export default { create: () => value };');
    await expect(bundleNativeSurfaceModule(surface, bridge)).rejects.toThrow(/nonexistent-superimg-native-fixture|resolve/i);
  });
  it("retains the ESM entry and dynamic companion chunks for a host to publish", async () => {
    const { entry, helper } = await fixture();
    await writeFile(helper, 'export const title = "dynamic";');
    await writeFile(entry, 'import { image, Text } from "@foxworth/superimg"; export async function load() { return (await import("./helper")).title; } export default image({ render: () => Text("ok") });');
    const bundled = await bundleTemplateESMWithMap(entry);
    const directory = await mkdtemp(join(tmpdir(), "superimg-output-")); directories.push(directory);
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    const outputs = bundled.outputs!;
    expect(Object.isFrozen(outputs)).toBe(true);
    expect(outputs.every(output => Object.isFrozen(output))).toBe(true);
    for (const output of outputs) if (output.type === "chunk") {
      expect(Object.isFrozen(output.sourceMap)).toBe(true);
      expect(Object.isFrozen(output.sourceMap.sources)).toBe(true);
    }
    expect(outputs.filter(output => output.type === "chunk").length).toBeGreaterThan(1);
    for (const output of outputs) await writeFile(join(directory, output.fileName), output.type === "chunk" ? output.code : output.source);
    const main = outputs.find(output => output.type === "chunk" && output.isEntry)!;
    const loaded = await import(pathToFileURL(join(directory, main.fileName)).href);
    expect(await loaded.load()).toBe("dynamic");
    expect(bundled.outputSetIdentity).toBeTruthy();
    await writeFile(helper, 'export const title = "changed";');
    const changed = await bundleTemplateESMWithMap(entry);
    expect(changed.outputSetIdentity).not.toBe(bundled.outputSetIdentity);
  });
  it("selects the default clone while retaining named aliases and mapped authored source", async () => {
    const { entry } = await fixture();
    const pair = await bundleMediaProgramPair(entry, { selection: { editionId: "square", entryData: { title: "selected" } } });
    const esm = await moduleOf(pair.esm.code);
    expect(esm.label).toBe("named export");
    expect(esm.authored.sample).toEqual({ title: "first", untouched: true });
    expect(esm.authored.config.width).toBe(320);
    expect(esm.default).not.toBe(esm.authored);
    expect(esm.default.sample).toEqual({ title: "selected" });
    expect(esm.default.config).toMatchObject({ width: 108, height: 108 });
    expect(compileTemplate(pair.iife).media?.sample).toEqual(esm.default.sample);
    expect(pair.iife.inputIdentity).toBe(pair.esm.inputIdentity);
    expect(pair.iife.projectionIdentity).toBe(pair.esm.projectionIdentity);
    expect(pair.iife.outputIdentity).not.toBe(pair.esm.outputIdentity);
    expect(pair.esm.sourceMap.sources.some(path => path.endsWith("card.media.ts"))).toBe(true);
  });

  it("freezes imported bytes and resolutions across formats; a fresh request observes edits", async () => {
    const { entry, helper } = await fixture();
    const prepared = await prepareMediaProgram(entry);
    const iife = await bundleMediaProgram(entry, { prepared });
    await writeFile(entry, "throw Error('entry must remain frozen');");
    await writeFile(helper, 'export const title = "second";');
    await rm(helper);
    const esm = await bundleTemplateESMWithMap(entry, { prepared });
    expect((await moduleOf(esm.code)).default.sample.title).toBe("first");
    expect(esm.inputIdentity).toBe(iife.inputIdentity);
    await writeFile(entry, prepared.sourceText);
    await writeFile(helper, 'export const title = "second";');
    const fresh = await bundleMediaProgram(entry);
    expect(compileTemplate(fresh).media?.sample?.title).toBe("second");
    expect(fresh.inputIdentity).not.toBe(iife.inputIdentity);
  });

  it("handles authored import cycles and a re-exported default without waiting on the synthetic entry", async () => {
    const { entry, helper } = await fixture();
    const original = join(entry, "..", "original.ts");
    await writeFile(original, 'import { image, Text } from "@foxworth/superimg"; import { title } from "./helper"; export const marker = "named"; export default image({ sample: { title }, render: () => Text(title) });');
    await writeFile(helper, 'import { marker } from "./original"; export const title = "cycle"; export function readMarker() { return marker; }');
    await writeFile(entry, 'export { default, marker } from "./original";');
    const pair = await bundleMediaProgramPair(entry);
    const esm = await moduleOf(pair.esm.code);
    expect(esm.marker).toBe("named");
    expect(esm.default.sample.title).toBe("cycle");
    expect(compileTemplate(pair.iife).error).toBeUndefined();
  });

  it("rejects reusing preparation with different authoring facade policy", async () => {
    const { entry, helper } = await fixture();
    const prepared = await prepareMediaProgram(entry);
    await expect(bundleMediaProgram(entry, { prepared, authoringFacades: { "application/media": helper } })).rejects.toThrow(/compiler configuration/);
  });

  it("retains the original unresolved-import diagnostic after a failed graph preload", async () => {
    const { entry, helper } = await fixture();
    await rm(helper);
    await expect(bundleMediaProgram(entry)).rejects.toMatchObject({ details: { compilerDiagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "UNRESOLVED_IMPORT", message: expect.stringContaining("./helper") }),
    ]) } });
  });

  it("does not preload an unresolved builtin in a dead authoring-facade branch", async () => {
    const { entry, helper } = await fixture();
    await writeFile(helper, 'import { createRequire } from "node:module"; export { image, Text } from "@foxworth/superimg"; export function unusedRuntime() { return createRequire(import.meta.url); }');
    await writeFile(entry, 'import { image, Text } from "application/media"; export const note = "named"; export default image({ render: () => Text("ready") });');
    const pair = await bundleMediaProgramPair(entry, { authoringFacades: { "application/media": helper } });
    expect(compileTemplate(pair.iife).error).toBeUndefined();
    expect((await moduleOf(pair.esm.code)).note).toBe("named");
  }, 2000);
  it("rejects a surviving unresolved import on every emission of a prepared program", async () => {
    const { entry } = await fixture();
    await writeFile(entry, 'import { image } from "missing-package-for-test"; export default image({ render: () => "hello" });');
    const prepared = await prepareMediaProgram(entry);
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(bundleMediaProgram(entry, { prepared })).rejects.toThrow(/missing-package-for-test.*card\.media\.ts/);
    }
  });

  it("finds a package root above the entry and reports a missing sibling import with exact guidance", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-project-")); directories.push(root);
    await mkdir(join(root, "scenes")); await mkdir(join(root, "lib"));
    await writeFile(join(root, "package.json"), '{}');
    await writeFile(join(root, "scenes", "a.media.ts"), 'import { image } from "@foxworth/superimg"; import { value } from "../lib/x"; export default image({ sample: { value }, render: () => "ok" });');
    await writeFile(join(root, "lib", "x.ts"), 'import { value } from "missing-sibling"; export { value };');
    await expect(bundleMediaProgram(join(root, "scenes", "a.media.ts"))).rejects.toMatchObject({
      code: "UNRESOLVED_IMPORT",
      suggestion: '"missing-sibling" could not be resolved from lib/x.ts. Install it in this project (for example, pnpm add missing-sibling), fix the import path, or use "import type" if you only need types. Superimg no longer treats unresolved imports as runtime globals.',
    });
  });
  it("recognizes the config marker and distinguishes authored dist from package output", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-dist-")); directories.push(root);
    await mkdir(join(root, "src", "dist"), { recursive: true }); await mkdir(join(root, "dist"));
    await writeFile(join(root, "_config.ts"), 'export default {};');
    const entry = join(root, "src", "a.media.ts");
    await writeFile(join(root, "src", "dist", "authored.ts"), 'import { value } from "missing-authored-dist"; export { value };');
    await writeFile(entry, 'import { image } from "@foxworth/superimg"; import { value } from "./dist/authored"; export default image({ sample: { value }, render: () => "ok" });');
    await expect(bundleMediaProgram(entry)).rejects.toThrow(/missing-authored-dist.*authored\.ts/);
    await writeFile(join(root, "dist", "built.ts"), 'import { value } from "missing-built-dist"; export { value };');
    await writeFile(entry, 'import { image } from "@foxworth/superimg"; import { value } from "../dist/built"; export default image({ sample: { value }, render: () => "ok" });');
    await expect(bundleMediaProgram(entry)).resolves.toBeDefined();
  });
  it("treats /tmp and its real path as the same project", async () => {
    const root = await mkdtemp("/tmp/superimg-realpath-"); directories.push(root);
    await writeFile(join(root, "package.json"), '{}');
    const entry = join(root, "scene.media.ts");
    await writeFile(entry, 'import { image } from "missing-realpath"; export default image({ render: () => "ok" });');
    await expect(bundleMediaProgram(entry, { projectRoot: await realpath(root) })).rejects.toThrow(/missing-realpath.*scene\.media\.ts/);
    await expect(bundleMediaProgram(await realpath(entry), { projectRoot: root })).rejects.toThrow(/missing-realpath.*scene\.media\.ts/);
  });

  it("skips package dist and logs out-of-scope imports in debug mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-package-dist-")); directories.push(root);
    await mkdir(join(root, "vendor", "dist"), { recursive: true });
    await writeFile(join(root, "package.json"), '{}');
    await writeFile(join(root, "vendor", "package.json"), '{}');
    await writeFile(join(root, "vendor", "dist", "built.ts"), 'import { value } from "missing-vendor-dist"; export { value };');
    const entry = join(root, "scene.media.ts");
    await writeFile(entry, 'import { image } from "@foxworth/superimg"; import { value } from "./vendor/dist/built"; export default image({ sample: { value }, render: () => "ok" });');
    const original = process.env.SUPERIMG_BUNDLER_DEBUG;
    process.env.SUPERIMG_BUNDLER_DEBUG = "1";
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(bundleMediaProgram(entry)).resolves.toBeDefined();
      expect(logs.mock.calls.some(args => String(args[0]).includes("unresolved:skipped") && String(args[1]).includes("missing-vendor-dist"))).toBe(true);
    } finally {
      logs.mockRestore();
      if (original === undefined) delete process.env.SUPERIMG_BUNDLER_DEBUG; else process.env.SUPERIMG_BUNDLER_DEBUG = original;
    }
  });

});
