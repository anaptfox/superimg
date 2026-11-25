//! Identity-only WOFF2 → SFNT. Brotli comes from Node's zlib. glyf/loca/hmtx
//! transforms are rejected by name; this does not reconstruct them.

const WOFF2_MAGIC = 0x774f4632;
const TTCF = 0x74746366;
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
  "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
] as const;

interface TableEntry {
  tag: string;
  length: number;
}

function isWoff2(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 48) return false;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) === WOFF2_MAGIC;
}

/** Null transform: version 0 for ordinary tables, version 3 for glyf and loca. */
function isNullTransform(tag: string, version: number): boolean {
  if (tag === "glyf" || tag === "loca") return version === 3;
  return version === 0;
}

function readBase128(bytes: Uint8Array, offset: number): { value: number; offset: number } | undefined {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (offset >= bytes.byteLength) return undefined;
    const byte = bytes[offset++]!;
    if (i === 0 && byte === 0x80) return undefined;
    const next = value * 128 + (byte & 0x7f);
    if (next > 0xffffffff) return undefined;
    value = next;
    if ((byte & 0x80) === 0) return { value, offset };
  }
  return undefined;
}

function tagBytes(tag: string): number {
  return ((tag.charCodeAt(0) & 255) << 24)
    | ((tag.charCodeAt(1) & 255) << 16)
    | ((tag.charCodeAt(2) & 255) << 8)
    | (tag.charCodeAt(3) & 255);
}

function tableChecksum(view: DataView, offset: number, length: number): number {
  let sum = 0;
  const padded = (length + 3) & ~3;
  for (let i = 0; i < padded; i += 4) {
    sum = (sum + view.getUint32(offset + i)) >>> 0;
  }
  return sum;
}

function brotliDecompress(payload: Uint8Array): Uint8Array | undefined {
  const zlib = (globalThis as { process?: { getBuiltinModule?: (id: string) => { brotliDecompressSync?: (data: Uint8Array) => Uint8Array } } }).process
    ?.getBuiltinModule?.("zlib");
  if (!zlib?.brotliDecompressSync) {
    throw new TypeError("WOFF2 decoding requires Node zlib brotli");
  }
  try {
    return new Uint8Array(zlib.brotliDecompressSync(payload));
  } catch {
    return undefined;
  }
}

/**
 * Decode a WOFF2 font whose tables are stored without glyf/loca/hmtx transforms.
 * Returns undefined for truncated or corrupt containers. Throws when a table
 * uses a transform this decoder does not implement.
 */
export function decodeWoff2IdentityToSfnt(bytes: Uint8Array): Uint8Array | undefined {
  if (!isWoff2(bytes)) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flavor = view.getUint32(4);
  if (flavor === TTCF) throw new TypeError("WOFF2 font collections are not supported");
  const numTables = view.getUint16(12);
  const totalCompressedSize = view.getUint32(20);
  if (numTables === 0) return undefined;

  const entries: TableEntry[] = [];
  let offset = 48;
  for (let i = 0; i < numTables; i++) {
    if (offset >= bytes.byteLength) return undefined;
    const flags = bytes[offset++]!;
    const tagIndex = flags & 0x3f;
    const version = flags >>> 6;
    let tag: string;
    if (tagIndex === 63) {
      if (offset + 4 > bytes.byteLength) return undefined;
      tag = String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
      offset += 4;
    } else {
      const known = KNOWN_TAGS[tagIndex];
      if (known === undefined) return undefined;
      tag = known;
    }
    const orig = readBase128(bytes, offset);
    if (!orig) return undefined;
    offset = orig.offset;
    if (!isNullTransform(tag, version)) {
      const transformed = readBase128(bytes, offset);
      if (!transformed) return undefined;
      throw new TypeError(`WOFF2 table "${tag}" uses transform version ${version}; only identity WOFF2 tables can be decoded`);
    }
    entries.push({ tag, length: orig.value });
  }
  if (offset + totalCompressedSize > bytes.byteLength) return undefined;
  const compressed = bytes.subarray(offset, offset + totalCompressedSize);
  const tables = brotliDecompress(compressed);
  if (!tables) return undefined;

  const sorted = entries
    .map((entry, index) => ({ ...entry, index }))
    .sort((left, right) => (left.tag < right.tag ? -1 : left.tag > right.tag ? 1 : 0));
  let cursor = 0;
  const slices: { tag: string; length: number; dataOffset: number }[] = [];
  for (const entry of sorted) {
    if (cursor + entry.length > tables.byteLength) return undefined;
    slices.push({ tag: entry.tag, length: entry.length, dataOffset: cursor });
    cursor += entry.length;
  }
  if (cursor !== tables.byteLength) return undefined;

  let maxPow2 = 1;
  let entrySelector = 0;
  while (maxPow2 * 2 <= numTables) {
    maxPow2 *= 2;
    entrySelector++;
  }
  const searchRange = maxPow2 * 16;
  const rangeShift = numTables * 16 - searchRange;
  let sfntSize = 12 + numTables * 16;
  for (const slice of slices) sfntSize += (slice.length + 3) & ~3;
  const sfnt = new Uint8Array(sfntSize);
  const out = new DataView(sfnt.buffer);
  out.setUint32(0, flavor);
  out.setUint16(4, numTables);
  out.setUint16(6, searchRange);
  out.setUint16(8, entrySelector);
  out.setUint16(10, rangeShift);

  let writeAt = 12 + numTables * 16;
  slices.forEach((slice, index) => {
    const dir = 12 + index * 16;
    out.setUint32(dir, tagBytes(slice.tag));
    out.setUint32(dir + 8, writeAt);
    out.setUint32(dir + 12, slice.length);
    sfnt.set(tables.subarray(slice.dataOffset, slice.dataOffset + slice.length), writeAt);
    if (slice.tag === "head" && slice.length >= 12) out.setUint32(writeAt + 8, 0);
    out.setUint32(dir + 4, tableChecksum(out, writeAt, slice.length));
    writeAt += (slice.length + 3) & ~3;
  });

  let fontSum = 0;
  for (let i = 0; i < sfnt.byteLength; i += 4) fontSum = (fontSum + out.getUint32(i)) >>> 0;
  const head = slices.findIndex((slice) => slice.tag === "head");
  if (head >= 0 && slices[head]!.length >= 12) {
    const headOffset = out.getUint32(12 + head * 16 + 8);
    out.setUint32(headOffset + 8, (0xb1b0afba - fontSum) >>> 0);
  }
  return sfnt;
}
