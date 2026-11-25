import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  videoOptions: [] as Array<Record<string, unknown>>,
  videoProbeOptions: [] as Array<Record<string, unknown>>,
  audioOptions: [] as Array<Record<string, unknown>>,
  formats: [] as string[],
  registeredDts: 0,
  registeredServer: 0,
  samples: [] as Array<{ data: Uint8Array; options: Record<string, unknown> }>,
  audioSamples: [] as Array<{ data: Float32Array; timestamp: number }>,
  submissions: [] as string[],
}));

vi.mock("mediabunny", () => {
  class Quality { constructor(readonly value: unknown) {} }
  class BufferTarget { buffer = Uint8Array.from([1]).buffer; }
  class Output { readonly target: BufferTarget; constructor(options: { target: BufferTarget }) { this.target = options.target; } setMetadataTags() {} addVideoTrack() {} addAudioTrack() {} async start() {} async finalize() {} async cancel() {} }
  class VideoSampleSource {
    constructor(private readonly options: Record<string, unknown>) { state.videoOptions.push(options); }
    async add() {
      state.submissions.push("video");
      (this.options.onEncoderConfig as (value: unknown) => void)?.({ codec: "avc1.640028", width: 64, height: 64, bitrateMode: "variable" });
      (this.options.onEncodedPacket as (packet: unknown, metadata: unknown) => void)?.({}, { decoderConfig: { codec: "avc1.640028" } });
    }
    close() {}
  }
  class AudioSampleSource { constructor(options: Record<string, unknown>) { state.audioOptions.push(options); } async add(sample: { options: { data: Float32Array; timestamp: number } }) { state.audioSamples.push(sample.options); state.submissions.push("audio"); } close() {} }
  class Format { getSupportedVideoCodecs() { return ["prores", "avc", "vp9"]; } getSupportedAudioCodecs() { return ["aac", "opus", "dts"]; } }
  class MovOutputFormat extends Format { constructor() { super(); state.formats.push("mov"); } }
  class MkvOutputFormat extends Format { constructor() { super(); state.formats.push("mkv"); } }
  class Mp4OutputFormat extends Format { constructor() { super(); state.formats.push("mp4"); } }
  class WebMOutputFormat extends Format { constructor() { super(); state.formats.push("webm"); } }
  return {
    Quality, BufferTarget, BufferSource: class { constructor(_value: unknown) {} }, Output, VideoSampleSource, AudioSampleSource, MovOutputFormat, MkvOutputFormat, Mp4OutputFormat, WebMOutputFormat,
    VideoSample: class { constructor(data: Uint8Array, options: Record<string, unknown>) { state.samples.push({ data, options }); } close() {} },
    AudioSample: class { constructor(readonly options: unknown) {} close() {} },
    AudioSampleSink: class { async *samples() { yield { allocationSize: () => 48_000 * 4, copyTo: (plane: Float32Array) => plane.fill(0.5), close() {} }; } },
    Input: class { async getPrimaryAudioTrack() { return { getSampleRate: async () => 48_000, getNumberOfChannels: async () => 1 }; } async computeDuration() { return 1; } dispose() {} },
    FilePathSource: class {}, FilePathTarget: class {}, ALL_FORMATS: [],
    getFirstEncodableVideoCodec: vi.fn(async (_codecs: unknown, options: Record<string, unknown>) => { state.videoProbeOptions.push(options); return "prores"; }),
    getFirstEncodableAudioCodec: vi.fn(async () => "dts"),
  };
});
vi.mock("@mediabunny/server", () => ({ registerMediabunnyServer: () => { state.registeredServer += 1; } }));
vi.mock("@mediabunny/dts", () => ({ registerDtsEncoder: () => { state.registeredDts += 1; } }));
vi.mock("sharp", () => ({ default: vi.fn() }));

import { NodeVideoEncoder } from "./node-encoder.js";

beforeEach(() => { state.videoOptions.length = 0; state.videoProbeOptions.length = 0; state.audioOptions.length = 0; state.formats.length = 0; state.samples.length = 0; state.audioSamples.length = 0; state.submissions.length = 0; });

describe("NodeVideoEncoder container and quality forwarding", () => {
  it("uses MOV ProRes with alpha, hardware acceleration, and normalized quality", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({ width: 64, height: 64, fps: 30, encoding: { format: "mov", video: { codec: "prores", alpha: "keep", latencyMode: "realtime", hardwareAcceleration: "prefer-hardware", quality: "very-high" } } });
    expect(state.formats).toEqual(["mov"]);
    expect(state.videoProbeOptions[0]).toMatchObject({ latencyMode: "realtime", hardwareAcceleration: "prefer-hardware" });
    expect(state.videoOptions[0]).toMatchObject({ codec: "prores", alpha: "keep", latencyMode: "realtime", hardwareAcceleration: "prefer-hardware" });
    expect((state.videoOptions[0]?.quality as { value: unknown }).value).toEqual({ quality: "very-high", preferBitrate: true });
    expect(state.registeredServer).toBeGreaterThan(0);
    expect(state.registeredDts).toBeGreaterThan(0);
    await encoder.dispose();
  });

  it("prefers bitrate for the default qualitative quality only when hardware is explicitly preferred", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({ width: 64, height: 64, fps: 30, encoding: { video: { hardwareAcceleration: "prefer-hardware" } } });
    expect((state.videoProbeOptions[0]?.quality as { value: unknown }).value).toEqual({ quality: "high", preferBitrate: true });
    expect(state.videoOptions[0]?.quality).toBe(state.videoProbeOptions[0]?.quality);
    await encoder.dispose();
  });

  it("keeps an explicit software quantizer unchanged", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({ width: 64, height: 64, fps: 30, encoding: { video: { quality: { quantizer: 12 }, hardwareAcceleration: "prefer-software" } } });
    expect((state.videoOptions[0]?.quality as { value: unknown }).value).toEqual({ quantizer: 12 });
    await encoder.dispose();
  });

  it.runIf(process.platform === "darwin")("rejects an explicit hardware/quantizer combination unsupported by VideoToolbox", async () => {
    const encoder = new NodeVideoEncoder();
    await expect(encoder.init({ width: 64, height: 64, fps: 30, encoding: { video: { quality: { quantizer: 12 }, hardwareAcceleration: "prefer-hardware" } } }))
      .rejects.toThrow(/VideoToolbox.*quantizer/);
    expect(state.videoProbeOptions).toHaveLength(0);
  });

  it("reports confirmed configuration once and isolates observer errors", async () => {
    const encoder = new NodeVideoEncoder();
    const diagnostics = vi.fn((_value: import("@superimg/types").VideoEncoderDiagnostics) => { throw new Error("observer failed"); });
    await encoder.init({ width: 64, height: 64, fps: 30, onDiagnostics: diagnostics });
    const frame = { kind: "rgba", data: new Uint8Array(64 * 64 * 4), width: 64, height: 64 } as const;
    await encoder.addFrame(frame, 0);
    await encoder.addFrame(frame, 1 / 30);
    expect(diagnostics).toHaveBeenCalledTimes(1);
    expect(diagnostics.mock.calls[0]?.[0]).toMatchObject({ codecString: "avc1.640028", width: 64, height: 64, rateControl: "variable", inputPixelFormat: "RGBA" });
    expect(diagnostics.mock.calls[0]?.[0]).not.toHaveProperty("implementation");
    expect(await encoder.finalize()).toEqual(Uint8Array.from([1]));
    await encoder.dispose();
  });

  it("refuses in-memory mux staging for file output before touching the target", async () => {
    const encoder = new NodeVideoEncoder();
    await expect(encoder.init({ width: 64, height: 64, fps: 30, output: { kind: "file", path: "/unused.mp4" }, encoding: { mp4: { fastStart: "in-memory" } } }))
      .rejects.toThrow(/in-memory fast start/);
  });

  it("advances audio with video in bounded chunks and preserves an offset clip's silence", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({
      width: 64, height: 64, fps: 10, durationSeconds: 1,
      resolvedAudio: {
        videoDurationSeconds: 1,
        clips: [{ id: "voice", src: "/voice.wav", showInTimeline: true, role: "voice", atSeconds: 0.05, placementDurationSeconds: 0.95, trimInSeconds: 0, trimOutSeconds: null, loop: false, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 }],
        mix: { master: 1, ducking: false, duckingLevel: 0.25, duckingAttack: 0.1, duckingRelease: 0.1 },
      },
    });
    const frame = { kind: "rgba", data: new Uint8Array(64 * 64 * 4), width: 64, height: 64 } as const;
    await encoder.addFrame(frame, 0);
    expect(state.submissions).toEqual(["audio", "audio", "video"]);
    expect(state.audioSamples.every((sample) => sample.data.length <= 4096 * 2)).toBe(true);
    expect(state.audioSamples.reduce((sum, sample) => sum + sample.data.length / 2, 0)).toBe(4800);
    expect(state.audioSamples[0]!.data[100]).toBe(0);
    expect(state.audioSamples[0]!.data[3000]).toBeCloseTo(0.5);
    await encoder.addFrame(frame, 0.1);
    await encoder.finalize();
    // A declared duration must not make an early-stopped encode emit its unrendered tail.
    expect(state.audioSamples.reduce((sum, sample) => sum + sample.data.length / 2, 0)).toBe(9600);
    expect(state.audioSamples[2]!.timestamp).toBeCloseTo(0.1);
    await encoder.dispose();
  });

  it("uses MKV and forwards DTS audio quality", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({ width: 64, height: 64, fps: 30, resolvedAudio: { clips: [{}] } as never, encoding: { format: "mkv", audio: { codec: "dts", quality: { bitrate: 1_536_000, mode: "constant" } } } });
    expect(state.formats).toEqual(["mkv"]);
    expect(state.audioOptions[0]).toMatchObject({ codec: "dts" });
    expect((state.audioOptions[0]?.quality as { value: unknown }).value).toEqual({ bitrate: 1_536_000, bitrateMode: "constant" });
    await encoder.dispose();
  });
});
