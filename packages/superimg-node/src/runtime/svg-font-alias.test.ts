import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { aliasSvgFont } from "@superimg/core/edge";
import { nodeEnsureInit, rasterizeSvgSync } from "@superimg/core/rendering/resvg-rasterizer.node";

const original = readFileSync(new URL("../../../superimg-core/assets/fonts/Inter-400.ttf", import.meta.url));

describe("native SVG font aliases", () => {
  it("owns a new valid SFNT and keeps the source untouched", () => {
    const input = Buffer.from(original);
    const result = aliasSvgFont(input, "OwnedRegular");
    expect(input).toEqual(original);
    expect(result).not.toEqual(input);
    let sum = 0;
    const data = Buffer.from(result);
    for (let i = 0; i < data.length; i += 4) sum = (sum + data.readUInt32BE(i)) >>> 0;
    expect(sum).toBe(0xb1b0afba);
  });

  it("sets face-selection metadata from the declaration", () => {
    const result = Buffer.from(aliasSvgFont(original, "Alias", 700, "italic"));
    const count = result.readUInt16BE(4);
    const table = (tag: string) => {
      const entry = Array.from({ length: count }, (_, index) => 12 + index * 16)
        .find((offset) => result.toString("ascii", offset, offset + 4) === tag)!;
      return result.readUInt32BE(entry + 8);
    };
    const os2 = table("OS/2"), head = table("head");
    expect(result.readUInt16BE(os2 + 4)).toBe(700);
    expect(result.readUInt16BE(os2 + 62) & 0x61).toBe(0x21);
    expect(result.readUInt16BE(head + 44) & 3).toBe(3);
  });

  it("retains real italic outlines when changing the family", async () => {
    const requireStdlib = createRequire(new URL("../../../superimg-stdlib/package.json", import.meta.url));
    const italic = readFileSync(join(dirname(requireStdlib.resolve("katex")), "fonts/KaTeX_Main-Italic.ttf"));
    const svg = (family: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="4" y="40" font-family="${family}" font-style="italic" font-size="32">Tea time</text></svg>`;
    await nodeEnsureInit();
    const expected = rasterizeSvgSync(svg("KaTeX_Main"), { width: 200, fontBuffers: [italic], defaultFontFamily: "KaTeX_Main" });
    const actual = rasterizeSvgSync(svg("Alias"), { width: 200, fontBuffers: [aliasSvgFont(italic, "Alias", 400, "italic")], defaultFontFamily: "Alias" });
    expect(Buffer.compare(Buffer.from(actual), Buffer.from(expected))).toBe(0);
  });

  it("refuses collections and truncated directory entries", () => {
    const collection = Buffer.from(original);
    collection.write("ttcf", 0, "ascii");
    collection.writeUInt32BE(1, 8);
    expect(() => aliasSvgFont(collection, "Alias")).toThrow(/Invalid SVG font collection/);
    const malformed = Buffer.from(original);
    malformed.writeUInt32BE(0xffffffff, 20);
    expect(() => aliasSvgFont(malformed, "Alias")).toThrow(/Invalid/);
  });

  it("refuses format-1 name tables rather than silently dropping glyphs", () => {
    const count = original.readUInt16BE(4);
    const directory = Array.from({ length: count }, (_, index) => 12 + 16 * index)
      .find((offset) => original.toString("ascii", offset, offset + 4) === "name")!;
    const start = original.readUInt32BE(directory + 8), length = original.readUInt32BE(directory + 12);
    const old = original.subarray(start, start + length);
    const records = old.readUInt16BE(2), storage = old.readUInt16BE(4), end = 6 + 12 * records;
    const tag = Buffer.from([0, 101, 0, 110]); // UTF-16BE "en"
    const language = Buffer.alloc(6);
    language.writeUInt16BE(1, 0);
    language.writeUInt16BE(tag.length, 2);
    language.writeUInt16BE(old.length - storage, 4);
    const name = Buffer.concat([old.subarray(0, end), language, old.subarray(storage), tag]);
    name.writeUInt16BE(1, 0);
    name.writeUInt16BE(end + language.length, 4);
    const source = Buffer.concat([original, name]);
    source.writeUInt32BE(original.length, directory + 8);
    source.writeUInt32BE(name.length, directory + 12);
    expect(() => aliasSvgFont(source, "Alias")).toThrow(/format-1 name tables require browser/);
  });
});
