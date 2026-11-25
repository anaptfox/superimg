import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@foxworth/superimg-interactions", async () => import(new URL("../../../../superimg-interactions/src/node/source.ts", import.meta.url).pathname));
import { withCommandProfile, type CommandProfile } from "./command-profile.js";
import { loadCliMediaValue, prepareCliMediaSource } from "./runtime-source.js";
const originalCwd = process.cwd();
const roots: string[] = [];
afterEach(async () => { process.chdir(originalCwd); await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
it("profiles actual source phases and counts materialization reuse without additional compiler invocations", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-cli-source-profile-")); roots.push(root); process.chdir(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  const entry = join(root, "card.media.ts");
  await writeFile(entry, 'import { image, Text } from "@foxworth/superimg"; export default image({ render: () => Text("ready") });');
  const records: unknown[] = [];
  await withCommandProfile("inspect", { profile: true }, async () => {
    const preparedSource = await prepareCliMediaSource(entry);
    await loadCliMediaValue(entry, { preparedSource });
    await loadCliMediaValue(entry, { preparedSource });
  }, value => records.push(value));
  const profile = (records[0] as { profile: CommandProfile }).profile;
  expect(profile.counts).toMatchObject({ "source.load": 1, "source.prepare": 1, "source.bundle": 1, "source.evaluate": 1, "source.materialize": 2, "source.configuration": 2 });
  expect(profile.spans.filter(span => ["source.prepare", "source.bundle", "source.evaluate"].includes(span.stage)).every(span => span.parentId === profile.spans.find(parent => parent.stage === "source.load")?.id)).toBe(true);
  expect(profile.spans.every(span => span.status === "completed" && Number.isFinite(span.durationMs))).toBe(true);
});
