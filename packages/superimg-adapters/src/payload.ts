//! Serializable SSR / RSC payload for framework adapters.
//! @experimental Draft — only IDs, hashes, data, IR, poster — never template functions.

import type { JsonObject, MediaIR } from "@superimg/types";

/**
 * Payload safe to pass across RSC/SSR → client boundaries.
 * Must remain JSON-serializable (no functions, no class instances).
 */
export interface SerializableMediaPayload {
  schemaVersion: 0;
  sourceId: string;
  /** Optional Media IR for timeline UI without loading server renderers. */
  media?: MediaIR;
  /** Fixed-dimension poster for SSR shell. */
  poster: MediaPoster;
  /** Job / personalization data (schema-checked server-side). */
  data?: JsonObject;
}

export interface MediaPoster {
  width: number;
  height: number;
  /** Static markup or placeholder; never interactive Player. */
  html: string;
  alt?: string;
  /** Optional data URL or public asset path for a raster poster frame. */
  imageUrl?: string;
}

/** Assert a value is JSON-serializable (RSC-safe). Throws on functions/symbols. */
export function assertSerializablePayload(value: unknown, path = "$"): void {
  if (value === null || value === undefined) return;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return;
  if (t === "bigint" || t === "symbol" || t === "function") {
    throw new Error(`Non-serializable value at ${path}: ${t}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertSerializablePayload(item, `${path}[${i}]`));
    return;
  }
  if (t === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertSerializablePayload(v, `${path}.${k}`);
    }
  }
}

export function payloadFromMediaIR(
  ir: MediaIR,
  options?: {
    data?: JsonObject;
    posterHtml?: string;
    imageUrl?: string;
    alt?: string;
    includeMedia?: boolean;
  },
): SerializableMediaPayload {
  const poster = {
    width: ir.canvas.width,
    height: ir.canvas.height,
    html:
      options?.posterHtml ??
      defaultPosterHtml(ir, options?.alt ?? ir.identity.sourceId),
    ...(options?.alt ? { alt: options.alt } : { alt: ir.identity.sourceId }),
    ...(options?.imageUrl ? { imageUrl: options.imageUrl } : {}),
  };
  const payload: SerializableMediaPayload = {
    schemaVersion: 0,
    sourceId: ir.identity.sourceId,
    poster,
  };
  if (options?.data !== undefined) payload.data = options.data;
  if (options?.includeMedia !== false) payload.media = ir;
  assertSerializablePayload(payload);
  return payload;
}

function defaultPosterHtml(ir: MediaIR, alt: string): string {
  const { width, height } = ir.canvas;
  const label = escapeHtml(alt);
  // Fluid fill: parent stage owns aspect-ratio; do not force fixed px height.
  return (
    `<div data-superimg-poster="1" role="img" aria-label="${label}" ` +
    `style="position:absolute;inset:0;width:100%;height:100%;max-width:100%;` +
    `box-sizing:border-box;background:linear-gradient(135deg,#0f172a,#1e293b);` +
    `color:#e2e8f0;display:flex;align-items:center;justify-content:center;` +
    `font:600 14px/1.4 system-ui,sans-serif;padding:16px;text-align:center">` +
    `<span>${label}` +
    `<span style="display:block;font-weight:400;opacity:.7;margin-top:6px;font-size:12px">` +
    `${width}×${height}` +
    (ir.animated ? ` · ${ir.clock.durationSeconds}s` : "") +
    `</span></span></div>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
