import { describe, expect, it, vi, beforeEach } from "vitest";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { FrameExtractor, type FrameExtractorBackend } from "./frame-extractor.js";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const countdownMp4 = join(repoRoot, "examples/marketing/countdown/output.mp4");

function pngDimensions(buf: Buffer): { width: number; height: number } {
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

class CountingBackend implements FrameExtractorBackend {
  calls = 0;

  async extract(_absPath: string, _t: number): Promise<Buffer> {
    this.calls++;
    return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }

  async dispose(): Promise<void> {}
}

describe("FrameExtractor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts a non-empty PNG from countdown mp4 at t=2s", async () => {
    const extractor = new FrameExtractor();
    const png = await extractor.extractFrame(countdownMp4, 2, 30);
    expect(png.length).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    await extractor.dispose();
  });

  it("returns cached buffer on second identical extraction", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);
    const src = countdownMp4;

    await extractor.extractFrame(src, 2, 30);
    await extractor.extractFrame(src, 2, 30);

    expect(backend.calls).toBe(1);
    const stats = extractor.getStats();
    expect(stats.hits).toBeGreaterThan(0);
    await extractor.dispose();
  });

  it("evicts oldest cache entries beyond max size", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend, 2);

    await extractor.extractFrame(countdownMp4, 0, 30);
    await extractor.extractFrame(countdownMp4, 1, 30);
    await extractor.extractFrame(countdownMp4, 2, 30);

    expect(backend.calls).toBe(3);

    await extractor.extractFrame(countdownMp4, 0, 30);
    expect(backend.calls).toBe(4);

    await extractor.dispose();
  });

  it("resolves localhost asset URLs to filesystem paths", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);
    const url = `http://localhost:3000/assets?path=${encodeURIComponent(countdownMp4)}`;

    await extractor.extractFrame(url, 1, 30);
    expect(backend.calls).toBe(1);
    await extractor.dispose();
  });

  it("shares cache for times that round to the same frame index", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);

    await extractor.extractFrame(countdownMp4, 1, 30);
    await extractor.extractFrame(countdownMp4, 1.0000001, 30);

    expect(backend.calls).toBe(1);
    await extractor.dispose();
  });

  it("extracts different frames for adjacent quantized times", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);

    await extractor.extractFrame(countdownMp4, 1, 30);
    await extractor.extractFrame(countdownMp4, 1 + 1 / 30, 30);

    expect(backend.calls).toBe(2);
    await extractor.dispose();
  });

  it("extracts PNG at native source dimensions", async () => {
    const extractor = new FrameExtractor();
    const png = await extractor.extractFrame(countdownMp4, 2, 30);
    const { width, height } = pngDimensions(png);
    expect(width).toBe(1080);
    expect(height).toBe(1920);
    await extractor.dispose();
  });
});