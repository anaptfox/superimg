//! Session-scoped local asset registry and streaming HTTP response planner.

import { createReadStream, realpathSync, statSync, type ReadStream } from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, resolve } from "node:path";

export const MIME_TYPES: Record<string, string> = {
  ".aac": "audio/aac", ".css": "text/css", ".flac": "audio/flac",
  ".gif": "image/gif", ".jpeg": "image/jpeg", ".jpg": "image/jpeg",
  ".json": "application/json", ".m4a": "audio/mp4", ".mkv": "video/x-matroska",
  ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
  ".ogg": "audio/ogg", ".png": "image/png", ".svg": "image/svg+xml",
  ".wav": "audio/wav", ".webm": "video/webm", ".webp": "image/webp",
};

export interface ByteRange { start: number; end: number }
export type ParseRangeResult =
  | { ok: true; range: ByteRange }
  | { ok: false; reason: "missing" | "invalid" | "unsatisfiable" };

export function parseRangeHeader(rangeHeader: string | undefined, fileSize: number): ParseRangeResult {
  if (!rangeHeader) return { ok: false, reason: "missing" };
  if (!rangeHeader.startsWith("bytes=") || rangeHeader.includes(",")) return { ok: false, reason: "invalid" };
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) return { ok: false, reason: "invalid" };
  if (fileSize === 0) return { ok: false, reason: "unsatisfiable" };

  const spec = rangeHeader.slice(6).trim();
  const dash = spec.indexOf("-");
  if (dash === -1) return { ok: false, reason: "invalid" };
  const startPart = spec.slice(0, dash);
  const endPart = spec.slice(dash + 1);
  let start: number;
  let end: number;
  if (startPart === "") {
    const suffix = Number(endPart);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { ok: false, reason: "invalid" };
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = Number(startPart);
    if (!Number.isSafeInteger(start) || start < 0) return { ok: false, reason: "invalid" };
    if (start >= fileSize) return { ok: false, reason: "unsatisfiable" };
    end = endPart === "" ? fileSize - 1 : Number(endPart);
    if (!Number.isSafeInteger(end) || end < start) return { ok: false, reason: "invalid" };
    end = Math.min(end, fileSize - 1);
  }
  return { ok: true, range: { start, end } };
}

interface RegisteredAsset { id: string; path: string }

/** Maps opaque session-local IDs to canonical files. Paths never cross HTTP. */
export class AssetRegistry {
  readonly #byId = new Map<string, RegisteredAsset>();
  readonly #byPath = new Map<string, RegisteredAsset>();
  readonly #maximumAssets: number;

  constructor(maximumAssets = 10_000) {
    this.#maximumAssets = Number.isFinite(maximumAssets) && maximumAssets > 0
      ? Math.floor(maximumAssets)
      : 10_000;
  }

  register(filePath: string): string {
    const canonicalPath = realpathSync(resolve(filePath));
    if (!statSync(canonicalPath).isFile()) throw new Error(`Asset is not a file: ${filePath}`);
    const existing = this.#byPath.get(canonicalPath);
    if (existing) return existing.id;
    if (this.#byId.size >= this.#maximumAssets) {
      throw new Error(`Asset registry limit exceeded (${this.#maximumAssets})`);
    }
    const asset = { id: randomUUID(), path: canonicalPath };
    this.#byId.set(asset.id, asset);
    this.#byPath.set(asset.path, asset);
    return asset.id;
  }

  resolve(id: string): string | undefined { return this.#byId.get(id)?.path }
  resolveUrl(url: string): string | undefined {
    try {
      const id = new URL(url).pathname.split("/").filter(Boolean).at(-1);
      return id ? this.resolve(id) : undefined;
    } catch {
      return undefined;
    }
  }
  clear(): void { this.#byId.clear(); this.#byPath.clear() }
  get size(): number { return this.#byId.size }
}

export interface OpenAssetOptions {
  method?: "GET" | "HEAD";
  range?: string;
  signal?: AbortSignal;
}
export interface AssetResponse {
  status: 200 | 206 | 400 | 404 | 416;
  headers: Record<string, string>;
  body?: ReadStream;
}

/** Open a registered asset without buffering it into memory. */
export function openRegisteredAsset(
  registry: AssetRegistry,
  id: string | undefined,
  options: OpenAssetOptions = {},
): AssetResponse {
  const textHeaders = { "Content-Type": "text/plain; charset=utf-8" };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: 400, headers: textHeaders };
  const filePath = registry.resolve(id);
  if (!filePath) return { status: 404, headers: textHeaders };

  let fileSize: number;
  try { fileSize = statSync(filePath).size; } catch { return { status: 404, headers: textHeaders }; }
  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
    "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
  };
  const parsed = parseRangeHeader(options.range, fileSize);
  if (!parsed.ok && parsed.reason === "unsatisfiable") {
    return { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${fileSize}` } };
  }
  if (!parsed.ok && parsed.reason === "invalid") return { status: 400, headers: baseHeaders };
  const range = parsed.ok ? parsed.range : undefined;
  const contentLength = range ? range.end - range.start + 1 : fileSize;
  const headers = {
    ...baseHeaders,
    "Content-Length": String(contentLength),
    ...(range ? { "Content-Range": `bytes ${range.start}-${range.end}/${fileSize}` } : {}),
  };
  if (options.method === "HEAD") return { status: range ? 206 : 200, headers };
  return {
    status: range ? 206 : 200,
    headers,
    body: createReadStream(filePath, {
      ...(range ? { start: range.start, end: range.end } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    }),
  };
}
