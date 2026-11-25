import { expect, it } from "vitest";
import { image, collection, sequence, video, Text } from "./index.js";
import { describeMedia } from "./runtime.describe.js";

it("describes authored values without running providers or projecting programs", () => {
  let calls = 0;
  const media = image({ size: { width: 100, height: 50 }, sample: { id: "x" }, render: () => { throw new Error("rendered"); } });
  const value = collection({ entries: () => { calls++; return [{ id: "x" }]; }, media });
  expect(describeMedia(value)).toMatchObject({ kind: "collection", canvas: { width: 100, height: 50 } });
  expect(describeMedia(sequence([{ id: "a", content: media }]))).toEqual({ kind: "program", operation: "sequence" });
  expect(calls).toBe(0);
});

it("probes phases only on request and reports the runtime clock", () => {
  let renders = 0;
  const media = video({
    duration: "2s",
    fps: 25,
    render(ctx) {
      renders++;
      ctx.director({ intro: "25%", hold: "75%" });
      return Text({}, "hello");
    },
  });
  expect(describeMedia(media)).toMatchObject({ clock: { fps: 25, totalFrames: 50, durationSeconds: 2 } });
  expect(renders).toBe(0);
  expect(describeMedia(media, { probePhases: true })).toMatchObject({
    phases: [{ name: "intro", startSeconds: 0, endSeconds: 0.5 }, { name: "hold", startSeconds: 0.5, endSeconds: 2 }],
  });
  expect(renders).toBe(1);
});
