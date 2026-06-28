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

  it("finds *.media.ts files and skips node_modules", () => {
    root = makeTmpDir("walk");
    writeFileSync(join(root, "hero.media.ts"), "export default {}");
    mkdirSync(join(root, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(root, "node_modules", "pkg", "ignored.media.ts"), "export default {}");

    const found = discoverVideos(root);
    expect(found).toHaveLength(1);
    expect(found[0]?.shortName).toBe("hero");
    expect(found[0]?.relativePath).toBe("hero.media.ts");
  });

  it("ignores legacy template extensions", () => {
    root = makeTmpDir("legacy");
    writeFileSync(join(root, "legacy.video.ts"), "export default {}");

    expect(discoverVideos(root)).toHaveLength(0);
  });
});