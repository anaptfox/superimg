import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { preparePlate } from "@foxworth/superimg-node/plate";
import { findProjectRoot } from "../utils/find-project-root.js";

export async function plateCommand(input: string, options: { json?: boolean } = {}): Promise<void> {
  const { manifest, atlas } = await preparePlate(input);
  const outDir = join(findProjectRoot(), ".superimg", "plates", manifest.name);
  await mkdir(join(outDir, "frames"), { recursive: true });
  await writeFile(join(outDir, manifest.atlas.sheets[0]!.file), atlas);
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (options.json) {
    console.log(JSON.stringify({ ok: true, outDir, manifest }, null, 2));
    return;
  }
  console.log(`Plate atlas: ${outDir}`);
  console.log(`  frames: ${manifest.compiled.totalFrames}  cell: ${manifest.atlas.tileWidth}x${manifest.atlas.tileHeight}  grid: ${manifest.atlas.columns}x${manifest.atlas.rows}`);
  console.log(`  next: Plate({ src: "${basename(input)}" })`);
}
