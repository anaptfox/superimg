import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "vite";
import { expect, it } from "vitest";
import { superimgScriptVite } from "./vite.js";
import { scriptModuleCode } from "@superimg/core/bundler";

it("loads script imports in Vite with the same projection as the CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-vite-script-"));
  const script = "# Test\n\n```shot id=x hold=2\nHello\n```\n";
  const server = await createServer({ root, configFile: false, plugins: [superimgScriptVite()], server: { middlewareMode: true } });
  try {
    await writeFile(join(root, "film.script.md"), script);
    await writeFile(join(root, "entry.ts"), 'export { default } from "./film.script.md";');
    const result = (await server.ssrLoadModule("/entry.ts")).default;
    const expected = JSON.parse(scriptModuleCode(script, "film.script.md").replace(/^export default /, "").replace(/;\s*$/, ""));
    expect(result).toEqual(expected);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
