import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { fileURLToPath } from "node:url";

const sourceModule = (path: string) => import(fileURLToPath(new URL(path, import.meta.url)));
const { svgDocument, SvgArtwork } = await sourceModule("../../../superimg-stdlib/src/svg/document-artwork.ts");
const { lower } = await sourceModule("../../../superimg-stdlib/src/tree/lower.ts");

describe("imported SVG realization", () => {
  it("preserves viewport alignment, local gradients, masks and nested text on rasterization", async () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 60" preserveAspectRatio="xMinYMax slice">
      <defs><radialGradient id="paint"><stop stop-color="#f00"/><stop offset="1" stop-color="#00f"/></radialGradient><mask id="cut"><rect width="120" height="60" fill="white"/><circle cx="20" cy="20" r="8" fill="black"/></mask></defs>
      <rect width="120" height="60" fill="url(#paint)" mask="url(#cut)"/><text x="4" y="50" font-size="10" fill="white">Tea <tspan font-weight="bold">time</tspan></text>
    </svg>`;
    const art = SvgArtwork({ document: svgDocument(new TextEncoder().encode(source)), id: "art", width: 120, height: 120 });
    const imported = lower(art, "svg");
    const pixels = async (svg: string) => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    expect(await pixels(imported)).toEqual(await pixels(source));
  });
  it("preserves a local blur filter and its reference when rasterized", async () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs><rect x="20" y="20" width="40" height="40" fill="red" filter="url(#blur)"/></svg>';
    const imported = lower(SvgArtwork({ document: svgDocument(new TextEncoder().encode(source)), id: "art", width: 80, height: 80 }), "svg");
    const pixels = async (svg: string) => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    expect(await pixels(imported)).toEqual(await pixels(source));
  });
});
