import { describe, it, expect } from "vitest";
import { resolveOutputPath } from "../resolve-output-path.js";
import { join, resolve } from "node:path";

describe("resolveOutputPath", () => {
  const projectRoot = "/Users/test/project";
  const templatePath = "/Users/test/project/src/videos/promo/promo.video.ts";

  it("mirrors the directory structure by default inside output/", () => {
    const result = resolveOutputPath({ templatePath, projectRoot });
    expect(result).toBe(resolve(projectRoot, "output/src/videos/promo/promo.mp4"));
  });

  it("applies preset suffixes when no overrides exist", () => {
    const result = resolveOutputPath({ templatePath, projectRoot, presetSuffix: "youtube" });
    expect(result).toBe(resolve(projectRoot, "output/src/videos/promo/promo-youtube.mp4"));
  });

  it("handles a specific -o CLI file override", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      outputArg: "/Users/test/custom.mp4",
      presetSuffix: "youtube" // CLI file override ignores preset suffixes
    });
    expect(result).toBe("/Users/test/custom.mp4");
  });

  it("handles a -o CLI directory override and maintains the filename", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      outputArg: "/Users/test/builds/", // Trailing slash indicates directory
      presetSuffix: "reels"
    });
    expect(result).toBe("/Users/test/builds/src/videos/promo/promo-reels.mp4");
  });

  it("respects cascadingConfig.outDir over the default 'output' directory", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      cascadingConfig: { outDir: "dist-videos" }
    });
    expect(result).toBe(resolve(projectRoot, "dist-videos/src/videos/promo/promo.mp4"));
  });

  it("respects presetOutFile (exact explicit file config) and anchors to projectRoot", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      presetOutFile: "docs/my-final-render.mp4",
      cascadingConfig: { outDir: "dist-videos" } // Should be ignored
    });
    expect(result).toBe(resolve(projectRoot, "docs/my-final-render.mp4"));
  });

  it("respects presetOutDir (preset specific sub-directory)", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      presetOutDir: "socials",
      presetSuffix: "tiktok"
    });
    expect(result).toBe(resolve(projectRoot, "socials/src/videos/promo/promo-tiktok.mp4"));
  });

  it("gives CLI -o exact file precedence over presetOutFile", () => {
    const result = resolveOutputPath({ 
      templatePath, 
      projectRoot, 
      presetOutFile: "docs/my-final-render.mp4",
      outputArg: "/Users/test/urgent-render.mp4"
    });
    expect(result).toBe("/Users/test/urgent-render.mp4");
  });

  it("drops templates outside the project root directly into the base directory without mirror paths", () => {
    // If someone calls `render /tmp/sandbox/test.video.ts` inside a project...
    const externalTemplate = "/tmp/sandbox/test.video.ts";
    const result = resolveOutputPath({ 
      templatePath: externalTemplate, 
      projectRoot 
    });
    expect(result).toBe(resolve(projectRoot, "output/test.mp4"));
  });
});
