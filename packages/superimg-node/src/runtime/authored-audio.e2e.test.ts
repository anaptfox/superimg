import { describe, expect, it } from "vitest";
import { createRuntime, startExport } from "@superimg/core/runtime";
import { MEDIA_ELEMENT, video, type MediaElement } from "@superimg/types";
import type { PlaywrightEngine } from "@superimg/playwright/engine";
import { NodeVideoEncoder } from "@superimg/playwright";
import sharp from "sharp";
import { ALL_FORMATS, AudioSampleSink, BufferSource, Input } from "mediabunny";
import { registerDtsDecoder } from "@mediabunny/dts";
import { createNodeRuntimeAdapter } from "./adapter.js";
import { inspectNativeMedia } from "./media.js";

describe("Node authored audio export", () => {
  it("mixes a portable data URL into an authored MKV DTS export", async () => {
    const runtime = createRuntime(createNodeRuntimeAdapter({
      animatedFormats: ["mkv"],
      createEngine: () => audioEngine(),
    }));
    try {
      const job = startExport(runtime, authoredVideo(), {
        for: [{ id: "clip", format: "mkv", width: 16, height: 16, encoding: { audio: { codec: "dts" } } }],
      });
      const bundle = await job.result;
      const artifact = bundle.artifacts[0]!;
      const bytes = new Uint8Array(await new Response(artifact.stream()).arrayBuffer());
      const inspection = await inspectNativeMedia({ kind: "bytes", bytes }, fetch.bind(globalThis));
      expect(inspection.tracks.find((track) => track.kind === "audio")?.codec).toBe("dts");
      const decoded = await decodeStereoDts(bytes);
      expect(decoded.channels).toBe(2);
      expect(decoded.durationSeconds).toBeGreaterThan(0.9);
      expect(decoded.leftEnergy).toBeGreaterThan(decoded.rightEnergy * 20 + 0.001);
      await bundle.dispose();
    } finally {
      await runtime.dispose();
    }
  });

  it("rejects authored GIF audio during preflight before engine creation", async () => {
    let engineCalls = 0;
    const runtime = createRuntime(createNodeRuntimeAdapter({
      animatedFormats: ["gif"],
      createEngine: () => {
        engineCalls += 1;
        return audioEngine();
      },
    }));
    try {
      await expect(startExport(runtime, authoredVideo(), {
        for: [{ id: "gif", format: "gif", width: 16, height: 16 }],
      }).result).rejects.toMatchObject({ code: "MEDIA_PREFLIGHT_FAILED" });
      expect(engineCalls).toBe(0);
    } finally {
      await runtime.dispose();
    }
  });
});

function authoredVideo() {
  return video({
    duration: "1s",
    fps: 2,
    size: { width: 16, height: 16 },
    audio: { id: "tone", src: wavDataUrl(), role: "music" },
    render: () => html("<div>audio</div>"),
  });
}

function audioEngine(): PlaywrightEngine {
  const screenshot = sharp({ create: { width: 16, height: 16, channels: 4, background: "black" } }).png().toBuffer();
  return {
    async init() {},
    createAdapters() {
      return {
        renderer: {
          async init() {},
          async rasterize() { return screenshot; },
          async dispose() {},
        },
        encoder: new NodeVideoEncoder(),
      };
    },
    async dispose() {},
  } as unknown as PlaywrightEngine;
}

function wavDataUrl(): string {
  const sampleRate = 8_000;
  const frames = sampleRate / 2;
  const samples = new Int16Array(frames * 2);
  for (let index = 0; index < frames; index += 1) {
    samples[index * 2] = Math.round(Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 0x3fff);
    samples[index * 2 + 1] = 0;
  }
  const bytes = new Uint8Array(44 + samples.byteLength);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + samples.byteLength, true);
  writeAscii(bytes, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, samples.byteLength, true);
  new Int16Array(bytes.buffer, 44, samples.length).set(samples);
  return `data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`;
}

async function decodeStereoDts(bytes: Uint8Array): Promise<{
  channels: number;
  durationSeconds: number;
  leftEnergy: number;
  rightEnergy: number;
}> {
  registerDtsDecoder();
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const [track] = await input.getAudioTracks();
    if (track === undefined) throw new Error("Expected DTS audio track");
    const sink = new AudioSampleSink(track);
    let channels = 0;
    let durationSeconds = 0;
    let leftTotal = 0;
    let rightTotal = 0;
    let frames = 0;
    for await (const sample of sink.samples()) {
      try {
        channels = sample.numberOfChannels;
        durationSeconds += sample.duration;
        const left = new Float32Array(sample.allocationSize({ planeIndex: 0, format: "f32-planar" }) / 4);
        const right = new Float32Array(sample.allocationSize({ planeIndex: 1, format: "f32-planar" }) / 4);
        sample.copyTo(left, { planeIndex: 0, format: "f32-planar" });
        sample.copyTo(right, { planeIndex: 1, format: "f32-planar" });
        for (let index = 0; index < left.length; index += 1) {
          leftTotal += Math.abs(left[index]!);
          rightTotal += Math.abs(right[index]!);
        }
        frames += left.length;
      } finally {
        sample.close();
      }
    }
    return { channels, durationSeconds, leftEnergy: leftTotal / frames, rightEnergy: rightTotal / frames };
  } finally {
    input.dispose();
  }
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

function html(value: string): MediaElement {
  return { $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", html: value }, children: [] } as MediaElement;
}
