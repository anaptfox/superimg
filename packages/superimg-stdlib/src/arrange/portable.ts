//! Portable (JSON) encoding of an arrangement request.
//!
//! Native `arrange.*` calls accept a `MediaElement` specimen view. The
//! portable parse deliberately does not: a request that crossed a wire may
//! only name a `src`, so untrusted JSON cannot smuggle a render tree into a
//! rasterizer. That asymmetry is the trust boundary; `validatePortableSrc`
//! enforces the rest of it.

import {
  ArrangeRequestError,
  asArray,
  asRecord,
  rejectUnknownKeys,
  requiredFiniteNumber,
  requiredString,
} from "./portable-helpers.js";
import {
  ARRANGE_PATTERN_IDS,
  isArrangePatternId,
  parseSpecFor,
  type ArrangePatternId,
  type ArrangeSpecById,
} from "./portable-specs.js";
import type { SrcView } from "./types.js";

/** A portable specimen view names a source. It is never a render tree. */
export type PortableSpecimenView = SrcView;

/** Bytes travelling with a request, addressed from a spec as `asset:<id>`. */
export interface ArrangeAsset {
  readonly id: string;
  readonly mimeType: string;
  /** Base64. The door decodes; the pattern library never does. */
  readonly bytes: string;
}

/** One pattern id paired with exactly that pattern's spec. */
export type ArrangeRequest = {
  [Id in ArrangePatternId]: {
    readonly pattern: Id;
    readonly spec: ArrangeSpecById[Id];
    readonly assets?: readonly ArrangeAsset[];
    readonly editions?: Readonly<Record<string, { readonly size: { readonly width: number; readonly height: number } }>>;
  };
}[ArrangePatternId];

const REQUEST_KEYS = new Set(["pattern", "spec", "assets", "editions"]);
const ASSET_KEYS = new Set(["id", "mimeType", "bytes"]);
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function parseAsset(value: unknown, path: string): ArrangeAsset {
  const record = asRecord(value, path);
  rejectUnknownKeys(record, ASSET_KEYS, path);
  const id = requiredString(record.id, `${path}.id`);
  if (!id.trim()) {
    throw new ArrangeRequestError(`${path}.id`, `${path}.id must not be empty`);
  }
  const bytes = requiredString(record.bytes, `${path}.bytes`);
  if (!BASE64.test(bytes)) {
    throw new ArrangeRequestError(`${path}.bytes`, `${path}.bytes must be base64`);
  }
  return Object.freeze({
    id,
    mimeType: requiredString(record.mimeType, `${path}.mimeType`),
    bytes,
  });
}

function parseAssets(value: unknown): readonly ArrangeAsset[] | undefined {
  if (value === undefined) return undefined;
  const assets = asArray(value, "assets").map((asset, index) =>
    parseAsset(asset, `assets.${index}`),
  );
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.id)) {
      throw new ArrangeRequestError("assets", `Duplicate asset id '${asset.id}'`);
    }
    seen.add(asset.id);
  }
  return Object.freeze(assets);
}

/**
 * Validate untrusted JSON into an arrangement request. Shape only: a
 * well-formed request whose arrangement cannot work still has to fail through
 * the pattern's `check`, which names the broken invariant.
 */
export function parseArrangeRequest(value: unknown): ArrangeRequest {
  const root = asRecord(value, "");
  rejectUnknownKeys(root, REQUEST_KEYS, "");
  const pattern = requiredString(root.pattern, "pattern");
  if (!isArrangePatternId(pattern)) {
    throw new ArrangeRequestError(
      "pattern",
      `Unknown pattern '${pattern}'. Known patterns: ${ARRANGE_PATTERN_IDS.join(", ")}`,
    );
  }
  const assets = parseAssets(root.assets);
  const assetIds = new Set((assets ?? []).map((asset) => asset.id));
  const spec = parseSpecFor(pattern, root.spec, assetIds, "spec");
  let editions: Record<string, { size: { width: number; height: number } }> | undefined;
  if (root.editions !== undefined) {
    editions = Object.create(null) as Record<string, { size: { width: number; height: number } }>;
    for (const [id, value] of Object.entries(asRecord(root.editions, "editions"))) {
      const path = `editions.${id}`;
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) || id === "default") throw new ArrangeRequestError(path, "Edition id must be a non-reserved path segment");
      const edition = asRecord(value, path);
      rejectUnknownKeys(edition, new Set(["size"]), path);
      const size = asRecord(edition.size, `${path}.size`);
      rejectUnknownKeys(size, new Set(["width", "height"]), `${path}.size`);
      const width = requiredFiniteNumber(size.width, `${path}.size.width`);
      const height = requiredFiniteNumber(size.height, `${path}.size.height`);
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) throw new ArrangeRequestError(`${path}.size`, "Edition dimensions must be positive integers");
      editions[id] = { size: { width, height } };
    }
  }
  // `pattern` and `spec` are correlated by construction, but TypeScript widens
  // them independently across the union, so the pairing needs an assertion.
  return Object.freeze({
    pattern,
    spec,
    ...(assets === undefined ? {} : { assets }),
    ...(editions === undefined ? {} : { editions }),
  }) as ArrangeRequest;
}

export { ArrangeRequestError } from "./portable-helpers.js";
export {
  ARRANGE_PATTERN_IDS,
  isArrangePatternId,
  type ArrangePatternId,
  type ArrangeSpecById,
} from "./portable-specs.js";
