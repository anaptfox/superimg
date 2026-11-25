import { mkdtemp, mkdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { build, createServer } from "vite";
import { expect, it } from "vitest";
import { nativeSurfaceVite } from "./vite.js";
import { render, shutdown } from "./runtime.node.js";

it("loads a Vite SSR native world, follows companion edits, and recovers after a bad edit", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-surface-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    const world = join(root, "world.ts"), color = join(root, "color.ts");
    await writeFile(world, `export default { async create({canvas}: {canvas: HTMLCanvasElement}) { const {color}=await import('./color'); const ctx=canvas.getContext('2d')!; return {sample(){ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}; } };`);
    await writeFile(color, `export const color='#ff0000';`);
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg'; import world from './world.ts?superimg-surface'; export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    async function pixel() {
      const media = (await server!.ssrLoadModule("/scene.ts")).default;
      expect(media.config.nativeModuleSets[0].outputs.filter((file: { type: string }) => file.type === "chunk").length).toBeGreaterThan(1);
      const raw = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
      return [...raw.subarray(0, 4)];
    }
    async function edit(value: string) {
      const changed = new Promise<void>((done, fail) => {
        const timeout = setTimeout(() => fail(new Error("Vite did not observe the edit")), 5000);
        server!.watcher.once("change", () => { clearTimeout(timeout); setTimeout(done, 100); });
      });
      await writeFile(color, value);
      await changed;
    }
    expect(await pixel()).toEqual([255, 0, 0, 255]);
    await edit("export const color = ;");
    await expect(server.ssrLoadModule("/scene.ts")).rejects.toThrow();
    await edit("export const color='#0000ff';");
    expect(await pixel()).toEqual([0, 0, 255, 255]);
    async function watch(event: "unlink" | "add", change: () => Promise<void>) {
      const changed = new Promise<void>((done, fail) => {
        const timeout = setTimeout(() => fail(new Error(`Vite did not observe ${event}`)), 5000);
        server!.watcher.once(event, () => { clearTimeout(timeout); setTimeout(done, 100); });
      });
      await change();
      await changed;
    }
    await watch("unlink", () => unlink(color));
    await expect(server.ssrLoadModule("/scene.ts")).rejects.toThrow();
    await watch("add", () => writeFile(color, "export const color='#00ff00';"));
    expect(await pixel()).toEqual([0, 255, 0, 255]);
  } finally {
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("passes binary emitted assets into the prepared closure and refuses browser loading", async () => {
  const plugin = nativeSurfaceVite({ build: async () => ({ output: [
    { type: "chunk", fileName: "world.js", code: "export default {}", isEntry: true, moduleIds: ["/world.ts", "/asset.bin?url"] },
    { type: "asset", fileName: "asset.bin", source: new Uint8Array([0, 127, 255]) },
  ] }) });
  const id = plugin.resolveId("./world.ts?superimg-surface", "/project/scene.ts")!;
  const watched: string[] = [];
  const context = { addWatchFile(path: string) { watched.push(path); } };
  const code = await plugin.load.call(context, id, { ssr: true });
  expect(code).toContain('Buffer.from("AH//", "base64")');
  expect(watched).toContain("/asset.bin");
  await expect(plugin.load.call(context, id, { ssr: false })).rejects.toThrow(/Node SSR/);
});

it("loads an emitted binary asset from the Vite world in Chromium", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-binary-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    await writeFile(join(root, "world.ts"), `import {url} from 'virtual:binary'; export default { async create({canvas}) { const bytes=new Uint8Array(await (await fetch(url)).arrayBuffer()); const ctx=canvas.getContext('2d'); return {sample(){ctx.fillStyle='rgb('+bytes[0]+','+bytes[1]+','+bytes[2]+')';ctx.fillRect(0,0,32,32)},dispose(){}}; } };`);
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg';import world from './world.ts?superimg-surface';export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    const binaryPlugin = {
      name: "binary-world-asset",
      resolveId(id: string) { return id === "virtual:binary" ? "\0binary-world-asset" : null; },
      load(id: string) { return id === "\0binary-world-asset" ? `export const url = new URL('./paint.bin', import.meta.url).href;` : null; },
      generateBundle(this: { emitFile(file: { type: "asset"; fileName: string; source: Uint8Array }): unknown }) { this.emitFile({ type: "asset", fileName: "paint.bin", source: new Uint8Array([17, 101, 203]) }); },
    };
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build, world: { plugins: [binaryPlugin] } })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    const media = (await server.ssrLoadModule("/scene.ts")).default;
    expect(media.config.nativeModuleSets[0].outputs.some((file: { fileName: string; type: string }) => file.type === "asset" && file.fileName === "paint.bin")).toBe(true);
    const raw = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
    expect([...raw.subarray(0, 4)]).toEqual([17, 101, 203, 255]);
  } finally {
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("refuses external imports absent from the host-built closure", async () => {
  const plugin = nativeSurfaceVite({ build: async () => ({ output: [{ type: "chunk", fileName: "world.js", code: "import 'external';", isEntry: true, moduleIds: [], imports: ["external"] }] }) });
  const id = plugin.resolveId("./world.ts?superimg-surface", "/project/scene.ts")!;
  await expect(plugin.load.call({ addWatchFile() {} }, id, { ssr: true })).rejects.toThrow(/Unresolved native surface import: external/);
});

it("recovers when a companion missing on first load is created", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-missing-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    await writeFile(join(root, "world.ts"), `import {color} from './missing'; export default {create({canvas}) {const ctx=canvas.getContext('2d'); return {sample(){ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}}};`);
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg';import world from './world.ts?superimg-surface';export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    await expect(server.ssrLoadModule("/scene.ts")).rejects.toThrow();
    const added = new Promise<void>((done, fail) => {
      const timeout = setTimeout(() => fail(new Error("Vite did not observe the new companion")), 5000);
      server!.watcher.once("add", () => { clearTimeout(timeout); setTimeout(done, 100); });
    });
    await writeFile(join(root, "missing.ts"), "export const color='#00ff00';");
    await added;
    const media = (await server.ssrLoadModule("/scene.ts")).default;
    const raw = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
    expect([...raw.subarray(0, 4)]).toEqual([0, 255, 0, 255]);
  } finally {
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("uses explicitly supplied host aliases and plugins for world compilation", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-alias-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await mkdir(join(root, "world"), { recursive: true });
    await mkdir(join(root, "shared"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    const color = join(root, "shared", "color.ts");
    await writeFile(color, "export const color='#ff0000';");
    await writeFile(join(root, "world", "world.ts"), `import {color} from '@palette'; import {alpha} from 'virtual:alpha'; export default {create({canvas}) {const ctx=canvas.getContext('2d');return {sample(){ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}}};`);
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg';import world from './world/world.ts?superimg-surface';export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    const worldPlugin = { name: "world-alpha", resolveId(id: string) { return id === "virtual:alpha" ? "\0test-alpha" : null; }, load(id: string) { return id === "\0test-alpha" ? "export const alpha=1;" : null; } };
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build, world: { resolve: { alias: { "@palette": color } }, plugins: [worldPlugin] } })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    async function pixel() {
      const media = (await server!.ssrLoadModule("/scene.ts")).default;
      const raw = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
      return [...raw.subarray(0, 4)];
    }
    expect(await pixel()).toEqual([255, 0, 0, 255]);
    const changed = new Promise<void>((done, fail) => {
      const timeout = setTimeout(() => fail(new Error("Vite did not observe the aliased companion")), 5000);
      server!.watcher.once("change", () => { clearTimeout(timeout); setTimeout(done, 100); });
    });
    await writeFile(color, "export const color='#0000ff';");
    await changed;
    expect(await pixel()).toEqual([0, 0, 255, 255]);
  } finally {
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("recovers when an initially missing aliased companion outside the world directory appears", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-missing-alias-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await mkdir(join(root, "world"), { recursive: true });
    await mkdir(join(root, "shared"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    const color = join(root, "shared", "missing.ts");
    await writeFile(join(root, "world", "world.ts"), `import {color} from '@palette'; export default {create({canvas}) {const ctx=canvas.getContext('2d'); return {sample(){ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}}};`);
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg';import world from './world/world.ts?superimg-surface';export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build, world: { resolve: { alias: { "@palette": color } } } })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    await expect(server.ssrLoadModule("/scene.ts")).rejects.toThrow();
    const added = new Promise<void>((done, fail) => {
      const timeout = setTimeout(() => fail(new Error("Vite did not observe the aliased companion")), 5000);
      server!.watcher.once("add", () => { clearTimeout(timeout); setTimeout(done, 100); });
    });
    await writeFile(color, "export const color='#00ff00';");
    await added;
    const media = (await server.ssrLoadModule("/scene.ts")).default;
    const raw = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
    expect([...raw.subarray(0, 4)]).toEqual([0, 255, 0, 255]);
  } finally {
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it("rebuilds an older world when a source changes while it is pending", async () => {
  const output = { output: [{ type: "chunk", fileName: "world.js", code: "export default {}", isEntry: true, moduleIds: ["/project/world.ts"] }] };
  let finish!: (value: unknown) => void;
  let calls = 0;
  const plugin = nativeSurfaceVite({ build: () => ++calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(output) });
  const handlers = new Map<string, (path: string) => void>();
  const invalidated: unknown[] = [];
  plugin.configureServer({ watcher: { add() {}, on(event, callback) { handlers.set(event, callback); } }, moduleGraph: { getModuleById(id) { return id; }, invalidateModule(value: never) { invalidated.push(value); } } });
  const id = plugin.resolveId("./world.ts?superimg-surface", "/project/scene.ts")!;
  const context = { addWatchFile() {} };
  const old = plugin.load.call(context, id, { ssr: true });
  handlers.get("change")!("/project/color.ts");
  finish(output);
  await expect(old).resolves.toContain("prepareNativeSurface");
  expect(calls).toBe(2);
  expect(invalidated).toContain("/project/scene.ts");
  await expect(plugin.load.call(context, id, { ssr: true })).resolves.toContain("prepareNativeSurface");
});

it("stops after repeated overlapping edits rather than returning a stale world", async () => {
  let onChange: ((path: string) => void) | undefined;
  let calls = 0;
  const plugin = nativeSurfaceVite({ build: async () => {
    calls++;
    onChange!("/project/color.ts");
    return { output: [{ type: "chunk", fileName: "world.js", code: "export default {}", isEntry: true, moduleIds: [] }] };
  } });
  plugin.configureServer({ watcher: { add() {}, on(event, callback) { if (event === "change") onChange = callback; } }, moduleGraph: { getModuleById(id) { return id; }, invalidateModule() {} } });
  const id = plugin.resolveId("./world.ts?superimg-surface", "/project/scene.ts")!;
  await expect(plugin.load.call({ addWatchFile() {} }, id, { ssr: true })).rejects.toThrow(/kept changing/);
  expect(calls).toBe(3);
});

it("rebuilds a real Vite output superseded by a watched aliased companion edit", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-generation-"));
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let release!: () => void;
  let compiled!: () => void;
  const buildCompleted = new Promise<void>(done => { compiled = done; });
  const hold = new Promise<void>(done => { release = done; });
  let calls = 0;
  const delayedBuild: typeof build = async config => {
    const output = await build(config);
    if (++calls === 1) { compiled(); await hold; }
    return output;
  };
  try {
    await mkdir(join(root, "node_modules", "@foxworth"), { recursive: true });
    await mkdir(join(root, "world"), { recursive: true });
    await mkdir(join(root, "shared"), { recursive: true });
    await symlink(packageRoot, join(root, "node_modules", "@foxworth", "superimg"), "dir");
    const color = join(root, "shared", "color.ts");
    await writeFile(join(root, "world", "world.ts"), `import {color} from '@palette'; export default {create({canvas}) {const ctx=canvas.getContext('2d');return {sample(){ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}}};`);
    await writeFile(color, "export const color='#ff0000';");
    await writeFile(join(root, "scene.ts"), `import {image,NativeSurface} from '@foxworth/superimg';import world from './world/world.ts?superimg-surface';export default image({size:{width:32,height:32},nativeModuleSets:[world],render:()=>NativeSurface({id:'world',module:world,width:32,height:32,seconds:0,data:{}})});`);
    server = await createServer({ configFile: false, root, plugins: [nativeSurfaceVite({ build: delayedBuild, world: { resolve: { alias: { "@palette": color } } } })], server: { middlewareMode: true, fs: { allow: [root, packageRoot, resolve(packageRoot, "../..")] } } });
    const old = server.ssrLoadModule("/scene.ts");
    await buildCompleted;
    const changed = new Promise<void>((done, fail) => {
      const timeout = setTimeout(() => fail(new Error("Vite did not observe the overlapping edit")), 5000);
      server!.watcher.once("change", () => { clearTimeout(timeout); done(); });
    });
    await writeFile(color, "export const color='#0000ff';");
    await changed;
    release();
    const current = (await old).default;
    const raw = await sharp(await (await render(current, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
    expect([...raw.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
    expect(calls).toBe(2);
  } finally {
    release();
    await shutdown();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
