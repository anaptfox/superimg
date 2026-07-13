import { describe, it, expect } from "vitest";
import {
  createRenderPlan,
  executeRenderPlan,
  executeRenderPlanParallel,
} from "../rendering/engine.js";
import { createRenderContext } from "../rendering/create-render-context.js";
import { bundleTemplateCodeWithMap } from "../bundler/bundler.js";
import type { FrameRendererConfig, RenderJob } from "@superimg/types";

async function jobFromCode(
  code: string,
  overrides: Partial<RenderJob> = {}
): Promise<RenderJob> {
  const templateBundle = await bundleTemplateCodeWithMap(code, {
    sourcefile: "test.video.ts",
  });
  return {
    templateBundle,
    duration: 1,
    width: 640,
    height: 360,
    fps: 10,
    fonts: [],
    ...overrides,
  };
}

function mockRenderer() {
  let captureCount = 0;
  const clockSteps: number[] = [];
  const initConfigs: FrameRendererConfig[] = [];
  const renderer = {
    init: async (config: FrameRendererConfig) => {
      initConfigs.push(config);
    },
    captureFrame: async (html: string) => {
      captureCount++;
      return html;
    },
    advanceClock: async (ms: number) => {
      clockSteps.push(ms);
    },
    dispose: async () => {},
    get captureCount() {
      return captureCount;
    },
    get clockSteps() {
      return clockSteps;
    },
    get initConfigs() {
      return initConfigs;
    },
  };
  return renderer;
}

function mockEncoder() {
  const frames: Array<{ frame: unknown; ts: number }> = [];
  return {
    init: async () => {},
    addFrame: async (frame: unknown, ts: number) => {
      frames.push({ frame, ts });
    },
    finalize: async () => new Uint8Array([1, 2, 3]),
    dispose: async () => {},
    frames,
  };
}

describe("createRenderContext timing", () => {
  it("maps frame 0 to timeline.progress 0", () => {
    const ctx = createRenderContext(0, 30, 60, 1920, 1080);
    expect(ctx.timeline.progress).toBe(0);
    expect(ctx.globalTimeSeconds).toBe(0);
    expect(ctx.timeline.frame).toBe(0);
  });

  it("maps last frame to timeline.progress 1", () => {
    const ctx = createRenderContext(59, 30, 60, 1920, 1080);
    expect(ctx.timeline.progress).toBe(1);
    expect(ctx.globalTimeSeconds).toBeCloseTo(ctx.timeline.seconds, 5);
    expect(ctx.timeline.seconds).toBe(2);
  });

  it("maps midpoint frame to timeline.progress 0.5", () => {
    const ctx = createRenderContext(15, 30, 31, 1920, 1080);
    expect(ctx.timeline.progress).toBeCloseTo(0.5, 5);
  });

  it("handles single-frame video", () => {
    const ctx = createRenderContext(0, 30, 1, 1920, 1080);
    expect(ctx.timeline.progress).toBe(1);
    expect(ctx.totalFrames).toBe(1);
  });

  it("computes duration from totalFrames and fps", () => {
    const ctx = createRenderContext(10, 24, 48, 1280, 720);
    expect(ctx.totalDurationSeconds).toBe(2);
    expect(ctx.timeline.durationSeconds).toBe(2);
  });
});

describe("executeRenderPlan frame behavior", () => {
  it("deduplicates identical consecutive frames in frame mode", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) {
          return '<div>' + (ctx.globalFrame < 5 ? 'static' : ctx.globalFrame) + '</div>';
        }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);

    const renderer = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlan(plan, renderer, encoder);

    expect(renderer.captureCount).toBe(6);
    expect(encoder.frames).toHaveLength(10);
  });

  it("captures every frame in animation mode", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { mode: 'animation' },
        render() { return '<div class="animated">x</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);

    const renderer = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlan(plan, renderer, encoder);

    expect(renderer.captureCount).toBe(10);
    expect(renderer.clockSteps).toEqual(Array(10).fill(100));
  });

  it("renders partial frame range via startFrame/endFrame", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; }
      });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job, { startFrame: 3, endFrame: 7 });

    const renderedFrames: number[] = [];
    const renderer = {
      init: async () => {},
      captureFrame: async (html: string) => {
        const match = html.match(/>(\d+)</);
        if (match) renderedFrames.push(Number(match[1]));
        return html;
      },
      dispose: async () => {},
    };
    const encoder = mockEncoder();

    await executeRenderPlan(plan, renderer, encoder);

    expect(renderedFrames).toEqual([3, 4, 5, 6]);
    expect(encoder.frames).toHaveLength(4);
    expect(encoder.frames[0]!.ts).toBeCloseTo(0.3, 5);
  });

  it("calls onFrameRendered with raw and composite html", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        config: { background: '#ff0000' },
        render() { return '<main>tpl</main>'; }
      });
    `;
    const job = await jobFromCode(code, { duration: 0.1, fps: 1 });
    const plan = await createRenderPlan(job);

    const callbacks: Array<{ frame: number; raw: string; composite: string }> = [];
    const renderer = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlan(plan, renderer, encoder, {
      onFrameRendered: (frame, raw, composite) => {
        callbacks.push({ frame, raw: raw, composite });
      },
    });

    expect(callbacks).toHaveLength(1);
    expect(callbacks[0]!.raw).toContain("<main>tpl</main>");
    expect(callbacks[0]!.composite).toContain("background:#ff0000");
    expect(callbacks[0]!.composite).toContain("<main>tpl</main>");
  });

  it("encodes frames in order with correct timestamps", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({ render(ctx) { return String(ctx.globalFrame); } });
    `;
    const job = await jobFromCode(code, { duration: 0.3, fps: 10 });
    const plan = await createRenderPlan(job);

    const renderer = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlan(plan, renderer, encoder);

    expect(encoder.frames.map((f) => f.ts)).toEqual([0, 0.1, 0.2]);
  });
});

describe("executeRenderPlanParallel", () => {
  it("distributes frames round-robin and encodes in order", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; }
      });
    `;
    const job = await jobFromCode(code, { duration: 0.4, fps: 10 });
    const plan = await createRenderPlan(job);

    const rendererA = mockRenderer();
    const rendererB = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlanParallel(plan, [rendererA, rendererB], encoder);

    expect(rendererA.initConfigs[0]?.fps).toBe(10);
    expect(rendererB.initConfigs[0]?.fps).toBe(10);
    expect(rendererA.captureCount + rendererB.captureCount).toBe(4);
    expect(encoder.frames).toHaveLength(4);
    expect(encoder.frames.map((f) => f.ts)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it("falls back to single renderer when array has one entry", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; }
      });
    `;
    const job = await jobFromCode(code, { duration: 0.2, fps: 10 });
    const plan = await createRenderPlan(job);

    const renderer = mockRenderer();
    const encoder = mockEncoder();

    await executeRenderPlanParallel(plan, [renderer], encoder);

    expect(renderer.captureCount).toBe(2);
    expect(encoder.frames).toHaveLength(2);
  });

  it("throws when renderers array is empty", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({ render() { return '<div />'; } });
    `;
    const job = await jobFromCode(code);
    const plan = await createRenderPlan(job);
    const encoder = mockEncoder();

    await expect(
      executeRenderPlanParallel(plan, [], encoder)
    ).rejects.toThrow(/renderers array is empty/);
  });

  it("bounds out-of-order captured frames behind a slow frame", async () => {
    const code = `
      import { define } from 'superimg';
      export default define({
        render(ctx) { return '<div>' + ctx.globalFrame + '</div>'; }
      });
    `;
    const job = await jobFromCode(code, { duration: 0.8, fps: 10 });
    const plan = await createRenderPlan(job);
    let releaseFirst!: () => void;
    const firstFrameGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let capturesStarted = 0;
    const makeRenderer = () => ({
      init: async () => {},
      captureFrame: async (html: string) => {
        capturesStarted += 1;
        if (html.includes(">0</div>")) await firstFrameGate;
        return html;
      },
      dispose: async () => {},
    });
    const rendering = executeRenderPlanParallel(
      plan,
      [makeRenderer(), makeRenderer()],
      mockEncoder(),
      { maxBufferedFrames: 2 },
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(capturesStarted).toBe(2);
    releaseFirst();
    await rendering;
  });
});
