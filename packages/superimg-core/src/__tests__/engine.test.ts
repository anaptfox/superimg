import { describe, it, expect } from "vitest";
import { createRenderPlan, executeRenderPlan, executeRenderPlanParallel } from "../rendering/engine.js";
import { bundleTemplateCodeWithMap } from "../bundler/bundler.js";
import { RenderExecutionError, TemplateRuntimeError } from "@superimg/types";
import type { RenderJob } from "@superimg/types";

async function jobFromCode(code: string): Promise<RenderJob> {
  const templateBundle = await bundleTemplateCodeWithMap(code, { sourcefile: "test.video.ts" });
  return {
    templateBundle,
    duration: 2,
    width: 640,
    height: 360,
    fps: 30,
    fonts: [],
  };
}

describe("createRenderPlan", () => {
  it("creates plan from valid template", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { fps: 30 },
        render(ctx) { return '<div>Hello</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);
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
      import { define } from 'superimg';
      export default define({
        config: { fonts: ['Roboto:wght@400'] },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);
    expect(plan.fonts).toContain("Roboto:wght@400");
  });

  it("merges global fonts with template fonts", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { fonts: ['TemplateFont'] },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    job.fonts = ["GlobalFont"];
    const plan = await createRenderPlan(job);
    expect(plan.fonts).toContain("GlobalFont");
    expect(plan.fonts).toContain("TemplateFont");
  });

  it("passes through resolvedAssets from caller", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const resolvedAssets = [
      { key: "logo", type: "image" as const, src: "/images/logo.png", sourceDir: "/tmp" },
      { key: "hero", type: "video" as const, src: "/videos/hero.mp4", sourceDir: "/tmp" },
    ];
    const plan = await createRenderPlan(job, { resolvedAssets });
    expect(plan.resolvedAssets).toHaveLength(2);
    expect(plan.resolvedAssets.find((a) => a.key === "logo")).toMatchObject({
      key: "logo",
      type: "image",
      src: "/images/logo.png",
    });
    expect(plan.resolvedAssets.find((a) => a.key === "hero")).toMatchObject({
      key: "hero",
      type: "video",
      src: "/videos/hero.mp4",
    });
  });

  it("defaults to empty assets when none provided", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);
    expect(plan.resolvedAssets).toEqual([]);
  });

  it("collects inlineCss and stylesheets from template config", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: {
          inlineCss: ['.foo { color: red; }'],
          stylesheets: ['https://example.com/style.css'],
        },
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);
    expect(plan.inlineCss).toContain(".foo { color: red; }");
    expect(plan.stylesheets).toContain("https://example.com/style.css");
  });

  it("merges global inlineCss and stylesheets with template config", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
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
    const plan = await createRenderPlan(job);
    expect(plan.inlineCss).toEqual([".global { }", ".template { }"]);
    expect(plan.stylesheets).toEqual(["https://global.css", "https://template.css"]);
  });

  it("throws on invalid template", async () => {
    const job = await jobFromCode("export default { config: {} };");
    await expect(createRenderPlan(job)).rejects.toThrow(/compilation failed/i);
  });

  it("rejects resolved plans that exceed configured limits", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render() { return '<div />'; } });
    `);
    await expect(
      createRenderPlan(job, { limits: { maxFrames: 10 } }),
    ).rejects.toMatchObject({ code: "resource_limit" });
  });

  it("validates partial frame ranges before renderer allocation", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render() { return '<div />'; } });
    `);
    await expect(
      createRenderPlan(job, { startFrame: 10, endFrame: 1000 }),
    ).rejects.toBeInstanceOf(RenderExecutionError);
  });
});

describe("executeRenderPlan", () => {
  it("calls renderer and encoder in order", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div>' + ctx.timeline.progress + '</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);

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

  it("captures the next frame while the previous frame is encoding", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; } });
    `);
    job.duration = 0.2;
    job.fps = 10;
    const plan = await createRenderPlan(job);

    let releaseFirstEncode!: () => void;
    const firstEncodeGate = new Promise<void>((resolve) => { releaseFirstEncode = resolve; });
    let firstEncodeStarted!: () => void;
    const firstEncode = new Promise<void>((resolve) => { firstEncodeStarted = resolve; });
    let secondCaptureStarted!: () => void;
    const secondCapture = new Promise<void>((resolve) => { secondCaptureStarted = resolve; });
    let captures = 0;

    const rendering = executeRenderPlan(
      plan,
      {
        init: async () => {},
        captureFrame: async (html: string) => {
          captures += 1;
          if (captures === 2) secondCaptureStarted();
          return html;
        },
        dispose: async () => {},
      },
      {
        init: async () => {},
        addFrame: async (_frame: string, timestamp: number) => {
          if (timestamp === 0) {
            firstEncodeStarted();
            await firstEncodeGate;
          }
        },
        finalize: async () => new Uint8Array(),
        dispose: async () => {},
      },
    );

    await firstEncode;
    await expect(
      Promise.race([
        secondCapture.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 100)),
      ]),
    ).resolves.toBe(true);
    releaseFirstEncode();
    await rendering;
  });

  it("calls onProgress callback", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div></div>'; }
      });
    `;
    const job = await jobFromCode(code);
    job.duration = 0.1;
    job.fps = 10;
    const plan = await createRenderPlan(job);

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
    expect(progressUpdates[0]!.totalFrames).toBe(1);
  });

  it("wraps render errors with TemplateRuntimeError containing frame context", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) {
          if (ctx.timeline.progress > 0.5) {
            throw new Error('Intentional fail at 50%');
          }
          return '<div>ok</div>';
        }
      });
    `;
    const job = await jobFromCode(code);
    job.duration = 1;
    job.fps = 10;
    const plan = await createRenderPlan(job);

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
        timelineProgress: number;
        timelineSeconds: number;
      };
      expect(timeCtx.timelineProgress).toBeGreaterThan(0.5);
      expect(runtimeErr.message).toContain("Intentional fail at 50%");
      expect(runtimeErr.message).toContain("progress");
    }
  });

  it("cancels an in-flight capture and still disposes adapters", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render() { return '<div />'; } });
    `);
    job.duration = 0.1;
    job.fps = 10;
    const plan = await createRenderPlan(job);
    const controller = new AbortController();
    let rendererDisposed = false;
    let encoderDisposed = false;
    const renderer = {
      init: async () => {},
      captureFrame: async () => new Promise<string>(() => {}),
      dispose: async () => { rendererDisposed = true; },
    };
    const encoder = {
      init: async () => {},
      addFrame: async () => {},
      finalize: async () => new Uint8Array(),
      dispose: async () => { encoderDisposed = true; },
    };

    const rendering = executeRenderPlan(plan, renderer, encoder, {
      signal: controller.signal,
      cleanupTimeoutMs: 100,
    });
    controller.abort();

    await expect(rendering).rejects.toMatchObject({ code: "aborted" });
    expect(rendererDisposed).toBe(true);
    expect(encoderDisposed).toBe(true);
  });

  it("keeps a 300-frame render bounded to one encoder write", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; } });
    `);
    job.duration = 10;
    job.fps = 30;
    const plan = await createRenderPlan(job);
    let captures = 0;
    let activeEncodes = 0;
    let maxActiveEncodes = 0;
    await executeRenderPlan(
      plan,
      { init: async () => {}, captureFrame: async (html: string) => { captures += 1; return html; }, dispose: async () => {} },
      {
        init: async () => {},
        addFrame: async () => {
          activeEncodes += 1;
          maxActiveEncodes = Math.max(maxActiveEncodes, activeEncodes);
          await Promise.resolve();
          activeEncodes -= 1;
        },
        finalize: async () => new Uint8Array(),
        dispose: async () => {},
      },
    );
    expect(captures).toBe(300);
    expect(maxActiveEncodes).toBe(1);
  });

  it("distributes capture across four renderers and encodes in order", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; } });
    `);
    job.duration = 0.8;
    job.fps = 10;
    const plan = await createRenderPlan(job);
    const counts = [0, 0, 0, 0];
    const renderers = counts.map((_count, index) => ({
      init: async () => {},
      captureFrame: async (html: string) => { counts[index]! += 1; return html; },
      dispose: async () => {},
    }));
    const timestamps: number[] = [];
    await executeRenderPlanParallel(plan, renderers, {
      init: async () => {},
      addFrame: async (_frame: string, timestamp: number) => { timestamps.push(timestamp); },
      finalize: async () => new Uint8Array(),
      dispose: async () => {},
    });
    expect(counts.every((count) => count > 0)).toBe(true);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it("attributes an encoder failure to the frame being encoded", async () => {
    const job = await jobFromCode(`
      import { define } from 'superimg';
      export default define({ render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; } });
    `);
    job.duration = 0.2;
    job.fps = 10;
    const plan = await createRenderPlan(job);
    await expect(executeRenderPlan(
      plan,
      { init: async () => {}, captureFrame: async (html: string) => html, dispose: async () => {} },
      {
        init: async () => {},
        addFrame: async (_frame: string, timestamp: number) => { if (timestamp === 0) throw new Error("encode failed"); },
        finalize: async () => new Uint8Array(),
        dispose: async () => {},
      },
    )).rejects.toMatchObject({ details: { frame: 0 } });
  });
});
