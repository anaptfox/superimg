import { describe, expect, it, vi } from "vitest";
import { ALL_FORMATS, AudioSample, AudioSampleSink, AudioSampleSource, BufferSource, BufferTarget, Input, InputVideoTrack, VideoSampleSink, MkvOutputFormat, EncodedAudioPacketSource, EncodedPacket, EncodedPacketSink, Mp4OutputFormat, Output, Quality, VideoSample, VideoSampleSource, WavOutputFormat } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { inspectNativeMedia } from "./media.js";
import { prepareMediaInput } from "./owned-media-input.js";
import { ExportArtifactStorage } from "./artifact-storage.js";
import { access, open, readFile, type FileHandle } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createKeptRangeMap, mapTranscript, projectMappedCaptions } from "@superimg/stdlib/cue";
import { exportCuts, prepareCuts, detectSilence, extractFrames, extractWaveform } from "../media-preparation.js";
registerMediabunnyServer();

async function fixture() {
  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") });
  const audio = new AudioSampleSource({ codec: "aac", quality: new Quality("high") });
  const audio2 = new AudioSampleSource({ codec: "aac", quality: new Quality("high") });
  output.addVideoTrack(video); output.addAudioTrack(audio); output.addAudioTrack(audio2); await output.start();
  for (let i = 0; i < 4; i++) {
    const pixels = new Uint8Array(16 * 16 * 4).fill(i * 60); for (let j = 3; j < pixels.length; j += 4) pixels[j] = 255;
    const sample = new VideoSample(pixels, { format: "RGBA", codedWidth: 16, codedHeight: 16, timestamp: i * 0.5, duration: 0.5 });
    try { await video.add(sample); } finally { sample.close(); }
  }
  const pcm = new Float32Array(16000);
  for (let i = 0; i < pcm.length; i++) if (i < 4000 || i >= 12000) pcm[i] = 0.5 * Math.sin(i * 0.1);
  const sample = new AudioSample({ data: pcm, format: "f32", sampleRate: 8000, numberOfChannels: 1, timestamp: 0 });
  try { await audio.add(sample); } finally { sample.close(); }
  const silent = new AudioSample({ data: new Float32Array(16000), format: "f32", sampleRate: 8000, numberOfChannels: 1, timestamp: 0 });
  try { await audio2.add(silent); } finally { silent.close(); }
  await output.finalize(); return { kind: "bytes" as const, bytes: new Uint8Array(target.buffer!) };
}

describe("selected media preparation", () => {
  it("requires the inspected ID even for a single WAV track", async () => {
    const target = new BufferTarget();
    const output = new Output({ format: new WavOutputFormat(), target });
    const audio = new AudioSampleSource({ codec: "pcm-s16" });
    output.addAudioTrack(audio);
    await output.start();
    const sample = new AudioSample({ data: new Float32Array(8000).fill(0.25), format: "f32", sampleRate: 8000, numberOfChannels: 1, timestamp: 0 });
    try { await audio.add(sample); } finally { sample.close(); }
    await output.finalize();

    const input = { kind: "bytes" as const, bytes: new Uint8Array(target.buffer!) };
    const inspection = await inspectNativeMedia(input, fetch);
    expect(inspection.tracks).toMatchObject([{ id: "audio:1", kind: "audio" }]);
    await expect(extractWaveform(input, { trackId: "1", bins: 4 })).rejects.toThrow(/Legacy media track ID.*select a current track ID/);
    const current = await extractWaveform(input, { trackId: inspection.tracks[0]!.id, bins: 4 });
    expect(current.bins).toHaveLength(4);
  });

  it("prepares one immutable 8 kHz accepted clock for captions and A/V output", async () => {
    const input = await fixture(), info = await inspectNativeMedia(input, fetch);
    const video = info.tracks.find(t => t.kind === "video")!, audio = info.tracks.find(t => t.kind === "audio")!;
    const source = { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds! };
    const requested = [{ startSeconds: 0.123456, endSeconds: 0.5 }];
    const plan = await prepareCuts(input, { source, ranges: requested, videoTrackId: video.id, audioTrackId: audio.id, quantization: "nearest" });
    expect(plan.clock).toMatchObject({ kind: "audio-samples", ticksPerSecond: 8000 });
    expect(plan.requestedRanges[0]!.startSeconds).toBe(0.123456);
    expect(plan.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(988 / 8000, 12);
    expect(plan.adjustments[0]!.startSeconds).toBeCloseTo(988 / 8000 - 0.123456, 12);
    const bounds = [{ startSeconds: 0.123456, endSeconds: 0.50004 }];
    const inward = await prepareCuts(input, { source, ranges: bounds, videoTrackId: video.id, audioTrackId: audio.id, quantization: "inward" });
    const outward = await prepareCuts(input, { source, ranges: bounds, videoTrackId: video.id, audioTrackId: audio.id, quantization: "outward" });
    expect(inward.acceptedMap.ranges[0]).toEqual({ startSeconds: 988 / 8000, endSeconds: 4000 / 8000 });
    expect(outward.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(987 / 8000, 12);
    expect(outward.acceptedMap.ranges[0]!.endSeconds).toBeCloseTo(4001 / 8000, 12);
    await expect(prepareCuts(input, { source, ranges: [{ startSeconds: 0.123451, endSeconds: 0.123452 }], audioTrackId: audio.id, quantization: "inward" })).rejects.toThrow("empty");
    await expect(prepareCuts(input, { source, ranges: [{ startSeconds: 0.1, endSeconds: 0.20001 }, { startSeconds: 0.20002, endSeconds: 0.3 }], audioTrackId: audio.id, quantization: "outward" })).rejects.toThrow("overlapping");
    const tick = plan.clock.originSeconds + 4000 / 8000;
    for (const mode of ["nearest", "inward", "outward"] as const) {
      for (const delta of [-5e-12, 5e-12]) {
        const snap = await prepareCuts(input, { source, ranges: [{ startSeconds: tick + delta, endSeconds: 0.5 }], audioTrackId: audio.id, quantization: mode });
        expect(snap.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(tick, 14);
        expect(snap.adjustments[0]!.startSeconds).toBeCloseTo(-delta, 14);
      }
    }
    const offset = vi.spyOn(InputVideoTrack.prototype, "getFirstTimestamp").mockResolvedValue(0.1000000004);
    try { await expect(prepareCuts(input, { source, ranges: [{ startSeconds: 0.1, endSeconds: 0.5 }], videoTrackId: video.id, audioTrackId: audio.id, quantization: "nearest" })).rejects.toThrow("outside"); }
    finally { offset.mockRestore(); }
    requested[0]!.startSeconds = 0.2;
    expect(Object.isFrozen(plan.acceptedMap.ranges[0])).toBe(true);
    const transcript = { schemaVersion: 1 as const, source, revision: "one", timeUnit: "seconds" as const, spans: [{ id: "word", text: "hello", timing: { startSeconds: 0.124, endSeconds: 0.2 }, granularity: "word" as const, alignment: "recognized" as const }] };
    expect(projectMappedCaptions(transcript, plan.acceptedMap).cues[0]!.startSeconds).toBeCloseTo(0.124 - 988 / 8000, 12);
    const output = await exportCuts(input, { plan, encoding: { format: "mp4", video: { codec: "avc" }, audio: { codec: "aac" } } });
    try { expect(output.ranges[0]!.source).toEqual(plan.acceptedMap.ranges[0]); expect(output.artifact.tracks).toHaveLength(2); }
    finally { await output.artifact.dispose(); }
    await expect(exportCuts({ kind: "bytes", bytes: new Uint8Array([1, 2, 3]) }, { plan })).rejects.toThrow();
    await expect(exportCuts(input, { plan: { ...plan } })).rejects.toThrow("forged");
    const controller = new AbortController(), originalDispose = Input.prototype.dispose;
    const dispose = vi.spyOn(Input.prototype, "dispose").mockImplementationOnce(function (this: Input) { originalDispose.call(this); controller.abort(); });
    try { await expect(prepareCuts(input, { source, ranges: [{ startSeconds: 0.1, endSeconds: 0.5 }], videoTrackId: video.id, audioTrackId: audio.id, quantization: "nearest", signal: controller.signal })).rejects.toThrow(); }
    finally { dispose.mockRestore(); }
  });
  it("quantizes millisecond requests at 44.1 kHz and exports audio-only and video-only", async () => {
    const target = new BufferTarget(), output = new Output({ format: new MkvOutputFormat(), target });
    const audio = new AudioSampleSource({ codec: "pcm-f32" }); output.addAudioTrack(audio); await output.start();
    const samples = new Float32Array(44100); for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.1) * 0.3;
    const sample = new AudioSample({ data: samples, format: "f32", sampleRate: 44100, numberOfChannels: 1, timestamp: 0 });
    try { await audio.add(sample); } finally { sample.close(); } await output.finalize();
    const input = { kind: "bytes" as const, bytes: new Uint8Array(target.buffer!) }, info = await inspectNativeMedia(input, fetch), track = info.tracks[0]!;
    const source = { mediaSha256: info.sha256, trackId: track.id, durationSeconds: track.durationSeconds! };
    const plan = await prepareCuts(input, { source, ranges: [{ startSeconds: 0.123, endSeconds: 0.567 }, { startSeconds: 0.7, endSeconds: 0.9 }], audioTrackId: track.id, quantization: "nearest" });
    expect(plan.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(Math.round(0.123 * 44100) / 44100, 12);
    const exported = await exportCuts(input, { plan, encoding: { format: "mp4", audio: { codec: "aac" } } });
    try { const bytes = new Uint8Array(await new Response(exported.artifact.open()).arrayBuffer()); const observed = await inspectNativeMedia({kind:"bytes",bytes},fetch); expect(observed.tracks.map(t => t.kind)).toEqual(["audio"]); }
    finally { await exported.artifact.dispose(); }
    const pcmOutput = await exportCuts(input, { plan, encoding: { format: "mkv", audio: { codec: "pcm-f32" } } });
    try {
      const bytes = new Uint8Array(await new Response(pcmOutput.artifact.open()).arrayBuffer());
      const decoded = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
      try {
        const outputTrack = (await decoded.getAudioTracks())[0]!; expect(await outputTrack.getCodec()).toBe("pcm-f32");
        const expected = plan.acceptedMap.ranges.flatMap(range => Array.from(samples.subarray(Math.round(range.startSeconds * 44100), Math.round(range.endSeconds * 44100))));
        const actual: number[] = [];
        for await (const frame of new AudioSampleSink(outputTrack).samples()) {
          try {
            expect(frame.timestamp).toBeCloseTo(actual.length / 44100, 5);
            const values = new Float32Array(frame.numberOfFrames); frame.copyTo(values, { format: "f32", planeIndex: 0 }); actual.push(...values);
          } finally { frame.close(); }
        }
        expect(actual.length).toBe(expected.length); expect(actual).toEqual(expected);
      } finally { decoded.dispose(); }
    } finally { await pcmOutput.artifact.dispose(); }
    const videoInput = await fixture(), vi = await inspectNativeMedia(videoInput, fetch), video = vi.tracks.find(t => t.kind === "video")!;
    const videoPlan = await prepareCuts(videoInput, { source: { mediaSha256: vi.sha256, trackId: video.id, durationSeconds: video.durationSeconds! }, ranges: [{ startSeconds: 0.1234567, endSeconds: 0.5 }], videoTrackId: video.id, quantization: "nearest" });
    expect(videoPlan.clock.kind).toBe("video-microseconds"); expect(videoPlan.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(0.123457, 9);
    const origin = videoPlan.clock.originSeconds;
    const tieIndex = Array.from({length:10000}, (_, i) => 100000 + i).find(i => ((origin + (i + 0.5) / 1_000_000 - origin) * 1_000_000) === i + 0.5);
    expect(tieIndex).toBeDefined();
    const tie = await prepareCuts(videoInput, { source: videoPlan.source, ranges: [{ startSeconds: origin + (tieIndex! + 0.5) / 1_000_000, endSeconds: 0.5 }], videoTrackId: video.id, quantization: "nearest" });
    expect(tie.acceptedMap.ranges[0]!.startSeconds).toBeCloseTo(origin + (tieIndex! + 1) / 1_000_000, 12);
    const videoOutput = await exportCuts(videoInput, { plan: videoPlan, encoding: { format: "mp4", video: { codec: "avc" } } });
    try { const bytes = new Uint8Array(await new Response(videoOutput.artifact.open()).arrayBuffer()); expect((await inspectNativeMedia({kind:"bytes",bytes},fetch)).tracks.map(t => t.kind)).toEqual(["video"]); }
    finally { await videoOutput.artifact.dispose(); }
    await expect(exportCuts(videoInput, { plan: videoPlan, encoding: { format: "webm", video: { codec: "avc" } } })).rejects.toThrow("compatible");
  });
  it("reuses one streamed snapshot across inspection, frames, waveform and cuts and cleans it on disposal", async () => {
    const source = await fixture(); let calls = 0; let spool = "";
    const originalAllocate = ExportArtifactStorage.prototype.allocate;
    const allocate = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) {
      const path = await originalAllocate.call(this, ext); spool ||= path; return path;
    });
    const fetcher: typeof fetch = async () => { calls++; const bytes = source.bytes; return new Response(new ReadableStream({ start(c) { c.enqueue(bytes.subarray(0, 100)); c.enqueue(bytes.subarray(100)); c.close(); } })); };
    try {
      const owned = await prepareMediaInput({ kind: "url", url: "https://example.invalid/media" }, { fetch: fetcher });
      const info = await owned.inspect(); const video = info.tracks.find(t => t.kind === "video")!; const audio = info.tracks.find(t => t.kind === "audio")!;
      const frames = await extractFrames(owned, { trackId: video.id, timesSeconds: [0.2], width: 8, height: 8 });
      expect(frames.sourceSha256).toBe(info.sha256); frames.dispose();
      const wave = await extractWaveform(owned, { trackId: audio.id, bins: 4, startSeconds: 0, endSeconds: 2 });
      expect(wave.sourceSha256).toBe(info.sha256);
      const map = createKeptRangeMap({ mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds! }, [{ startSeconds: 0, endSeconds: 0.5 }]);
      const plan = await prepareCuts(owned, { source: map.source, ranges: map.ranges, audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest" });
      const cut = await exportCuts(owned, { plan }); await cut.artifact.dispose();
      expect(calls).toBe(1); await access(spool);
      await Promise.all([owned.dispose(), owned.dispose()]);
      await expect(access(spool)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(owned.inspect()).rejects.toThrow("disposed");
      await expect(extractFrames(owned, { trackId: video.id, timesSeconds: [0], width: 8, height: 8 })).rejects.toThrow("disposed");
    } finally { allocate.mockRestore(); }
  });

  it("enforces byte limits on bytes and streaming bodies and cancels failed streams", async () => {
    const source = await fixture(); let cancelled = false;
    await expect(prepareMediaInput(source, { maxInputBytes: source.bytes.length - 1 })).rejects.toThrow("byte limit");
    const fetcher: typeof fetch = async () => new Response(new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(20)); }, cancel() { cancelled = true; } }), { headers: { "content-length": "1" } });
    await expect(prepareMediaInput({ kind: "url", url: "https://example.invalid/large" }, { maxInputBytes: 30, fetch: fetcher })).rejects.toThrow("byte limit");
    expect(cancelled).toBe(true);
  });
  it("cancels a stalled URL read and removes its private spool on abort", async () => {
    const originalAllocate = ExportArtifactStorage.prototype.allocate; let path = "", cancelled = false;
    const allocate = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) { path = await originalAllocate.call(this, ext); return path; });
    let started!: () => void; const ready = new Promise<void>(resolve => { started = resolve; });
    const fetcher: typeof fetch = async () => new Response(new ReadableStream({ pull() { started(); }, cancel() { cancelled = true; } }));
    const controller = new AbortController();
    try {
      const pending = prepareMediaInput({ kind: "url", url: "https://example.invalid/stalled" }, { signal: controller.signal, fetch: fetcher });
      await ready; controller.abort(); await expect(pending).rejects.toThrow();
      expect(cancelled).toBe(true); await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { allocate.mockRestore(); }
  });
  it("snapshots mutable bytes and waits for an active extraction before disposal", async () => {
    const source = await fixture(); const original = await inspectNativeMedia(source, fetch);
    const pending = prepareMediaInput(source); source.bytes.fill(0);
    const owned = await pending; const info = await owned.inspect();
    expect(info.sha256).toBe(original.sha256);
    const video = info.tracks.find(t => t.kind === "video")!;
    let proceed!: () => void, entered!: () => void;
    const waiting = new Promise<void>(resolve => { proceed = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const extraction = extractFrames(owned, { trackId: video.id, timesSeconds: [0.2], width: 8, height: 8, onProgress: async () => { entered(); await waiting; } });
    await started;
    let disposed = false; const disposal = owned.dispose().then(() => { disposed = true; });
    await Promise.resolve(); expect(disposed).toBe(false);
    proceed(); const frames = await extraction; frames.dispose(); await disposal; expect(disposed).toBe(true);
  });
  it("copies Buffer views before asynchronous byte and stream ingestion", async () => {
    const fixtureBytes = (await fixture()).bytes;
    const original = await inspectNativeMedia({ kind: "bytes", bytes: fixtureBytes }, fetch);
    const originalAllocate = ExportArtifactStorage.prototype.allocate; let path = "";
    const allocation = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) { path = await originalAllocate.call(this, ext); return path; });
    const buffer = Buffer.concat([Buffer.alloc(7), Buffer.from(fixtureBytes), Buffer.alloc(9)]).subarray(7, 7 + fixtureBytes.length);
    const pending = prepareMediaInput({ kind: "bytes", bytes: buffer }); buffer.fill(0);
    const owned = await pending;
    try { expect((await owned.inspect()).sha256).toBe(original.sha256); expect(createHash("sha256").update(await readFile(path)).digest("hex")).toBe(original.sha256); } finally { await owned.dispose(); }
    const chunk = Buffer.from(fixtureBytes);
    const probe = await open("/dev/null", "w"); const prototype = Object.getPrototypeOf(probe) as FileHandle; await probe.close();
    const originalWrite = prototype.writeFile; let unblock!: () => void, started!: () => void;
    const gate = new Promise<void>(resolve => { unblock = resolve; }); const ready = new Promise<void>(resolve => { started = resolve; });
    const write = vi.spyOn(prototype, "writeFile").mockImplementationOnce(async function (this: FileHandle, data, options) { started(); await gate; return await originalWrite.call(this, data, options); });
    try {
      const fetcher: typeof fetch = async () => new Response(new ReadableStream({ start(c) { c.enqueue(chunk); c.close(); } }));
      const streamPending = prepareMediaInput({ kind: "url", url: "https://example.invalid/buffer" }, { fetch: fetcher });
      await ready; chunk.fill(0); unblock();
      const streamOwned = await streamPending;
      try { expect((await streamOwned.inspect()).sha256).toBe(original.sha256); expect(createHash("sha256").update(await readFile(path)).digest("hex")).toBe(original.sha256); } finally { await streamOwned.dispose(); }
    } finally { unblock(); write.mockRestore(); allocation.mockRestore(); }
  });
  it("removes cut output storage after a progress failure", async () => {
    const input = await fixture(), info = await inspectNativeMedia(input, fetch);
    const video = info.tracks.find(t => t.kind === "video")!, audio = info.tracks.find(t => t.kind === "audio")!;
    const map = createKeptRangeMap({ mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds! }, [{ startSeconds: 0, endSeconds: 0.5 }]);
    const originalAllocate = ExportArtifactStorage.prototype.allocate; const paths: string[] = [];
    const allocate = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) { const path = await originalAllocate.call(this, ext); paths.push(path); return path; });
    try {
      const plan = await prepareCuts(input, { source: map.source, ranges: map.ranges, audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest" });
      await expect(exportCuts(input, { plan, onProgress: () => { throw new Error("stop cut"); } })).rejects.toThrow("stop cut");
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { allocate.mockRestore(); }
  });
  it("disposes an undelivered cut if input release fails", async () => {
    const source = await fixture(), info = await inspectNativeMedia(source, fetch);
    const video = info.tracks.find(t => t.kind === "video")!, audio = info.tracks.find(t => t.kind === "audio")!;
    const map = createKeptRangeMap({ mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds! }, [{ startSeconds: 0, endSeconds: 0.5 }]);
    const originalAllocate = ExportArtifactStorage.prototype.allocate, originalDispose = ExportArtifactStorage.prototype.dispose;
    const paths: string[] = []; let disposals = 0;
    const allocate = vi.spyOn(ExportArtifactStorage.prototype, "allocate").mockImplementation(async function (this: ExportArtifactStorage, ext) { const path = await originalAllocate.call(this, ext); paths.push(path); return path; });
    const dispose = vi.spyOn(ExportArtifactStorage.prototype, "dispose").mockImplementation(async function (this: ExportArtifactStorage) { await originalDispose.call(this); if (++disposals === 1) throw new Error("input cleanup failed"); });
    try {
      const fetcher: typeof fetch = async () => new Response(source.bytes);
      const plan = await prepareCuts(source, { source: map.source, ranges: map.ranges, audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest" });
      const failure = await exportCuts({ kind: "url", url: "https://example.invalid/source" }, { plan, fetch: fetcher }).catch(error => error);
      expect(failure).toBeInstanceOf(AggregateError); expect(String(failure.errors[0])).toContain("Media input cleanup failed");
      expect(String(failure.errors[0].errors[0])).toContain("input cleanup failed");
      expect(paths).toHaveLength(2); expect(disposals).toBe(2);
      for (const path of paths) await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally { allocate.mockRestore(); dispose.mockRestore(); }
  });
  it("decodes selected frames and bounded waveform and finds the authored silence", async () => {
    const input = await fixture(); const info = await inspectNativeMedia(input, fetch);
    const video = info.tracks.find(t => t.kind === "video")!; const audio = info.tracks.find(t => t.kind === "audio")!;
    const frames = await extractFrames(input, { trackId: video.id, timesSeconds: [0.2, 1.2], width: 8, height: 8 });
    expect(frames.frames.map(f => f.timestampSeconds)).toEqual([0, 1]); expect(frames.frames[0]!.png.slice(0, 8)).toEqual(new Uint8Array([137,80,78,71,13,10,26,10]));
    expect(frames.sourceSha256).toBe(info.sha256); const owned = frames.frames[0]!.png; frames.dispose(); expect(owned.every(byte => byte === 0)).toBe(true); expect(() => frames.frames).toThrow("disposed");
    const waveform = await extractWaveform(input, { trackId: audio.id, bins: 20, startSeconds: 0, endSeconds: 2 });
    expect(waveform.bins).toHaveLength(20); expect(waveform.bins[1]!.peak).toBeGreaterThan(0.2);
    const other = info.tracks.filter(t => t.kind === "audio")[1]!;
    expect((await extractWaveform(input, {trackId:other.id,bins:2,startSeconds:0,endSeconds:2})).bins.every(b => b.peak < 0.01)).toBe(true);
    let waveCalls = 0;
    const waveOptions = {trackId:audio.id, bins:20, startSeconds:0, endSeconds:2, onProgress:(_n:number,_total:number) => {waveCalls++; waveOptions.trackId="changed"; waveOptions.bins=1; waveOptions.onProgress=()=>{throw new Error("changed callback");};}};
    const waveSnapshot = await extractWaveform(input,waveOptions);
    expect(waveCalls).toBeGreaterThan(1); expect(waveSnapshot.trackId).toBe(audio.id); expect(waveSnapshot.bins).toHaveLength(20);
    const silence = detectSilence(waveform, { threshold: 0.01, minDurationSeconds: 0.5 });
    expect(silence.intervals.some(i => i.startSeconds >= 0.5 && i.startSeconds <= 0.7 && i.endSeconds >= 1.3 && i.endSeconds <= 1.5)).toBe(true);
    await expect(extractFrames(input, { trackId: audio.id, timesSeconds: [0], width: 8, height: 8 })).rejects.toThrow("Unknown video track");
    await expect(extractFrames(input, { trackId: video.id, timesSeconds: [2], width: 8, height: 8 })).rejects.toThrow("outside");
    const active = new AbortController();
    await expect(extractFrames(input, { trackId: video.id, timesSeconds: [0.2, 1.2], width: 8, height: 8, signal: active.signal, onProgress: () => active.abort() })).rejects.toThrow();
    const afterAbort = await extractFrames(input, { trackId: video.id, timesSeconds: [0.2], width: 8, height: 8 });
    expect(afterAbort.frames[0]!.timestampSeconds).toBe(0); afterAbort.dispose();
    const controller = new AbortController(); controller.abort();
    await expect(extractWaveform(input, { trackId: audio.id, bins: 20, signal: controller.signal })).rejects.toThrow();
    expect((await extractWaveform(input, { trackId: audio.id, bins: 2, startSeconds: 0, endSeconds: 2 })).bins).toHaveLength(2);
  });
  it("exports retained A/V ranges and preserves their shared clock", async () => {
    const input = await fixture(); const info = await inspectNativeMedia(input, fetch);
    const video = info.tracks.find(t => t.kind === "video")!; const audio = info.tracks.find(t => t.kind === "audio")!;
    const source = { mediaSha256: info.sha256, trackId: audio.id, durationSeconds: audio.durationSeconds! };
    const map = createKeptRangeMap(source, [{startSeconds: 0, endSeconds: 0.5}, {startSeconds: 1.5, endSeconds: 2}]);
    const transcript = {schemaVersion:1 as const, source, revision:"1", timeUnit:"seconds" as const, spans:[{id:"word",text:"later",timing:{startSeconds:1.6,endSeconds:1.8},granularity:"word" as const,alignment:"recognized" as const}]};
    expect(mapTranscript(transcript,map).spans[0]!.outputRange.startSeconds).toBeCloseTo(0.6);
    let progressCalls = 0;
    const mutableMap = { ...map, source: { ...map.source }, ranges: map.ranges.map(range => ({ ...range })) };
    const plan = await prepareCuts(input, { source: mutableMap.source, ranges: mutableMap.ranges, audioTrackId: audio.id, videoTrackId: video.id, quantization: "nearest" });
    const cutOptions = { plan, onProgress: (_completed: number, _total: number) => { progressCalls++; mutableMap.ranges[1]!.startSeconds = 1.9; mutableMap.source.trackId = "changed"; cutOptions.onProgress = () => { throw new Error("mutated callback"); }; } };
    const result = await exportCuts(input, cutOptions);
    expect(progressCalls).toBeGreaterThan(1);
    expect(result.ranges[1]!.output).toEqual({startSeconds: 0.5, endSeconds: 1});
    const bytes = new Uint8Array(await new Response(result.artifact.open()).arrayBuffer());
    const observed = await inspectNativeMedia({kind:"bytes",bytes},fetch);
    expect(result.artifact.durationSeconds).toBe(observed.durationSeconds);
    const decoded = new Input({source: new BufferSource(bytes), formats: ALL_FORMATS});
    try {
      expect(result.artifact.durationSeconds).toBe(await decoded.computeDuration());
      const v = (await decoded.getVideoTracks())[0]!; const a = (await decoded.getAudioTracks())[0]!;
      const colors: number[] = [];
      for (const t of [0.1, 0.6]) { const frame = await new VideoSampleSink(v).getSample(t); expect(frame).not.toBeNull(); try { const rgba = new Uint8Array(16*16*4); await frame!.copyTo(rgba, {format:"RGBA"}); colors.push(rgba[0]!); } finally { frame!.close(); } }
      expect(colors[0]).toBeLessThan(30); expect(colors[1]).toBeGreaterThan(130);
      let count = 0; const peaks = [0, 0];
      for await (const sample of new AudioSampleSink(a).samples()) { try { const pcm = new Float32Array(sample.numberOfFrames * sample.numberOfChannels); sample.copyTo(pcm,{format:"f32",planeIndex:0}); for (let i=0;i<sample.numberOfFrames;i++) { const t=sample.timestamp+i/sample.sampleRate; if(t>=0 && t<1) peaks[Math.min(1,Math.floor(t*2))] = Math.max(peaks[Math.min(1,Math.floor(t*2))]!,Math.abs(pcm[i*sample.numberOfChannels]!)); } count += sample.numberOfFrames; } finally { sample.close(); } }
      expect(peaks[0]).toBeGreaterThan(0.2); expect(peaks[1]).toBeGreaterThan(0.2); expect(count / 8000).toBeGreaterThanOrEqual(0.9); expect(count / 8000).toBeLessThan(1.2);
      expect(result.artifact.tracks.map(t => t.action)).toEqual(["transcode", "transcode"]);
    } finally { decoded.dispose(); await result.artifact.dispose(); }
    expect(() => result.artifact.open()).toThrow();
    await expect(exportCuts(input, {plan: { ...plan }})).rejects.toThrow("forged");
    await expect(prepareCuts(input, {source: {...map.source, trackId:"missing"}, ranges: map.ranges, audioTrackId: audio.id, videoTrackId:video.id, quantization:"nearest"})).rejects.toThrow("track or duration");
    await expect(prepareCuts(input, {source: map.source, ranges: map.ranges, audioTrackId: audio.id, videoTrackId:audio.id, quantization:"nearest"})).rejects.toThrow("unavailable");
    const controller = new AbortController();
    await expect(exportCuts(input, {plan, signal: controller.signal, onProgress: () => controller.abort()})).rejects.toThrow();
    await expect(exportCuts(input, {plan, onProgress:()=>{throw new Error("progress failed");}})).rejects.toThrow("progress failed");
    const otherAudio = info.tracks.filter(t => t.kind === "audio")[1]!;
    const otherMap = createKeptRangeMap({...source, trackId:otherAudio.id, durationSeconds:otherAudio.durationSeconds!}, map.ranges);
    const otherPlan = await prepareCuts(input, {source:otherMap.source,ranges:otherMap.ranges,audioTrackId:otherAudio.id,videoTrackId:video.id,quantization:"nearest"});
    const again = await exportCuts(input, {plan:otherPlan});
    try {
      const otherBytes = new Uint8Array(await new Response(again.artifact.open()).arrayBuffer());
      const outputInfo = await inspectNativeMedia({kind:"bytes", bytes:otherBytes},fetch);
      const outputAudio = outputInfo.tracks.find(t => t.kind === "audio")!;
      const wave = await extractWaveform({kind:"bytes", bytes:otherBytes},{trackId:outputAudio.id,bins:10,startSeconds:0,endSeconds:0.9});
      expect(wave.bins.every(bin => bin.peak < 0.01)).toBe(true);
    } finally {await again.artifact.dispose();}
  });

  it("rejects incomplete decoded audio bins as silence", async () => {
    const target = new BufferTarget(); const output = new Output({format:new MkvOutputFormat(), target});
    const source = new EncodedAudioPacketSource("pcm-f32"); output.addAudioTrack(source); await output.start();
    for (const timestamp of [0, 0.75]) await source.add(new EncodedPacket(new Uint8Array(8000), "key", timestamp, 0.25), {decoderConfig:{codec:"pcm-f32", sampleRate:8000, numberOfChannels:1}});
    await output.finalize();
    const input = {kind:"bytes" as const, bytes:new Uint8Array(target.buffer!)}; const info = await inspectNativeMedia(input,fetch); const audio = info.tracks.find(t=>t.kind === "audio")!;
    const wave = await extractWaveform(input, {trackId:audio.id,bins:2,startSeconds:0,endSeconds:1});
    expect(wave.bins.every(bin => !bin.complete)).toBe(true);
    expect(detectSilence(wave,{threshold:0.01,minDurationSeconds:0.1}).intervals).toEqual([]);
    const plan = await prepareCuts(input, {source:{mediaSha256:info.sha256,trackId:audio.id,durationSeconds:audio.durationSeconds!},ranges:[{startSeconds:0,endSeconds:1}],audioTrackId:audio.id,quantization:"nearest"});
    await expect(exportCuts(input,{plan,encoding:{format:"mkv",audio:{codec:"pcm-f32"}}})).rejects.toThrow("coverage gap");
    const later = await prepareCuts(input, {source:{mediaSha256:info.sha256,trackId:audio.id,durationSeconds:audio.durationSeconds!},ranges:[{startSeconds:0.75,endSeconds:1}],audioTrackId:audio.id,quantization:"nearest"});
    await expect(exportCuts(input,{plan:later,encoding:{format:"mkv",audio:{codec:"pcm-f32"}}})).rejects.toThrow("coverage gap");
  });
  it.each([0.26, 0.24])("rejects a raw PCM packet discontinuity at %s even when decoding smooths it", async timestamp => {
    const target = new BufferTarget(), output = new Output({format:new MkvOutputFormat(),target});
    const audio = new EncodedAudioPacketSource("pcm-f32"); output.addAudioTrack(audio); await output.start();
    for (const t of [0, timestamp]) await audio.add(new EncodedPacket(new Uint8Array(8000), "key", t, 0.25), {decoderConfig:{codec:"pcm-f32",sampleRate:8000,numberOfChannels:1}});
    await output.finalize();
    const input={kind:"bytes" as const,bytes:new Uint8Array(target.buffer!)};
    const raw = new Input({source:new BufferSource(input.bytes),formats:ALL_FORMATS});
    try {
      const track=(await raw.getAudioTracks())[0]!, packets=[];
      for await (const packet of new EncodedPacketSink(track).packets()) packets.push(packet);
      expect(packets.map(p=>p.timestamp)).toEqual([0,timestamp]);
      expect(packets.map(p=>p.byteLength)).toEqual([8000,8000]);
      const decoded=[]; for await (const sample of new AudioSampleSink(track).samples()) {try {decoded.push(sample.timestamp);} finally {sample.close();}}
      expect(decoded[1]).toBeCloseTo(0.25, 6);
    } finally {raw.dispose();}
    const info=await inspectNativeMedia(input,fetch), track=info.tracks[0]!;
    const plan=await prepareCuts(input,{source:{mediaSha256:info.sha256,trackId:track.id,durationSeconds:track.durationSeconds!},ranges:[{startSeconds:0,endSeconds:0.4}],audioTrackId:track.id,quantization:"nearest"});
    await expect(exportCuts(input,{plan,encoding:{format:"mkv",audio:{codec:"pcm-f32"}}})).rejects.toThrow("packet coverage gap or overlap");
    if (timestamp < 0.25) {
      const endingInsideOverlap=await prepareCuts(input,{source:plan.source,ranges:[{startSeconds:0,endSeconds:0.245}],audioTrackId:track.id,quantization:"nearest"});
      await expect(exportCuts(input,{plan:endingInsideOverlap,encoding:{format:"mkv",audio:{codec:"pcm-f32"}}})).rejects.toThrow("packet coverage gap or overlap");
    }
  });
  it("explicitly refuses audio codecs without qualified packet continuity evidence", async () => {
    const target=new BufferTarget(), output=new Output({format:new MkvOutputFormat(),target});
    const audio=new AudioSampleSource({codec:"opus",quality:new Quality("low")}); output.addAudioTrack(audio); await output.start();
    const sample=new AudioSample({data:new Float32Array(48000),format:"f32",sampleRate:48000,numberOfChannels:1,timestamp:0});
    try {await audio.add(sample);} finally {sample.close();} await output.finalize();
    const input={kind:"bytes" as const,bytes:new Uint8Array(target.buffer!)}, info=await inspectNativeMedia(input,fetch), track=info.tracks[0]!;
    const plan=await prepareCuts(input,{source:{mediaSha256:info.sha256,trackId:track.id,durationSeconds:track.durationSeconds!},ranges:[{startSeconds:0,endSeconds:0.5}],audioTrackId:track.id,quantization:"nearest"});
    await expect(exportCuts(input,{plan})).rejects.toThrow("packet continuity unavailable for codec opus");
  });
  it("cuts nonzero-start variable-duration frames without shifting audio", async () => {
    const target = new BufferTarget(); const output = new Output({format:new MkvOutputFormat(),target});
    const v = new VideoSampleSource({codec:"avc",quality:new Quality("high")}); const a = new AudioSampleSource({codec:"pcm-f32"}); output.addVideoTrack(v); output.addAudioTrack(a); await output.start();
    for (const [i, start, duration] of [[0,0.5,0.3],[1,0.8,0.7],[2,1.5,0.5]] as const) { const data = new Uint8Array(16*16*4).fill(i*100); for(let j=3;j<data.length;j+=4)data[j]=255; const sample = new VideoSample(data,{format:"RGBA",codedWidth:16,codedHeight:16,timestamp:start,duration}); try { await v.add(sample); } finally {sample.close();} }
    const data = new Float32Array(12000); for(let i=0;i<data.length;i++) data[i] = 0.4*Math.sin(i*0.1);
    const sample = new AudioSample({data,format:"f32",sampleRate:8000,numberOfChannels:1,timestamp:0.5}); try {await a.add(sample);} finally {sample.close();} await output.finalize();
    const input={kind:"bytes" as const,bytes:new Uint8Array(target.buffer!)}; const info=await inspectNativeMedia(input,fetch); const vi=info.tracks.find(t=>t.kind==="video")!; const ai=info.tracks.find(t=>t.kind==="audio")!;
    const map={source:{mediaSha256:info.sha256,trackId:ai.id,durationSeconds:ai.durationSeconds!},ranges:[{startSeconds:0.6,endSeconds:1},{startSeconds:1.5,endSeconds:1.9}],durationSeconds:0.8};
    const plan=await prepareCuts(input,{source:map.source,ranges:map.ranges,audioTrackId:ai.id,videoTrackId:vi.id,quantization:"nearest"});
    const result=await exportCuts(input,{plan});
    const bytes=new Uint8Array(await new Response(result.artifact.open()).arrayBuffer()); const decoded=new Input({source:new BufferSource(bytes),formats:ALL_FORMATS});
    try {const vt=(await decoded.getVideoTracks())[0]!; const sink=new VideoSampleSink(vt); const stamps:number[]=[]; for await (const sample of sink.samples()) { try {stamps.push(sample.timestamp);} finally {sample.close();} } expect(stamps).toHaveLength(3); expect(stamps[0]).toBeCloseTo(0); expect(stamps[1]).toBeCloseTo(0.2); expect(stamps[2]).toBeCloseTo(0.4); const frame=await sink.getSample(0.5); expect(frame).not.toBeNull(); try {const rgba=new Uint8Array(16*16*4); await frame!.copyTo(rgba,{format:"RGBA"}); expect(rgba[0]).toBeGreaterThan(160);} finally {frame!.close();} } finally {decoded.dispose();await result.artifact.dispose();}
  });

  it("rejects a video-only source when audio is requested", async () => {
    const target=new BufferTarget(); const output=new Output({format:new Mp4OutputFormat(),target}); const v=new VideoSampleSource({codec:"avc",quality:new Quality("low")}); output.addVideoTrack(v); await output.start();
    const sample=new VideoSample(new Uint8Array(16*16*4),{format:"RGBA",codedWidth:16,codedHeight:16,timestamp:0,duration:1}); try {await v.add(sample);} finally {sample.close();} await output.finalize();
    const input={kind:"bytes" as const,bytes:new Uint8Array(target.buffer!)}; const info=await inspectNativeMedia(input,fetch);
    await expect(prepareCuts(input,{videoTrackId:info.tracks[0]!.id,audioTrackId:"missing",source:{mediaSha256:info.sha256,trackId:"missing",durationSeconds:1},ranges:[{startSeconds:0,endSeconds:1}],quantization:"nearest"})).rejects.toThrow("unavailable");
  });

  it("snapshots frame selection and callbacks before asynchronous decoding", async () => {
    const input = await fixture(); const info = await inspectNativeMedia(input, fetch); const video = info.tracks.find(t=>t.kind==="video")!;
    const times = [0.2,1.2]; let calls = 0;
    const options = {trackId:video.id,timesSeconds:times,width:8,height:8,onProgress:(_n:number,_total:number) => {calls++; times[1] = 1.9; options.trackId = "wrong"; options.onProgress = () => {throw new Error("mutated callback");};}};
    const pending = extractFrames(input, options); times[0] = 1.8; options.trackId = "wrong before await";
    const frames = await pending;
    try {expect(calls).toBe(2); expect(frames.trackId).toBe(video.id); expect(frames.frames.map(f=>f.requestedSeconds)).toEqual([0.2,1.2]);} finally {frames.dispose();}
  });
  it("inspects and decodes the same owned input for frames", async () => {
    const input = await fixture(); const info = await inspectNativeMedia(input, fetch);
    const video = info.tracks.find(t => t.kind === "video")!;
    const getTracks = vi.spyOn(Input.prototype, "getTracks");
    try {
      const frames = await extractFrames(input, { trackId: video.id, timesSeconds: [0.2], width: 8, height: 8 });
      try {
        expect(getTracks.mock.instances.length).toBeGreaterThan(1);
        expect(new Set(getTracks.mock.instances).size).toBe(1);
        expect(frames.sourceSha256).toBe(info.sha256);
      } finally { frames.dispose(); }
    } finally { getTracks.mockRestore(); }
  });
  it("closes decoded and transformed samples after success, copy failure, and cancellation", async () => {
    const input = await fixture(); const info = await inspectNativeMedia(input, fetch); const video = info.tracks.find(t => t.kind === "video")!;
    const transform = vi.spyOn(VideoSample.prototype, "transform");
    const close = vi.spyOn(VideoSample.prototype, "close");
    const originalCopy = VideoSample.prototype.copyTo;
    const copy = vi.spyOn(VideoSample.prototype, "copyTo");
    const options = { trackId: video.id, timesSeconds: [0.2], width: 8, height: 8 };
    try {
      const result = await extractFrames(input, options);
      const decoded = transform.mock.instances.at(-1)!; const transformed = await transform.mock.results.at(-1)!.value;
      expect(close.mock.instances).toContain(decoded); expect(close.mock.instances).toContain(transformed); result.dispose();
      close.mockClear(); transform.mockClear();
      copy.mockRejectedValueOnce(new Error("copy failed"));
      await expect(extractFrames(input, options)).rejects.toThrow("copy failed");
      expect(close.mock.instances).toContain(transform.mock.instances[0]);
      expect(close.mock.instances).toContain(await transform.mock.results[0]!.value);
      close.mockClear(); transform.mockClear();
      transform.mockRejectedValueOnce(new Error("transform failed"));
      await expect(extractFrames(input, options)).rejects.toThrow("transform failed");
      expect(close.mock.instances).toContain(transform.mock.instances[0]);
      close.mockClear(); transform.mockClear();
      const controller = new AbortController();
      copy.mockImplementationOnce(async function (this: VideoSample, ...args) { const value = await originalCopy.apply(this, args); controller.abort(); return value; });
      await expect(extractFrames(input, { ...options, signal: controller.signal })).rejects.toThrow();
      expect(close.mock.instances).toContain(transform.mock.instances[0]);
      expect(close.mock.instances).toContain(await transform.mock.results[0]!.value);
    } finally { transform.mockRestore(); close.mockRestore(); copy.mockRestore(); }
  });
  it("rejects malformed and noncontiguous silence evidence", async () => {
    const input=await fixture(); const info=await inspectNativeMedia(input,fetch); const audio=info.tracks.find(t=>t.kind==="audio")!;
    const wave=await extractWaveform(input,{trackId:audio.id,bins:2,startSeconds:0,endSeconds:2});
    const gap={...wave,bins:[wave.bins[0]!,{...wave.bins[1]!,startSeconds:1.1}]};
    expect(()=>detectSilence(gap,{threshold:1,minDurationSeconds:0.1})).toThrow("noncontiguous");
    expect(()=>detectSilence({...wave,bins:[{...wave.bins[0]!,peak:NaN},wave.bins[1]!]},{threshold:1,minDurationSeconds:0.1})).toThrow("Invalid");
    expect(()=>detectSilence({...wave,bins:[{...wave.bins[0]!,endSeconds:-1},wave.bins[1]!]},{threshold:1,minDurationSeconds:0.1})).toThrow("Invalid");
  });

});
