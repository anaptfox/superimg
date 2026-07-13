import { describe, expect, it } from "vitest";
import { bundleTemplateCodeWithMap } from "@superimg/core/bundler";
import type { FrameRenderer, RenderJob, VideoEncoder } from "@superimg/types";
import { createRenderSession, type RenderSessionEngine } from "./render-session.js";

function renderer(): FrameRenderer<string> {
  return {
    init: async () => {},
    captureFrame: async (html) => html,
    dispose: async () => {},
  };
}

function encoder(frames: Array<{ frame: string; ts: number }>): VideoEncoder<string> {
  return {
    init: async () => {},
    addFrame: async (frame, ts) => {
      frames.push({ frame, ts });
    },
    finalize: async () => new Uint8Array([1, 2, 3]),
    dispose: async () => {},
  };
}

async function job(): Promise<RenderJob> {
  const templateBundle = await bundleTemplateCodeWithMap(
    `
      import { define } from "superimg";
      export default define({
        config: { fps: 10, duration: 0.2, width: 100, height: 100 },
        render(ctx) { return "<main>" + ctx.globalFrame + "</main>"; }
      });
    `,
    { sourcefile: "session.media.ts" },
  );
  return {
    templateBundle,
    duration: 0.2,
    width: 100,
    height: 100,
    fps: 10,
  };
}

describe("RenderSession", () => {
  it("initializes one engine and renders jobs through mocked adapters", async () => {
    const frames: Array<{ frame: string; ts: number }> = [];
    let initCount = 0;
    let disposeCount = 0;
    const engine: RenderSessionEngine<string> = {
      init: async () => {
        initCount++;
      },
      createAdapters: () => ({ renderer: renderer(), encoder: encoder(frames) }),
      registerAsset: (filePath) => `http://127.0.0.1:1234/assets/${filePath}`,
      dispose: async () => {
        disposeCount++;
      },
    };

    const session = await createRenderSession({ engine });
    const output = await session.render(await job());
    await session.render(await job());
    await session.close();

    expect(output).toEqual(new Uint8Array([1, 2, 3]));
    expect(initCount).toBe(1);
    expect(disposeCount).toBe(1);
    expect(frames.map((frame) => frame.ts)).toEqual([0, 0.1, 0, 0.1]);
  });

  it("serializes concurrent jobs that share one engine", async () => {
    let releaseCapture!: () => void;
    const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    let adapterCount = 0;
    const engine: RenderSessionEngine<string> = {
      init: async () => {},
      createAdapters: () => {
        adapterCount += 1;
        const current = adapterCount;
        return {
          renderer: {
            init: async () => {},
            captureFrame: async (html) => {
              if (current === 1) {
                captureStarted();
                await captureGate;
              }
              return html;
            },
            dispose: async () => {},
          },
          encoder: encoder([]),
        };
      },
      dispose: async () => {},
    };
    const session = await createRenderSession({ engine });
    const renderJob = await job();

    const first = session.render(renderJob);
    const second = session.render(renderJob);
    await started;
    expect(adapterCount).toBe(1);
    releaseCapture();

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(adapterCount).toBe(2);
    await session.close();
  });

  it("cancels queued work without starting new adapters", async () => {
    let releaseCapture!: () => void;
    const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    let adapterCount = 0;
    const engine: RenderSessionEngine<string> = {
      init: async () => {},
      createAdapters: () => {
        adapterCount += 1;
        return {
          renderer: {
            init: async () => {},
            captureFrame: async (html) => {
              captureStarted();
              await captureGate;
              return html;
            },
            dispose: async () => {},
          },
          encoder: encoder([]),
        };
      },
      dispose: async () => {},
    };
    const session = await createRenderSession({ engine });
    const renderJob = await job();
    const first = session.render(renderJob);
    await started;
    const controller = new AbortController();
    const queued = session.render(renderJob, { signal: controller.signal });
    controller.abort();

    await expect(queued).rejects.toMatchObject({ code: "aborted" });
    expect(adapterCount).toBe(1);
    releaseCapture();
    await first;
    await session.close();
  });

  it("waits for an active render during close and rejects new work", async () => {
    let releaseCapture!: () => void;
    const captureGate = new Promise<void>((resolve) => { releaseCapture = resolve; });
    let captureStarted!: () => void;
    const started = new Promise<void>((resolve) => { captureStarted = resolve; });
    let disposeCount = 0;
    const engine: RenderSessionEngine<string> = {
      init: async () => {},
      createAdapters: () => ({
        renderer: {
          init: async () => {},
          captureFrame: async (html) => {
            captureStarted();
            await captureGate;
            return html;
          },
          dispose: async () => {},
        },
        encoder: encoder([]),
      }),
      dispose: async () => { disposeCount += 1; },
    };
    const session = await createRenderSession({ engine });
    const renderJob = await job();
    const rendering = session.render(renderJob);
    await started;
    const closing = session.close();

    await expect(session.render(renderJob)).rejects.toThrow(/closed/);
    expect(disposeCount).toBe(0);
    releaseCapture();
    await rendering;
    await closing;
    expect(disposeCount).toBe(1);
  });
});
