import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { build } from "vite";
import type { RolldownOutput } from "rolldown";
import { expect, it } from "vitest";
import { image, NativeSurface } from "./index.js";
import { prepareNativeSurface, render, shutdown } from "./runtime.node.js";

it("renders a Vite-built native module and observes edits to a dynamic companion", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-native-vite-"));
  try {
    const entry = join(root, "world.ts");
    const companion = join(root, "color.ts");
    await writeFile(entry, `export default { async create({canvas}: {canvas: HTMLCanvasElement}) { const {color}=await import('./color'); const ctx=canvas.getContext('2d')!; return {sample(){ctx.fillStyle=color;ctx.fillRect(0,0,32,32)},dispose(){}}; } };`);
    async function renderColor(color: string) {
      await writeFile(companion, `export const color=${JSON.stringify(color)};`);
      const built = await build({ configFile: false, logLevel: "silent", build: { write: false, sourcemap: true, minify: false, lib: { entry, formats: ["es"], fileName: () => "world.js" }, rollupOptions: { output: { inlineDynamicImports: false } } } });
      const outputs = (Array.isArray(built) ? built : [built]) as RolldownOutput[];
      const files: Record<string, string | Uint8Array> = {};
      let entryName: string | undefined;
      for (const file of outputs.flatMap(output => output.output)) {
        files[file.fileName] = file.type === "chunk" ? file.code : file.source;
        if (file.type === "chunk" && file.isEntry) entryName = file.fileName;
      }
      if (!entryName) throw new Error("Vite did not emit the surface entry");
      expect(Object.keys(files).some(name => name.startsWith("color-") && name.endsWith(".js"))).toBe(true);
      const world = await prepareNativeSurface({ entry: entryName, files });
      const entryChunk = world.nativeModuleSets[0]!.outputs.find(file => file.fileName === entryName);
      expect(entryChunk?.type === "chunk" && entryChunk.sourceMap.sources.some(source => source.endsWith("world.ts"))).toBe(true);
      const media = image({ size: { width: 32, height: 32 }, nativeModuleSets: world.nativeModuleSets, render: () => NativeSurface({ id: "world", module: world.module, width: 32, height: 32, seconds: 0, data: {} }) });
      const pixels = await sharp(await (await render(media, { as: "png" })).bytes()).ensureAlpha().raw().toBuffer();
      return { pixel: [...pixels.subarray(0, 4)], identity: world.module.identity };
    }
    const before = await renderColor("#ff0000");
    const after = await renderColor("#0000ff");
    expect(before.pixel).toEqual([255, 0, 0, 255]);
    expect(after.pixel).toEqual([0, 0, 255, 255]);
    expect(after.identity).not.toBe(before.identity);
  } finally {
    await shutdown();
    await rm(root, { recursive: true, force: true });
  }
}, 30000);
