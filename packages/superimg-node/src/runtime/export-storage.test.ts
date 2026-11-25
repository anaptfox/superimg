import { access, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntime, exportMedia, render } from "@superimg/core/runtime";
import type { PlaywrightEngine } from "@superimg/playwright/engine";
import { MEDIA_ELEMENT, video, type VideoEncoderConfig } from "@superimg/types";
import { createNodeRuntimeAdapter } from "./adapter.js";

const media = video({ duration: "3f", fps: 10, size: { width: 80, height: 40 }, render: () => ({
  $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", html: "fixture" }, children: [],
}) });
const target = { id: "movie", format: "mp4" as const, width: 80, height: 40 };

function engine(hooks: {
  file?: boolean;
  capture?: (time: number | undefined) => Promise<void>;
  encode?: (time: number) => Promise<void>;
  init?: (config: VideoEncoderConfig) => void;
}): PlaywrightEngine {
  const impl = {
    async init() {}, async dispose() {},
    createAdapters() {
      let path: string | undefined;
      return {
        renderer: {
          async init() {}, async dispose() {},
          async rasterize(_html: string, options?: { time?: number }) {
            await hooks.capture?.(options?.time);
            return Buffer.from([1, 2, 3]);
          },
        },
        encoder: {
          async init(config: VideoEncoderConfig) { path = config.output?.path; hooks.init?.(config); },
          async addFrame(_bytes: Buffer, time: number) { await hooks.encode?.(time); },
          async finalize() { return Buffer.from([1, 2, 3]); },
          ...(hooks.file ? { async finalizeToFile() {
            if (!path) throw new Error("File output was not requested");
            await writeFile(path, new Uint8Array([2, 4, 6, 8]));
            return { path, byteLength: 4 };
          } } : {}),
          async dispose() {},
        },
      };
    },
  };
  return impl as unknown as PlaywrightEngine;
}

describe("Node export execution ownership", () => {
  it("overlaps one capture with an encoder write while preserving order and bounded buffering", async () => {
    let releaseWrite!: () => void;
    const firstWrite = new Promise<void>((resolve) => { releaseWrite = resolve; });
    let signalSecondCapture!: () => void;
    const secondCapture = new Promise<void>((resolve) => { signalSecondCapture = resolve; });
    const captures: number[] = [];
    const writes: number[] = [];
    const runtime = createRuntime(createNodeRuntimeAdapter({ createEngine: () => engine({
      capture: async (time) => {
        captures.push(time!);
        if (time === 0.1) signalSecondCapture();
      },
      encode: async (time) => { writes.push(time); if (time === 0) await firstWrite; },
    }) }));
    const job = exportMedia(runtime, media, { for: [target] });
    try {
      // Synchronize on the actual second capture. Polling for this brief state
      // can miss it under parallel Vitest load, then release the encoder in
      // finally and report the resulting third frame as the assertion value.
      await secondCapture;
      expect(captures).toEqual([0, 0.1]);
      expect(writes).toEqual([0]);
      releaseWrite();
      const bundle = await job;
      expect(captures).toEqual([0, 0.1, 0.2]);
      expect(writes).toEqual([0, 0.1, 0.2]);
      await bundle.dispose();
    } finally {
      releaseWrite();
      await job.catch(() => undefined);
      await runtime.dispose();
    }
  });

  it("keeps sealed files readable after runtime disposal and removes them with the bundle", async () => {
    let outputPath = "";
    const runtime = createRuntime(createNodeRuntimeAdapter({ createEngine: () => engine({
      file: true, init: (config) => { outputPath = config.output!.path; expect(config.durationSeconds).toBe(0.3); },
    }) }));
    const bundle = await exportMedia(runtime, media, { for: [target] });
    await runtime.dispose();
    try {
      await expect(access(outputPath)).resolves.toBeUndefined();
      for (let i = 0; i < 2; i++) {
        expect(new Uint8Array(await new Response(bundle.artifacts[0]!.stream()).arrayBuffer())).toEqual(new Uint8Array([2, 4, 6, 8]));
      }
      expect(bundle.artifacts[0]!.byteLength).toBe(4);
    } finally { await bundle.dispose(); }
    await expect(access(dirname(outputPath))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes already completed movies when a later rendition fails", async () => {
    let outputPath = "";
    let captures = 0;
    const runtime = createRuntime(createNodeRuntimeAdapter({ createEngine: () => engine({
      file: true, init: (config) => { outputPath ||= config.output!.path; },
      capture: async () => { if (++captures === 4) throw new Error("capture failed"); },
    }) }));
    await expect(exportMedia(runtime, media, { for: [target, { ...target, id: "second" }] })).rejects.toThrow(/capture failed/);
    await expect(access(dirname(outputPath))).rejects.toMatchObject({ code: "ENOENT" });
    await runtime.dispose();
  });

  it("passes an exact still's selected frame time to the capture backend", async () => {
    const times: (number | undefined)[] = [];
    const runtime = createRuntime(createNodeRuntimeAdapter({ createEngine: () => engine({
      capture: async (time) => { times.push(time); },
    }) }));
    try { await render(runtime, media, { as: "png", at: "2f" }); }
    finally { await runtime.dispose(); }
    expect(times).toEqual([0.2]);
  });
});
