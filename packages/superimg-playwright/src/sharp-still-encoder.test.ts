import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { SharpStillEncoder } from "./sharp-still-encoder.js";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SharpStillEncoder quality", () => {
  it("writes a host-owned PNG file without returning its bytes and preserves it after disposal", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-still-file-"));
    const path = join(directory, "frame.png");
    const encoder = new SharpStillEncoder("png");
    try {
      const screenshot = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).png().toBuffer();
      await encoder.init({ width: 8, height: 8, fps: 1, output: { kind: "file", path }, encoding: { still: { deband: "none" } } });
      await encoder.addFrame(screenshot);
      await expect(encoder.finalize()).rejects.toThrow(/finalizeToFile/);
      const result = await encoder.finalizeToFile();
      await encoder.dispose();
      expect(result).toEqual({ path, byteLength: (await stat(path)).size });
      const image = sharp(await readFile(path));
      const meta = await image.metadata();
      expect([meta.width, meta.height]).toEqual([8, 8]);
      expect((await image.raw().toBuffer()).subarray(0, 4)).toEqual(Buffer.from([255, 0, 0, 255]));
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("removes partial still output when decoding fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "superimg-still-failure-"));
    const path = join(directory, "frame.png");
    const encoder = new SharpStillEncoder("png");
    try {
      await encoder.init({ width: 8, height: 8, fps: 1, output: { kind: "file", path } });
      await encoder.addFrame(Buffer.from("invalid image"));
      await expect(encoder.finalizeToFile()).rejects.toThrow();
      await expect(stat(path)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await encoder.dispose();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("encodes PNG without forcing lossy webp defaults", async () => {
    const raw = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 20, g: 40, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const enc = new SharpStillEncoder("png");
    await enc.init({ width: 16, height: 16, fps: 1 });
    await enc.addFrame(raw);
    const out = await enc.finalize();
    expect(out[0]).toBe(0x89);
    expect(out[1]).toBe(0x50);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(16);
    await enc.dispose();
  });

  it("resizes with lanczos when buffer differs from target", async () => {
    const raw = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const enc = new SharpStillEncoder("png");
    await enc.init({ width: 16, height: 16, fps: 1 });
    await enc.addFrame(raw);
    const out = await enc.finalize();
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(16);
    await enc.dispose();
  });

  it("honors still lossless webp", async () => {
    const raw = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const enc = new SharpStillEncoder("webp");
    await enc.init({
      width: 8,
      height: 8,
      fps: 1,
      encoding: { still: { lossless: true } },
    });
    await enc.addFrame(raw);
    const out = await enc.finalize();
    // RIFF....WEBP
    expect(out.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(out.subarray(8, 12).toString("ascii")).toBe("WEBP");
    await enc.dispose();
  });

  it("applies blue-noise deband so output differs from source flat bands", async () => {
    // Stepped gray ramp (banding) as PNG input
    const w = 64;
    const h = 16;
    const rawPixels = Buffer.alloc(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.floor(x / 8) * 8;
        const i = (y * w + x) * 3;
        rawPixels[i] = v;
        rawPixels[i + 1] = v;
        rawPixels[i + 2] = v;
      }
    }
    const src = await sharp(rawPixels, {
      raw: { width: w, height: h, channels: 3 },
    })
      .png()
      .toBuffer();

    const encNone = new SharpStillEncoder("png");
    await encNone.init({
      width: w,
      height: h,
      fps: 1,
      encoding: { still: { deband: "none" } },
    });
    await encNone.addFrame(src);
    const noDeband = await encNone.finalize();
    await encNone.dispose();

    const encBn = new SharpStillEncoder("png");
    await encBn.init({
      width: w,
      height: h,
      fps: 1,
      encoding: { still: { deband: "blue-noise", debandStrength: 0.6 } },
    });
    await encBn.addFrame(src);
    const withDeband = await encBn.finalize();
    await encBn.dispose();

    expect(withDeband.equals(noDeband)).toBe(false);
  });

  it("uses PNG compression 4 by default and honors compressionLevel", async () => {
    const raw = await sharp({
      create: {
        width: 48,
        height: 48,
        channels: 3,
        background: { r: 12, g: 34, b: 56 },
      },
    })
      .png()
      .toBuffer();

    const encDefault = new SharpStillEncoder("png");
    await encDefault.init({
      width: 48,
      height: 48,
      fps: 1,
      encoding: { still: { deband: "none" } },
    });
    await encDefault.addFrame(raw);
    const def = await encDefault.finalize();
    await encDefault.dispose();

    const encNine = new SharpStillEncoder("png");
    await encNine.init({
      width: 48,
      height: 48,
      fps: 1,
      encoding: { still: { deband: "none", compressionLevel: 9 } },
    });
    await encNine.addFrame(raw);
    const nine = await encNine.finalize();
    await encNine.dispose();

    expect(def[0]).toBe(0x89);
    expect(nine[0]).toBe(0x89);
    expect(def.equals(nine)).toBe(false);
  });

  it("writes 16-bit PNG masters when bitDepth is 16", async () => {
    const raw = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const enc = new SharpStillEncoder("png");
    await enc.init({
      width: 8,
      height: 8,
      fps: 1,
      encoding: { still: { bitDepth: 16 } },
    });
    await enc.addFrame(raw);
    const out = await enc.finalize();
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    // 16-bit per channel
    expect(meta.depth).toBe("ushort");
    await enc.dispose();
  });
});
