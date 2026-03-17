import { describe, expect, it } from "vitest";
import { extractTemplateMetadata } from "../shared/template-metadata.js";

describe("extractTemplateMetadata", () => {
  it("extracts render and config from default export object", async () => {
    const code = `
      export default {
        render(ctx) { return "<div>ok</div>"; },
        config: { width: 1920, fps: 30 }
      }
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ width: 1920, fps: 30 });
  });

  it("extracts render and config from defineScene call", async () => {
    const code = `
      function render(ctx) { return "<div>ok</div>"; }
      const config = { height: 720 };
      export default defineScene({ render, config });
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
  });

  it("extracts metadata from variable-referenced defineScene", async () => {
    const code = `
      const mod = defineScene({
        render(ctx) { return "<div>ok</div>"; },
        config: { width: 1280, height: 720 }
      });
      export default mod;
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ width: 1280, height: 720 });
  });

  it("default export without render has hasRenderExport false", async () => {
    const code = `
      export default {
        config: { fps: 30 }
      }
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(false);
    expect(metadata.config).toEqual({ fps: 30 });
  });

  it("throws when no default export", async () => {
    const code = `
      export function render(ctx) { return "<div>ok</div>"; }
      export const config = { width: 1280 };
    `;

    await expect(extractTemplateMetadata(code)).rejects.toThrow(
      expect.objectContaining({
        message: expect.stringContaining("defineScene"),
      })
    );
  });

  it("handles TypeScript syntax", async () => {
    const code = `
      function getPhase(time: number): { name: string; progress: number } {
        return { name: "test", progress: time };
      }
      export default {
        render(ctx) { return "<div>ok</div>"; },
        config: { fps: 30 }
      }
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ fps: 30 });
  });
  it("extracts render from compose call array", async () => {
    const code = `
      import { compose } from "superimg";
      import intro from "./intro.video.js";
      import content from "./content.video.js";
      import outro from "./outro.video.js";
      export default compose([intro, content, outro]);
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
  });

  it("extracts metadata from late re-export", async () => {
    const code = `
      const myTemplate = defineScene({
        render(ctx) { return "ok"; },
        config: { width: 1080, height: 1080 }
      });
      export { myTemplate as default };
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({ width: 1080, height: 1080 });
  });

  it("extracts render from variable-referenced compose", async () => {
    const code = `
      const scene = compose([intro, outro]);
      export default scene;
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
  });
});
