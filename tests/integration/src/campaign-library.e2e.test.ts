import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { ALL_FORMATS, BufferSource, Input, VideoSampleSink } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";
import { exportMedia, render, shutdown } from "@foxworth/superimg/runtime";
import card from "../../../examples/marketing/campaign-library/launch-card.media";
import film from "../../../examples/marketing/campaign-library/launch-film.media";

afterAll(() => shutdown());
beforeAll(() => registerMediabunnyServer());

async function decodeDelivery(bytes: Uint8Array) {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Export has no video track");
    const width = await track.getDisplayWidth();
    const height = await track.getDisplayHeight();
    const duration = await track.computeDuration();
    const firstTimestamp = await track.getFirstTimestamp();
    const codec = await track.getCodec();
    const metrics = await track.computeFrameRateMetrics({ targetPacketCount: Infinity });
    const samples = new VideoSampleSink(track);
    let count = 0;
    const ruleWidths: number[] = [];
    const sampleTimes: number[] = [];
    for await (const sample of samples.samples()) {
      try {
        // Observe entrance, middle, hold and final encoded frames, not a
        // separately rendered PNG that could conceal a broken video export.
        if ([0, 10, 30, 47].includes(count)) {
          const pixels = new Uint8Array(sample.allocationSize({ format: "RGBA" }));
          const [plane] = await sample.copyTo(pixels, { format: "RGBA" });
          if (!plane) throw new Error("Decoded sample has no RGBA plane");
          const row = plane.offset + Math.floor(height * 0.8125) * plane.stride;
          let green = 0;
          for (let x = 0; x < width; x++) {
            const offset = row + x * 4;
            if (pixels[offset]! > 150 && pixels[offset + 1]! > 180 && pixels[offset + 2]! < 170) green++;
          }
          ruleWidths.push(green);
          sampleTimes.push(sample.timestamp);
        }
        count++;
      } finally { sample.close(); }
    }
    return { width, height, duration, firstTimestamp, codec, frameRate: metrics.bestGuessFrameRate, count, ruleWidths, sampleTimes };
  } finally { input.dispose(); }
}

describe("campaign library deliveries", () => {
  it("exports selected copy as wide PNG/HTML and a square edition from one still", async () => {
    const selected = await render(card, { as: "html", variantId: "teams", editionId: "square" });
    expect(await selected.text()).toContain("Build together.");
    const bundle = await exportMedia(card, {
      for: ["640x360.png", "640x360.html", "640x640.png"],
      variantIds: ["teams"],
    });
    try {
      const dimensions = [];
      for (const artifact of bundle.artifacts) {
        expect(artifact.coordinates.variantId).toBe("teams");
        expect(artifact.coordinates.editionId).toBe(artifact.path.includes("640x640") ? "square" : "default");
        const bytes = await artifact.bytes();
        if (artifact.path.endsWith(".html")) {
          expect(Buffer.from(bytes).toString()).toContain("Build together.");
          expect(artifact.coordinates.renditionId).toBe("640x360.html");
          dimensions.push(artifact.coordinates.renditionId);
          continue;
        }
        const meta = await sharp(bytes).metadata();
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const reference = await render(card, {
          as: "png", variantId: "teams", editionId: artifact.coordinates.editionId,
        });
        const selectedPixels = await sharp(await reference.bytes()).ensureAlpha().raw().toBuffer();
        expect(data.equals(selectedPixels)).toBe(true);
        let markWidth = 0;
        const row = Math.floor(info.height * 0.25);
        for (let x = 0; x < info.width; x++) {
          const offset = (row * info.width + x) * info.channels;
          if (data[offset]! > 150 && data[offset + 1]! > 180 && data[offset + 2]! < 170) markWidth++;
        }
        // The square edition recomposes the mark, rather than merely stretching
        // the landscape image into square encoded dimensions.
        const expectedMarkWidth = info.width * (info.width === info.height ? 0.44 : 0.16);
        expect(Math.abs(markWidth - expectedMarkWidth)).toBeLessThanOrEqual(2);
        dimensions.push(`${meta.width}x${meta.height}.${meta.format}`);
      }
      expect(dimensions.sort()).toEqual(["640x360.png", "640x360.html", "640x640.png"].sort());
    } finally { await bundle.dispose(); }
  });

  it("exports the same timed source as MP4 and WebM", async () => {
    const bundle = await exportMedia(film, { for: ["320x180.mp4", "320x180.webm"] });
    try {
      expect(bundle.artifacts).toHaveLength(2);
      const frame = await render(film, { as: "png", at: "1s" });
      const meta = await sharp(await frame.bytes()).metadata();
      expect([meta.width, meta.height]).toEqual([640, 360]);
      const deliveries = [];
      for (const artifact of bundle.artifacts) {
        const bytes = Buffer.from(await artifact.bytes());
        const decoded = await decodeDelivery(bytes);
        if (artifact.mimeType === "video/mp4") {
          expect(bytes.subarray(0, 32).toString("latin1")).toContain("ftyp");
          expect(decoded.codec).toBe("avc");
        } else {
          expect(artifact.mimeType).toBe("video/webm");
          expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
          expect(decoded.codec).toBe("vp9");
        }
        expect(decoded).toMatchObject({ width: 320, height: 180, count: 48 });
        expect(decoded.firstTimestamp).toBeCloseTo(0, 3);
        expect(decoded.duration).toBeCloseTo(2, 2);
        expect(decoded.frameRate).toBeCloseTo(24, 1);
        expect(decoded.ruleWidths).toHaveLength(4);
        for (const [index, frameIndex] of [0, 10, 30, 47].entries()) {
          expect(decoded.sampleTimes[index]).toBeCloseTo(frameIndex / 24, 2);
        }
        expect(Math.abs(decoded.ruleWidths[0]! - 27)).toBeLessThanOrEqual(3);
        expect(decoded.ruleWidths[1]).toBeGreaterThan(decoded.ruleWidths[0]!);
        expect(Math.abs(decoded.ruleWidths[2]! - 269)).toBeLessThanOrEqual(3);
        expect(Math.abs(decoded.ruleWidths[3]! - decoded.ruleWidths[2]!)).toBeLessThanOrEqual(2);
        deliveries.push(decoded);
      }
      for (let index = 0; index < 4; index++) {
        expect(Math.abs(deliveries[0]!.ruleWidths[index]! - deliveries[1]!.ruleWidths[index]!)).toBeLessThanOrEqual(2);
      }
    } finally { await bundle.dispose(); }
  });
});
