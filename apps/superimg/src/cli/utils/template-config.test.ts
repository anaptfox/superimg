import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTemplate, resolveRenderConfig } from "./template-config.js";
import { withTempDir } from "../__test-utils__/fs.js";

describe("resolveRenderConfig", () => {
  it("applies precedence: cli > template > defaults", () => {
    const resolved = resolveRenderConfig({
      cli: { width: "3840", fps: "60" },
      templateConfig: { width: 1280, height: 720, fps: 24, durationSeconds: 4 },
      defaults: { width: 640, height: 360, fps: 12, durationSeconds: 2 },
    });

    expect(resolved).toEqual({
      width: 3840,
      height: 720,
      fps: 60,
      durationSeconds: 4,
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
          import { defineTemplate } from 'superimg';
          const sideEffect = (() => { throw new Error("should not execute"); })();
          export default defineTemplate({
            config: { fps: 48 },
            render(ctx) { return "<div>safe</div>"; }
          });
        `
      );

      const parsed = await parseTemplate(templatePath);
      expect(parsed.metadata.hasRenderExport).toBe(true);
      expect(parsed.templateConfig?.fps).toBe(48);
    });
  });

  it("uses template duration from config", async () => {
    await withTempDir(async (dir) => {
      const templatePath = join(dir, "template.js");
      writeFileSync(
        templatePath,
        `
          import { defineTemplate } from 'superimg';
          export default defineTemplate({
            config: { durationSeconds: 9 },
            render(ctx) { return "<div>ok</div>"; }
          });
        `
      );

      const parsed = await parseTemplate(templatePath);
      expect(parsed.config?.durationSeconds).toBe(9);
    });
  });
});
