import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverMediaSources } from "./project.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("discoverMediaSources", () => {
  it("skips a scratch directory", () => {
    const root = mkdtempSync(join(tmpdir(), "superimg-scratch-"));
    roots.push(root);
    writeFileSync(join(root, "hero.media.ts"), "export default {}");
    mkdirSync(join(root, "scratch"));
    writeFileSync(join(root, "scratch", "probe.media.ts"), "export default {}");
    expect(discoverMediaSources(root).map((source) => source.relativePath)).toEqual(["hero.media.ts"]);
  });
});
