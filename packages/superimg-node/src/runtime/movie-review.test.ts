import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ALL_FORMATS, BufferSource, Input, Quality, BufferTarget, Output, Mp4OutputFormat, WebMOutputFormat, VideoSample, VideoSampleSink, VideoSampleSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { decodeNodeMovieFrames, assertMovieReviewSelection } from "./movie-review.js";

registerMediabunnyServer();
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

async function movie(options: { frames?: number; fps?: number; webm?: boolean; timestamps?: number[]; frameRateHint?: boolean } = {}) {
  const frames = options.frames ?? 5, fps = options.fps ?? 25;
  const target = new BufferTarget();
  const output = new Output({ target, format: options.webm ? new WebMOutputFormat() : new Mp4OutputFormat() });
  const source = new VideoSampleSource({ codec: options.webm ? "vp9" : "avc", quality: new Quality("high") });
  output.addVideoTrack(source, options.frameRateHint === false ? {} : { frameRate: fps });
  await output.start();
  let complete = false;
  try {
    for (let frame = 0; frame < frames; frame++) {
      const rgba = new Uint8Array(32 * 32 * 4);
      for (let i = 0; i < rgba.length; i += 4) { rgba[i + frame % 3] = 255; rgba[i + 3] = 255; }
      const sample = new VideoSample(rgba, { format: "RGBA", codedWidth: 32, codedHeight: 32, timestamp: options.timestamps?.[frame] ?? frame / fps, duration: 1 / fps });
      try { await source.add(sample); } finally { sample.close(); }
    }
    await output.finalize(); complete = true;
    const bytes = new Uint8Array(target.buffer!);
    return { bytes, sha256: sha(bytes), byteLength: bytes.byteLength, clock: { width: 32, height: 32, fps, totalFrames: frames } };
  } finally { if (!complete) await output.cancel(); }
}

describe("exact encoded movie review decoder", () => {
  it("rejects knowable canvas/clock/evidence work before decoding", () => {
    expect(() => assertMovieReviewSelection({ width: 7680, height: 4320, fps: 25, totalFrames: 25 }, [0])).toThrow(/limits/);
    expect(() => assertMovieReviewSelection({ width: 32, height: 32, fps: 25, totalFrames: 25 }, Array.from({ length: 513 }, () => 0))).toThrow(/limits/);
  });

  it("observes cancellation after yielding the final selected sample", async () => {
    const source = await movie({ frames: 1 });
    const controller = new AbortController();
    const iterator = decodeNodeMovieFrames({ ...source, frames: [0], signal: controller.signal });
    expect((await iterator.next()).done).toBe(false);
    controller.abort(new Error("cancelled after final frame"));
    await expect(iterator.next()).rejects.toThrow("cancelled after final frame");
  });

  it.each([false, true])("decodes selected presentation indices from real %s/WebM bytes with their actual timestamps", async webm => {
    const input = await movie({ webm });
    const frames = [];
    for await (const frame of decodeNodeMovieFrames({ ...input, frames: [0, 2, 4] })) frames.push(frame);
    expect(frames.map(frame => frame.frame)).toEqual([0, 2, 4]);
    expect(frames.map(frame => frame.timestamp)).toEqual([0, .08, .16]);
    expect(frames.every(frame => Math.abs(frame.duration - .04) < .002)).toBe(true);
    const sharp = (await import("sharp")).default;
    const pixels = await Promise.all(frames.map(async frame => [...(await sharp(frame.png).raw().toBuffer()).subarray(0, 3)]));
    expect(pixels[0]![0]).toBeGreaterThan(240);
    expect(pixels[1]![2]).toBeGreaterThan(240);
    expect(pixels[2]![1]).toBeGreaterThan(240);
    // Independent native sink consumption of the exact retained bytes is the pixel oracle.
    const independent = new Input({ source: new BufferSource(input.bytes), formats: ALL_FORMATS });
    try {
      const track = await independent.getPrimaryVideoTrack();
      let index = 0;
      for await (const sample of new VideoSampleSink(track!).samples()) {
        try {
          const captured = frames.find(frame => frame.frame === index);
          if (captured) {
            const rgba = new Uint8Array(sample.allocationSize({ format: "RGBA" }));
            await sample.copyTo(rgba, { format: "RGBA" });
            expect(new Uint8Array(await sharp(captured.png).raw().toBuffer())).toEqual(rgba);
          }
          index++;
        } finally { sample.close(); }
      }
    } finally { independent.dispose(); }
  });

  it("handles a one-frame movie and refuses missing/extra frames, VFR and changed bytes", async () => {
    const one = await movie({ frames: 1, fps: 24 });
    const received = [];
    for await (const frame of decodeNodeMovieFrames({ ...one, frames: [0] })) received.push(frame);
    expect(received).toHaveLength(1);
    const drain = async (value: Parameters<typeof decodeNodeMovieFrames>[0]) => { for await (const _ of decodeNodeMovieFrames(value)) { /* force final clock checks */ } };
    await expect(drain({ ...one, frames: [1] })).rejects.toMatchObject({ code: "REVIEW_FRAME_INVALID" });
    await expect(drain({ ...one, frames: [0], sha256: "0".repeat(64) })).rejects.toMatchObject({ code: "REVIEW_MOVIE_STALE" });
    await expect(drain({ ...one, clock: { ...one.clock, totalFrames: 2 }, frames: [0] })).rejects.toMatchObject({ code: "REVIEW_CLOCK_MISMATCH" });
    const variable = await movie({ timestamps: [0, .04, .1, .15, .2] });
    await expect(drain({ ...variable, frames: [0] })).rejects.toMatchObject({ code: "REVIEW_CLOCK_MISMATCH" });
    // MediaBunny now writes the final Matroska packet duration even without a
    // frame-rate hint, so this formerly incomplete clock is reviewable.
    const inferredDuration = await movie({ webm: true, frameRateHint: false });
    await expect(drain({ ...inferredDuration, frames: [0] })).resolves.toBeUndefined();
    const aborted = new AbortController(); aborted.abort(new Error("cancelled review"));
    await expect(drain({ ...one, frames: [0], signal: aborted.signal })).rejects.toThrow("cancelled review");
  });
});
