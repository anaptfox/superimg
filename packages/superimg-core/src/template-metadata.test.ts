import { describe, expect, it } from "vitest";
import { extractTemplateMetadata } from "./template-metadata.js";

describe("extractTemplateMetadata", () => {
  it("extracts render and config from default export object", () => {
    const code = `
      export default {
        render(ctx) { return "<div>ok</div>"; },
        config: { width: 1920, fps: 30 }
      }
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ width: 1920, fps: 30 });
  });

  it("extracts render and config from defineTemplate call", () => {
    const code = `
      function render(ctx) { return "<div>ok</div>"; }
      const config = { height: 720 };
      export default defineTemplate({ render, config });
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
  });

  it("extracts metadata from variable-referenced defineTemplate", () => {
    const code = `
      const mod = defineTemplate({
        render(ctx) { return "<div>ok</div>"; },
        config: { width: 1280, height: 720 }
      });
      export default mod;
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ width: 1280, height: 720 });
  });

  it("default export without render has hasRenderExport false", () => {
    const code = `
      export default {
        config: { fps: 30 }
      }
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(false);
    expect(metadata.config).toEqual({ fps: 30 });
  });

  it("throws when no default export", () => {
    const code = `
      export function render(ctx) { return "<div>ok</div>"; }
      export const config = { width: 1280 };
    `;

    expect(() => extractTemplateMetadata(code)).toThrow(
      expect.objectContaining({
        message: expect.stringContaining("defineTemplate"),
      })
    );
  });
});
