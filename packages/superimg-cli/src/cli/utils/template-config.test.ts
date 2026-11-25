import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTemplate, resolveRenderConfig } from "./template-config.js";
import { withTempDir } from "../__test-utils__/fs.js";

describe("resolveRenderConfig", () => {
  it("resolves authored duration units using the selected frame rate", () => {
    expect(resolveRenderConfig({ templateConfig: { duration: "28s" } }).duration).toBe(28);
    expect(resolveRenderConfig({ templateConfig: { duration: "48f", fps: 24 } }).duration).toBe(2);
  });
  it("applies precedence: cli > template > defaults", () => {
    const resolved = resolveRenderConfig({
      cli: { width: "3840", fps: "60" },
      templateConfig: { width: 1280, height: 720, fps: 24, duration: 4 },
      defaults: { width: 640, height: 360, fps: 12, duration: 2 },
    });

    expect(resolved).toEqual({
      width: 3840,
      height: 720,
      fps: 60,
      duration: 4,
    });
  });
});

describe("parseTemplate", () => {
  it("does not execute template side effects while parsing metadata", async () => {
    await withTempDir(async (dir) => {
      const templatePath = join(dir, "template.js");
      writeFileSync(
        templatePath,
        `
          import { define, Html } from '@foxworth/superimg';
          const sideEffect = (() => { throw new Error("should not execute"); })();
          export default define({
            config: { fps: 48 },
            render(ctx) { return Html({ width: "fill", height: "fill", html: "<div>safe</div>" }); }
          });
        `
      );

      const parsed = await parseTemplate(templatePath);
      expect(parsed.metasample.hasRenderExport).toBe(true);
      expect(parsed.templateConfig?.fps).toBe(48);
    });
  });

  it("uses template duration from config", async () => {
    await withTempDir(async (dir) => {
      const templatePath = join(dir, "template.js");
      writeFileSync(
        templatePath,
        `
          import { define, Html } from '@foxworth/superimg';
          export default define({
            config: { duration: 9 },
            render(ctx) { return Html({ width: "fill", height: "fill", html: "<div>ok</div>" }); }
          });
        `
      );

      const parsed = await parseTemplate(templatePath);
      expect(parsed.config?.duration).toBe(9);
    });
  });
});
