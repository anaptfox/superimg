//! Local asset HTTP handler with byte-range support for video seeking.

import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";

export const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const RANGEABLE_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".mkv",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
]);

export interface ByteRange {
  start: number;
  end: number;
}

export type ParseRangeResult =
  | { ok: true; range: ByteRange }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unsatisfiable" };

/** Parse an HTTP Range header against a file size. */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  fileSize: number,
): ParseRangeResult {
  if (!rangeHeader?.startsWith("bytes=")) {
    return { ok: false, reason: "missing" };
  }

  const spec = rangeHeader.slice("bytes=".length).trim();
  const dash = spec.indexOf("-");
  if (dash === -1) return { ok: false, reason: "invalid" };

  const startPart = spec.slice(0, dash);
  const endPart = spec.slice(dash + 1);

  let start: number;
  let end: number;

  if (startPart === "") {
    // suffix: bytes=-500
    const suffix = Number(endPart);
    if (!Number.isInteger(suffix) || suffix <= 0) return { ok: false, reason: "invalid" };
    if (suffix >= fileSize) {
      start = 0;
      end = fileSize - 1;
    } else {
      start = fileSize - suffix;
      end = fileSize - 1;
    }
  } else {
    start = Number(startPart);
    if (!Number.isInteger(start) || start < 0) return { ok: false, reason: "invalid" };
    if (start >= fileSize) return { ok: false, reason: "unsatisfiable" };
    end = endPart === "" ? fileSize - 1 : Number(endPart);
    if (!Number.isInteger(end) || end < start) return { ok: false, reason: "invalid" };
    end = Math.min(end, fileSize - 1);
  }

  return { ok: true, range: { start, end } };
}

export function isRangeableExtension(ext: string): boolean {
  return RANGEABLE_EXTENSIONS.has(ext.toLowerCase());
}

export interface AssetServeResult {
  status: 200 | 206 | 400 | 404 | 416;
  headers: Record<string, string>;
  body: Uint8Array;
}

export function serveAssetFile(
  filePath: string | undefined,
  rangeHeader?: string,
): AssetServeResult {
  if (!filePath) {
    return { status: 400, headers: { "Content-Type": "text/plain" }, body: new TextEncoder().encode("Missing path parameter") };
  }
  if (!existsSync(filePath)) {
    return {
      status: 404,
      headers: { "Content-Type": "text/plain" },
      body: new TextEncoder().encode(`File not found: ${filePath}`),
    };
  }

  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  const data = readFileSync(filePath);
  const fileSize = data.length;

  const baseHeaders: Record<string, string> = {
    "Content-Type": mimeType,
    // The render page (via page.setContent) has a null origin, so assets are
    // cross-origin. Preload probes and fetches require CORS headers.
    "Access-Control-Allow-Origin": "*",
  };

  if (!isRangeableExtension(ext)) {
    return {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(fileSize) },
      body: data,
    };
  }

  baseHeaders["Accept-Ranges"] = "bytes";

  const parsed = parseRangeHeader(rangeHeader, fileSize);
  if (!parsed.ok) {
    if (parsed.reason === "unsatisfiable") {
      return {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${fileSize}`,
        },
        body: new Uint8Array(),
      };
    }
    return {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(fileSize) },
      body: data,
    };
  }

  const { start, end } = parsed.range;
  const chunk = data.subarray(start, end + 1);
  return {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    },
    body: chunk,
  };
}