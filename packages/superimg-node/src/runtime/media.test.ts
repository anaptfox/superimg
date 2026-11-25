import { describe, expect, it, vi } from "vitest";
import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BufferSource,
  BufferTarget,
  EncodedPacketSink,
  Input,
  Mp4OutputFormat,
  MkvOutputFormat,
  Output,
  Quality,
  VideoSample,
  VideoSampleSource,
  VideoSampleSink,
} from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { createRuntime, startConversion } from "@superimg/core/runtime";
import { mediaTrackId, type ConversionRequest } from "@superimg/types";
import { createNodeRuntimeAdapter } from "./adapter.js";
import { convertNativeMedia as convertNativeMediaToBacking, inspectNativeMedia, repairSinglePacketDuration } from "./media.js";
import * as media from "mediabunny";
import { ExportArtifactStorage } from "./artifact-storage.js";
import { access } from "node:fs/promises";

// Most existing codec assertions consume bytes. Keep that independent decoder
// evidence while ensuring the native adapter's file backing is disposed.
async function convertNativeMedia(...args: Parameters<typeof convertNativeMediaToBacking>) {
  const result = await convertNativeMediaToBacking(...args);
  if (result.bytes) return { ...result, bytes: result.bytes };
  const backing = result.backing!;
  try { return { ...result, bytes: new Uint8Array(await new Response(backing.open()).arrayBuffer()) }; }
  finally { await backing.dispose(); }
}

registerMediabunnyServer();

async function sourceBytes(lateAudio = false): Promise<Uint8Array> {
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") });
  const audioA = new AudioSampleSource({ codec: "aac", quality: new Quality("low") });
  const audioB = new AudioSampleSource({ codec: "aac", quality: new Quality("low") });
  output.addVideoTrack(video);
  output.addAudioTrack(audioA);
  output.addAudioTrack(audioB);
  await output.start();
  for (let i = 0; i < 2; i += 1) {
    const frame = new VideoSample(new Uint8Array(16 * 16 * 4), { format: "RGBA", codedWidth: 16, codedHeight: 16, timestamp: i, duration: 1 });
    await video.add(frame); frame.close();
  }
  for (const [index, source] of [audioA, audioB].entries()) {
    const sample = new AudioSample({ data: new Float32Array(index === 0 ? 8_000 : 4_000), format: "f32", sampleRate: 8_000, numberOfChannels: 1, timestamp: lateAudio && index === 1 ? 0.5 : 0 });
    await source.add(sample); sample.close();
  }
  await output.finalize();
  return new Uint8Array(target.buffer!);
}

async function singleFrameBytes(timestamp = 0, matroska = false, precedingAudio = false): Promise<Uint8Array> {
  const target = new BufferTarget();
  const output = new Output({ format: matroska ? new MkvOutputFormat() : new Mp4OutputFormat(), target });
  const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") });
  const audio = precedingAudio ? new AudioSampleSource({ codec: "aac", quality: new Quality("low") }) : undefined;
  if (audio) output.addAudioTrack(audio);
  output.addVideoTrack(video);
  await output.start();
  const frame = new VideoSample(new Uint8Array(16 * 16 * 4), { format: "RGBA", codedWidth: 16, codedHeight: 16, timestamp, duration: 1 });
  await video.add(frame);
  frame.close();
  if (audio) {
    const sample = new AudioSample({ data: new Float32Array(2_000), format: "f32", sampleRate: 8_000, numberOfChannels: 1, timestamp: 0 });
    try { await audio.add(sample); } finally { sample.close(); }
  }
  await output.finalize();
  return new Uint8Array(target.buffer!);
}

async function waitForState(job: { readonly state: string }, state: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (job.state === state) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for job state ${state}; received ${job.state}`);
}

async function videoPacketTimestamps(bytes: Uint8Array): Promise<number[]> {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  try {
    const [track] = await input.getVideoTracks();
    if (track === undefined) throw new Error("Expected a video track");
    const timestamps: number[] = [];
    for await (const packet of new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) {
      timestamps.push(packet.timestamp);
    }
    return timestamps;
  } finally {
    input.dispose();
  }
}

/** Deliberate one-second GOPs with visible left/right content and delta frames. */
async function boundarySource(): Promise<Uint8Array> {
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const source = new VideoSampleSource({ codec: "avc", quality: new Quality("high"), keyFrameInterval: 1 });
  output.addVideoTrack(source);
  let finalized = false;
  try {
    await output.start();
    for (let i = 0; i < 12; i++) {
      const data = new Uint8Array(32 * 16 * 4);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
        const at = (y * 32 + x) * 4;
        data[at + (x < 16 ? 0 : 2)] = 255;
        data[at + 3] = 255;
      }
      const frame = new VideoSample(data, { format: "RGBA", codedWidth: 32, codedHeight: 16, timestamp: i / 4, duration: 0.25 });
      try { await source.add(frame, { keyFrame: i % 4 === 0 }); }
      finally { frame.close(); }
    }
    await output.finalize();
    finalized = true;
    return new Uint8Array(target.buffer!);
  } finally { if (!finalized) await output.cancel(); }
}

async function videoPackets(bytes: Uint8Array) {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Missing video");
    const packets = [];
    for await (const packet of new EncodedPacketSink(track).packets()) packets.push(packet);
    return packets;
  } finally { input.dispose(); }
}

async function firstPixels(bytes: Uint8Array) {
  const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Missing video");
    const sample = await new VideoSampleSink(track).getSample(0);
    if (!sample) throw new Error("Missing sample");
    try {
      const pixels = new Uint8Array(32 * 16 * 4);
      await sample.copyTo(pixels, { format: "RGBA" });
      return pixels;
    } finally { sample.close(); }
  } finally { input.dispose(); }
}

describe("native media conversion", () => {
  it("opts into packet copying, boundary shrink, and tolerance fallback without changing legacy trims", async () => {
    const bytes = await boundarySource();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = inspection.tracks[0]!;
    const original = await videoPackets(bytes);
    expect(original.filter((packet) => packet.type === "key").map((packet) => packet.timestamp)).toEqual([0, 1, 2]);
    const request: ConversionRequest = {
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id, trim: { startSeconds: 1.5, endSeconds: 2.5 } },
      audio: [], format: "mp4",
    };
    const convert = (copy?: ConversionRequest["copy"]) => convertNativeMedia({ ...request, ...(copy === undefined ? {} : { copy }) }, fetcher, async () => {}, () => {});
    const expanded = await convert({ mode: "required" });
    expect(expanded.tracks).toMatchObject([{ action: "copy", outputStartSeconds: -0.5 }]);
    // AVC packet reordering/container duration inference can retain an end beyond the requested trim.
    expect(expanded.tracks[0]!.outputEndSeconds).toBeGreaterThanOrEqual(1);
    expect(expanded.durationSeconds).toBe((await inspectNativeMedia({ kind: "bytes", bytes: expanded.bytes }, fetcher)).durationSeconds);
    for (const packet of await videoPackets(expanded.bytes)) {
      expect(packet.data).toEqual(original.find((old) => old.timestamp === packet.timestamp + 1.5)!.data);
    }
    const shrunk = await convert({ mode: "required", boundaryPolicy: "shrink" });
    expect(shrunk.tracks).toMatchObject([{ action: "copy", outputStartSeconds: 0.5 }]);
    for (const packet of await videoPackets(shrunk.bytes)) {
      expect(packet.data).toEqual(original.find((old) => old.timestamp === packet.timestamp + 1.5)!.data);
    }
    for (const result of [await convert({ boundaryTolerance: 0.25 }), await convert(), await convert(false)]) {
      expect(result.tracks).toMatchObject([{ action: "transcode", outputStartSeconds: 0 }]);
      expect(result.durationSeconds).toBeCloseTo(1, 6);
    }
    const disposeInput = vi.spyOn(Input.prototype, "dispose");
    const cancelOutput = vi.spyOn(Output.prototype, "cancel");
    try {
      await expect(convert({ mode: "required", boundaryTolerance: 0.25 })).rejects.toThrow("cannot_copy");
      expect(disposeInput).toHaveBeenCalled();
      expect(cancelOutput).toHaveBeenCalled();
    } finally {
      disposeInput.mockRestore();
      cancelOutput.mockRestore();
    }
    // A rejected required copy cancels all allocated work and leaves subsequent conversions usable.
    expect((await convert({ mode: "required" })).tracks[0]!.action).toBe("copy");
  });

  it("copies every selected audio/video track without independent timeline shifts", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const audio = inspection.tracks.filter((track) => track.kind === "audio").reverse();
    const converted = await convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: audio.map((track, i) => ({ id: `audio-${i}`, sourceId: "source", trackId: track.id })),
      format: "mp4", copy: { mode: "required", shiftTolerance: 0 },
    }, fetcher, async () => {}, () => {});
    expect(converted.tracks.map((track) => track.action)).toEqual(["copy", "copy", "copy"]);
    expect(converted.tracks.map((track) => track.trackId)).toEqual([video.id, ...audio.map((track) => track.id)]);
    const original = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
    const result = new Input({ formats: ALL_FORMATS, source: new BufferSource(converted.bytes) });
    try {
      const oldTracks = await original.getTracks();
      const newTracks = await result.getTracks();
      expect(newTracks).toHaveLength(3);
      for (const [i, track] of newTracks.entries()) {
        const oldTrack = oldTracks.find((candidate) => mediaTrackId(candidate.type, candidate.number) === converted.tracks[i]!.trackId)!;
        expect(await track.getFirstTimestamp()).toBeCloseTo(await oldTrack.getFirstTimestamp(), 6);
        const oldSink = new EncodedPacketSink(oldTrack);
        for await (const packet of new EncodedPacketSink(track).packets()) {
          const oldPacket = await oldSink.getPacket(packet.timestamp + 0.000001);
          expect(packet.data).toEqual(oldPacket!.data);
        }
      }
    } finally { original.dispose(); result.dispose(); }
  });

  it("rejects empty shrunk output and never silently drops an uncopyable selected track", async () => {
    const bytes = await boundarySource();
    const fetcher = fetch.bind(globalThis);
    const { tracks } = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const request: ConversionRequest = {
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: tracks[0]!.id, trim: { startSeconds: 1.5, endSeconds: 1.75 } },
      audio: [], format: "mp4", copy: { mode: "required", boundaryPolicy: "shrink" },
    };
    await expect(convertNativeMedia(request, fetcher, async () => {}, () => {})).rejects.toThrow("no media");
    await expect(convertNativeMedia({ ...request, resize: { width: 8, height: 8 } }, fetcher, async () => {}, () => {})).rejects.toThrow("cannot_copy");
    const invalidCopy = { ...request, copy: { shiftTolerance: 1 } } as unknown as ConversionRequest;
    const noFetch = vi.fn(fetcher);
    await expect(convertNativeMedia(invalidCopy, noFetch, async () => {}, () => {})).rejects.toThrow("synchronization");
    expect(noFetch).not.toHaveBeenCalled();
  });

  it("copies flip metadata, composes an existing flip, and bakes a mirror into pixels when requested", async () => {
    const bytes = await boundarySource();
    const fetcher = fetch.bind(globalThis);
    const { tracks } = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    expect(tracks[0]).toMatchObject({ width: 32, height: 16, displayWidth: 32, displayHeight: 16, rotation: 0, flip: false, canBeTransparent: false });
    const request: ConversionRequest = {
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: tracks[0]!.id, flip: true }, audio: [], format: "mp4", copy: { mode: "required" },
    };
    const flipped = await convertNativeMedia(request, fetcher, async () => {}, () => {});
    expect(flipped.tracks[0]!.action).toBe("copy");
    const mirrored = await inspectNativeMedia({ kind: "bytes", bytes: flipped.bytes }, fetcher);
    expect(mirrored.tracks[0]).toMatchObject({ flip: true, rotation: 0, transformationMatrix: [-1, 0, 0, 0, 1, 0, 32, 0, 1] });
    expect(Object.isFrozen(mirrored.tracks[0]!.transformationMatrix)).toBe(true);
    const restored = await convertNativeMedia({ ...request, sources: [{ id: "source", input: { kind: "bytes", bytes: flipped.bytes } }], video: { ...request.video, trackId: mirrored.tracks[0]!.id } }, fetcher, async () => {}, () => {});
    expect((await inspectNativeMedia({ kind: "bytes", bytes: restored.bytes }, fetcher)).tracks[0]!.flip).toBe(false);
    const baked = await convertNativeMedia({ ...request, copy: { mode: "preferred" }, video: { ...request.video, allowTransformationMetadata: false } }, fetcher, async () => {}, () => {});
    expect(baked.tracks[0]!.action).toBe("transcode");
    expect((await inspectNativeMedia({ kind: "bytes", bytes: baked.bytes }, fetcher)).tracks[0]).toMatchObject({ flip: false, rotation: 0 });
    const pixels = await firstPixels(baked.bytes);
    const left = (8 * 32 + 4) * 4;
    const right = (8 * 32 + 28) * 4;
    expect(pixels[left + 2]! - pixels[left]!).toBeGreaterThan(150);
    expect(pixels[right]! - pixels[right + 2]!).toBeGreaterThan(150);
  });

  it("inspects real tracks and converts selected tracks with a trim and resize", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes, mimeType: "video/mp4" }, fetcher);
    expect(inspection.tracks.filter((track) => track.kind === "video")).toHaveLength(1);
    expect(inspection.tracks.filter((track) => track.kind === "audio")).toHaveLength(2);
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const audio = inspection.tracks.filter((track) => track.kind === "audio");
    expect(audio[0]!.durationSeconds!).toBeGreaterThan(audio[1]!.durationSeconds!);
    let planned: readonly { trackId: string; action: "copy" | "transcode" }[] = [];
    const converted = await convertNativeMedia({ sources: [{ id: "source", input: { kind: "bytes", bytes, mimeType: "video/mp4" } }], video: { sourceId: "source", trackId: video.id, trim: { endSeconds: 1 } }, audio: [{ id: "a", sourceId: "source", trackId: audio[1]!.id, trim: { endSeconds: 0.5 } }], format: "mp4", resize: { width: 8, height: 8 } }, fetcher, async () => {}, () => {}, async (tracks) => { planned = tracks; });
    expect(converted.durationSeconds).toBe(1);
    const inspected = await inspectNativeMedia({ kind: "bytes", bytes: converted.bytes, mimeType: converted.mimeType }, fetcher);
    expect(inspected.tracks).toHaveLength(2);
    expect(inspected.tracks.find((track) => track.kind === "video")).toMatchObject({ width: 8, height: 8 });
    expect(planned.map((track) => track.trackId)).toEqual([video.id, audio[1]!.id]);
    expect(planned.some((track) => track.action === "transcode")).toBe(true);
  });

  it("rejects malformed media", async () => {
    await expect(inspectNativeMedia({ kind: "bytes", bytes: new Uint8Array([0, 1, 2]) }, fetch.bind(globalThis))).rejects.toThrow();
  });

  it("uses positive container duration metadata when a one-frame MKV copy has no packet duration", async () => {
    const bytes = await singleFrameBytes();
    const fetcher = fetch.bind(globalThis);
    const source = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = source.tracks.find((track) => track.kind === "video")!;
    const converted = await convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id, trim: { endSeconds: 1 } },
      audio: [],
      format: "mkv",
    }, fetcher, async () => {}, () => {});
    expect(converted.tracks).toMatchObject([{ action: "copy" }]);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes: converted.bytes }, fetcher);
    expect(inspection.durationSeconds).toBeCloseTo(1, 6);
    expect(inspection.tracks[0]?.durationSeconds).toBeCloseTo(1, 6);
    const copiedVideo = inspection.tracks.find((track) => track.kind === "video")!;
    const reconverted = await convertNativeMedia({
      sources: [{ id: "copied", input: { kind: "bytes", bytes: converted.bytes } }],
      video: { sourceId: "copied", trackId: copiedVideo.id, trim: { endSeconds: 1 } },
      audio: [],
      format: "mkv",
    }, fetcher, async () => {}, () => {});
    expect(reconverted.tracks).toMatchObject([{ action: "copy" }]);
    expect((await inspectNativeMedia({ kind: "bytes", bytes: reconverted.bytes }, fetcher)).durationSeconds).toBeCloseTo(1, 6);

    const resized = await convertNativeMedia({
      sources: [{ id: "copied", input: { kind: "bytes", bytes: converted.bytes } }],
      video: { sourceId: "copied", trackId: copiedVideo.id, trim: { endSeconds: 1 } },
      audio: [],
      format: "mp4",
      resize: { width: 8, height: 8 },
      encoding: { video: { codec: "avc", quality: "low" } },
    }, fetcher, async () => {}, () => {});
    expect(resized.tracks).toMatchObject([{ action: "transcode" }]);
    expect(await inspectNativeMedia({ kind: "bytes", bytes: resized.bytes }, fetcher)).toMatchObject({ durationSeconds: 1, tracks: [{ codec: "avc", width: 8, height: 8 }] });

    const webm = await convertNativeMedia({
      sources: [{ id: "copied", input: { kind: "bytes", bytes: converted.bytes } }],
      video: { sourceId: "copied", trackId: copiedVideo.id, trim: { endSeconds: 1 } },
      audio: [],
      format: "webm",
      encoding: { video: { codec: "vp9", quality: "low" } },
    }, fetcher, async () => {}, () => {});
    expect(await inspectNativeMedia({ kind: "bytes", bytes: webm.bytes }, fetcher)).toMatchObject({ durationSeconds: 1, tracks: [{ codec: "vp9" }] });
  });

  it("restores metadata-only timing when the sole packet starts after zero", async () => {
    const bytes = await singleFrameBytes(0.5, true, true);
    const fetcher = fetch.bind(globalThis);
    const source = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = source.tracks.find((track) => track.kind === "video")!;
    expect(video.id).toBe("video:1");
    expect(source.durationSeconds).toBeCloseTo(1.5, 6);
    expect(video.durationSeconds).toBeCloseTo(1.5, 6);
    const converted = await convertNativeMedia({
      sources: [{ id: "late", input: { kind: "bytes", bytes } }],
      video: { sourceId: "late", trackId: video.id, trim: { startSeconds: 0.5, endSeconds: 1.5 } },
      audio: [], format: "mp4", resize: { width: 8, height: 8 },
    }, fetcher, async () => {}, () => {});
    expect(converted.tracks).toMatchObject([{ sourceId: "late", trackId: video.id, action: "transcode", outputStartSeconds: 0, outputEndSeconds: 1 }]);
    expect((await inspectNativeMedia({ kind: "bytes", bytes: converted.bytes }, fetcher)).durationSeconds).toBeCloseTo(1, 6);
  });

  it("enforces the output byte budget on timing repair", async () => {
    const bytes = await singleFrameBytes(0.5, true, true);
    const input = new Input({ formats: ALL_FORMATS, source: new BufferSource(bytes) });
    try {
      const track = await input.getPrimaryVideoTrack(); expect(track).not.toBeNull();
      const packet = await new EncodedPacketSink(track!).getFirstPacket(); expect(packet).not.toBeNull();
      const packets = vi.spyOn(EncodedPacketSink.prototype, "packets").mockImplementationOnce(async function* () { yield new media.EncodedPacket(packet!.data, packet!.type, packet!.timestamp, 0); });
      try { await expect(repairSinglePacketDuration(media, new media.MovOutputFormat(), track!, 1.5, undefined, 32)).rejects.toThrow("byte limit"); }
      finally { packets.mockRestore(); }
    } finally { input.dispose(); }
  });

  it("releases every input and discards undelivered output when input cleanup fails", async () => {
    const bytes = await sourceBytes(); const info = await inspectNativeMedia({ kind: "bytes", bytes }, fetch);
    const video = info.tracks.find(track => track.kind === "video")!, audio = info.tracks.find(track => track.kind === "audio")!;
    const originalAllocate = ExportArtifactStorage.prototype.allocate, originalDispose = ExportArtifactStorage.prototype.dispose;
    const paths: string[] = []; let disposals = 0;
    const allocate = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) { const path = await originalAllocate.call(this, ext); paths.push(path); return path; });
    const dispose = vi.spyOn(ExportArtifactStorage.prototype, "dispose").mockImplementation(async function (this: ExportArtifactStorage) { await originalDispose.call(this); if (++disposals === 1) throw new Error("first input cleanup failed"); });
    try {
      const fetcher: typeof fetch = async () => new Response(new Uint8Array(bytes));
      const failure = await convertNativeMediaToBacking({ sources: [{ id: "v", input: { kind: "url", url: "https://example.invalid/video" } }, { id: "a", input: { kind: "url", url: "https://example.invalid/audio" } }], video: { sourceId: "v", trackId: video.id }, audio: [{ id: "a", sourceId: "a", trackId: audio.id }], format: "mp4" }, fetcher, async () => {}, () => {}).catch(error => error);
      expect(failure).toBeInstanceOf(AggregateError); expect(String(failure.errors[0])).toContain("Media input cleanup failed");
      expect(String(failure.errors[0].errors[0])).toContain("first input cleanup failed");
      expect(paths).toHaveLength(3); expect(disposals).toBe(3);
      for (const path of paths) await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { allocate.mockRestore(); dispose.mockRestore(); }
  });

  it("uses detected MIME, selects a compatible codec preference, and rejects implicit leading padding", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes, mimeType: "audio/not-the-file" }, fetcher);
    expect(inspection.mimeType).toContain("video/mp4");
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const audio = inspection.tracks.filter((track) => track.kind === "audio");
    const converted = await convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: [{ id: "a", sourceId: "source", trackId: audio[0]!.id }],
      format: "webm",
      resize: { width: 8, height: 8 },
      encoding: { video: { codec: ["avc", "vp9"] }, audio: { codec: ["aac", "opus"] } },
    }, fetcher, async () => {}, () => {});
    const output = await inspectNativeMedia({ kind: "bytes", bytes: converted.bytes }, fetcher);
    expect(output.tracks.find((track) => track.kind === "video")?.codec).toBe("vp9");

    await expect(convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: [],
      format: "mp4",
      encoding: { video: { codec: "vp9", alpha: "keep" } },
    }, fetcher, async () => {}, () => {})).rejects.toThrow("compatible with mp4 and alpha");

    const lateBytes = await sourceBytes(true);
    const lateInspection = await inspectNativeMedia({ kind: "bytes", bytes: lateBytes }, fetcher);
    await expect(convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes: lateBytes } }],
      video: { sourceId: "source", trackId: lateInspection.tracks.find((track) => track.kind === "video")!.id },
      audio: [{ id: "late", sourceId: "source", trackId: lateInspection.tracks.filter((track) => track.kind === "audio")[1]!.id }],
      format: "mp4",
    }, fetcher, async () => {}, () => {})).rejects.toThrow("leading padding is unsupported");
  });

  it("aborts after active conversion work and releases output resources for the next conversion", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const controller = new AbortController();
    const request = {
      sources: [{ id: "source", input: { kind: "bytes" as const, bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: [],
      format: "mp4" as const,
    };
    await expect(convertNativeMedia(
      { ...request, signal: controller.signal },
      fetcher,
      async (completed) => { if (completed === 1) controller.abort(new Error("test abort")); },
      () => {},
    )).rejects.toThrow("test abort");

    const retry = await convertNativeMedia(request, fetcher, async () => {}, () => {});
    expect(retry.bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects duplicate audio ids and encoding namespaces conversion cannot honor", async () => {
    const bytes = await sourceBytes();
    const fetcher = fetch.bind(globalThis);
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetcher);
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const audio = inspection.tracks.filter((track) => track.kind === "audio");
    await expect(convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: [
        { id: "duplicate", sourceId: "source", trackId: audio[0]!.id },
        { id: "duplicate", sourceId: "source", trackId: audio[1]!.id },
      ],
      format: "mp4",
    }, fetcher, async () => {}, () => {})).rejects.toThrow("Duplicate conversion audio id");
    await expect(convertNativeMedia({
      sources: [{ id: "source", input: { kind: "bytes", bytes } }],
      video: { sourceId: "source", trackId: video.id },
      audio: [],
      format: "mp4",
      encoding: { capture: { dpr: 2 } },
    }, fetcher, async () => {}, () => {})).rejects.toThrow("does not support capture");
  });

  it("pauses at public conversion preflight, resumes without duplicate timestamps, and cancels while paused", async () => {
    const bytes = await sourceBytes();
    const inspection = await inspectNativeMedia({ kind: "bytes", bytes, mimeType: "video/mp4" }, fetch.bind(globalThis));
    const video = inspection.tracks.find((track) => track.kind === "video")!;
    const audio = inspection.tracks.filter((track) => track.kind === "audio");
    const request = {
      sources: [{ id: "source", input: { kind: "bytes" as const, bytes, mimeType: "video/mp4" } }],
      video: { sourceId: "source", trackId: video.id },
      audio: audio.map((track, index) => ({ id: `audio-${index}`, sourceId: "source", trackId: track.id })),
      format: "mp4" as const,
    };
    const runtime = createRuntime(createNodeRuntimeAdapter());
    try {
      const job = startConversion(runtime, request);
      let preflightPauseIssued = false;
      let progressPauseIssued = false;
      let resolveProgressPause: (() => void) | undefined;
      const progressPaused = new Promise<void>((resolve) => { resolveProgressPause = resolve; });
      const unsubscribe = job.subscribe((event) => {
        if (!preflightPauseIssued && event.tracks !== undefined) {
          preflightPauseIssued = true;
          void job.pause();
        }
        if (!progressPauseIssued && event.completed === 1) {
          progressPauseIssued = true;
          void job.pause();
        }
        if (progressPauseIssued && event.state === "paused") resolveProgressPause?.();
      });
      await waitForState(job, "paused");
      expect(preflightPauseIssued).toBe(true);
      await job.resume();
      await progressPaused;
      expect(progressPauseIssued).toBe(true);
      await job.resume();
      const artifact = await job.result;
      unsubscribe();
      const outputBytes = new Uint8Array(await new Response(artifact.open()).arrayBuffer());
      const converted = await inspectNativeMedia({ kind: "bytes", bytes: outputBytes, mimeType: artifact.mimeType }, fetch.bind(globalThis));
      expect(converted.tracks).toHaveLength(3);
      expect(artifact.durationSeconds).toBe(2);
      const timestamps = await videoPacketTimestamps(outputBytes);
      expect(timestamps).toEqual([0, 1]);
      expect(new Set(timestamps).size).toBe(timestamps.length);
      await artifact.dispose();

      const cancelled = startConversion(runtime, request);
      const stop = cancelled.subscribe((event) => {
        if (event.tracks !== undefined) void cancelled.pause();
      });
      await waitForState(cancelled, "paused");
      await cancelled.cancel("test cancellation while paused");
      await expect(cancelled.result).rejects.toThrow();
      stop();
    } finally {
      await runtime.dispose();
    }
  });
});
