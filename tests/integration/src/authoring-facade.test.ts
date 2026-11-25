import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createNodeMediaInteractionMount,
  loadNodeMediaValue,
} from "@foxworth/superimg-interactions";
import type { Runtime } from "@foxworth/superimg/runtime";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("host authoring facade resolution", () => {
  it("loads and describes media without installing the facade package", async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-downstream-facade-"));
    roots.push(root);
    const facadeSpecifier = "application/media";
    const facadeModule = join(root, "application-media.ts");
    await writeFile(join(root, "package.json"), '{"type":"module"}\n');
    await writeFile(
      facadeModule,
      'export { image, Html } from "@foxworth/superimg";\n',
    );
    await writeFile(
      join(root, "card.media.ts"),
      [
        `import { image, Html } from ${JSON.stringify(facadeSpecifier)};`,
        'export default image({ render: () => Html({ html: "<h1>Facade</h1>" }) });',
      ].join("\n"),
    );
    const authoringFacades = { [facadeSpecifier]: facadeModule };

    const loaded = await loadNodeMediaValue(root, "card", { authoringFacades });
    expect(loaded.value.kind).toBe("media");
    expect(existsSync(join(root, "node_modules", "application"))).toBe(false);

    const mount = createNodeMediaInteractionMount({
      projectRoot: root,
      runtime: fakeRuntime(),
      authoringFacades,
    });
    await expect(mount.dispatch({
      interactionId: "media.source.describe",
      input: { source: "card" },
    }, {})).resolves.toMatchObject({
      sourceId: "card",
      sourceKind: "media",
    });
  });
});

function fakeRuntime(): Runtime {
  const dispose = async () => {};
  return {
    abi: "test-runtime",
    capabilities: {
      schemaVersion: 0,
      check: true,
      inspect: true,
      documents: ["html", "svg"],
      rasters: ["png"],
      animated: ["mp4"],
      collections: { static: true, providers: true },
      assets: { url: true, bytes: true },
      fonts: { logical: true, frozenBytes: true },
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
