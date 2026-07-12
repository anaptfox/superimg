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

  it("extracts render and config from define call", async () => {
    const code = `
      function render(ctx) { return "<div>ok</div>"; }
      const config = { height: 720 };
      export default define({ render, config });
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasDefaultExport).toBe(true);
    expect(metadata.hasRenderExport).toBe(true);
  });

  it("extracts metadata from variable-referenced define", async () => {
    const code = `
      const mod = define({
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
        message: expect.stringContaining("define"),
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
      const myTemplate = define({
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

  it("folds const-bound duration/width/height/fps identifiers", async () => {
    const code = `
      const DURATION = 12;
      const W = 1920;
      const H = 1080;
      const FPS = 30;
      export default define({
        config: { width: W, height: H, fps: FPS, duration: DURATION },
        render(ctx) { return "<div>ok</div>"; },
      });
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.config).toEqual({
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 12,
    });
  });

  it("folds config object referenced by identifier", async () => {
    const code = `
      function render(ctx) { return "<div>ok</div>"; }
      const config = { height: 720, duration: 8, fps: 30 };
      export default define({ render, config });
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.hasRenderExport).toBe(true);
    expect(metadata.config).toEqual({
      height: 720,
      duration: 8,
      fps: 30,
    });
  });

  it("folds chained identifier aliases for duration", async () => {
    const code = `
      const D = 5;
      const DUR = D;
      export default define({
        config: { fps: 30, duration: DUR },
        render(ctx) { return ""; },
      });
    `;

    const metadata = await extractTemplateMetadata(code);
    expect(metadata.config?.duration).toBe(5);
    expect(metadata.config?.fps).toBe(30);
  });
});
