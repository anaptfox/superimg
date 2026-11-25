import { brotliCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { assertNativeFont } from "./font-format.js";
import { decodeWoff2IdentityToSfnt } from "./woff2.js";

function base128(value: number): number[] {
  if (value < 128) return [value];
  const bytes = [value & 0x7f];
  let rest = value >>> 7;
  while (rest > 0) {
    bytes.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  return bytes.reverse();
}

function wrap(directory: number[], tables: Uint8Array, flavor = 0x00010000): Uint8Array {
  const compressed = brotliCompressSync(tables);
  const bytes = new Uint8Array(48 + directory.length + compressed.byteLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x774f4632);
  view.setUint32(4, flavor);
  view.setUint16(12, 1);
  view.setUint32(20, compressed.byteLength);
  bytes.set(directory, 48);
  bytes.set(compressed, 48 + directory.length);
  return bytes;
}

describe("decodeWoff2IdentityToSfnt", () => {
  it("rebuilds an identity table as SFNT", () => {
    const table = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const decoded = decodeWoff2IdentityToSfnt(wrap([5, ...base128(table.byteLength)], table));
    expect(decoded).toBeDefined();
    assertNativeFont(decoded!);
    expect(Array.from(decoded!.subarray(12 + 16, 12 + 16 + table.byteLength))).toEqual(Array.from(table));
  });

  it("names a transformed glyf table instead of inventing outlines", () => {
    const table = new Uint8Array([1, 2, 3, 4]);
    const flags = 10;
    expect(() => decodeWoff2IdentityToSfnt(wrap([flags, ...base128(table.byteLength), ...base128(table.byteLength)], table))).toThrow(/glyf/);
  });
});
