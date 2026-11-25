//! Portable byte ownership for runtime render and export results.
//!
//! This module deliberately uses only web platform primitives. Platform
//! adapters may spool while they work, but bytes crossing into the value
//! runtime are copied so the result outlives both the adapter and the runtime.

import { sha256Hex } from "../ir/pure/sha256.js";

const MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:\s*;[^\r\n]+)?$/i;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ENCODED_SEPARATOR = /%(?:2f|5c)/i;

/** Validate and return the canonical portable artifact path. */
export function assertPortableArtifactPath(path: string): string {
  if (
    path.length === 0 ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes(":") ||
    /[\u0000-\u001f\u007f]/.test(path) ||
    URL_SCHEME.test(path) ||
    ENCODED_SEPARATOR.test(path)
  ) {
    throw new TypeError(`Artifact path must be a normalized relative path: ${JSON.stringify(path)}`);
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new TypeError(`Artifact path must not contain empty, dot, or parent segments: ${JSON.stringify(path)}`);
  }

  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new TypeError(`Artifact path contains invalid percent encoding: ${JSON.stringify(path)}`);
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes(":") ||
      decoded.includes("?") ||
      decoded.includes("#") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) {
      throw new TypeError(`Artifact path contains an encoded traversal segment: ${JSON.stringify(path)}`);
    }
  }

  return path;
}

export function assertMimeType(mimeType: string): string {
  if (!MIME_TYPE.test(mimeType)) {
    throw new TypeError(`Artifact MIME type is invalid: ${JSON.stringify(mimeType)}`);
  }
  return mimeType;
}

/** Immutable validation result used before any public result becomes visible. */
export interface VerifiedBytes {
  readonly bytes: Uint8Array;
  readonly byteLength: number;
  readonly sha256: string;
}

/** Copy and validate bytes. A failed validation never exposes the owned copy. */
export function verifyAndOwnBytes(
  input: Uint8Array,
  expected?: { readonly byteLength?: number; readonly sha256?: string },
): VerifiedBytes {
  // Buffer.slice() aliases its input; a typed-array copy also respects view offsets.
  const bytes = new Uint8Array(input);
  const byteLength = bytes.byteLength;
  const sha256 = sha256Hex(bytes);

  if (expected?.byteLength !== undefined && expected.byteLength !== byteLength) {
    bytes.fill(0);
    throw new TypeError(
      `Artifact byte length mismatch: declared ${expected.byteLength}, received ${byteLength}`,
    );
  }
  if (expected?.sha256 !== undefined && expected.sha256.toLowerCase() !== sha256) {
    bytes.fill(0);
    throw new TypeError(
      `Artifact SHA-256 mismatch: declared ${expected.sha256}, computed ${sha256}`,
    );
  }

  return Object.freeze({ bytes, byteLength, sha256 });
}

/** A new, independent stream for every read. */
export function streamOwnedBytes(bytes: Uint8Array): ReadableStream<Uint8Array> {
  const snapshot = new Uint8Array(bytes);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(snapshot);
      controller.close();
    },
  });
}

export async function readByteStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== undefined) {
        const copy = new Uint8Array(value);
        chunks.push(copy);
        length += copy.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
