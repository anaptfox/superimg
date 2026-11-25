import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { compileNodeMediaSource, loadNodeMediaValue, type NodeMediaAuthoringOptions } from "./source.js";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function fixture(source: string) {
  const root = await mkdtemp(join(tmpdir(), "superimg-source-profile-")); roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  const entry = join(root, "card.media.ts"); await writeFile(entry, source);
  return { root, entry };
}
function observer() {
  const events: { stage: string; status: string }[] = [];
  const measureStage: NonNullable<NodeMediaAuthoringOptions["measureStage"]> = async (stage, work) => {
    try { const result = await work(); events.push({ stage, status: "completed" }); return result; }
    catch (error) { events.push({ stage, status: "failed" }); throw error; }
  };
  return { events, measureStage };
}
const source = 'import { image, Text } from "@foxworth/superimg"; export default image({ render: () => Text("ready") });';
it("measures preparation, bundling and evaluation once, with no compiler events for prepared reuse", async () => {
  const { root } = await fixture(source);
  const { events, measureStage } = observer();
  const preparedSource = await compileNodeMediaSource(root, "card", { measureStage });
  expect(events).toEqual(["source.prepare", "source.bundle", "source.evaluate"].map(stage => ({ stage, status: "completed" })));
  const count = events.length;
  const loaded = await loadNodeMediaValue(root, "card", { preparedSource, measureStage });
  expect(loaded.compiled).toBe(preparedSource.compiled);
  expect(events).toHaveLength(count);
  expect(Object.keys(preparedSource)).not.toContain("measureStage");
});
it("identifies the actual failing stage and never records phases that did not run", async () => {
  const { root, entry } = await fixture('export default (;');
  const { events, measureStage } = observer();
  await expect(compileNodeMediaSource(root, "card", { measureStage })).rejects.toMatchObject({ code: "MEDIA_SOURCE_PARSE_ERROR" });
  expect(events).toEqual([{ stage: "source.prepare", status: "failed" }]);
  events.length = 0;
  await writeFile(entry, 'import { image, NonexistentPrimitive } from "@foxworth/superimg"; export default image({ render: () => NonexistentPrimitive() });');
  await expect(compileNodeMediaSource(root, "card", { measureStage })).rejects.toMatchObject({ code: "TEMPLATE_MISSING_EXPORT" });
  expect(events).toEqual([{ stage: "source.prepare", status: "completed" }, { stage: "source.bundle", status: "failed" }]);
  events.length = 0;
  await writeFile(entry, 'throw Error("authored evaluation failed");' + source);
  await expect(compileNodeMediaSource(root, "card", { measureStage })).rejects.toThrow("authored evaluation failed");
  expect(events).toEqual([{ stage: "source.prepare", status: "completed" }, { stage: "source.bundle", status: "completed" }, { stage: "source.evaluate", status: "failed" }]);
});
