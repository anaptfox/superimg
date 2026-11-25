//! Deterministic collection authoring contracts.
//!
//! A collection runs one media definition against a complete, finite entry
//! snapshot. Entry providers are server-only and are projected out before any
//! browser program is bundled.

import type { DeterministicMediaDefinition } from "./define.js";
import type { JsonCompatible } from "./json.js";

export type CollectionEntryProvider<TEntry extends object> = () =>
  | readonly JsonCompatible<TEntry>[]
  | Promise<readonly JsonCompatible<TEntry>[]>;

export type CollectionEntries<TEntry extends object> =
  | readonly JsonCompatible<TEntry>[]
  | CollectionEntryProvider<TEntry>;

type RequiredStringKey<TEntry extends object> = {
  [K in keyof TEntry]-?: TEntry extends Record<K, string> ? K : never;
}[keyof TEntry] & string;

export type CollectionEntryIdResolver<TEntry extends object> =
  | RequiredStringKey<TEntry>
  | ((entry: Readonly<TEntry>) => string);

type CollectionIdentity<TEntry extends object> = "id" extends RequiredStringKey<TEntry>
  ? { entryId?: CollectionEntryIdResolver<TEntry> }
  : { entryId: CollectionEntryIdResolver<TEntry> };

export type CollectionInput<
  TEntry extends object,
  TMedia extends DeterministicMediaDefinition<TEntry>,
> = CollectionIdentity<TEntry> & {
  entries: CollectionEntries<TEntry>;
  media: TMedia;
};

/** Server-aware top-level declaration; never valid as another collection's media. */
export type CollectionDefinition<
  TEntry extends object,
  TMedia extends DeterministicMediaDefinition<TEntry>,
> = CollectionInput<TEntry, TMedia> & {
  readonly kind: "collection";
};

/**
 * Run one deterministic media definition against a static array or one
 * zero-argument sync/async provider. The raw entry is passed unchanged to
 * `ctx.data`; identity is resolved separately.
 */
export function collection<
  TEntry extends object,
  TMedia extends DeterministicMediaDefinition<TEntry>,
>(input: CollectionInput<TEntry, TMedia>): CollectionDefinition<TEntry, TMedia> {
  if (input.media.kind !== "media") {
    throw new TypeError("collection() requires deterministic media");
  }
  return { kind: "collection", ...input };
}

export interface CollectionEntryItem<TEntry extends object> {
  readonly id: string;
  readonly data: JsonCompatible<TEntry>;
}

/**
 * Synchronously resolve static entries of a `collection()` into `{ id, data }` pairs.
 * Returns `null` when the collection uses a server-only provider function.
 */
export function listCollectionEntries<
  TEntry extends object,
  TMedia extends DeterministicMediaDefinition<TEntry>,
>(
  definition: CollectionDefinition<TEntry, TMedia>,
): readonly CollectionEntryItem<TEntry>[] | null {
  if (!Array.isArray(definition.entries)) return null;
  const resolver = (definition as { entryId?: CollectionEntryIdResolver<TEntry> }).entryId;
  const seen = new Set<string>();
  return definition.entries.map((entry) => {
    const rawId =
      typeof resolver === "function"
        ? resolver(entry as Readonly<TEntry>)
        : typeof resolver === "string"
          ? (entry as Record<string, unknown>)[resolver]
          : (entry as Record<string, unknown>).id;
    if (typeof rawId !== "string" || rawId.length === 0) {
      throw new TypeError("Collection entry id must be a non-empty string");
    }
    if (seen.has(rawId)) {
      throw new TypeError(`Duplicate collection entry id: ${JSON.stringify(rawId)}`);
    }
    seen.add(rawId);
    return Object.freeze({ id: rawId, data: entry });
  });
}
