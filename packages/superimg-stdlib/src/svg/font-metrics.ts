//! Synchronous TTF/OTF/WOFF1 metrics. Glyph outlines are unused: advances come from
//! hmtx, mapping from cmap, optional pair adjustments from kern format 0.

import { decodeWoff1ToSfnt, isWoff1, isWoff2, inflateZlibOrDeflate } from "./woff.js";

export { decodeWoff1ToSfnt, isWoff1, isWoff2, inflateZlibOrDeflate };

export interface FontMetrics {
  readonly unitsPerEm: number;
  /** Distance above the baseline, in font units. */
  readonly ascent: number;
  /** Distance below the baseline, in font units (positive). */
  readonly descent: number;
  /** Advance width in font units. Missing glyphs use `.notdef`. */
  advance(codePoint: number): number;
  /** Pair adjustment in font units. Missing pairs are 0. */
  kerning(left: number, right: number): number;
}

interface TableSlice {
  offset: number;
  length: number;
}

interface CmapMap {
  glyphId(codePoint: number): number | undefined;
}

const HEADER_SIZE = 12;
const RECORD_SIZE = 16;

export function parseFontMetrics(rawBytes: Uint8Array): FontMetrics {
  let bytes = rawBytes;
  if (isWoff1(rawBytes)) {
    const unpacked = decodeWoff1ToSfnt(rawBytes);
    if (!unpacked) throw new Error("Failed to unpack WOFF1 font container");
    bytes = unpacked;
  }
  if (bytes.byteLength < HEADER_SIZE) throw new Error("Font is too small to be SFNT");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const scaler = view.getUint32(0);
  if (scaler !== 0x00010000 && scaler !== 0x4f54544f && scaler !== 0x74727565) {
    throw new Error("Font is not a TrueType or CFF OpenType file");
  }
  const tables = readTables(bytes, view);
  const head = required(tables, "head");
  const hhea = required(tables, "hhea");
  const hmtx = required(tables, "hmtx");
  const cmap = required(tables, "cmap");
  if (head.length < 20 || hhea.length < 36) throw new Error("Font head/hhea tables are truncated");

  const unitsPerEm = view.getUint16(head.offset + 18);
  if (unitsPerEm === 0) throw new Error("Font unitsPerEm is 0");
  const hheaAscent = view.getInt16(hhea.offset + 4);
  const hheaDescent = view.getInt16(hhea.offset + 6);
  const numberOfHMetrics = view.getUint16(hhea.offset + 34);
  if (numberOfHMetrics === 0) throw new Error("Font has no horizontal metrics");

  const typo = typoMetrics(view, tables.get("OS/2"));
  const ascent = typo?.ascent ?? hheaAscent;
  const descent = Math.abs(typo?.descent ?? hheaDescent);
  const glyphOf = readCmap(view, cmap);
  const advanceOf = glyphAdvance(view, hmtx, numberOfHMetrics);
  const pairs = readKern(view, tables.get("kern"));

  return {
    unitsPerEm,
    ascent,
    descent,
    advance(codePoint: number): number {
      return advanceOf(glyphOf(codePoint) ?? 0);
    },
    kerning(left: number, right: number): number {
      const a = glyphOf(left);
      const b = glyphOf(right);
      if (a === undefined || b === undefined) return 0;
      return pairs.get((a << 16) | b) ?? 0;
    },
  };
}

function readTables(bytes: Uint8Array, view: DataView): Map<string, TableSlice> {
  const count = view.getUint16(4);
  const tables = new Map<string, TableSlice>();
  for (let index = 0; index < count; index++) {
    const record = HEADER_SIZE + index * RECORD_SIZE;
    if (record + RECORD_SIZE > bytes.byteLength) throw new Error("Font table directory is truncated");
    const tag = String.fromCharCode(bytes[record]!, bytes[record + 1]!, bytes[record + 2]!, bytes[record + 3]!);
    const offset = view.getUint32(record + 8);
    const length = view.getUint32(record + 12);
    if (offset + length > bytes.byteLength) throw new Error(`Font table ${tag} is out of range`);
    tables.set(tag, { offset, length });
  }
  return tables;
}

function required(tables: Map<string, TableSlice>, tag: string): TableSlice {
  const table = tables.get(tag);
  if (!table) throw new Error(`Font is missing the ${tag} table`);
  return table;
}

function typoMetrics(
  view: DataView,
  os2: TableSlice | undefined,
): { ascent: number; descent: number } | undefined {
  if (!os2 || os2.length < 72) return undefined;
  const ascent = view.getInt16(os2.offset + 68);
  const descent = view.getInt16(os2.offset + 70);
  if (ascent === 0 && descent === 0) return undefined;
  return { ascent, descent };
}

function glyphAdvance(view: DataView, hmtx: TableSlice, numberOfHMetrics: number): (glyphId: number) => number {
  const last = view.getUint16(hmtx.offset + (numberOfHMetrics - 1) * 4);
  return (glyphId: number) => {
    if (glyphId < numberOfHMetrics) return view.getUint16(hmtx.offset + glyphId * 4);
    return last;
  };
}

function readCmap(view: DataView, cmap: TableSlice): (codePoint: number) => number | undefined {
  if (cmap.length < 4) throw new Error("Font cmap is truncated");
  const start = cmap.offset;
  const count = view.getUint16(start + 2);
  const format4: CmapMap[] = [];
  const format12: CmapMap[] = [];
  for (let index = 0; index < count; index++) {
    const record = start + 4 + index * 8;
    if (record + 8 > start + cmap.length) throw new Error("Font cmap records are truncated");
    const platform = view.getUint16(record);
    const encoding = view.getUint16(record + 2);
    const offset = view.getUint32(record + 4);
    const preferred = (platform === 3 && (encoding === 1 || encoding === 10)) || platform === 0;
    if (!preferred) continue;
    const sub = start + offset;
    if (sub + 2 > view.byteLength) continue;
    const format = view.getUint16(sub);
    const rank = platform === 3 ? 0 : 1;
    if (format === 12 && (encoding === 10 || platform === 0)) format12.push(parseCmap12(view, sub, rank));
    else if (format === 4 && (encoding === 1 || platform === 0)) format4.push(parseCmap4(view, sub, rank));
  }
  const usable = [...format12, ...format4].sort((left, right) => rankOf(left) - rankOf(right));
  return (codePoint: number) => {
    if (codePoint < 0) return undefined;
    for (const map of usable) {
      const glyph = map.glyphId(codePoint);
      if (glyph !== undefined && glyph !== 0) return glyph;
    }
    for (const map of usable) {
      const glyph = map.glyphId(codePoint);
      if (glyph !== undefined) return glyph;
    }
    return undefined;
  };
}

function rankOf(map: CmapMap): number {
  return (map as CmapMap & { rank?: number }).rank ?? 0;
}

function parseCmap4(view: DataView, offset: number, rank: number): CmapMap {
  const length = view.getUint16(offset + 2);
  const segCount = view.getUint16(offset + 6) / 2;
  let cursor = offset + 14;
  const endCode = readU16s(view, cursor, segCount);
  cursor += segCount * 2 + 2;
  const startCode = readU16s(view, cursor, segCount);
  cursor += segCount * 2;
  const idDelta = readI16s(view, cursor, segCount);
  cursor += segCount * 2;
  const idRangeOffsetAt = cursor;
  const idRangeOffset = readU16s(view, cursor, segCount);
  const limit = offset + length;
  const map: CmapMap & { rank: number } = {
    rank,
    glyphId(codePoint: number): number | undefined {
      if (codePoint < 0 || codePoint > 0xffff) return undefined;
      let index = 0;
      while (index < segCount && (endCode[index] ?? 0) < codePoint) index++;
      if (index >= segCount) return undefined;
      const start = startCode[index] ?? 0;
      if (codePoint < start) return undefined;
      const delta = idDelta[index] ?? 0;
      const range = idRangeOffset[index] ?? 0;
      if (range === 0) return (codePoint + delta) & 0xffff;
      const glyphOffset = idRangeOffsetAt + index * 2 + range + (codePoint - start) * 2;
      if (glyphOffset + 2 > limit) return 0;
      const glyph = view.getUint16(glyphOffset);
      if (glyph === 0) return 0;
      return (glyph + delta) & 0xffff;
    },
  };
  return map;
}

function parseCmap12(view: DataView, offset: number, rank: number): CmapMap {
  const groups = view.getUint32(offset + 12);
  const records: { start: number; end: number; glyph: number }[] = [];
  let cursor = offset + 16;
  for (let index = 0; index < groups; index++) {
    records.push({
      start: view.getUint32(cursor),
      end: view.getUint32(cursor + 4),
      glyph: view.getUint32(cursor + 8),
    });
    cursor += 12;
  }
  const map: CmapMap & { rank: number } = {
    rank,
    glyphId(codePoint: number): number | undefined {
      if (codePoint < 0) return undefined;
      let lo = 0;
      let hi = records.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const group = records[mid]!;
        if (codePoint < group.start) hi = mid - 1;
        else if (codePoint > group.end) lo = mid + 1;
        else return group.glyph + (codePoint - group.start);
      }
      return undefined;
    },
  };
  return map;
}

function readKern(view: DataView, kern: TableSlice | undefined): Map<number, number> {
  const pairs = new Map<number, number>();
  if (!kern || kern.length < 4) return pairs;
  const version16 = view.getUint16(kern.offset);
  if (version16 === 0) readMicrosoftKern(view, kern, pairs);
  else if (view.getUint32(kern.offset) === 0x00010000) readAppleKern(view, kern, pairs);
  return pairs;
}

function readMicrosoftKern(view: DataView, kern: TableSlice, pairs: Map<number, number>): void {
  const tables = view.getUint16(kern.offset + 2);
  let cursor = kern.offset + 4;
  const end = kern.offset + kern.length;
  for (let index = 0; index < tables && cursor + 6 <= end; index++) {
    const length = view.getUint16(cursor + 2);
    const coverage = view.getUint16(cursor + 4);
    const next = cursor + length;
    if (isFormat0Horizontal(coverage)) {
      readKernPairs(view, cursor + 6, next, pairs);
    }
    cursor = next;
  }
}

function readAppleKern(view: DataView, kern: TableSlice, pairs: Map<number, number>): void {
  const tables = view.getUint32(kern.offset + 4);
  let cursor = kern.offset + 8;
  const end = kern.offset + kern.length;
  for (let index = 0; index < tables && cursor + 8 <= end; index++) {
    const length = view.getUint32(cursor);
    const coverage = view.getUint16(cursor + 4);
    const next = cursor + length;
    if (isFormat0Horizontal(coverage)) {
      readKernPairs(view, cursor + 8, next, pairs);
    }
    cursor = next;
  }
}

/** OpenType stores the subtable format in the high byte and horizontal in bit 0. */
function isFormat0Horizontal(coverage: number): boolean {
  return (coverage >> 8) === 0 && ((coverage & 0x1) !== 0 || coverage === 0);
}

function readKernPairs(view: DataView, offset: number, end: number, pairs: Map<number, number>): void {
  if (offset + 8 > end) return;
  const count = view.getUint16(offset);
  let cursor = offset + 8;
  for (let index = 0; index < count && cursor + 6 <= end; index++) {
    const left = view.getUint16(cursor);
    const right = view.getUint16(cursor + 2);
    pairs.set((left << 16) | right, view.getInt16(cursor + 4));
    cursor += 6;
  }
}

function readU16s(view: DataView, offset: number, count: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index++) values.push(view.getUint16(offset + index * 2));
  return values;
}

function readI16s(view: DataView, offset: number, count: number): number[] {
  const values: number[] = [];
  for (let index = 0; index < count; index++) values.push(view.getInt16(offset + index * 2));
  return values;
}
