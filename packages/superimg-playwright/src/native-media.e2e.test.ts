import { describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { ALL_FORMATS, AudioSample, AudioSampleSink, AudioSampleSource, BufferSource, BufferTarget, Input, MkvOutputFormat, Output, Quality, VideoSampleSink } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { registerDtsDecoder, registerDtsEncoder } from "@mediabunny/dts";
import { NodeVideoEncoder } from "./node-encoder.js";
import { FfmpegGifEncoder } from "./ffmpeg-gif-encoder.js";

registerMediabunnyServer();
registerDtsEncoder();
registerDtsDecoder();

describe("native Mediabunny media contracts", () => {
  it("produces identical MP4 bytes for equal frames across different creation times", async () => {
    const clock = vi.spyOn(Date, "now");
    async function encode(now: number) {
      clock.mockReturnValue(now);
      const encoder = new NodeVideoEncoder();
      try {
        await encoder.init({ width: 32, height: 32, fps: 1, durationSeconds: 1, encoding: { format: "mp4", video: { codec: "avc", hardwareAcceleration: "prefer-software" } } });
        await encoder.addFrame({ kind: "rgba", data: new Uint8Array(32 * 32 * 4).fill(255), width: 32, height: 32 }, 0);
        return await encoder.finalize();
      } finally { await encoder.dispose(); }
    }
    try {
      const first = await encode(1_700_000_000_000);
      const second = await encode(1_700_000_010_000);
      expect(Buffer.from(first)).toEqual(Buffer.from(second));
      const input = new Input({ source: new BufferSource(first), formats: ALL_FORMATS });
      try { expect((await input.getMetadataTags()).creationTime).toBeUndefined(); } finally { input.dispose(); }
      expect(await decodeRgba(first)).toHaveLength(32 * 32 * 4);
    } finally { clock.mockRestore(); }
  });

  it("produces identical seekable MP4 files across different creation times", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-mp4-stable-"));
    const clock = vi.spyOn(Date, "now");
    async function encode(name: string, now: number) {
      clock.mockReturnValue(now);
      const path = join(directory, name);
      const encoder = new NodeVideoEncoder();
      try {
        await encoder.init({ width: 32, height: 32, fps: 1, durationSeconds: 1, output: { kind: "file", path }, encoding: { format: "mp4", video: { codec: "avc", hardwareAcceleration: "prefer-software" } } });
        await encoder.addFrame({ kind: "rgba", data: new Uint8Array(32 * 32 * 4).fill(255), width: 32, height: 32 }, 0);
        await encoder.finalizeToFile();
        return await readFile(path);
      } finally { await encoder.dispose(); }
    }
    try {
      const first = await encode("first.mp4", 1_700_000_000_000);
      const second = await encode("second.mp4", 1_700_000_010_000);
      expect(first).toEqual(second);
      expect(await decodeRgba(first)).toHaveLength(32 * 32 * 4);
    } finally { clock.mockRestore(); await rm(directory, { recursive: true, force: true }); }
  });
  it("encodes transparent ProRes MOV and decodes its alpha pixels", async () => {
    const encoder = new NodeVideoEncoder();
    await encoder.init({ width: 2, height: 1, fps: 1, encoding: { format: "mov", video: { codec: "prores", alpha: "keep", quality: "very-high", hardwareAcceleration: "prefer-software" } } });
    await encoder.addFrame({ kind: "rgba", data: Uint8Array.from([255, 0, 0, 0, 0, 255, 0, 255]), width: 2, height: 1 }, 0);
    const bytes = await encoder.finalize();
    const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
    try {
      const [track] = await input.getVideoTracks();
      expect(track).toBeDefined();
      expect(await track!.getCodec()).toMatch(/prores/i);
      const sink = new VideoSampleSink(track!);
      for await (const sample of sink.samples()) {
        expect(sample.hasAlpha).toBe(true);
        sample.close();
        break;
      }
      const rgba = await decodeRgba(bytes);
      expect(rgba).toHaveLength(8);
      expect(rgba[3]).toBeLessThan(20);
      expect(rgba[7]).toBeGreaterThan(230);
      // Alpha-composite the transparent red pixel and opaque green pixel onto
      // white and black. The transparent pixel must reveal each background.
      expect(composite(rgba.slice(0, 4), [255, 255, 255])).toEqual([255, 255, 255]);
      expect(composite(rgba.slice(0, 4), [0, 0, 0])).toEqual([0, 0, 0]);
      expect(composite(rgba.slice(4, 8), [255, 255, 255])[1]).toBeGreaterThan(180);
      expect(composite(rgba.slice(4, 8), [0, 0, 0])[1]).toBeGreaterThan(180);

    } finally { input.dispose(); await encoder.dispose(); }
  });

  it("encodes DTS in MKV and decodes sample duration and channels", async () => {
    const target = new BufferTarget();
    const output = new Output({ format: new MkvOutputFormat(), target });
    const source = new AudioSampleSource({ codec: "dts", quality: new Quality({ bitrate: 768_000 }) });
    output.addAudioTrack(source); await output.start();
    const sample = new AudioSample({ data: new Float32Array(960 * 2), format: "f32", sampleRate: 48_000, numberOfChannels: 2, timestamp: 0 });
    await source.add(sample); sample.close(); await output.finalize();
    const input = new Input({ source: new BufferSource(target.buffer!), formats: ALL_FORMATS });
    try {
      const [track] = await input.getAudioTracks();
      expect(await track!.getCodec()).toMatch(/dts/i);
      const sink = new AudioSampleSink(track!);
      for await (const decoded of sink.samples()) {
        expect(decoded.numberOfChannels).toBe(2);
        expect(decoded.duration).toBeGreaterThan(0);
        decoded.close(); return;
      }
      throw new Error("DTS MKV had no decoded sample");
    } finally { input.dispose(); }
  });

  it("keeps MP4 AVC and WebM VP9 encoding smoke coverage", async () => {
    for (const [format, codec] of [["mp4", "avc"], ["webm", "vp9"]] as const) {
      const encoder = new NodeVideoEncoder();
      await encoder.init({ width: 2, height: 2, fps: 1, encoding: { format, video: { codec, quality: "low" } } });
      await encoder.addFrame({ kind: "rgba", data: new Uint8Array(16).fill(255), width: 2, height: 2 }, 0);
      const bytes = await encoder.finalize();
      const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
      try { expect(await (await input.getVideoTracks())[0]!.getCodec()).toMatch(codec === "avc" ? /avc|h264/i : /vp9/i); } finally { input.dispose(); await encoder.dispose(); }
    }
  });

  it("encodes the whole supersampled screenshot into a host-owned file at coded size", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-encoder-pixels-"));
    const path = join(directory, "output.mp4");
    const encoder = new NodeVideoEncoder();
    try {
      await encoder.init({ width: 32, height: 32, fps: 1, durationSeconds: 1, output: { kind: "file", path }, encoding: { format: "mp4", video: { codec: "avc", quality: { quantizer: 12 }, hardwareAcceleration: "prefer-software" } } });
      await encoder.addFrame(await quadrantsPng(), 0);
      await expect(encoder.finalize()).rejects.toThrow(/finalizeToFile/);
      const result = await encoder.finalizeToFile();
      expect(result).toEqual({ path, byteLength: (await stat(path)).size });
      await encoder.dispose();
      const rgba = await decodeRgba(await readFile(path));
      expect(rgba).toHaveLength(32 * 32 * 4);
      expectPixel(rgba, 8, 8, [255, 0, 0]);
      expectPixel(rgba, 24, 8, [0, 255, 0]);
      expectPixel(rgba, 8, 24, [0, 0, 255]);
      expectPixel(rgba, 24, 24, [255, 255, 0]);
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("cleans cancelled partial output and refuses to overwrite an existing host file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-encoder-cancel-"));
    const path = join(directory, "output.mp4");
    const encoder = new NodeVideoEncoder();
    const config = { width: 32, height: 32, fps: 1, output: { kind: "file" as const, path }, encoding: { format: "mp4" as const, video: { codec: "avc" as const, hardwareAcceleration: "prefer-software" as const } } };
    try {
      await encoder.init(config);
      await encoder.addFrame(await quadrantsPng(), 0);
      await encoder.dispose();
      await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
      await writeFile(path, "keep host data");
      await expect(encoder.init(config)).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(path, "utf8")).toBe("keep host data");
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("writes a GIF file at coded size without loading the result into the encoder", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-gif-file-"));
    const path = join(directory, "output.gif");
    const encoder = new FfmpegGifEncoder();
    try {
      await encoder.init({ width: 32, height: 32, fps: 2, output: { kind: "file", path } });
      await encoder.addFrame(await quadrantsPng(), 0);
      const result = await encoder.finalizeToFile();
      await encoder.dispose();
      expect(result.byteLength).toBe((await stat(path)).size);
      const info = await sharp(path).metadata();
      expect([info.width, info.height]).toEqual([32, 32]);
      const rgba = await sharp(path).ensureAlpha().raw().toBuffer();
      expectPixel(rgba, 8, 8, [255, 0, 0]);
      expectPixel(rgba, 8, 24, [0, 0, 255]);
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("streams audio alongside file-backed video while preserving negative and positive clip offsets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-encoder-audio-"));
    const path = join(directory, "output.mp4");
    const source = join(directory, "tone.wav");
    const encoder = new NodeVideoEncoder();
    try {
      await writeFile(source, toneWav());
      const clip = { src: source, showInTimeline: true, role: "voice" as const, placementDurationSeconds: 0.35, trimInSeconds: 0, trimOutSeconds: null, loop: false, volume: 1, fadeInSeconds: 0, fadeOutSeconds: 0 };
      await encoder.init({
        width: 32, height: 32, fps: 10, durationSeconds: 1, output: { kind: "file", path },
        encoding: { format: "mp4", video: { codec: "avc", hardwareAcceleration: "prefer-software" } },
        resolvedAudio: {
          videoDurationSeconds: 1,
          clips: [{ ...clip, id: "early", atSeconds: -0.1 }, { ...clip, id: "late", atSeconds: 0.65 }],
          mix: { master: 1, ducking: false, duckingLevel: 0.25, duckingAttack: 0.1, duckingRelease: 0.1 },
        },
      });
      const frame = await quadrantsPng();
      for (let index = 0; index < 10; index++) await encoder.addFrame(frame, index / 10);
      await encoder.finalizeToFile();
      const pcm = await decodeMonoAudio(path);
      const rms = (time: number) => {
        const start = Math.round(time * 48_000);
        let sum = 0;
        for (let index = start; index < start + 960; index++) sum += pcm[index]! ** 2;
        return Math.sqrt(sum / 960);
      };
      expect(pcm.length).toBeGreaterThanOrEqual(48_000);
      expect(rms(0.05)).toBeGreaterThan(0.08);
      expect(rms(0.45)).toBeLessThan(0.01);
      expect(rms(0.8)).toBeGreaterThan(0.08);
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function toneWav(): Buffer {
  const data = Buffer.alloc(44 + 48_000 * 2);
  data.write("RIFF", 0); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(48_000, 24); data.writeUInt32LE(96_000, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(96_000, 40);
  for (let index = 0; index < 48_000; index++) data.writeInt16LE(Math.round(6000 * Math.sin(index / 48_000 * Math.PI * 2 * 440)), 44 + index * 2);
  return data;
}

async function decodeMonoAudio(path: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "pipe:1"]);
    const chunks: Buffer[] = []; const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg audio decode failed: ${Buffer.concat(errors)}`));
      const bytes = Buffer.concat(chunks);
      const samples = new Float32Array(bytes.byteLength / 4);
      for (let index = 0; index < samples.length; index++) samples[index] = bytes.readFloatLE(index * 4);
      resolve(samples);
    });
  });
}

async function quadrantsPng(): Promise<Buffer> {
  const rgba = Buffer.alloc(64 * 64 * 4);
  const colors = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255]];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) rgba.set(colors[(y >= 32 ? 2 : 0) + (x >= 32 ? 1 : 0)]!, (y * 64 + x) * 4);
  }
  return sharp(rgba, { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer();
}

function expectPixel(rgba: Uint8Array, x: number, y: number, expected: readonly number[]): void {
  const start = (y * 32 + x) * 4;
  for (let channel = 0; channel < 3; channel++) expect(Math.abs(rgba[start + channel]! - expected[channel]!)).toBeLessThan(25);
}

function composite(pixel: Uint8Array, background: readonly number[]): number[] {
  const alpha = pixel[3]! / 255;
  return [0, 1, 2].map((index) => Math.round(pixel[index]! * alpha + background[index]! * (1 - alpha)));
}

async function decodeRgba(bytes: Uint8Array): Promise<Uint8Array> {
  return await new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-v", "error", "-i", "pipe:0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]);
    const output: Buffer[] = []; const errors: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve(new Uint8Array(Buffer.concat(output))) : reject(new Error(`ffmpeg alpha decode failed: ${Buffer.concat(errors)}`)));
    child.stdin.end(bytes);
  });
}
