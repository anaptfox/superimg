import { resolve, join } from "node:path";
import { mkdtemp, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { compileNodeMediaSource } from "@foxworth/superimg-node/source";
import { checkCompiledSource, inspectCompiledSource } from "@foxworth/superimg-node/source";
import { describe, expect, it } from "vitest";
import { checkNodeSource } from "@foxworth/superimg-node/source";
import { inspectPreparedSource } from "@foxworth/superimg-node/source";
import { runCheck } from "./check.js";
import { loadCliMediaValue } from "../utils/runtime-source.js";
import { createCliValueRuntime } from "../utils/media-interactions.js";

describe("prepared source operations", () => {
  it("matches CLI check sampled findings and returns resolved inspection clocks", async () => {
    const path = resolve("src/__fixtures__/phased-responsive.media.ts");
    const loaded = await loadCliMediaValue(path);
    const runtime = createCliValueRuntime();
    try {
      const cli = await runCheck(path, { at: "0,0.5,1" }, { runtime, loaded });
      const direct = await checkNodeSource({ runtime, loaded, samples: [
        { kind: "progress", progress: 0, label: "0" },
        { kind: "progress", progress: 0.5, label: "0.5" },
        { kind: "progress", progress: 1, label: "1" },
      ] });
      expect(direct.samples).toEqual(cli.samples);
      expect(direct.issues).toEqual(cli.issues);
      const inspection = await inspectPreparedSource({ runtime, loaded, progresses: [0, 0.5, 1] });
      expect(inspection.samples.map(s => s.frame)).toEqual(cli.samples.map(s => s.frame));
      expect(inspection.evaluation.programHash).toHaveLength(64);
      expect(inspection.report.coverage?.samples.length).toBeGreaterThan(0);
      const controller = new AbortController(); controller.abort();
      await expect(inspectPreparedSource({ runtime, loaded, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    } finally { await runtime.dispose(); }
  });
  it("checks and inspects a compiled provider collection without invoking it", async () => {
    const root = await mkdtemp(join(tmpdir(), "source-deferred-"));
    try {
      await writeFile(join(root, "package.json"), '{"type":"module"}');
      await writeFile(join(root, "data.server.ts"), `import { writeFileSync } from "node:fs"; export const entries = () => { writeFileSync(${JSON.stringify(join(root, "invoked"))}, "yes"); return [{ id: "a" }]; };`);
      await writeFile(join(root, "card.media.ts"), 'import { collection, image, Text } from "@foxworth/superimg"; import { entries } from "./data.server"; export default collection({ entries, media: image({ render: () => Text("card") }) });');
      const compiled = await compileNodeMediaSource(root, "card");
      const runtime = createCliValueRuntime();
      try {
        const checked = await checkCompiledSource({ projectRoot: root, compiled, runtime });
        const inspected = await inspectCompiledSource({ projectRoot: root, compiled, runtime });
        expect(checked.compiled).toBe(compiled);
        expect(inspected.compiled).toBe(compiled);
        expect(checked.value.kind).toBe("collection");
        expect(inspected.value.kind).toBe("collection");
        expect(await access(join(root, "invoked")).then(() => true, () => false)).toBe(false);
      } finally { await runtime.dispose(); }
    } finally { await rm(root, { recursive: true, force: true }); }
  });

});
