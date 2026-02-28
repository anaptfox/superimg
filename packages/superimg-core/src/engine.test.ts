import { describe, it, expect } from "vitest";
import { createRenderPlan, executeRenderPlan } from "./engine.js";
import { bundleTemplateCode } from "./bundler.js";
import { TemplateRuntimeError } from "@superimg/types";

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

  it("collects inlineCss and stylesheets from template config", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: {
          inlineCss: ['.foo { color: red; }'],
          stylesheets: ['https://example.com/style.css'],
        },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = createRenderPlan(job);
    expect(plan.inlineCss).toContain(".foo { color: red; }");
    expect(plan.stylesheets).toContain("https://example.com/style.css");
  });

  it("merges global inlineCss and stylesheets with template config", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        config: {
          inlineCss: ['.template { }'],
          stylesheets: ['https://template.css'],
        },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    job.inlineCss = [".global { }"];
    job.stylesheets = ["https://global.css"];
    const plan = createRenderPlan(job);
    expect(plan.inlineCss).toEqual([".global { }", ".template { }"]);
    expect(plan.stylesheets).toEqual(["https://global.css", "https://template.css"]);
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

  it("wraps render errors with TemplateRuntimeError containing frame context", async () => {
    const code = `
      import { defineTemplate } from 'superimg';
      export default defineTemplate({
        render(ctx) {
          if (ctx.sceneProgress > 0.5) {
            throw new Error('Intentional fail at 50%');
          }
          return '<div>ok</div>';
        }
      });
    `;
    const job = await jobFromCode(code);
    job.durationSeconds = 1;
    job.fps = 10;
    const plan = createRenderPlan(job);

    const renderer = {
      init: async () => {},
      captureFrame: async (html: string) => html,
      dispose: async () => {},
    };
    const encoder = {
      init: async () => {},
      addFrame: async () => {},
      finalize: async () => new Uint8Array(0),
      dispose: async () => {},
    };

    await expect(executeRenderPlan(plan, renderer, encoder)).rejects.toThrow(
      TemplateRuntimeError
    );

    try {
      await executeRenderPlan(plan, renderer, encoder);
    } catch (err) {
      expect(err).toBeInstanceOf(TemplateRuntimeError);
      const runtimeErr = err as TemplateRuntimeError;
      expect(runtimeErr.code).toBe("TEMPLATE_RUNTIME_ERROR");
      expect(runtimeErr.details.frame).toBeGreaterThanOrEqual(5); // Fails at ~50%
      expect(runtimeErr.details.timeContext).toBeDefined();
      const timeCtx = runtimeErr.details.timeContext as {
        sceneProgress: number;
        sceneTimeSeconds: number;
      };
      expect(timeCtx.sceneProgress).toBeGreaterThan(0.5);
      expect(runtimeErr.message).toContain("Intentional fail at 50%");
      expect(runtimeErr.message).toContain("progress");
    }
  });
});
