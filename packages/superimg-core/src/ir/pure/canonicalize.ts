//! Deterministic JSON canonicalize for Media IR.

import { MediaIRError } from "./errors.js";

/**
 * Volatile keys stripped only outside author-owned data bags.
 * Never strip under properties/meta/state/from/to — those may legitimately
 * use names like "timestamp" as semantic author data.
 */
const STRIP_KEYS = new Set([
  "timestamp",
  "createdAt",
  "updatedAt",
  "compiledAt",
  "sourceMap",
  "sourcemap",
  "absolutePath",
  "workspacePath",
  "tmpUrl",
  "tempUrl",
]);

/** Path segments that own free-form author maps (preserve all keys). */
const AUTHOR_DATA_SEGMENTS = new Set([
  "properties",
  "meta",
  "state",
  "from",
  "to",
  "exitTo",
  "namedStates",
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeNumber(n: number, path: string): number {
  if (!Number.isFinite(n)) {
    throw new MediaIRError("non_finite", `Non-finite number at ${path}`, { path, value: n });
  }
  // Normalize -0 → 0
  return Object.is(n, -0) ? 0 : n;
}

function normalizeString(s: string): string {
  // Normalize path separators in file-like strings; leave URLs scheme intact
  if (/^https?:\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    try {
      if (s.startsWith("http")) {
        const u = new URL(s);
        // Drop volatile query params often used for cache-busting
        u.searchParams.delete("_t");
        u.searchParams.delete("ts");
        return u.toString();
      }
    } catch {
      /* keep raw */
    }
    return s;
  }
  // Strip absolute workspace-looking prefixes from relative canonical form
  let out = s.replace(/\\/g, "/");
  // Reject embedding of absolute unix/windows paths in canonical IR strings used as paths
  return out;
}

function containsForbidden(s: string): boolean {
  if (/^\/Users\//.test(s) || /^\/home\//.test(s) || /^[A-Za-z]:\//.test(s)) return true;
  if (/blob:|tmp\/|temp\//i.test(s) && /:\/\//.test(s)) return true;
  return false;
}

/** True when path is under an author free-form map (do not strip keys). */
function inAuthorDataBag(path: string): boolean {
  // Paths include structured media fields such as "$.motions[0].from".
  const segments = path.split(".");
  for (const seg of segments) {
    const name = seg.replace(/\[\d+\]/g, "");
    if (AUTHOR_DATA_SEGMENTS.has(name)) return true;
  }
  return false;
}

function shouldStripKey(key: string, parentPath: string): boolean {
  if (!STRIP_KEYS.has(key)) return false;
  return !inAuthorDataBag(parentPath);
}

/**
 * Deep-canonicalize a JSON-compatible value:
 * - lexicographic object key sort
 * - preserve array order
 * - reject non-finite numbers
 * - normalize -0
 * - strip volatile keys (except under author data bags)
 */
export function canonicalize(value: unknown, path = "$"): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return normalizeNumber(value, path);
  if (typeof value === "string") {
    const n = normalizeString(value);
    if (containsForbidden(n) && (path.includes("src") || path.includes("path") || path.includes("sourceId"))) {
      // sourceId may be relative; absolute paths are forbidden in path-like fields
      if (/^\/|^[A-Za-z]:\//.test(n)) {
        throw new MediaIRError("invalid_type", `Absolute path not allowed at ${path}`, { path, value: n });
      }
    }
    return n;
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new MediaIRError("invalid_type", `Unsupported type at ${path}`, { path });
  }
  if (Array.isArray(value)) {
    return value.map((item, i) => canonicalize(item, `${path}[${i}]`));
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
      .filter((k) => !shouldStripKey(k, path))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = canonicalize(value[k], `${path}.${k}`);
    }
    return out;
  }
  throw new MediaIRError("invalid_type", `Unsupported value at ${path}`, { path });
}

export function canonicalizeToJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
