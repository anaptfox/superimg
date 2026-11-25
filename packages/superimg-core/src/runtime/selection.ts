//! Value-only media and collection selection.

import type {
  CollectionMediaValue,
  CompositionEntryData,
  DeterministicMediaDefinition,
  JsonObject,
  TemplateModule,
} from "@superimg/types";
import { applyTemplateResolve, type ApplyTemplateResolveResult } from "../rendering/resolve-template.js";
import { prepareComposition } from "../composition/prepare.js";
import { interactiveCompositionRuntimes, time } from "../composition/time.js";
import { selectMediaDefinition } from "./selection-value.js";
import { uniqueNativeModuleSets } from "../composition/native-modules.js";
export { selectMediaDefinition } from "./selection-value.js";

export interface RuntimeCollectionEntry {
  readonly entryId: string;
  readonly data: JsonObject;
}

export interface RuntimeMediaSelection {
  readonly media: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly preparedResolve?: ApplyTemplateResolveResult;
  readonly coordinates: {
    readonly entryId?: string;
    readonly variantId: string;
    readonly editionId: string;
  };
}

/** Resolve after entry/data, variant, and edition selection; never per frame. */
export async function resolveRuntimeSelection(
  selection: RuntimeMediaSelection,
  signal?: AbortSignal,
): Promise<RuntimeMediaSelection> {
  if (selection.media.resolve === undefined) return selection;
  const applied = await applyTemplateResolve({
    ...selection.media,
    // Collection entries replace sample data; variants have already been merged.
    sample: selection.data,
  } as unknown as TemplateModule, {
    ...(signal !== undefined ? { signal } : {}),
  });
  // This selection is fulfilled. IR compilation must not invoke the hook again.
  const { resolve: _resolve, ...resolvedMedia } = applied.template;
  const media = Object.freeze(resolvedMedia) as unknown as DeterministicMediaDefinition<JsonObject>;
  return Object.freeze({
    ...selection,
    media,
    data: Object.freeze(applied.data) as JsonObject,
    preparedResolve: { ...applied, template: media as unknown as TemplateModule },
  });
}

/**
 * Materialize a retained composition for one concrete render job.
 *
 * Entry data belongs to named child occurrences. Once child resolve hooks have
 * consumed it, the timed projection receives an empty root payload so the
 * occurrence data cannot be applied a second time during frame rendering.
 */
export async function prepareRuntimeCompositionSelection(
  selection: RuntimeMediaSelection,
  options: {
    readonly size: Readonly<{ width: number; height: number }>;
    readonly fps: number;
    readonly signal?: AbortSignal;
  },
): Promise<RuntimeMediaSelection> {
  const prepared = await prepareRuntimeCompositionMedia(selection.media, selection.data, options);
  if (prepared === undefined) return selection;
  return Object.freeze({ ...selection, ...prepared });
}

/** Internal composition preflight shared by render plans, IR, and adapters. */
export async function prepareRuntimeCompositionMedia(
  media: DeterministicMediaDefinition<JsonObject>,
  data: JsonObject,
  options: {
    readonly size: Readonly<{ width: number; height: number }>;
    readonly fps: number;
    readonly signal?: AbortSignal;
  },
): Promise<{ readonly media: DeterministicMediaDefinition<JsonObject>; readonly data: JsonObject } | undefined> {
  const composition = media.composition;
  if (composition === undefined) return undefined;
  const interactiveRuntimes = Object.fromEntries(interactiveCompositionRuntimes(media).map(({ path, runtime }) => [path, runtime]));
  const prepared = await prepareComposition(composition.program, {
    size: options.size,
    fps: options.fps,
    ...(composition.schedule.selectedRoutes !== undefined
      ? { routes: composition.schedule.selectedRoutes }
      : {}),
    data: data as CompositionEntryData,
    ...(Object.keys(interactiveRuntimes).length ? { interactiveRuntimes } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  const projectedMedia = time(prepared.program, {
    size: options.size,
    fps: options.fps,
    routes: prepared.plan.selectedRoutes,
  }) as unknown as DeterministicMediaDefinition<JsonObject>;
  // The source compiler and artifact reader can attach prepared closures and
  // qualified, frozen resources at the projection root. Re-planning children
  // must not discard those host-owned resources.
  const nativeModuleSets = uniqueNativeModuleSets([
    ...(projectedMedia.config?.nativeModuleSets ?? []),
    ...(media.config?.nativeModuleSets ?? []),
  ]);
  const config = Object.freeze({
    ...projectedMedia.config,
    ...(media.config?.assets === undefined ? {} : { assets: media.config.assets }),
    ...(media.config?.fonts === undefined ? {} : { fonts: media.config.fonts }),
    ...(media.config?.audio === undefined ? {} : { audio: media.config.audio }),
    ...(nativeModuleSets.length ? { nativeModuleSets } : {}),
  });
  return Object.freeze({
    media: Object.freeze({ ...projectedMedia, config }) as DeterministicMediaDefinition<JsonObject>,
    data: Object.freeze({}) as JsonObject,
  });
}

type RuntimeCollection = CollectionMediaValue;

export function isDeterministicMediaValue(
  value: unknown,
): value is DeterministicMediaDefinition<JsonObject> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; media?: unknown; render?: unknown };
  return candidate.kind === "media" &&
    (candidate.media === "video" || candidate.media === "image" || candidate.media === "svg") &&
    typeof candidate.render === "function";
}

export function isCollectionMediaValue(value: unknown): value is RuntimeCollection {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; media?: unknown; entries?: unknown };
  return candidate.kind === "collection" &&
    isDeterministicMediaValue(candidate.media) &&
    (Array.isArray(candidate.entries) || typeof candidate.entries === "function");
}

export function isInteractiveMediaValue(value: unknown): value is {
  readonly kind: "interactive";
  readonly guide: unknown;
  readonly render: (...args: never[]) => unknown;
  readonly sample?: unknown;
  readonly size?: { readonly width: number; readonly height: number };
} {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { kind?: unknown; guide?: unknown; render?: unknown };
  return candidate.kind === "interactive" &&
    candidate.guide !== undefined &&
    typeof candidate.render === "function";
}

export function staticCollectionEntries(collection: RuntimeCollection): RuntimeCollectionEntry[] | null {
  if (!Array.isArray(collection.entries)) return null;
  return normalizeCollectionEntries(collection, collection.entries);
}

export function normalizeCollectionEntries(
  collection: RuntimeCollection,
  entries: readonly unknown[],
): RuntimeCollectionEntry[] {
  const resolver = (collection as RuntimeCollection & {
    readonly entryId?: string | ((entry: Readonly<Record<string, unknown>>) => string);
  }).entryId;
  const seen = new Set<string>();
  const normalized: RuntimeCollectionEntry[] = [];

  for (const raw of entries) {
    if (!isJsonObject(raw)) {
      throw new TypeError("Collection entries must be JSON-compatible objects");
    }
    const entryId = resolveEntryId(raw, resolver);
    assertEntryId(entryId);
    if (seen.has(entryId)) {
      throw new TypeError(`Collection entry id is duplicated: ${JSON.stringify(entryId)}`);
    }
    seen.add(entryId);
    normalized.push(Object.freeze({ entryId, data: raw }));
  }
  return normalized;
}

function resolveEntryId(
  entry: JsonObject,
  resolver: string | ((entry: Readonly<Record<string, unknown>>) => string) | undefined,
): string {
  if (typeof resolver === "function") return resolver(entry);
  const key = resolver ?? "id";
  const value = entry[key];
  if (typeof value !== "string") {
    throw new TypeError(
      `Collection entry identity field ${JSON.stringify(key)} must contain a string`,
    );
  }
  return value;
}

function assertEntryId(entryId: string): void {
  if (entryId.length === 0 || entryId === "." || entryId === ".." || /[\\/\0]/.test(entryId)) {
    throw new TypeError(`Collection entry id is unsafe: ${JSON.stringify(entryId)}`);
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return isJsonValue(value, new WeakSet<object>());
}

function isJsonValue(value: unknown, seen: WeakSet<object>): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, seen))
    : (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
      Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

export function selectRuntimeMedia(
  value: DeterministicMediaDefinition<JsonObject> | RuntimeCollection,
  options: {
    readonly data?: JsonObject;
    readonly entryId?: string;
    readonly variant?: string;
    readonly edition?: string;
  },
  resolvedEntries?: readonly RuntimeCollectionEntry[],
): RuntimeMediaSelection {
  const collection = isCollectionMediaValue(value) ? value : undefined;
  const media = (collection?.media ?? value) as DeterministicMediaDefinition<JsonObject>;
  let entry: RuntimeCollectionEntry | undefined;

  if (collection) {
    const entries = resolvedEntries ?? staticCollectionEntries(collection);
    if (entries === null) {
      throw new TypeError("Collection provider entries have not been resolved by this runtime");
    }
    if (options.data !== undefined) {
      throw new TypeError("Runtime data cannot replace a collection entry; select entryId instead");
    }
    if (options.entryId !== undefined) {
      entry = entries.find((candidate) => candidate.entryId === options.entryId);
      if (!entry) throw new TypeError(`Unknown collection entry ${JSON.stringify(options.entryId)}`);
    } else if (entries.length === 1) {
      entry = entries[0];
    } else {
      throw new TypeError("Rendering a collection requires entryId unless it has exactly one entry");
    }
  } else if (options.entryId !== undefined) {
    throw new TypeError("entryId is only valid for collection media");
  }

  const variantId = options.variant ?? "default";
  const editionId = options.edition ?? "default";
  const selectedMedia = selectMediaDefinition(media, {
    variantId, editionId,
    ...(entry !== undefined ? { entryData: entry.data } : {}),
    ...(options.data !== undefined ? { data: options.data } : {}),
  });
  const data = selectedMedia.sample as JsonObject;

  return Object.freeze({
    media: selectedMedia,
    data,
    coordinates: Object.freeze({
      ...(entry !== undefined ? { entryId: entry.entryId } : {}),
      variantId,
      editionId,
    }),
  });
}
