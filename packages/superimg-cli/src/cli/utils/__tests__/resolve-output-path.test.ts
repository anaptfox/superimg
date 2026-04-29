import { describe, it, expect } from "vitest";
import { resolveDebugHtmlDir, resolveOutputPath } from "../resolve-output-path.js";
import { join } from "node:path";

describe("resolveOutputPath", () => {
  const templatePath = "/Users/test/project/src/videos/promo/promo.video.ts";
  const templateDir = "/Users/test/project/src/videos/promo";

  it("places the output in an output/ folder next to the template by default", () => {
    const result = resolveOutputPath({ templatePath });
    expect(result).toBe(join(templateDir, "output", "promo.mp4"));
  });

  it("applies preset suffixes when no overrides exist", () => {
    const result = resolveOutputPath({ templatePath, presetSuffix: "youtube" });
    expect(result).toBe(join(templateDir, "output", "promo-youtube.mp4"));
  });

  it("respects an explicit -o file path", () => {
    const result = resolveOutputPath({
      templatePath,
      outputArg: "/Users/test/custom.mp4",
      presetSuffix: "youtube", // CLI file override ignores preset suffixes
    });
    expect(result).toBe("/Users/test/custom.mp4");
  });

  it("treats -o as a flat directory (no mirroring)", () => {
    const result = resolveOutputPath({
      templatePath,
      outputArg: "/Users/test/builds/",
      presetSuffix: "reels",
    });
    expect(result).toBe("/Users/test/builds/promo-reels.mp4");
  });

  it("respects cascadingConfig.outDir as template-relative", () => {
    const result = resolveOutputPath({
      templatePath,
      cascadingConfig: { outDir: "renders" },
    });
    expect(result).toBe(join(templateDir, "renders", "promo.mp4"));
  });

  it("respects an absolute cascadingConfig.outDir verbatim", () => {
    const result = resolveOutputPath({
      templatePath,
      cascadingConfig: { outDir: "/var/renders" },
    });
    expect(result).toBe(join("/var/renders", "promo.mp4"));
  });

  it("respects presetOutFile as template-dir-relative", () => {
    const result = resolveOutputPath({
      templatePath,
      presetOutFile: "final/launch.mp4",
      cascadingConfig: { outDir: "renders" }, // ignored
    });
    expect(result).toBe(join(templateDir, "final", "launch.mp4"));
  });

  it("respects an absolute presetOutFile verbatim", () => {
    const result = resolveOutputPath({
      templatePath,
      presetOutFile: "/var/renders/launch.mp4",
    });
    expect(result).toBe("/var/renders/launch.mp4");
  });

  it("respects presetOutDir as template-dir-relative", () => {
    const result = resolveOutputPath({
      templatePath,
      presetOutDir: "socials",
      presetSuffix: "tiktok",
    });
    expect(result).toBe(join(templateDir, "socials", "promo-tiktok.mp4"));
  });

  it("gives CLI -o exact file precedence over presetOutFile", () => {
    const result = resolveOutputPath({
      templatePath,
      presetOutFile: "final/launch.mp4",
      outputArg: "/Users/test/urgent-render.mp4",
    });
    expect(result).toBe("/Users/test/urgent-render.mp4");
  });

  it("places debug HTML next to the resolved render output", () => {
    const outputPath = join(templateDir, "output", "promo.mp4");
    const result = resolveDebugHtmlDir({
      outputPath,
      outputName: "default",
    });
    expect(result).toBe(join(templateDir, "output", ".superimg", "debug", "default"));
  });

  it("keeps debug HTML aligned with explicit output file overrides", () => {
    const result = resolveDebugHtmlDir({
      outputPath: "/Users/test/custom.mp4",
      outputName: "instagram",
    });
    expect(result).toBe("/Users/test/.superimg/debug/instagram");
  });
});
