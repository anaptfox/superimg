import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverVideos,
  extractShortName,
  isTemplateFile,
} from "../discover-videos.js";

function makeTmpDir(label: string): string {
  const dir = join(tmpdir(), `superimg-discover-${label}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("isTemplateFile", () => {
  it("accepts *.media.ts and *.media.js only", () => {
    expect(isTemplateFile("intro.media.ts")).toBe(true);
    expect(isTemplateFile("intro.media.js")).toBe(true);
    expect(isTemplateFile("intro.video.ts")).toBe(false);
    expect(isTemplateFile("og.image.ts")).toBe(false);
  });
});

describe("extractShortName", () => {
  it("uses folder name for {folder}/{folder}.media.ts", () => {
    expect(extractShortName("hello-world/hello-world.media.ts")).toBe("hello-world");
  });

  it("uses parent folder for index.media.ts", () => {
    expect(extractShortName("compose-demo/index.media.ts")).toBe("compose-demo");
  });
});

describe("discoverVideos", () => {
  let root: string;

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = "";
    }
  });

  it("finds authored media while skipping dependencies and retained private studies", () => {
    root = makeTmpDir("walk");
    writeFileSync(join(root, "hero.media.ts"), "export default {}");
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "pkg", "ignored.media.ts"), "export default {}");
    mkdirSync(join(root, ".private", "internal", "studies"), { recursive: true });
    writeFileSync(join(root, ".private", "internal", "studies", "hero.media.ts"), "export default {}");

    const found = discoverVideos(root);
    expect(found).toHaveLength(1);
    expect(found[0]?.shortName).toBe("hero");
    expect(found[0]?.relativePath).toBe("hero.media.ts");
  });

  it("skips .superimg-drafts (base/work snapshots)", () => {
    root = makeTmpDir("drafts");
    writeFileSync(join(root, "hero.media.ts"), "export default {}");
    const draftPath = join(
      root,
      ".superimg-drafts",
      "abc123",
      "work",
      "apps",
      "compose",
    );
    mkdirSync(draftPath, { recursive: true });
    writeFileSync(join(draftPath, "compose.media.ts"), "export default {}");

    const found = discoverVideos(root);
    expect(found).toHaveLength(1);
    expect(found[0]?.shortName).toBe("hero");
    expect(found.every((v) => !v.relativePath.includes(".superimg-drafts"))).toBe(
      true,
    );
  });

  it("stops at nested package boundaries but still discovers files at the selected root", () => {
    root = makeTmpDir("package-boundaries");
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "root.media.ts"), "export default {}");
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "local.media.ts"), "export default {}");
    mkdirSync(join(root, "packages", "media"), { recursive: true });
    writeFileSync(join(root, "packages", "media", "package.json"), "{}");
    writeFileSync(join(root, "packages", "media", "other.media.ts"), "export default {}");

    expect(discoverVideos(root).map((item) => item.relativePath).sort()).toEqual([
      "root.media.ts",
      "src/local.media.ts",
    ]);
  });

  it("skips a scratch directory", () => {
    root = makeTmpDir("scratch");
    writeFileSync(join(root, "hero.media.ts"), "export default {}");
    mkdirSync(join(root, "scratch"), { recursive: true });
    writeFileSync(join(root, "scratch", "probe.media.ts"), "export default {}");

    const found = discoverVideos(root);
    expect(found.map((item) => item.relativePath)).toEqual(["hero.media.ts"]);
  });

});
