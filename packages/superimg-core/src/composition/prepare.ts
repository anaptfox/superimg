//! Per-job preparation for retained composition.
//!
//! A Program remains reusable and immutable. This module creates a separate
//! tree with child resolve() results applied once per occurrence; hosts must
//! render that returned tree and must not pass the same entry data a second time.

import type {
  AssetDeclaration,
  AssetMeta,
  CompositionContent,
  CompositionMedia,
  InteractiveCompositionChild,
  InteractiveCompositionRuntime,
  CompositionEntryData,
  FontInput,
  AudioClip,
  JsonObject,
  Program,
  RetainedComposition,
  TemplateModule,
  Use,
} from "@superimg/types";
import { applyTemplateResolve } from "../rendering/resolve-template.js";
import { bindPreparedChildSelection, compositionSchedule, planComposition, selectChildMedia, type CompositionPlan, type CompositionProjectionOptions } from "./plan.js";
import { bindPreparedChildResources, compositionAssetNamespace, portableChildResourcesFor, resolveCompositionSource } from "./resources.js";
import { snapshotJsonObject } from "./scoped-data.js";

export interface CompositionAssetRequest {
  /** Qualified occurrence path, for example `chapter/demo`. */
  readonly path: string;
  /** Key used by the authored child as `ctx.asset(name)`. */
  readonly name: string;
  /** Collision-free root resource key: `${path}/${encodeURIComponent(name)}`. */
  readonly namespace: string;
  readonly declaration: AssetDeclaration;
  /** Explicit source origin supplied by the caller for this child occurrence. */
  readonly sourceBase?: string | URL;
  readonly signal?: AbortSignal;
}

export interface PreparedCompositionAsset {
  readonly url: string;
  /** Optional because portable bytes do not carry reliable dimensions. */
  readonly meta?: AssetMeta;
}

/** Resolves remote child declarations into URLs controlled by the current job host. */
export interface CompositionAssetProvider {
  resolveAsset(request: CompositionAssetRequest): PreparedCompositionAsset | Promise<PreparedCompositionAsset>;
}

export interface PrepareCompositionOptions extends CompositionProjectionOptions {
  readonly data?: CompositionEntryData;
  /** Optionally replaces portable child URLs with URLs controlled by the job host. */
  readonly assets?: CompositionAssetProvider;
  /** Explicit source origins keyed by qualified child occurrence path. */
  readonly sourceBases?: Readonly<Record<string, string | URL>>;
  readonly signal?: AbortSignal;
  /** Preserve runtime identity when a Player prepares a timed projection. */
  readonly interactiveRuntimes?: Readonly<Record<string, InteractiveCompositionRuntime>>;
}

/** A job-owned snapshot. It contains no mutable state shared with Program or siblings. */
export interface PreparedComposition {
  readonly program: Program;
  readonly plan: CompositionPlan;
  readonly composition: RetainedComposition;
  /** Portable child declarations keyed by their occurrence-qualified namespace. */
  readonly assetDeclarations: Readonly<Record<string, AssetDeclaration>>;
}

function fail(message: string): never {
  throw new TypeError(`composition: ${message}`);
}

function isProgram(value: CompositionContent): value is Program {
  return typeof value === "object" && value !== null && "op" in value;
}

function isInteractiveChild(value: CompositionContent): value is InteractiveCompositionChild {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "interactive" &&
    "createCompositionRuntime" in value && typeof value.createCompositionRuntime === "function";
}

function asPreparedInteractiveChild(
  runtime: InteractiveCompositionRuntime,
  media: CompositionMedia,
): InteractiveCompositionChild {
  const bound = Object.freeze({ ...runtime, media });
  return Object.freeze({ kind: "interactive" as const, createCompositionRuntime: () => bound });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entryUses(data: CompositionEntryData | undefined): Readonly<Record<string, JsonObject>> {
  if (data === undefined) return {};
  if (!isObject(data)) fail("entry data must be an object");
  const extras = Object.keys(data).filter((key) => key !== "id" && key !== "uses");
  if (extras.length) fail(`root data keys ${extras.join(", ")} are not supported; use named uses`);
  if (data.id !== undefined && (typeof data.id !== "string" || data.id.length === 0)) fail("entry id must be a non-empty string");
  if (data.uses === undefined) return {};
  if (!isObject(data.uses)) fail("uses must be a map of named child data");
  const uses: Record<string, JsonObject> = {};
  for (const [path, patch] of Object.entries(data.uses)) {
    uses[path] = snapshotJsonObject(patch, `uses.${path}`) as JsonObject;
  }
  return uses;
}

async function prepareAssets(
  media: CompositionMedia,
  path: string,
  provider: CompositionAssetProvider | undefined,
  sourceBase: string | URL | undefined,
  declarations: Record<string, AssetDeclaration>,
  signal: AbortSignal | undefined,
): Promise<{ urls: Record<string, string>; assets: Record<string, AssetMeta> }> {
  const urls: Record<string, string> = {};
  const assets: Record<string, AssetMeta> = {};
  for (const [name, declaration] of Object.entries(media.config?.assets ?? {})) {
    const key = compositionAssetNamespace(path, name);
    const prepared = provider
      ? await provider.resolveAsset({ path, name, namespace: key, declaration, ...(sourceBase ? { sourceBase } : {}), ...(signal ? { signal } : {}) })
      : { url: portableChildResourcesFor(media, path, sourceBase).urls[name]! };
    if (!prepared || typeof prepared.url !== "string" || prepared.url.length === 0) fail(`${path}: asset provider returned no URL for "${name}"`);
    urls[name] = prepared.url;
    declarations[key] = "bytes" in declaration ? declaration : { ...declaration, url: prepared.url };
    if (prepared.meta) assets[name] = prepared.meta;
  }
  return { urls, assets };
}

function withResolvedResources(media: CompositionMedia, path: string, sourceBase: string | URL | undefined): CompositionMedia {
  const config = media.config;
  if (!config) return media;
  const fonts = config.fonts?.map((font) => {
    if ("kind" in font) return font;
    if (typeof font.src !== "string") return font;
    return { ...font, src: resolveCompositionSource(font.src, sourceBase, path, font.family, "font") };
  }) as readonly FontInput[] | undefined;
  const mapClip = (clip: AudioClip) => {
    const src = resolveCompositionSource(clip.src, sourceBase, path, clip.id ?? "clip", "audio");
    return { ...clip, src, ...(clip.source?.kind === "file" ? { source: { ...clip.source, src } } : {}) };
  };
  const audio = config.audio;
  const resolvedAudio = Array.isArray(audio)
    ? audio.map(mapClip)
    : audio && typeof audio === "object" && "clips" in audio
      ? { ...audio, clips: audio.clips.map(mapClip) }
      : audio ? mapClip(audio as import("@superimg/types").AudioClip) : undefined;
  return Object.freeze({ ...media, config: Object.freeze({ ...config, ...(fonts ? { fonts } : {}), ...(resolvedAudio ? { audio: resolvedAudio } : {}) }) }) as CompositionMedia;
}

function withoutResolve(media: CompositionMedia): CompositionMedia {
  const { resolve: _resolve, ...prepared } = media;
  return Object.freeze(prepared) as CompositionMedia;
}

async function prepareMedia(
  media: CompositionMedia,
  path: string,
  use: Use,
  patches: Readonly<Record<string, JsonObject>>,
  sourceBase: string | URL | undefined,
  provider: CompositionAssetProvider | undefined,
  declarations: Record<string, AssetDeclaration>,
  signal: AbortSignal | undefined,
): Promise<CompositionMedia> {
  const basedMedia = withResolvedResources(media, path, sourceBase);
  const resources = await prepareAssets(basedMedia, path, provider, sourceBase, declarations, signal);
  const data = snapshotJsonObject({ ...(use.data ?? {}), ...(patches[path] ?? {}) }, `${path}.data`) as JsonObject;
  const applied = await applyTemplateResolve(basedMedia as unknown as TemplateModule<JsonObject>, {
    ...(Object.keys(data).length ? { data } : {}),
    assets: resources.assets,
    assetResolver: (name) => resources.urls[name] ?? (() => { fail(`${path}: asset "${name}" is not declared in child config.assets`); })(),
    ...(signal !== undefined ? { signal } : {}),
  });
  // applyTemplateResolve spreads the original media value but returns its
  // general TemplateModule view, which omits the preserved media identity.
  const resolvedTemplate = withoutResolve(applied.template as unknown as CompositionMedia);
  const config = resolvedTemplate.config;
  const portableAssets = Object.fromEntries(Object.entries(config?.assets ?? {}).map(([name, declaration]) => [name,
    "bytes" in declaration ? declaration : { ...declaration, url: resources.urls[name]! },
  ]));
  const child = Object.freeze({ ...resolvedTemplate, ...(config ? { config: Object.freeze({ ...config, assets: Object.freeze(portableAssets) }) } : {}) }) as CompositionMedia;
  return bindPreparedChildResources(child, Object.freeze({
    urls: Object.freeze(resources.urls),
    assets: Object.freeze(resources.assets),
  }));
}

async function prepareUse(
  use: Use,
  path: string,
  options: PrepareCompositionOptions,
  patches: Readonly<Record<string, JsonObject>>,
  declarations: Record<string, AssetDeclaration>,
  stack: Set<object>,
  inheritedData: JsonObject,
): Promise<Use> {
  if (isProgram(use.content)) {
    const mergedData = snapshotJsonObject({ ...inheritedData, ...(use.data ?? {}) }, `${path}.data`) as JsonObject;
    const { data: _data, ...rest } = use;
    return Object.freeze({ ...rest, content: await prepareProgram(use.content, path, options, patches, declarations, stack, mergedData) });
  }
  const runtime = isInteractiveChild(use.content)
    ? options.interactiveRuntimes?.[path] ?? use.content.createCompositionRuntime()
    : undefined;
  const selected = runtime ? { media: runtime.media } : selectChildMedia(use, path);
  const effectiveUse = Object.freeze({ ...use, data: snapshotJsonObject({ ...inheritedData, ...(use.data ?? {}) }, `${path}.data`) as JsonObject });
  const content = bindPreparedChildSelection(
    await prepareMedia(selected.media, path, effectiveUse, patches, options.sourceBases?.[path], options.assets, declarations, options.signal),
    selected,
  );
  // Data was supplied to resolve and is now captured in the prepared media's
  // sample. Clear it so a host cannot apply it again at render time.
  const { data: _data, ...rest } = use;
  return Object.freeze({ ...rest, content: runtime ? asPreparedInteractiveChild(runtime, content) : content });
}

async function prepareProgram(
  program: Program,
  path: string,
  options: PrepareCompositionOptions,
  patches: Readonly<Record<string, JsonObject>>,
  declarations: Record<string, AssetDeclaration>,
  stack: Set<object>,
  inheritedData: JsonObject = {},
): Promise<Program> {
  if (stack.has(program)) fail(`${path || "root"}: cyclic Program graph`);
  stack.add(program);
  try {
    if (program.op === "sequence" || program.op === "together") {
      const parts: Use[] = [];
      for (const use of program.parts) {
        parts.push(await prepareUse(use, path ? `${path}/${use.id}` : use.id, options, patches, declarations, stack, inheritedData));
      }
      return Object.freeze({ ...program, parts: Object.freeze(parts) }) as Program;
    }
    const route = options.routes?.[path || "root"];
    if (!route || !Object.hasOwn(program.paths, route)) {
      // planComposition owns the user-facing missing/invalid route diagnostic.
      return program;
    }
    const selectedPath = path ? `${path}/${route}` : route;
    const selected = program.paths[route]!;
    let prepared: CompositionContent;
    if (isProgram(selected)) {
      prepared = await prepareProgram(selected, selectedPath, options, patches, declarations, stack, inheritedData);
    } else if (isInteractiveChild(selected)) {
      const runtime = options.interactiveRuntimes?.[selectedPath] ?? selected.createCompositionRuntime();
      const resolved = await prepareMedia(runtime.media, selectedPath, { id: route, content: selected, data: inheritedData }, patches, options.sourceBases?.[selectedPath], options.assets, declarations, options.signal);
      prepared = asPreparedInteractiveChild(runtime, resolved);
    } else {
      prepared = await prepareMedia(
        selectChildMedia({ id: route, content: selected }, selectedPath).media,
        selectedPath,
        { id: route, content: selected, data: inheritedData },
        patches,
        options.sourceBases?.[selectedPath],
        options.assets,
        declarations,
        options.signal,
      );
    }
    return Object.freeze({ ...program, paths: Object.freeze({ ...program.paths, [route]: prepared }) });
  } finally {
    stack.delete(program);
  }
}

/**
 * Resolve every selected child occurrence once for one job.
 *
 * Byte assets become self-contained data URLs. HTTP(S) assets ask the current
 * job host for a stable occurrence-namespaced URL.
 */
export async function prepareComposition(
  program: Program,
  options: PrepareCompositionOptions,
): Promise<PreparedComposition> {
  const patches = entryUses(options.data);
  const declarations: Record<string, AssetDeclaration> = {};
  const preparedProgram = await prepareProgram(program, "", options, patches, declarations, new Set<object>());
  const plan = planComposition(preparedProgram, options);
  for (const path of Object.keys(patches)) {
    if (!plan.leaves.some((leaf) => leaf.path === path)) fail(`data target "${path}" is not a selected leaf`);
  }
  const composition: RetainedComposition = Object.freeze({
    schemaVersion: 0,
    program: preparedProgram,
    outputSize: Object.freeze({ ...options.size }),
    schedule: compositionSchedule(plan),
  });
  return Object.freeze({ program: preparedProgram, plan, composition, assetDeclarations: Object.freeze({ ...declarations }) });
}
