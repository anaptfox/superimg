import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import type { Runtime } from "@superimg/types";
import { MEDIA_INTERACTION_IDS } from "../contracts.js";
import { createNodeMediaInteractionMount, type NodeMediaExecutionOptions } from "./mount.js";
import { compileNodeMediaSource, loadNodeMediaValue } from "./source.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

it("borrows the exact configured command value and frozen source findings without reloading", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-prepared-source-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  const path = join(root, "card.media.ts");
  await writeFile(path, 'import { image, Html } from "@foxworth/superimg"; const legacy = { for: 30 }; export default image({ size: { width: 320, height: 180 }, render: () => Html({ html: "original" }) });');
  const preparedSource = await compileNodeMediaSource(root, "card");
  const loaded = await loadNodeMediaValue(root, "card", { preparedSource });
  const preparedValue = { ...loaded, value: { ...loaded.value, config: { width: 777, height: 180 } } } as typeof loaded;
  const check = vi.fn(async (_runtime: Runtime, _value: unknown) => ({ schemaVersion: 0, ok: true, programDigest: "canonical", kind: "image", coordinates: [], findings: [] }));
  const mount = createNodeMediaInteractionMount<NodeMediaExecutionOptions>({
    projectRoot: root, runtime: {} as Runtime, executionOptions: context => context, check: check as never,
  });
  await writeFile(path, 'throw Error("must not reload the command snapshot")');
  const context = { preparedSource, preparedValue };
  const description = await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.describe, input: { source: "card" } }, context);
  const checked = await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.check, input: { source: "card" } }, context);
  expect(check.mock.calls[0]![1]).toBe(preparedValue.value);
  expect(checked.programHash).toBe(description.programHash);
  expect(checked.report.programDigest).toBe("canonical");
  expect(checked.report.findings).toContainEqual(expect.objectContaining({ code: "UNITLESS_MOTION_TIME" }));
  await writeFile(join(root, "other.media.ts"), 'import { image, Text } from "@foxworth/superimg"; export default image({ render: () => Text("other") });');
  await expect(mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.check, input: { source: "other" } }, context)).rejects.toThrow(/does not match/);
  // A normal later request reads current source; the mount retains no global cache.
  await expect(mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.describe, input: { source: "card" } }, {})).rejects.toThrow();
});

it("keeps providers deferred when the trusted context contains only a compiled source", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-prepared-provider-"));
  roots.push(root);
  await writeFile(join(root, "package.json"), '{"type":"module"}\n');
  await writeFile(join(root, "data.server.ts"), 'export const entries = () => { throw Error("provider must remain deferred"); };');
  await writeFile(join(root, "cards.media.ts"), 'import { collection, image, Text } from "@foxworth/superimg"; import { entries } from "./data.server"; export default collection({ entries, media: image({ render: () => Text("card") }) });');
  const preparedSource = await compileNodeMediaSource(root, "cards");
  const check = vi.fn(async (_runtime: Runtime, value: { entries: () => unknown }) => {
    await expect(value.entries()).rejects.toThrow(/unavailable during source analysis/);
    return { schemaVersion: 0, ok: true, programDigest: "canonical", kind: "collection", coordinates: [], findings: [] };
  });
  const mount = createNodeMediaInteractionMount<NodeMediaExecutionOptions>({
    projectRoot: root, runtime: {} as Runtime, executionOptions: context => context, check: check as never,
  });
  await mount.dispatch({ interactionId: MEDIA_INTERACTION_IDS.check, input: { source: "cards" } }, { preparedSource });
  expect(check).toHaveBeenCalledTimes(1);
});
