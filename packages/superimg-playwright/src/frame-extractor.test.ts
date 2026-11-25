import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execa } from "execa";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FrameExtractor, type FrameExtractorBackend } from "./frame-extractor.js";

const fixtureDir = mkdtempSync(join(tmpdir(), "superimg-frame-extractor-"));
const fixtureMp4 = join(fixtureDir, "fixture.mp4");

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
  beforeAll(async () => {
    await execa("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "color=c=blue:s=120x200:r=30",
      "-t", "3",
      "-c:v", "mpeg4",
      "-q:v", "5",
      fixtureMp4,
    ]);
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts a non-empty PNG from a fixture mp4 at t=2s", async () => {
    const extractor = new FrameExtractor();
    const png = await extractor.extractFrame(fixtureMp4, 2, 30);
    expect(png.length).toBeGreaterThan(100);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    await extractor.dispose();
  });

  it("returns cached buffer on second identical extraction", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);
    const src = fixtureMp4;

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

    await extractor.extractFrame(fixtureMp4, 0, 30);
    await extractor.extractFrame(fixtureMp4, 1, 30);
    await extractor.extractFrame(fixtureMp4, 2, 30);

    expect(backend.calls).toBe(3);

    await extractor.extractFrame(fixtureMp4, 0, 30);
    expect(backend.calls).toBe(4);

    await extractor.dispose();
  });

  it("resolves opaque asset URLs through the owning registry", async () => {
    const backend = new CountingBackend();
    const url = "http://localhost:3000/assets/8e638ea0-d396-4d0d-995a-f24e3690c839";
    const extractor = new FrameExtractor(
      backend,
      undefined,
      (src) => src === url ? fixtureMp4 : undefined,
    );

    await extractor.extractFrame(url, 1, 30);
    expect(backend.calls).toBe(1);
    await extractor.dispose();
  });

  it("shares cache for times that round to the same microsecond", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);

    await extractor.extractFrame(fixtureMp4, 1, 30);
    await extractor.extractFrame(fixtureMp4, 1.0000001, 30);

    expect(backend.calls).toBe(1);
    await extractor.dispose();
  });

  it("extracts different frames for adjacent source times", async () => {
    const backend = new CountingBackend();
    const extractor = new FrameExtractor(backend);

    await extractor.extractFrame(fixtureMp4, 1, 30);
    await extractor.extractFrame(fixtureMp4, 1 + 1 / 30, 30);

    expect(backend.calls).toBe(2);
    await extractor.dispose();
  });

  it("extracts PNG at native source dimensions", async () => {
    const extractor = new FrameExtractor();
    const png = await extractor.extractFrame(fixtureMp4, 2, 30);
    const { width, height } = pngDimensions(png);
    expect(width).toBe(120);
    expect(height).toBe(200);
    await extractor.dispose();
  });
});
