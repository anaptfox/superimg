import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { discoverMediaSources, resolveMediaSource } from "./discovery.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it("discovers the chosen package without collecting nested packages or private retained sources", () => {
  const root = mkdtempSync(join(tmpdir(), "media-package-discovery-"));
  roots.push(root);
  writeFileSync(join(root, "package.json"), "{}");
  for (const folder of ["media", ".private", "packages/campaign/media"]) mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, "media/card.media.ts"), "export default {};");
  writeFileSync(join(root, ".private/retained.media.ts"), "export default {};");
  writeFileSync(join(root, "packages/campaign/package.json"), "{}");
  writeFileSync(join(root, "packages/campaign/media/card.media.ts"), "export default {};");
  expect(discoverMediaSources(root).map((source) => source.relativePath)).toEqual(["media/card.media.ts"]);
  const child = join(root, "packages/campaign");
  expect(discoverMediaSources(child).map((source) => source.relativePath)).toEqual(["media/card.media.ts"]);
  expect(resolveMediaSource(child, "card").relativePath).toBe("media/card.media.ts");
});
