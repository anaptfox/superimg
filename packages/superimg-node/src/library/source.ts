import { compileTemplate } from "@superimg/core";
import { basename } from "node:path";
import {
  bundleMediaProgram,
  prepareMediaProgram,
  type MediaAuthoringFacadeModules,
} from "@superimg/core/bundler";
import {
  type MediaSourceAnalysisOptions,
  type SourceDescriptor,
} from "@superimg/core/source-analysis";
import type {
  CollectionDefinition,
  CompileResult,
  DeterministicMediaDefinition,
  JsonObject,
  MediaValue,
  TemplateBundle,
} from "@superimg/types";
import { snapshotDataToMediaJson, type MediaCollectionSnapshot } from "./snapshot.js";
import { materializeNodeMediaAssets } from "./assets.js";
import {
  normalizeProjectRoot,
  resolveMediaSource,
  type ResolvedMediaSource,
} from "./project.js";
import { assertSnapshotCurrent, snapshotCollection } from "./provider.js";

export interface CompiledNodeMediaSource {
  readonly source: ResolvedMediaSource;
  readonly descriptor: SourceDescriptor;
  readonly bundle: TemplateBundle;
  readonly compiled: CompileResult;
  /** Entry bytes belonging to this compilation, used for source-only findings. */
  readonly sourceText: string;
}

export interface NodeMediaAuthoringOptions {
  readonly sourceAnalysis?: MediaSourceAnalysisOptions;
  /** Bare facade specifiers mapped to absolute browser-safe authoring modules. */
  readonly authoringFacades?: MediaAuthoringFacadeModules;
  /** @internal Trusted host-owned command snapshot, never portable interaction input. */
  readonly preparedSource?: CompiledNodeMediaSource;
  /** @internal Host instrumentation only; never portable input or source metadata. */
  readonly measureStage?: <T>(stage: "source.prepare" | "source.bundle" | "source.evaluate", work: () => Promise<T>) => Promise<T>;
}

function sourceStage<T>(options: NodeMediaAuthoringOptions, stage: "source.prepare" | "source.bundle" | "source.evaluate", work: () => Promise<T>): Promise<T> {
  return options.measureStage ? options.measureStage(stage, work) : work();
}

export function resolveNodeMediaSourceAnalysis(
  options: NodeMediaAuthoringOptions,
): MediaSourceAnalysisOptions | undefined {
  const mapped = Object.keys(options.authoringFacades ?? {});
  if (mapped.length === 0) return options.sourceAnalysis;
  return {
    ...options.sourceAnalysis,
    facades: Object.freeze([
      ...new Set([...(options.sourceAnalysis?.facades ?? []), ...mapped]),
    ]),
  };
}

export interface LoadNodeMediaValueOptions extends NodeMediaAuthoringOptions {
  readonly signal?: AbortSignal;
  readonly providerTimeoutMs?: number;
  /** Reuse an already executed provider/static snapshot without executing it again. */
  readonly snapshot?: MediaCollectionSnapshot;
}

export interface LoadedNodeMediaValue extends CompiledNodeMediaSource {
  /** Path-free authored value ready for the value runtime. */
  readonly value: MediaValue;
  /** Present only for a collection source. */
  readonly snapshot?: MediaCollectionSnapshot;
}

/**
 * Compile the browser-safe projection of one native *.media.ts source exactly
 * once. This host-side result deliberately retains source metadata; callers
 * must pass only the authored value to the value runtime.
 */
export async function compileNodeMediaSource(
  projectRoot: string,
  requested: string | ResolvedMediaSource,
  options: NodeMediaAuthoringOptions & Readonly<{
    signal?: AbortSignal;
  }> = {},
): Promise<CompiledNodeMediaSource> {
  throwIfAborted(options.signal);
  const root = normalizeProjectRoot(projectRoot);
  const source = typeof requested === "string"
    ? resolveMediaSource(root, requested)
    : requested;
  if (options.preparedSource !== undefined) {
    assertPreparedMediaSource(options.preparedSource, source);
    return options.preparedSource;
  }
  const sourceAnalysis = resolveNodeMediaSourceAnalysis(options);
  const compilerOptions = {
    projectRoot: root,
    ...(sourceAnalysis === undefined
      ? {}
      : { sourceAnalysis }),
    ...(options.authoringFacades === undefined
      ? {}
      : { authoringFacades: options.authoringFacades }),
  };
  const prepared = await sourceStage(options, "source.prepare", () => prepareMediaProgram(source.templatePath, compilerOptions));
  const { descriptor, sourceText } = prepared;
  const bundle = await sourceStage(options, "source.bundle", () => bundleMediaProgram(source.templatePath, { ...compilerOptions, prepared }));
  throwIfAborted(options.signal);
  const compiled = await sourceStage(options, "source.evaluate", async () => {
    const result = compileTemplate(bundle);
    if (result.error) throw result.error;
    if (!result.media && !result.interactive) throw new Error(`Media source did not compile: ${source.relativePath}`);
    return result;
  });
  const normalizedPath = source.templatePath.replaceAll("\\", "/");
  let sourceIndex = bundle.sourceMap.sources.findIndex((path) => {
    const normalized = path.replaceAll("\\", "/");
    return normalized === normalizedPath || normalized === source.relativePath || normalized.endsWith(`/${source.relativePath}`);
  });
  if (sourceIndex < 0) {
    const matches = bundle.sourceMap.sources.map((path, index) => ({ path, index }))
      .filter(({ path }) => basename(path) === basename(source.templatePath));
    if (matches.length === 1) sourceIndex = matches[0]!.index;
  }
  return Object.freeze({ source, descriptor, bundle, compiled,
    sourceText: bundle.sourceMap.sourcesContent?.[sourceIndex] ?? sourceText });
}

/** @internal A reused command snapshot must name the mount-resolved source. */
export function assertPreparedMediaSource(
  prepared: CompiledNodeMediaSource,
  source: ResolvedMediaSource,
): void {
  if (prepared.source.templatePath !== source.templatePath ||
      prepared.source.relativePath !== source.relativePath ||
      prepared.source.sourceId !== source.sourceId) {
    throw new Error("Prepared media source does not match the requested project source");
  }
}

/**
 * Load one source into a portable runtime value. Collection providers execute
 * at most once here and are immediately replaced by a frozen static snapshot.
 */
export async function loadNodeMediaValue(
  projectRoot: string,
  requested: string | ResolvedMediaSource,
  options: LoadNodeMediaValueOptions = {},
): Promise<LoadedNodeMediaValue> {
  const root = normalizeProjectRoot(projectRoot);
  const loaded = await compileNodeMediaSource(root, requested, options);
  throwIfAborted(options.signal);

  if (loaded.compiled.interactive) {
    if (loaded.descriptor.kind === "collection") {
      throw new Error("Interactive definitions are singular and cannot be wrapped in collection()");
    }
    if (options.snapshot !== undefined) {
      throw new Error("A collection snapshot is only valid for collection sources");
    }
    return Object.freeze({ ...loaded, value: loaded.compiled.interactive });
  }

  const media = await materializeNodeMediaAssets(
    loaded.compiled.media as DeterministicMediaDefinition<JsonObject>,
    loaded.source.templatePath,
    root,
    options.signal,
  );
  throwIfAborted(options.signal);

  if (loaded.descriptor.kind !== "collection") {
    if (options.snapshot !== undefined) {
      throw new Error("A collection snapshot is only valid for collection sources");
    }
    return Object.freeze({ ...loaded, value: media });
  }

  const snapshot = options.snapshot ?? await snapshotCollection(
    loaded.descriptor,
    loaded.source,
    root,
    {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.providerTimeoutMs === undefined
        ? {}
        : { timeoutMs: options.providerTimeoutMs }),
    },
  );
  if (options.snapshot !== undefined) {
    assertSnapshotCurrent(snapshot, loaded.descriptor, loaded.source, root);
  }
  const value = staticCollection(media, snapshot);
  return Object.freeze({ ...loaded, value, snapshot });
}

function staticCollection(
  media: DeterministicMediaDefinition<JsonObject>,
  snapshot: MediaCollectionSnapshot,
): CollectionDefinition<JsonObject, DeterministicMediaDefinition<JsonObject>> {
  const entries = Object.freeze(
    snapshot.entries.map((entry) => freezeJson(snapshotDataToMediaJson(entry.data))),
  );
  const identities = new WeakMap<object, string>();
  snapshot.entries.forEach((entry, index) => identities.set(entries[index]!, entry.id));
  return Object.freeze({
    kind: "collection",
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

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Aborted", "AbortError");
}
