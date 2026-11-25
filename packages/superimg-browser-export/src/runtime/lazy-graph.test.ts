// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isAbsolute, resolve } from "node:path";
import { createRequire } from "node:module";

// The monorepo graph harness owns the bundler dependency, not this runtime.
const requireBenchmark = createRequire(new URL("../../../../tooling/benchmarks/package.json", import.meta.url));

interface GraphChunk {
  type: "chunk";
  fileName: string;
  isEntry: boolean;
  imports: string[];
  modules: Record<string, unknown>;
}
interface GraphAsset { type: "asset"; fileName: string }

describe("browser adapter module boundary", () => {
  it("keeps raster capture out of the eager document adapter graph", async () => {
    // Bare packages are external: this protects our split boundary independently
    // of installed dependency chunking. Packed consumer gates check full closure.
    const { rolldown } = await import(requireBenchmark.resolve("rolldown"));
    const bundle = await rolldown({ input: resolve(import.meta.dirname, "adapter.ts"), platform: "browser", external: (id: string) => !id.startsWith(".") && !isAbsolute(id) });
    try {
      const output = await bundle.generate({ format: "es", codeSplitting: true }) as { output: Array<GraphChunk | GraphAsset> };
      const chunks = new Map(output.output.filter((x): x is GraphChunk => x.type === "chunk").map(x => [x.fileName, x] as const));
      const eager = new Set<string>();
      function visit(name: string) {
        if (eager.has(name)) return;
        eager.add(name);
        for (const imported of chunks.get(name)?.imports ?? []) if (chunks.has(imported)) visit(imported);
      }
      visit([...chunks.values()].find(x => x.isEntry)!.fileName);
      const eagerModules = [...eager].flatMap(name => Object.keys(chunks.get(name)!.modules));
      expect(eagerModules.some(id => /\/(?:preview|capture|encoder|export)\.ts$/.test(id))).toBe(false);
      expect([...chunks.values()].flatMap(x => Object.keys(x.modules)).some(id => id.endsWith("/preview.ts"))).toBe(true);
    } finally { await bundle.close(); }
  });
});
