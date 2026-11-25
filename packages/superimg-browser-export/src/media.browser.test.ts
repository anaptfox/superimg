import { describe, expect, it } from "vitest";
import { ALL_FORMATS, BufferSource, BufferTarget, EncodedPacketSink, Input, Mp4OutputFormat, MkvOutputFormat, Output, Quality, VideoSample, VideoSampleSource } from "mediabunny";
import type { ConversionRequest } from "@superimg/types";
import { convertNativeMedia, inspectNativeMedia } from "./runtime/media.js";

/** Browser WebCodecs fixture: no Node extension or server codec registration. */
async function sourceBytes(frameCount = 12, matroska = false) {
  const target = new BufferTarget();
  const output = new Output({ format: matroska ? new MkvOutputFormat() : new Mp4OutputFormat(), target });
  const source = new VideoSampleSource({ codec: "vp9", quality: new Quality("high"), keyFrameInterval: 1 });
  output.addVideoTrack(source, { rotation: 90, flip: true });
  const canvas = new OffscreenCanvas(32, 16);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "red";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "blue";
  ctx.fillRect(16, 0, 16, 16);
  let finalized = false;
  try {
    await output.start();
    for (let frame = 0; frame < frameCount; frame++) {
      const sample = new VideoSample(canvas, { timestamp: frame / 4, duration: 0.25 });
      try { await source.add(sample, { keyFrame: frame % 4 === 0 }); }
      finally { sample.close(); }
    }
    await output.finalize();
    finalized = true;
    return new Uint8Array(target.buffer!);
  } finally { if (!finalized) await output.cancel(); }
}

async function packets(bytes: Uint8Array) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Missing fixture video");
    const result = [];
    for await (const packet of new EncodedPacketSink(track).packets()) result.push(packet);
    return result;
  } finally { input.dispose(); }
}

describe("browser native conversion", () => {
  it("retains encoded packets and orientation metadata, and rejects required copy without dropping the selected track", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    expect(inspection.tracks[0]).toMatchObject({ width: 32, height: 16, displayWidth: 16, displayHeight: 32, rotation: 90, flip: true, canBeTransparent: false });
    const request: ConversionRequest = {
      sources: [{ id: "clip", input: { kind: "bytes", bytes } }],
      video: { sourceId: "clip", trackId: inspection.tracks[0]!.id, flip: true, trim: { startSeconds: 1.5, endSeconds: 2.5 } },
      audio: [], format: "mp4", copy: { mode: "required" },
    };
    const convert = (patch: Partial<ConversionRequest> = {}) => convertNativeMedia({ ...request, ...patch }, fetcher, async () => {}, () => {});
    const copied = await convert();
    expect(copied.tracks).toMatchObject([{ action: "copy", outputStartSeconds: -0.5, outputEndSeconds: 1 }]);
    const original = await packets(bytes);
    for (const packet of await packets(copied.bytes)) {
      expect(packet.data).toEqual(original.find((old) => old.timestamp === packet.timestamp + 1.5)!.data);
    }
    const result = await inspectNativeMedia({ kind: "bytes", bytes: copied.bytes }, fetcher);
    expect(result.tracks[0]).toMatchObject({ rotation: 90, flip: false, displayWidth: 16, displayHeight: 32 });
    expect(result.tracks[0]!.transformationMatrix).toHaveLength(9);
    await expect(convert({ copy: { mode: "required", boundaryTolerance: 0.25 } })).rejects.toThrow("cannot_copy");
    const shrunk = await convert({ copy: { mode: "required", boundaryPolicy: "shrink" } });
    expect(shrunk.tracks).toMatchObject([{ action: "copy", outputStartSeconds: 0.5 }]);
  });

  it("normalizes metadata-only one-frame timing before browser resize while retaining orientation", async () => {
    const bytes = await sourceBytes(1, true);
    const fetcher = fetch.bind(globalThis);
    // Author the MKV metadata directly. Conversion bakes MKV transforms for player compatibility.
    const mkv = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    expect(mkv).toMatchObject({ durationSeconds: 0.25, tracks: [{ flip: true, rotation: 90 }] });
    const request: ConversionRequest = {
      sources: [{ id: "clip", input: { kind: "bytes", bytes } }],
      video: { sourceId: "clip", trackId: mkv.tracks[0]!.id }, audio: [], format: "mp4",
    };
    const copied = await convertNativeMedia({ ...request, copy: { mode: "required" } }, fetcher, async () => {}, () => {});
    expect(copied.tracks[0]!.action).toBe("copy");
    expect((await inspectNativeMedia({ kind: "bytes", bytes: copied.bytes }, fetcher))).toMatchObject({ durationSeconds: 0.25, tracks: [{ flip: true, rotation: 90 }] });
    const resized = await convertNativeMedia({ ...request, resize: { width: 8, height: 8 }, encoding: { video: { codec: "vp9" } } }, fetcher, async () => {}, () => {});
    expect(resized.tracks[0]!.action).toBe("transcode");
    expect((await inspectNativeMedia({ kind: "bytes", bytes: resized.bytes }, fetcher))).toMatchObject({ durationSeconds: 0.25, tracks: [{ width: 8, height: 8, flip: false, rotation: 0 }] });
  });

  it("falls back to browser encoding for a strict start boundary and explicit pixel mirroring", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const converted = await convertNativeMedia({
      sources: [{ id: "clip", input: { kind: "bytes", bytes } }],
      video: { sourceId: "clip", trackId: inspection.tracks[0]!.id, allowTransformationMetadata: false, trim: { startSeconds: 1.5, endSeconds: 2.5 } },
      audio: [], format: "mp4", copy: { boundaryTolerance: 0.25 }, encoding: { video: { codec: "vp9" } },
    }, fetcher, async () => {}, () => {});
    expect(converted.tracks).toMatchObject([{ action: "transcode", outputStartSeconds: 0 }]);
    expect(converted.durationSeconds).toBeCloseTo(1, 6);
    expect((await inspectNativeMedia({ kind: "bytes", bytes: converted.bytes }, fetcher)).tracks[0]).toMatchObject({ width: 16, height: 32, rotation: 0, flip: false });
  });
});
