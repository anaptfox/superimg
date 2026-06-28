import { describe, it, expect } from "vitest";
import {
  rasterize,
  rasterizeSvgSync,
  ensureInit,
  ResvgRasterizer,
} from "../rendering/resvg-rasterizer.js";

/** PNG magic number: 89 50 4E 47 0D 0A 1A 0A */
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

/** Read width/height from the PNG IHDR chunk (big-endian, bytes 16-23). */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const SQUARE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
  <rect width="120" height="80" fill="#0a0a0a"/>
  <circle cx="60" cy="40" r="24" fill="#667eea"/>
</svg>`;

describe("ResvgRasterizer (browser-free SVG → PNG)", () => {
  it("rasterizes an SVG string to a real PNG with no browser", async () => {
    const png = await rasterize(SQUARE_SVG, { width: 120, height: 80 });
    expect(isPng(png)).toBe(true);
    expect(pngSize(png)).toEqual({ width: 120, height: 80 });
  });

  it("scales to the requested width (fitTo:width, aspect preserved)", async () => {
    await ensureInit();
    const png = rasterizeSvgSync(SQUARE_SVG, { width: 240 });
    expect(pngSize(png)).toEqual({ width: 240, height: 160 });
  });

  it("produces byte-identical output across calls (build⟷edge parity)", async () => {
    await ensureInit();
    const a = rasterizeSvgSync(SQUARE_SVG, { width: 120 });
    const b = rasterizeSvgSync(SQUARE_SVG, { width: 120 });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it("implements the Rasterizer contract and accepts only svg", async () => {
    const r = new ResvgRasterizer();
    expect(r.accepts("svg")).toBe(true);
    expect(r.accepts("html")).toBe(false);
    expect(r.capabilities).toMatchObject({ browserFree: true, workerSafe: true });
    await r.init({ width: 120, height: 80 });
    const png = await r.rasterize(SQUARE_SVG);
    expect(isPng(png)).toBe(true);
    await r.dispose();
  });
});
