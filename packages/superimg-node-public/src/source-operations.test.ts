import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRuntime } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "../../superimg-node/src/runtime/adapter.js";
import { expect, it } from "vitest";
import { compileNodeMediaSource, checkCompiledSource, inspectCompiledSource } from "./source.js";

it("checks a compiled provider source without executing or replacing it", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-public-source-"));
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "data.server.ts"), `import { writeFileSync } from "node:fs"; export const entries = () => { writeFileSync(${JSON.stringify(join(root, "invoked"))}, "yes"); return [{ id: "a" }]; };`);
    await writeFile(join(root, "card.media.ts"), 'import { collection, image, Text } from "@foxworth/superimg"; import { entries } from "./data.server"; export default collection({ entries, media: image({ render: () => Text("card") }) });');
    const compiled = await compileNodeMediaSource(root, "card");
    await writeFile(join(root, "card.media.ts"), "throw new Error('changed source must not be loaded');");
    const checked = await checkCompiledSource({ projectRoot: root, compiled, runtime });
    const inspected = await inspectCompiledSource({ projectRoot: root, compiled, runtime });
    expect(checked.compiled).toBe(compiled);
    expect(inspected.compiled).toBe(compiled);
    expect(checked.value.kind).toBe("collection");
    expect(inspected.report.collection).toMatchObject({ resolved: false });
    await expect(access(join(root, "invoked"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await runtime.dispose(); await rm(root, { recursive: true, force: true }); }
});

it("exposes sampled check and inspect for a loaded deterministic source", async () => {
  const { resolve } = await import("node:path");
  const { loadNodeMediaValue, checkNodeSource, inspectPreparedSource } = await import("./source.js");
  const root = resolve(import.meta.dirname, "../../..");
  const runtime = createRuntime(createNodeRuntimeAdapter());
  try {
    const loaded = await loadNodeMediaValue(root, "packages/superimg-cli/src/__fixtures__/svg-text-no-font.media.ts");
    const checked = await checkNodeSource({ runtime, loaded, samples: [{ kind: "frame", frame: 0, label: "0f" }] });
    const inspected = await inspectPreparedSource({ runtime, loaded, frames: [0] });
    expect(checked.samples[0]?.frame).toBe(0);
    expect(inspected.samples[0]?.frame).toBe(0);
    expect(inspected.evaluation.programHash).toMatch(/^[a-f0-9]{64}$/);
  } finally { await runtime.dispose(); }
});
