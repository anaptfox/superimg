import { bytesDataUrl } from "../shared/base64.js";

/** @font-face rule pointing at an already-frozen font URL (usually a data URL). */
export function fontFaceCss(
  face: { family: string; weight?: number; style?: "normal" | "italic"; mimeType?: string },
  url: string,
): string {
  const family = face.family.replace(/["\\]/g, "\\$&");
  const mime = face.mimeType;
  const format = mime === undefined ? undefined
    : mime === "font/otf" ? "opentype"
    : mime === "font/woff2" ? "woff2"
    : mime === "font/woff" ? "woff"
    : mime === "font/collection" ? "collection"
    : "truetype";
  const source = url.replace(/["\\\n\r\f]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
  return `@font-face{font-family:"${family}";font-style:${face.style ?? "normal"};font-weight:${face.weight ?? 400};src:url("${source}")${format ? ` format("${format}")` : ""};font-display:block}`;
}

export function fontMimeType(data: Uint8Array): "font/ttf" | "font/otf" | "font/woff" | "font/woff2" | "font/collection" {
  const magic = data.byteLength >= 4
    ? new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0)
    : 0;
  if (magic === 0x774f4646) return "font/woff";
  if (magic === 0x774f4632) return "font/woff2";
  if (magic === 0x74746366) return "font/collection";
  return magic === 0x4f54544f ? "font/otf" : "font/ttf";
}

export function fontBytesDataUrl(bytes: Uint8Array, mimeType: string): string {
  return bytesDataUrl(bytes, mimeType);
}
