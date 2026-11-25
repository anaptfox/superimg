//! Pure-TypeScript WOFF1 (`wOFF`, 0x774F4646) to SFNT unpacker and RFC 1950/1951
//! zlib/DEFLATE decompressor. Keeps `@superimg/stdlib` runtime-neutral (no `node:zlib`).

const WOFF1_MAGIC = 0x774f4646; // 'wOFF'
const WOFF2_MAGIC = 0x774f4632; // 'wOF2'

export function isWoff1(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 44) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, false) === WOFF1_MAGIC;
}

export function isWoff2(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 48) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0, false) === WOFF2_MAGIC;
}

const FIXED_LIT_LENGTHS = (() => {
  const lengths = new Uint8Array(288);
  lengths.fill(8, 0, 144);
  lengths.fill(9, 144, 256);
  lengths.fill(7, 256, 280);
  lengths.fill(8, 280, 288);
  return lengths;
})();

const FIXED_DIST_LENGTHS = (() => {
  const lengths = new Uint8Array(32);
  lengths.fill(5);
  return lengths;
})();

const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
];

const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

interface HuffmanTable {
  maxBits: number;
  /** Map from `(bits << 16) | canonicalCode` to symbol. */
  map: Map<number, number>;
}

function buildHuffman(lengths: Uint8Array): HuffmanTable {
  let maxBits = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (lengths[i]! > maxBits) maxBits = lengths[i]!;
  }
  if (maxBits === 0) return { maxBits: 0, map: new Map() };

  const blCount = new Uint16Array(maxBits + 1);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (len > 0) blCount[len]!++;
  }

  const nextCode = new Uint32Array(maxBits + 1);
  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + blCount[bits - 1]!) << 1;
    nextCode[bits] = code;
  }

  const map = new Map<number, number>();
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const len = lengths[symbol]!;
    if (len !== 0) {
      const c = nextCode[len]!;
      nextCode[len] = c + 1;
      // decodeSymbol reads the stream MSB-first, matching the canonical code.
      map.set((len << 16) | c, symbol);
    }
  }
  return { maxBits, map };
}

const FIXED_LIT_TABLE = buildHuffman(FIXED_LIT_LENGTHS);
const FIXED_DIST_TABLE = buildHuffman(FIXED_DIST_LENGTHS);

/**
 * Inflate a zlib-wrapped (RFC 1950) or raw DEFLATE (RFC 1951) byte stream.
 */
export function inflateZlibOrDeflate(
  input: Uint8Array,
  expectedLength?: number,
): Uint8Array | undefined {
  if (input.byteLength < 2) return undefined;

  let pos = 0;
  // Check for RFC 1950 2-byte zlib header (CMF + FLG)
  const cmf = input[0]!;
  const flg = input[1]!;
  if ((cmf & 0x0f) === 8 && (cmf >>> 4) <= 7 && ((cmf << 8) + flg) % 31 === 0) {
    pos = 2;
    if ((flg & 0x20) !== 0) {
      if (input.byteLength < 6) return undefined;
      pos = 6; // Preset dictionary ID
    }
  }

  let bitPos = pos * 8;
  const totalBits = input.byteLength * 8;

  const readBits = (n: number): number => {
    if (n === 0) return 0;
    if (bitPos + n > totalBits) throw new RangeError("Unexpected EOF in DEFLATE stream");
    let val = 0;
    for (let i = 0; i < n; i++) {
      const byteIdx = bitPos >>> 3;
      const bitIdx = bitPos & 7;
      val |= ((input[byteIdx]! >>> bitIdx) & 1) << i;
      bitPos++;
    }
    return val;
  };

  const decodeSymbol = (table: HuffmanTable): number => {
    let code = 0;
    for (let len = 1; len <= table.maxBits; len++) {
      if (bitPos >= totalBits) throw new RangeError("Unexpected EOF in Huffman code");
      const byteIdx = bitPos >>> 3;
      const bitIdx = bitPos & 7;
      // Deflate transmits the most-significant bit of a Huffman code first.
      code = ((code << 1) | ((input[byteIdx]! >>> bitIdx) & 1)) >>> 0;
      bitPos++;
      const sym = table.map.get((len << 16) | code);
      if (sym !== undefined) return sym;
    }
    throw new Error("Invalid Huffman code");
  };

  let out = new Uint8Array(expectedLength && expectedLength > 0 ? expectedLength : Math.max(256, input.byteLength * 3));
  let outLen = 0;
  const ensureCapacity = (extra: number) => {
    if (outLen + extra <= out.length) return;
    let nextCap = Math.max(out.length * 2, outLen + extra);
    const next = new Uint8Array(nextCap);
    next.set(out.subarray(0, outLen));
    out = next;
  };

  try {
    let bfinal = 0;
    while (bfinal === 0) {
      bfinal = readBits(1);
      const btype = readBits(2);
      if (btype === 0) {
        // Stored uncompressed block: align to next byte boundary
        bitPos = (bitPos + 7) & ~7;
        const byteIdx = bitPos >>> 3;
        if (byteIdx + 4 > input.byteLength) return undefined;
        const len = input[byteIdx]! | (input[byteIdx + 1]! << 8);
        const nlen = input[byteIdx + 2]! | (input[byteIdx + 3]! << 8);
        if ((len ^ 0xffff) !== nlen) return undefined;
        bitPos += 32;
        const dataStart = bitPos >>> 3;
        if (dataStart + len > input.byteLength) return undefined;
        ensureCapacity(len);
        out.set(input.subarray(dataStart, dataStart + len), outLen);
        outLen += len;
        bitPos += len * 8;
      } else if (btype === 1 || btype === 2) {
        let litTable = FIXED_LIT_TABLE;
        let distTable = FIXED_DIST_TABLE;
        if (btype === 2) {
          const hlit = readBits(5) + 257;
          const hdist = readBits(5) + 1;
          const hclen = readBits(4) + 4;
          const clLengths = new Uint8Array(19);
          for (let i = 0; i < hclen; i++) {
            clLengths[CL_ORDER[i]!] = readBits(3);
          }
          const clTable = buildHuffman(clLengths);
          const allLengths = new Uint8Array(hlit + hdist);
          let idx = 0;
          while (idx < hlit + hdist) {
            const sym = decodeSymbol(clTable);
            if (sym < 16) {
              allLengths[idx++] = sym;
            } else if (sym === 16) {
              if (idx === 0) return undefined;
              const prev = allLengths[idx - 1]!;
              const repeat = readBits(2) + 3;
              for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = prev;
            } else if (sym === 17) {
              const repeat = readBits(3) + 3;
              for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = 0;
            } else if (sym === 18) {
              const repeat = readBits(7) + 11;
              for (let r = 0; r < repeat && idx < allLengths.length; r++) allLengths[idx++] = 0;
            } else {
              return undefined;
            }
          }
          litTable = buildHuffman(allLengths.subarray(0, hlit));
          distTable = buildHuffman(allLengths.subarray(hlit));
        }

        while (true) {
          const sym = decodeSymbol(litTable);
          if (sym === 256) break;
          if (sym < 256) {
            ensureCapacity(1);
            out[outLen++] = sym;
          } else {
            const lenIdx = sym - 257;
            if (lenIdx < 0 || lenIdx >= LENGTH_BASE.length) return undefined;
            const length = LENGTH_BASE[lenIdx]! + readBits(LENGTH_EXTRA[lenIdx]!);
            const distSym = decodeSymbol(distTable);
            if (distSym < 0 || distSym >= DIST_BASE.length) return undefined;
            const distance = DIST_BASE[distSym]! + readBits(DIST_EXTRA[distSym]!);
            if (distance > outLen) return undefined;
            ensureCapacity(length);
            for (let i = 0; i < length; i++) {
              out[outLen] = out[outLen - distance]!;
              outLen++;
            }
          }
        }
      } else {
        return undefined;
      }
    }
  } catch {
    return undefined;
  }

  if (expectedLength !== undefined && outLen !== expectedLength) return undefined;
  return out.subarray(0, outLen);
}

/**
 * Unpack a WOFF 1.0 (`wOFF`) container into a standard SFNT (`.ttf` / `.otf`) byte buffer.
 */
export function decodeWoff1ToSfnt(bytes: Uint8Array): Uint8Array | undefined {
  if (!isWoff1(bytes)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const flavor = view.getUint32(4, false);
  const numTables = view.getUint16(12, false);
  if (numTables === 0 || 44 + numTables * 20 > bytes.byteLength) return undefined;

  interface WoffTableEntry {
    tag: number;
    offset: number;
    compLength: number;
    origLength: number;
    origChecksum: number;
  }

  const entries: WoffTableEntry[] = [];
  let sfntSize = 12 + numTables * 16;
  for (let i = 0; i < numTables; i++) {
    const base = 44 + i * 20;
    const tag = view.getUint32(base, false);
    const offset = view.getUint32(base + 4, false);
    const compLength = view.getUint32(base + 8, false);
    const origLength = view.getUint32(base + 12, false);
    const origChecksum = view.getUint32(base + 16, false);
    if (offset + compLength > bytes.byteLength || compLength > origLength) {
      return undefined;
    }
    entries.push({ tag, offset, compLength, origLength, origChecksum });
    sfntSize += (origLength + 3) & ~3;
  }

  const sfnt = new Uint8Array(sfntSize);
  const sfntView = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength);

  let maxPow2 = 1;
  let entrySelector = 0;
  while (maxPow2 * 2 <= numTables) {
    maxPow2 *= 2;
    entrySelector++;
  }
  const searchRange = maxPow2 * 16;
  const rangeShift = numTables * 16 - searchRange;

  sfntView.setUint32(0, flavor, false);
  sfntView.setUint16(4, numTables, false);
  sfntView.setUint16(6, searchRange, false);
  sfntView.setUint16(8, entrySelector, false);
  sfntView.setUint16(10, rangeShift, false);

  let writeOffset = 12 + numTables * 16;
  for (let i = 0; i < numTables; i++) {
    const entry = entries[i]!;
    const slice = bytes.subarray(entry.offset, entry.offset + entry.compLength);
    let tableBytes: Uint8Array | undefined;
    if (entry.compLength === entry.origLength) {
      tableBytes = slice;
    } else {
      tableBytes = inflateZlibOrDeflate(slice, entry.origLength);
      if (!tableBytes || tableBytes.byteLength !== entry.origLength) return undefined;
    }

    const dirOffset = 12 + i * 16;
    sfntView.setUint32(dirOffset, entry.tag, false);
    sfntView.setUint32(dirOffset + 4, entry.origChecksum, false);
    sfntView.setUint32(dirOffset + 8, writeOffset, false);
    sfntView.setUint32(dirOffset + 12, entry.origLength, false);

    sfnt.set(tableBytes, writeOffset);
    writeOffset += (entry.origLength + 3) & ~3;
  }

  return sfnt;
}
