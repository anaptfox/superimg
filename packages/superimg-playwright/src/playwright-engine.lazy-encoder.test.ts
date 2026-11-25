import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoEncoderConfig } from "@superimg/types";
import { PlaywrightEngine } from "./playwright-engine.js";

const encoderState = vi.hoisted(() => ({
  videoConstructed: 0,
  stillConstructed: 0,
  gifConstructed: 0,
  videoInitConfigs: [] as unknown[],
  stillInitConfigs: [] as unknown[],
  gifInitConfigs: [] as unknown[],
  videoFrames: [] as Array<{ frame: Buffer; timestamp: number }>,
  stillFrames: [] as Array<{ frame: Buffer; timestamp: number }>,
  videoDisposed: 0,
  stillDisposed: 0,
  gifDisposed: 0,
}));

vi.mock("./node-encoder.js", () => ({
  NodeVideoEncoder: class {
    constructor() {
      encoderState.videoConstructed += 1;
    }

    async init(config: unknown): Promise<void> {
      encoderState.videoInitConfigs.push(config);
    }

    async addFrame(frame: Buffer, timestamp: number): Promise<void> {
      encoderState.videoFrames.push({ frame, timestamp });
    }

    async finalize(): Promise<Uint8Array> {
      return new Uint8Array([1, 2, 3]);
    }

    async dispose(): Promise<void> {
      encoderState.videoDisposed += 1;
    }
  },
}));

vi.mock("./sharp-still-encoder.js", () => ({
  SharpStillEncoder: class {
    constructor() {
      encoderState.stillConstructed += 1;
    }

    async init(config: unknown): Promise<void> {
      encoderState.stillInitConfigs.push(config);
    }

    async addFrame(frame: Buffer, timestamp: number): Promise<void> {
      encoderState.stillFrames.push({ frame, timestamp });
    }

    async finalize(): Promise<Uint8Array> {
      return new Uint8Array([7, 8, 9]);
    }

    async dispose(): Promise<void> {
      encoderState.stillDisposed += 1;
    }
  },
}));

vi.mock("./ffmpeg-gif-encoder.js", () => ({
  FfmpegGifEncoder: class {
    constructor() {
      encoderState.gifConstructed += 1;
    }

    async init(config: unknown): Promise<void> {
      encoderState.gifInitConfigs.push(config);
    }

    async addFrame(): Promise<void> {}

    async finalize(): Promise<Uint8Array> {
      return new Uint8Array([71, 73, 70]);
    }

    async dispose(): Promise<void> {
      encoderState.gifDisposed += 1;
    }
  },
}));

function initializedEngine(): PlaywrightEngine {
  const engine = new PlaywrightEngine({ perRenderContext: true });
  Object.assign(engine, { browser: {}, frameExtractor: {} });
  return engine;
}

beforeEach(() => {
  encoderState.videoConstructed = 0;
  encoderState.stillConstructed = 0;
  encoderState.gifConstructed = 0;
  encoderState.videoInitConfigs.length = 0;
  encoderState.stillInitConfigs.length = 0;
  encoderState.gifInitConfigs.length = 0;
  encoderState.videoFrames.length = 0;
  encoderState.stillFrames.length = 0;
  encoderState.videoDisposed = 0;
  encoderState.stillDisposed = 0;
  encoderState.gifDisposed = 0;
});

describe("PlaywrightEngine lazy native encoders", () => {
  it("does not load native encoders for unused still or video adapters", async () => {
    const engine = initializedEngine();

    const still = engine.createAdapters({ encoding: { format: "png" } });
    await still.encoder.dispose();

    const video = engine.createAdapters({ encoding: { format: "mp4" } });
    await video.encoder.dispose();

    const gif = engine.createAdapters({ encoding: { format: "gif" } });
    await gif.encoder.dispose();

    expect(encoderState.stillConstructed).toBe(0);
    expect(encoderState.videoConstructed).toBe(0);
    expect(encoderState.gifConstructed).toBe(0);
  });

  it("loads ffmpeg only on GIF initialization", async () => {
    const engine = initializedEngine();
    const { encoder } = engine.createAdapters({ encoding: { format: "gif" } });
    const config: VideoEncoderConfig = {
      width: 16,
      height: 9,
      fps: 10,
      encoding: { format: "gif" },
    };

    await encoder.init(config);
    await expect(encoder.finalize()).resolves.toEqual(new Uint8Array([71, 73, 70]));
    await encoder.dispose();

    expect(encoderState.gifConstructed).toBe(1);
    expect(encoderState.gifInitConfigs).toEqual([config]);
    expect(encoderState.gifDisposed).toBe(1);
    expect(encoderState.stillConstructed).toBe(0);
    expect(encoderState.videoConstructed).toBe(0);
  });

  it("loads Sharp once on still initialization and preserves delegation", async () => {
    const engine = initializedEngine();
    const { encoder } = engine.createAdapters({ encoding: { format: "png" } });
    const config: VideoEncoderConfig = {
      width: 16,
      height: 9,
      fps: 1,
      encoding: { format: "png" },
    };

    await encoder.init(config);
    await encoder.addFrame(Buffer.from([4, 5, 6]), 0);
    await expect(encoder.finalize()).resolves.toEqual(new Uint8Array([7, 8, 9]));
    await encoder.dispose();

    expect(encoderState.stillConstructed).toBe(1);
    expect(encoderState.stillInitConfigs).toEqual([config]);
    expect(encoderState.stillFrames).toEqual([
      { frame: Buffer.from([4, 5, 6]), timestamp: 0 },
    ]);
    expect(encoderState.stillDisposed).toBe(1);
    expect(encoderState.videoConstructed).toBe(0);
  });

  it("loads once on video initialization and preserves encoder delegation", async () => {
    const engine = initializedEngine();
    const { encoder } = engine.createAdapters({ encoding: { format: "mp4" } });
    const config: VideoEncoderConfig = {
      width: 16,
      height: 9,
      fps: 24,
      encoding: { format: "mp4" },
    };

    await encoder.init(config);
    await encoder.addFrame(Buffer.from([4, 5, 6]), 0.25);
    await encoder.addFrame(Buffer.from([7, 8, 9]), 0.5);
    await encoder.addFrame(Buffer.from([1, 1, 1]), 0.75);
    await expect(encoder.finalize()).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await encoder.dispose();

    expect(encoderState.videoConstructed).toBe(1);
    expect(encoderState.videoInitConfigs).toEqual([config]);
    expect(encoderState.videoFrames).toEqual([
      { frame: Buffer.from([4, 5, 6]), timestamp: 0.25 },
      { frame: Buffer.from([7, 8, 9]), timestamp: 0.5 },
      { frame: Buffer.from([1, 1, 1]), timestamp: 0.75 },
    ]);
    expect(encoderState.videoDisposed).toBe(1);
    expect(encoderState.stillConstructed).toBe(0);
  });

  it.each(["mov", "mkv"] as const)("routes %s through the lazy Mediabunny encoder", async (format) => {
    const engine = initializedEngine();
    const { encoder } = engine.createAdapters({ encoding: { format } });
    await encoder.init({ width: 16, height: 9, fps: 24, encoding: { format } });
    await encoder.dispose();
    expect(encoderState.videoConstructed).toBe(1);
    expect(encoderState.gifConstructed).toBe(0);
  });

  it("uses a fresh still renderer unless pooling is requested", () => {
    const isolated = initializedEngine();
    expect(isolated.createAdapters({ encoding: { format: "png" } }).renderer.constructor.name)
      .toBe("PerRenderRasterizer");

    const pooled = new PlaywrightEngine({ poolStillPages: true });
    Object.assign(pooled, { browser: {}, frameExtractor: {} });
    expect(pooled.createAdapters({ encoding: { format: "png" } }).renderer.constructor.name)
      .toBe("PooledStillRasterizer");
  });
});
