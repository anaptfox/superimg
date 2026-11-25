import { describe, expect, it } from "vitest";
import { exampleFrameSamples, GENERIC_FRAME_SAMPLES } from "./example-frame-samples.mjs";

describe("catalog example frame samples", () => {
  it("keeps the generic sample set for examples without a retained schedule", () => {
    expect(exampleFrameSamples()).toEqual(GENERIC_FRAME_SAMPLES);
  });

  it("retains generic sampling without adding out-of-clock boundaries for one-frame programs", () => {
    expect(exampleFrameSamples({
      totalFrames: 1,
      leaves: [{ path: "one", startFrame: 0, endFrame: 1 }],
    })).toEqual(GENERIC_FRAME_SAMPLES);
  });

  it("covers each leaf transition in the 57-frame three-leaf schedule", () => {
    const samples = exampleFrameSamples({
      totalFrames: 57,
      leaves: [
        { path: "opener", startFrame: 0, endFrame: 25 },
        { path: "chapter/demo", startFrame: 25, endFrame: 32 },
        { path: "chapter/result", startFrame: 32, endFrame: 57 },
      ],
    });

    expect(samples.slice(GENERIC_FRAME_SAMPLES.length)).toEqual([
      { name: "opener:exit/chapter/demo:before", frame: 24 },
      { name: "opener:after/chapter/demo:entry", frame: 25 },
      { name: "chapter/demo:exit/chapter/result:before", frame: 31 },
      { name: "chapter/demo:after/chapter/result:entry", frame: 32 },
    ]);
    expect(samples.filter((sample) => sample.frame !== undefined).map((sample) => sample.frame))
      .toEqual([24, 25, 31, 32]);
  });
});
