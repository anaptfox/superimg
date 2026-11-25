/** Small SFNT byte reader/writer usable in Node, browsers, and edge hosts. */
class ByteBuffer extends Uint8Array {
  static alloc(length: number): ByteBuffer { return new ByteBuffer(length); }
  static own(bytes: Uint8Array): ByteBuffer { return new ByteBuffer(bytes); }
  subbytes(start: number, end: number): ByteBuffer { return ByteBuffer.own(this.subarray(start, end)); }
  static ascii(value: string): ByteBuffer {
    const out = new ByteBuffer(value.length);
    for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff;
    return out;
  }
  static concat(parts: readonly Uint8Array[]): ByteBuffer {
    const result = new ByteBuffer(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  readUInt16BE(offset: number): number { return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint16(offset); }
  readUInt32BE(offset: number): number { return new DataView(this.buffer, this.byteOffset, this.byteLength).getUint32(offset); }
  writeUInt16BE(value: number, offset: number): void { new DataView(this.buffer, this.byteOffset, this.byteLength).setUint16(offset, value); }
  writeUInt32BE(value: number, offset: number): void { new DataView(this.buffer, this.byteOffset, this.byteLength).setUint32(offset, value); }
  copy(target: Uint8Array, targetStart = 0, start = 0, end = this.length): void { target.set(this.subarray(start, end), targetStart); }
  write(value: string, start: number, length: number, _encoding: "ascii"): void {
    for (let i = 0; i < length; i++) this[start + i] = value.charCodeAt(i) & 0xff;
  }
  toString(encoding?: "ascii", start = 0, end = this.length): string {
    if (encoding !== "ascii") return super.toString();
    let text = "";
    for (let i = start; i < end; i++) text += String.fromCharCode(this[i]! & 0x7f);
    return text;
  }
}

/**
 * Prepare a private SFNT copy for resvg, whose font database reads the family
 * from the font rather than the @font-face declaration. The original bytes
 * remain the resource identity and are never changed.
 *
 * Format-1 name tables use the browser until their rendering can be preserved.
 */
export class UnsupportedSvgFontAliasError extends TypeError {}

/** Preserve owned input; browsers need a standalone face for multi-face collections. */
export function prepareBrowserFontFace(bytes: Uint8Array, face: { family: string; weight?: number; style?: "normal" | "italic"; mimeType: string }): { bytes: Uint8Array; mimeType: string } {
  if (face.mimeType !== "font/collection" || bytes.length < 12 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8) <= 1) {
    return { bytes, mimeType: face.mimeType };
  }
  let selected: Uint8Array;
  try {
    selected = aliasSvgFont(bytes, face.family, face.weight ?? 400, face.style ?? "normal");
  } catch (error) {
    if (error instanceof UnsupportedSvgFontAliasError) throw new TypeError("Font collections with unsupported face metadata cannot be selected reliably; provide a standalone font", { cause: error });
    throw error;
  }
  const magic = new DataView(selected.buffer, selected.byteOffset, selected.byteLength).getUint32(0);
  return { bytes: selected, mimeType: magic === 0x4f54544f ? "font/otf" : "font/ttf" };
}

/** Extract one collection face; TTC table offsets are relative to the collection. */
function collectionFace(source: ByteBuffer, offset: number): { bytes: ByteBuffer; weight: number; italic: boolean } {
  const fail = () => { throw new TypeError("Invalid SVG font collection"); };
  if (offset > source.length - 12) return fail();
  const count = source.readUInt16BE(offset + 4);
  if (!count || count > (source.length - offset - 12) / 16) return fail();
  const tables: { tag: string; data: ByteBuffer }[] = [];
  for (let i = 0; i < count; i++) {
    const pos = offset + 12 + i * 16, tag = source.toString("ascii", pos, pos + 4);
    const start = source.readUInt32BE(pos + 8), length = source.readUInt32BE(pos + 12);
    if (start > source.length || length > source.length - start || tables.some(table => table.tag === tag)) return fail();
    tables.push({ tag, data: source.subbytes(start, start + length) });
  }
  const os2 = tables.find(table => table.tag === "OS/2")?.data;
  if (!os2 || os2.length < 64 || tables.some(table => table.tag === "fvar")) {
    throw new UnsupportedSvgFontAliasError("SVG collection face metadata requires browser rendering");
  }
  const directorySize = 12 + count * 16;
  const total = directorySize + tables.reduce((sum, table) => sum + Math.ceil(table.data.length / 4) * 4, 0);
  if (!Number.isSafeInteger(total) || total > 0xffffffff) return fail();
  const bytes = ByteBuffer.alloc(total);
  source.copy(bytes, 0, offset, offset + directorySize);
  let cursor = directorySize;
  for (let i = 0; i < count; i++) {
    const table = tables[i]!;
    table.data.copy(bytes, cursor);
    bytes.writeUInt32BE(cursor, 12 + i * 16 + 8);
    cursor += Math.ceil(table.data.length / 4) * 4;
  }
  return { bytes, weight: os2.readUInt16BE(4), italic: (os2.readUInt16BE(62) & 1) !== 0 };
}

function selectCollectionFace(source: ByteBuffer, weight: number, style: "normal" | "italic"): ByteBuffer {
  const fail = () => { throw new TypeError("Invalid SVG font collection"); };
  if (source.length < 16) return fail();
  const count = source.readUInt32BE(8);
  if (!count || count > (source.length - 12) / 4) return fail();
  const faces = Array.from({ length: count }, (_, index) => collectionFace(source, source.readUInt32BE(12 + index * 4)));
  // CSS Fonts face matching searches 400–500 toward 500 before searching
  // lighter faces; outside that interval it searches outward from the request.
  const rank = (face: typeof faces[number]): [number, number, number] => {
    const w = face.weight;
    const group = weight >= 400 && weight <= 500
      ? w >= weight && w <= 500 ? 0 : w < weight ? 1 : 2
      : weight < 400 ? w <= weight ? 0 : 1 : w >= weight ? 0 : 1;
    return [face.italic === (style === "italic") ? 0 : 1, group, Math.abs(w - weight)];
  };
  faces.sort((a, b) => {
    const left = rank(a), right = rank(b);
    return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
  });
  return faces[0]!.bytes;
}

export function aliasSvgFont(input: Uint8Array, family: string, weight = 400, style: "normal" | "italic" = "normal"): Uint8Array {
  let source: ByteBuffer = ByteBuffer.own(input);
  const fail = () => { throw new TypeError("Invalid or unsupported SVG font data"); };
  if (source.length < 12) return fail();
  const signature = source.readUInt32BE(0);
  if (signature === 0x74746366) {
    source = selectCollectionFace(source, weight, style);
  } else if (![0x00010000, 0x4f54544f, 0x74727565].includes(signature)) return fail();
  const count = source.readUInt16BE(4);
  if (!count || 12 + count * 16 > source.length) return fail();
  const tables: { tag: string; bytes: ByteBuffer }[] = [];
  for (let i = 0; i < count; i++) {
    const pos = 12 + 16 * i;
    const tag = source.toString("ascii", pos, pos + 4);
    const offset = source.readUInt32BE(pos + 8), length = source.readUInt32BE(pos + 12);
    if (offset > source.length || length > source.length - offset || tables.some(table => table.tag === tag)) return fail();
    tables.push({ tag, bytes: source.subbytes(offset, offset + length) });
  }
  const names = tables.find(table => table.tag === "name"), head = tables.find(table => table.tag === "head");
  if (!names || !head || names.bytes.length < 6 || head.bytes.length < 12) return fail();
  // Variable face selection depends on axis coordinates, not just OS/2 bits.
  // Leave that mapping to the browser until the native path supports it.
  if (tables.some(table => table.tag === "fvar")) throw new UnsupportedSvgFontAliasError("Variable SVG fonts require browser rendering");
  const os2 = tables.find(table => table.tag === "OS/2");
  if (!os2 || os2.bytes.length < 64 || head.bytes.length < 46 || !Number.isInteger(weight) || weight < 1 || weight > 1000) {
    throw new UnsupportedSvgFontAliasError("SVG font face metadata requires browser rendering");
  }
  // resvg chooses a face from font metadata, while the browser uses the
  // declaration. Align the private copy's selection metadata with the host.
  os2.bytes.writeUInt16BE(weight, 4);
  const bold = weight >= 700, italic = style === "italic";
  let selection = os2.bytes.readUInt16BE(62) & ~((1 << 0) | (1 << 5) | (1 << 6) | (1 << 9));
  if (italic) selection |= 1 << 0;
  if (bold) selection |= 1 << 5;
  if (!bold && !italic) selection |= 1 << 6;
  os2.bytes.writeUInt16BE(selection, 62);
  let macStyle = head.bytes.readUInt16BE(44) & ~3;
  if (bold) macStyle |= 1;
  if (italic) macStyle |= 2;
  head.bytes.writeUInt16BE(macStyle, 44);
  const data = names.bytes, records = data.readUInt16BE(2), start = data.readUInt16BE(4);
  const format = data.readUInt16BE(0), entriesEnd = 6 + 12 * records;
  if (format === 1) throw new UnsupportedSvgFontAliasError("SVG fonts with format-1 name tables require browser rendering");
  if (format !== 0 || entriesEnd > data.length || start < entriesEnd || start > data.length) return fail();
  const entries = data.subbytes(6, 6 + 12 * records);
  const values: ByteBuffer[] = [];
  let size = 0;
  for (let i = 0; i < records; i++) {
    const pos = i * 12, platform = entries.readUInt16BE(pos), id = entries.readUInt16BE(pos + 6);
    const length = entries.readUInt16BE(pos + 8), offset = entries.readUInt16BE(pos + 10);
    if (offset > data.length - start || length > data.length - start - offset) return fail();
    let value = data.subbytes(start + offset, start + offset + length);
    if ([1, 4, 6, 16, 21].includes(id)) {
      if (platform === 0 || platform === 3) {
        value = ByteBuffer.alloc(family.length * 2);
        for (let j = 0; j < family.length; j++) value.writeUInt16BE(family.charCodeAt(j), j * 2);
      } else if (platform === 1 && /^[\x20-\x7e]+$/.test(family)) value = ByteBuffer.ascii(family);
      else throw new UnsupportedSvgFontAliasError("This SVG font alias requires browser rendering for its name encoding");
    }
    if (size + value.length > 0xffff) return fail();
    entries.writeUInt16BE(value.length, pos + 8);
    entries.writeUInt16BE(size, pos + 10);
    size += value.length;
    values.push(value);
  }
  if (6 + entries.length > 0xffff) return fail();
  const header = ByteBuffer.alloc(6);
  header.writeUInt16BE(format, 0);
  header.writeUInt16BE(records, 2);
  header.writeUInt16BE(6 + entries.length, 4);
  names.bytes = ByteBuffer.concat([header, entries, ...values]);
  head.bytes.writeUInt32BE(0, 8);
  const directorySize = 12 + count * 16;
  const total = directorySize + tables.reduce((n, table) => n + ((table.bytes.length + 3) & ~3), 0);
  if (!Number.isSafeInteger(total) || total > 0xffffffff) return fail();
  const output = ByteBuffer.alloc(total);
  source.copy(output, 0, 0, 12);
  let offset = directorySize, headOffset = 0;
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i]!, pos = 12 + i * 16, padded = (table.bytes.length + 3) & ~3;
    output.write(table.tag, pos, 4, "ascii");
    table.bytes.copy(output, offset);
    let checksum = 0;
    for (let j = 0; j < padded; j += 4) checksum = (checksum + output.readUInt32BE(offset + j)) >>> 0;
    output.writeUInt32BE(checksum, pos + 4);
    output.writeUInt32BE(offset, pos + 8);
    output.writeUInt32BE(table.bytes.length, pos + 12);
    if (table.tag === "head") headOffset = offset;
    offset += padded;
  }
  let checksum = 0;
  for (let i = 0; i < output.length; i += 4) checksum = (checksum + output.readUInt32BE(i)) >>> 0;
  output.writeUInt32BE((0xb1b0afba - checksum) >>> 0, headOffset + 8);
  return output;
}
