import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { prepareSource } from "./prepare-source.js";

it("prepares singular IR using verified entry and imported source overrides", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-prepare-"));
  try {
    await writeFile(join(root, "helper.ts"), 'export const width = 40;');
    await writeFile(join(root, "scene.media.ts"), `import { image, Html } from '@foxworth/superimg'; import { width } from './helper'; export default image({ size: { width, height: 30 }, render: () => Html({ id: 'box', width, height: 30, html: 'hi' }) });`);
    const text = 'export const width = 80;';
    const result = await prepareSource(root, "scene", { kind: "singular", overrides: { "helper.ts": text } });
    expect(result.ir.canvas.width).toBe(80);
    expect(result.sourceHashes["helper.ts"]).toBe(createHash("sha256").update(text).digest("hex"));
    await expect(prepareSource(root, "scene", { kind: "singular", overrides: { "../helper.ts": text } })).rejects.toThrow(/Invalid project-relative/);
  } finally { await rm(root, { recursive: true, force: true }); }
}, 30000);
