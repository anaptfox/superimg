import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFontMetrics } from "./font-metrics.js";

const inter400 = readFileSync(join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../superimg-core/assets/fonts/Inter-400.ttf",
));

describe("parseFontMetrics", () => {
  it("reads Inter advances", () => {
    const metrics = parseFontMetrics(inter400);
    expect(metrics.unitsPerEm).toBe(2048);
    expect(metrics.advance("M".codePointAt(0)!)).toBeGreaterThan(metrics.advance("i".codePointAt(0)!));
    const a = metrics.advance("A".codePointAt(0)!);
    const v = metrics.advance("V".codePointAt(0)!);
    const pair = metrics.kerning("A".codePointAt(0)!, "V".codePointAt(0)!);
    if (pair !== 0) expect(a + v + pair).toBeLessThan(a + v);
  });

  it("applies kern format 0 pairs and falls back to .notdef", () => {
    const metrics = parseFontMetrics(syntheticKernFont());
    expect(metrics.unitsPerEm).toBe(1000);
    expect(metrics.ascent).toBe(800);
    expect(metrics.descent).toBe(200);
    const a = metrics.advance("A".codePointAt(0)!);
    const v = metrics.advance("V".codePointAt(0)!);
    expect(metrics.kerning("A".codePointAt(0)!, "V".codePointAt(0)!)).toBe(-80);
    expect(a + v + metrics.kerning("A".codePointAt(0)!, "V".codePointAt(0)!)).toBeLessThan(a + v);
    expect(metrics.advance("Q".codePointAt(0)!)).toBe(metrics.advance(0));
  });
});

function u16(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(value);
  return bytes;
}

function i16(value: number): Buffer {
  const bytes = Buffer.alloc(2);
  bytes.writeInt16BE(value);
  return bytes;
}

function u32(value: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(value);
  return bytes;
}

function sfnt(tables: { tag: string; data: Buffer }[]): Uint8Array {
  let offset = 12 + tables.length * 16;
  const directory: Buffer[] = [];
  const blobs: Buffer[] = [];
  for (const table of tables) {
    const pad = (4 - (table.data.length % 4)) % 4;
    directory.push(Buffer.concat([
      Buffer.from(table.tag),
      u32(0),
      u32(offset),
      u32(table.data.length),
    ]));
    const padded = Buffer.concat([table.data, Buffer.alloc(pad)]);
    blobs.push(padded);
    offset += padded.length;
  }
  const header = Buffer.concat([u32(0x00010000), u16(tables.length), u16(0), u16(0), u16(0)]);
  return new Uint8Array(Buffer.concat([header, ...directory, ...blobs]));
}

function syntheticKernFont(): Uint8Array {
  const head = Buffer.alloc(54);
  head.writeUInt16BE(1000, 18);
  const hhea = Buffer.alloc(36);
  hhea.writeInt16BE(800, 4);
  hhea.writeInt16BE(-200, 6);
  hhea.writeUInt16BE(3, 34);
  const hmtx = Buffer.concat([
    u16(500), i16(0),
    u16(600), i16(0),
    u16(600), i16(0),
  ]);
  const segCount = 3;
  const cmap4 = Buffer.concat([
    u16(4),
    u16(40),
    u16(0),
    u16(segCount * 2),
    u16(4),
    u16(1),
    u16(2),
    u16(65), u16(86), u16(0xffff),
    u16(0),
    u16(65), u16(86), u16(0xffff),
    i16(-64), i16(-84), i16(1),
    u16(0), u16(0), u16(0),
  ]);
  const cmap = Buffer.concat([
    u16(0),
    u16(1),
    u16(3),
    u16(1),
    u32(12),
    cmap4,
  ]);
  const pairBytes = Buffer.concat([u16(1), u16(2), i16(-80)]);
  const coverage = 0x0001;
  const subLength = 6 + 8 + pairBytes.length;
  const kern = Buffer.concat([
    u16(0),
    u16(1),
    u16(0),
    u16(subLength),
    u16(coverage),
    u16(1),
    u16(2),
    u16(0),
    u16(0),
    pairBytes,
  ]);
  return sfnt([
    { tag: "head", data: head },
    { tag: "hhea", data: hhea },
    { tag: "hmtx", data: hmtx },
    { tag: "cmap", data: cmap },
    { tag: "kern", data: kern },
  ]);
}
