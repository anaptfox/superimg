import { describe, expect, it } from "vitest";
import { bundledInterFontURLs, loadBundledInter } from "./bundled-inter.js";

describe("portable bundled font locations", () => {
  it("walks module ancestors without depending on a directory asset import", () => {
    const urls = bundledInterFontURLs("Inter-400.ttf");
    expect(urls.length).toBeGreaterThan(2);
    expect(urls[0]!.pathname).toMatch(/\/rendering\/assets\/fonts\/Inter-400\.ttf$/);
    expect(urls[1]!.pathname).toMatch(/\/rendering\/packages\/superimg-core\/assets\/fonts\/Inter-400\.ttf$/);
    expect(urls.some(url => url.pathname.endsWith("/superimg-core/assets/fonts/Inter-400.ttf"))).toBe(true);
    expect(urls.every(url => !url.search && !url.hash)).toBe(true);
  });

  it("still reads all three default font faces from the source package", async () => {
    const faces = await loadBundledInter();
    expect(faces.map(face => face.weight)).toEqual([400, 500, 700]);
    expect(faces.every(face => face.data.byteLength > 1000 && face.mimeType === "font/ttf")).toBe(true);
  });
});
