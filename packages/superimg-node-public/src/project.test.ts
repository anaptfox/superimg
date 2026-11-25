import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { discoverMediaSources, resolveMediaSource } from "./project.js";

it("discovers one project without crossing nested package boundaries", () => {
  const root = mkdtempSync(join(tmpdir(), "superimg-public-project-"));
  try {
    mkdirSync(join(root, "nested"));
    writeFileSync(join(root, "card.media.ts"), "export default {};");
    writeFileSync(join(root, "nested", "package.json"), "{}");
    writeFileSync(join(root, "nested", "other.media.ts"), "export default {};");
    expect(discoverMediaSources(root).map((source) => source.relativePath)).toEqual(["card.media.ts"]);
    expect(resolveMediaSource(root, "card").sourceId).toBe("card");
    expect(() => resolveMediaSource(root, "missing")).toThrow("No media source found");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
