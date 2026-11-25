import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compileNodeMediaSource } from "./source.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture(code: string) {
  const root = await mkdtemp(join(tmpdir(), "superimg-unresolved-")); roots.push(root);
  await writeFile(join(root, "scene.media.ts"), code);
  return root;
}
it("rejects a surviving unresolved runtime import before evaluation", async () => {
  const root = await fixture('import { image } from "missing-superimg-runtime"; export default image({ render: () => "hello" });');
  const measure = vi.fn(async (_stage, work) => work());
  await expect(compileNodeMediaSource(root, "scene.media.ts", { measureStage: measure })).rejects.toMatchObject({
    code: "UNRESOLVED_IMPORT", message: expect.stringMatching(/missing-superimg-runtime.*scene\.media\.ts/),
    details: { compilerDiagnostics: expect.arrayContaining([expect.objectContaining({ code: "UNRESOLVED_IMPORT", stage: "resolve", severity: "error" })]) },
  });
  expect(measure.mock.calls.map(call => call[0])).not.toContain("source.evaluate");
});
it("erases missing type-only imports and evaluates a resolvable authoring package", async () => {
  const root = await fixture('import type { Absent } from "missing-type-package"; import { image } from "@foxworth/superimg"; const value: Absent | undefined = undefined; export default image({ sample: { value }, render: () => "hello" });');
  expect((await compileNodeMediaSource(root, "scene.media.ts")).compiled.media).toBeDefined();
});

it("reports the project helper that owns an unresolved import", async () => {
  const root = await fixture('import { image } from "@foxworth/superimg"; import { title } from "./helper"; export default image({ sample: { title }, render: () => "hello" });');
  await writeFile(join(root, "helper.ts"), 'import { value } from "missing-helper-dependency"; export const title = value;');
  await expect(compileNodeMediaSource(root, "scene.media.ts")).rejects.toThrow(/missing-helper-dependency.*helper\.ts/);
});
