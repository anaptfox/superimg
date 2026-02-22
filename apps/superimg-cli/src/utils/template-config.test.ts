import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseTemplate, resolveRenderConfig } from "./template-config.js";

function withTempDir(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "superimg-cli-test-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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
  it("does not execute template side effects while parsing metadata", () => {
    withTempDir((dir) => {
      const templatePath = join(dir, "template.js");
      writeFileSync(
        templatePath,
        `
          const sideEffect = (() => { throw new Error("should not execute"); })();
          export function render(ctx) {
            return "<div>safe</div>";
          }
          export const config = { fps: 48 };
        `
      );

      const parsed = parseTemplate(templatePath);
      expect(parsed.metadata.hasRenderExport).toBe(true);
      expect(parsed.templateConfig?.fps).toBe(48);
    });
  });

  it("uses template duration from config", () => {
    withTempDir((dir) => {
      const templatePath = join(dir, "template.js");
      writeFileSync(
        templatePath,
        `
          export function render(ctx) {
            return "<div>ok</div>";
          }
          export const config = { durationSeconds: 9 };
        `
      );

      const parsed = parseTemplate(templatePath);
      expect(parsed.config?.durationSeconds).toBe(9);
    });
  });
});
