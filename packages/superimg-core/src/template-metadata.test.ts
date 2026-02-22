import { describe, expect, it } from "vitest";
import { extractTemplateMetadata } from "./template-metadata";

describe("extractTemplateMetadata", () => {
  it("extracts render export and config from direct exports", () => {
    const code = `
      export function render(ctx) {
        return "<div>ok</div>";
      }
      export const config = { width: 1280, height: 720, fps: 24, durationSeconds: 4 };
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.hasDefaultExport).toBe(false);
    expect(metadata.config).toEqual({
      width: 1280,
      height: 720,
      fps: 24,
      durationSeconds: 4,
    });
  });

  it("supports aliased named exports", () => {
    const code = `
      function localRender(ctx) {
        return "<div>ok</div>";
      }
      const localConfig = { fps: 60 };
      export { localRender as render, localConfig as config };
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ fps: 60 });
  });

  it("detects default export usage", () => {
    const code = `
      export default function render(ctx) {
        return "<div>default</div>";
      }
    `;

    const metadata = extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    // Named default function — render IS detected
    expect(metadata.hasRenderExport).toBe(true);
  });

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
});
