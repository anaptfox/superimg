//! Next App Router client/server boundary constants.

/**
 * Packages that must never appear in Client Component import graphs.
 * Fixtures and lint rules assert against this list.
 */
export const NEXT_CLIENT_FORBIDDEN = [
  "@foxworth/superimg-cli",
  "@superimg/playwright",
  "playwright",
  "sharp",
  "@mediabunny/server",
  "node:fs",
  "node:child_process",
] as const;

/** Allowed serializable field names on RSC → Client Component props. */
export const RSC_SAFE_PROP_KEYS = [
  "schemaVersion",
  "sourceId",
  "media",
  "poster",
  "data",
] as const;
