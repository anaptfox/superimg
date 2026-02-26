import { describe, it, expect } from "vitest";
import { createRenderPlan, executeRenderPlan } from "./engine.js";
import { bundleTemplateCode } from "./bundler.js";

async function jobFromCode(code: string) {
  const bundled = await bundleTemplateCode(code);
  return {
    templateCode: bundled,
    durationSeconds: 2,
    width: 640,
    height: 360,
    fps: 30,
    fonts: [],
  };
}

describe("createRenderPlan", () => {
  it("creates plan from valid template", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: { fps: 30 },
        render(ctx) { return '<div>Hello</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = createRenderPlan(job);
    expect(plan.template).toBeDefined();
    expect(plan.template.render).toBeInstanceOf(Function);
    expect(plan.durationSeconds).toBe(2);
    expect(plan.width).toBe(640);
    expect(plan.height).toBe(360);
    expect(plan.fps).toBe(30);
    expect(plan.totalFrames).toBe(60);
    expect(Array.isArray(plan.fonts)).toBe(true);
  });

  it("collects fonts from template config", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: { fonts: ['Roboto:wght@400'] },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = createRenderPlan(job);
    expect(plan.fonts).toContain("Roboto:wght@400");
  });

  it("merges global fonts with template fonts", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: { fonts: ['TemplateFont'] },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    job.fonts = ["GlobalFont"];
    const plan = createRenderPlan(job);
    expect(plan.fonts).toContain("GlobalFont");
    expect(plan.fonts).toContain("TemplateFont");
  });

  it("throws on invalid template", async () => {
    const job = await jobFromCode("export default { config: {} };");
    expect(() => createRenderPlan(job)).toThrow(/compilation failed/i);
  });
});

describe("executeRenderPlan", () => {
  it("calls renderer and encoder in order", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        render(ctx) { return '<div>' + ctx.sceneProgress + '</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = createRenderPlan(job);

    const capturedFrames: string[] = [];
    const renderer = {
      init: async () => {},
      captureFrame: async (html: string) => {
        capturedFrames.push(html);
        return html;
      },
      dispose: async () => {},
    };
    const encodedFrames: Array<{ frame: string; ts: number }> = [];
    const encoder = {
      init: async () => {},
      addFrame: async (frame: string, ts: number) => {
        encodedFrames.push({ frame, ts });
      },
      finalize: async () => new Uint8Array(0),
      dispose: async () => {},
    };

    await executeRenderPlan(plan, renderer, encoder);

    expect(capturedFrames).toHaveLength(60);
    expect(capturedFrames[0]).toContain("0");
    expect(capturedFrames[59]).toContain("1");
    expect(encodedFrames).toHaveLength(60);
  });

  it("calls onProgress callback", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    job.durationSeconds = 0.1;
    job.fps = 10;
    const plan = createRenderPlan(job);

    const progressUpdates: Array<{ frame: number; totalFrames: number }> = [];
    const renderer = {
      init: async () => {},
      captureFrame: async () => "",
      dispose: async () => {},
    };
    const encoder = {
      init: async () => {},
      addFrame: async () => {},
      finalize: async () => new Uint8Array(0),
      dispose: async () => {},
    };

    await executeRenderPlan(plan, renderer, encoder, {
      onProgress: (p) => progressUpdates.push({ frame: p.frame, totalFrames: p.totalFrames }),
    });

    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0].totalFrames).toBe(1);
  });
});
