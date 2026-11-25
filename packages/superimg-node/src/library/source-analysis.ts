import { analyzeMediaSourceFindings } from "@superimg/core/source-analysis";
import type {
  CollectionDefinition,
  DeterministicMediaDefinition,
  JsonObject,
  MediaValue,
} from "@superimg/types";
import type { MediaCollectionSnapshot } from "./snapshot.js";
import { materializeNodeMediaAssets } from "./assets.js";
import { normalizeProjectRoot, type ResolvedMediaSource } from "./project.js";
import {
  compileNodeMediaSource,
  assertPreparedMediaSource,
  type CompiledNodeMediaSource,
  type LoadedNodeMediaValue,
  type NodeMediaAuthoringOptions,
} from "./source.js";
import { assertSnapshotCurrent, snapshotCollection } from "./provider.js";

export type PreparedNodeMediaAnalysis = Readonly<{
  compiled: CompiledNodeMediaSource;
  value: MediaValue;
}>;

/**
 * Prepare a value for check/inspect without ever invoking a provider. Static
 * collections and explicit snapshots are frozen; unresolved providers remain
 * provider-shaped so the runtime can report them as deferred.
 */
export async function prepareNodeMediaAnalysis(
  projectRoot: string,
  source: ResolvedMediaSource,
  options: NodeMediaAuthoringOptions & Readonly<{
    snapshot?: MediaCollectionSnapshot;
    signal?: AbortSignal;
    /** @internal Trusted fully materialized command value, including host config. */
    loaded?: LoadedNodeMediaValue;
  }> = {},
): Promise<PreparedNodeMediaAnalysis> {
  const root = normalizeProjectRoot(projectRoot);
  if (options.loaded !== undefined) {
    assertPreparedMediaSource(options.loaded, source);
    if (options.snapshot !== undefined) {
      if (options.loaded.descriptor.kind !== "collection") {
        throw new Error("A collection snapshot is only valid for collection sources");
      }
      assertSnapshotCurrent(options.snapshot, options.loaded.descriptor, source, root);
      if (options.loaded.snapshot?.snapshotDigest !== options.snapshot.snapshotDigest) {
        throw new Error("Prepared media value does not match the requested collection snapshot");
      }
    }
    return Object.freeze({ compiled: options.loaded, value: options.loaded.value });
  }
  const compiled = await compileNodeMediaSource(root, source, options);
  if (compiled.compiled.interactive) {
    if (options.snapshot !== undefined) {
      throw new Error("A collection snapshot is only valid for collection sources");
    }
    return Object.freeze({ compiled, value: compiled.compiled.interactive });
  }
  if (!compiled.compiled.media) throw new Error(`Media source did not compile: ${source.relativePath}`);
  const media = await materializeNodeMediaAssets(
    compiled.compiled.media as DeterministicMediaDefinition<JsonObject>,
    source.templatePath,
    root,
    options.signal,
  );
  if (compiled.descriptor.kind !== "collection") {
    if (options.snapshot !== undefined) {
      throw new Error("A collection snapshot is only valid for collection sources");
    }
    return Object.freeze({ compiled, value: media });
  }
  if (options.snapshot !== undefined) {
    assertSnapshotCurrent(options.snapshot, compiled.descriptor, source, root);
    return Object.freeze({
      compiled,
      value: frozenCollection(media, options.snapshot),
    });
  }
  if (compiled.descriptor.entries.kind === "static") {
    const snapshot = await snapshotCollection(compiled.descriptor, source, root, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return Object.freeze({ compiled, value: frozenCollection(media, snapshot) });
  }
  const deferredEntries = async (): Promise<readonly JsonObject[]> => {
    throw new Error("Collection providers are unavailable during source analysis");
  };
  const value = Object.freeze({
    kind: "collection" as const,
    entries: deferredEntries,
    media,
  }) as CollectionDefinition<JsonObject, DeterministicMediaDefinition<JsonObject>>;
  return Object.freeze({ compiled, value });
}

function frozenCollection(
  media: DeterministicMediaDefinition<JsonObject>,
  snapshot: MediaCollectionSnapshot,
): CollectionDefinition<JsonObject, DeterministicMediaDefinition<JsonObject>> {
  const entries = Object.freeze(
    snapshot.entries.map((entry) => freezeJson(entry.data) as Readonly<JsonObject>),
  );
  const identities = new WeakMap<object, string>();
  snapshot.entries.forEach((entry, index) => identities.set(entries[index]!, entry.id));
  return Object.freeze({
    kind: "collection" as const,
    entries,
    entryId(entry: Readonly<JsonObject>) {
      const id = identities.get(entry as object);
      if (id === undefined) throw new Error("Collection snapshot identity was lost");
      return id;
    },
    media,
  });
}

function freezeJson<T>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((child) => freezeJson(child))) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, freezeJson(child)]),
    )) as T;
  }
  return value;
}

/** Analyze a compiled source without invoking collection providers. Pass a snapshot to select frozen entries. */
export async function checkCompiledSource(input: Readonly<{
  projectRoot: string;
  compiled: CompiledNodeMediaSource;
  runtime: import("@superimg/types").Runtime;
  snapshot?: MediaCollectionSnapshot;
  data?: JsonObject;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  signal?: AbortSignal;
}>) {
  const { check } = await import("@superimg/core/runtime");
  const prepared = await prepareNodeMediaAnalysis(input.projectRoot, input.compiled.source, { preparedSource: input.compiled, ...(input.snapshot === undefined ? {} : { snapshot: input.snapshot }), ...(input.signal === undefined ? {} : { signal: input.signal }) });
  const report = await check(input.runtime, prepared.value, {
    providers: "skip",
    ...(input.data === undefined ? {} : { data: input.data }),
    ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.editionId === undefined ? {} : { editionId: input.editionId }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  const enriched = mergeSourceFindings(report, prepared.compiled.sourceText, prepared.value);
  return { compiled: prepared.compiled, value: prepared.value, report: { ...enriched, ok: report.ok && enriched.findings.every(f => f.severity !== "error") } };
}

/** Inspect a compiled source without invoking collection providers. */
export async function inspectCompiledSource(input: Parameters<typeof checkCompiledSource>[0]) {
  const { inspect } = await import("@superimg/core/runtime");
  const prepared = await prepareNodeMediaAnalysis(input.projectRoot, input.compiled.source, { preparedSource: input.compiled, ...(input.snapshot === undefined ? {} : { snapshot: input.snapshot }), ...(input.signal === undefined ? {} : { signal: input.signal }) });
  const report = await inspect(input.runtime, prepared.value, {
    providers: "skip", includeIR: true,
    ...(input.data === undefined ? {} : { data: input.data }),
    ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.editionId === undefined ? {} : { editionId: input.editionId }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  return { compiled: prepared.compiled, value: prepared.value, report: mergeSourceFindings(report, prepared.compiled.sourceText, prepared.value) };
}

function mergeSourceFindings<T extends { findings: readonly import("@superimg/types").RuntimeFinding[] }>(report: T, source: string, value: MediaValue): T {
  const isAnimated = value.kind === "interactive" ? true : value.kind === "collection" ? value.media.animated : value.animated;
  const seen = new Set(report.findings.map(f => `${f.code}\0${f.message}`));
  const additions = analyzeMediaSourceFindings(source, { isAnimated }).filter(f => { const key = `${f.code}\0${f.message}`; if (seen.has(key)) return false; seen.add(key); return true; });
  return { ...report, findings: [...report.findings, ...additions] };
}
