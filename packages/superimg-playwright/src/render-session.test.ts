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
      getBaseUrl: () => "http://127.0.0.1:1234",
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
});
