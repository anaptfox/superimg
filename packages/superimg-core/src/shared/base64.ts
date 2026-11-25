/** Encode a byte view without a byte-by-byte, whole-payload string rope.
 * Chunk boundaries are multiples of three so only the last chunk has padding.
 * The bounded fallback keeps runtimes without the Web Platform btoa supported.
 */
export function encodeBase64(bytes: Uint8Array): string {
  // Use the runtime intrinsic on the original view: native implementations
  // avoid both the temporary binary strings and per-byte JavaScript work.
  const native = (Uint8Array.prototype as Uint8Array & {
    toBase64?: (this: Uint8Array) => string;
  }).toBase64;
  if (typeof native === "function") return native.call(bytes);
  const chunks: string[] = [];
  const chunkBytes = 24_576;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let offset = 0; offset < bytes.byteLength; offset += chunkBytes) {
    const end = Math.min(offset + chunkBytes, bytes.byteLength);
    if (typeof btoa === "function") {
      chunks.push(btoa(Reflect.apply(String.fromCharCode, undefined, bytes.subarray(offset, end))));
      continue;
    }
    let chunk = "";
    for (let index = offset; index < end; index += 3) {
      const packed = ((bytes[index] ?? 0) << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
      chunk += alphabet[(packed >>> 18) & 63];
      chunk += alphabet[(packed >>> 12) & 63];
      chunk += index + 1 < end ? alphabet[(packed >>> 6) & 63] : "=";
      chunk += index + 2 < end ? alphabet[packed & 63] : "=";
    }
    chunks.push(chunk);
  }
  return chunks.join("");
}

/** MIME validation belongs to the caller's resource contract. */
export function bytesDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${encodeBase64(bytes)}`;
}
