import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bundleMediaProgram, bundleTemplateESMWithMap } from "./bundler.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "superimg-local-graph-")));
  directories.push(root);
  return { root, entry: join(root, "city.media.ts") };
}

describe("compiler local dependency observations", () => {
  it("reports the actual graph, including an imported helper removed by tree shaking", async () => {
    const { root, entry } = await fixture();
    const helper = join(root, "camera.ts");
    const unused = join(root, "unused.ts");
    await writeFile(helper, 'export function camera() { return "rooftops"; }');
    await writeFile(unused, 'export const unused = "must-not-appear-in-output";');
    await writeFile(entry, `import { image, Html } from "@foxworth/superimg";
      import { camera } from "./camera";
      import "./unused";
      export default image({ render: () => Html({ html: camera() }) });`);
    for (const bundle of [await bundleMediaProgram(entry), await bundleTemplateESMWithMap(entry)]) {
      expect(bundle.dependencies).toEqual(expect.arrayContaining([entry, helper, unused]));
      expect(bundle.code).not.toContain("must-not-appear-in-output");
    }
  });

  it("observes a missing helper directory even when bundling fails", async () => {
    const { root, entry } = await fixture();
    const missingDirectory = join(root, "parts");
    await mkdir(missingDirectory);
    await writeFile(entry, `import { image, Html } from "@foxworth/superimg";
      import { camera } from "./parts/camera";
      export default image({ render: () => Html({ html: camera() }) });`);
    const seen = new Set<string>();
    await expect(bundleMediaProgram(entry, {
      onDependencies: ({ directories }) => { for (const path of directories) seen.add(path); },
    })).rejects.toThrow();
    expect(seen.has(missingDirectory)).toBe(true);
  });
});
