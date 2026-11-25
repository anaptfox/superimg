//! Pure library function for starting the SuperImg dev server without side-effects.

import { createServer as createHttpServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { join, dirname, basename, isAbsolute, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import chokidar from "chokidar";
import { WebSocketServer, WebSocket } from "ws";
import {
  resolveTemplatePath, findProjectRoot, normalizeProjectRoot, discoverVideos, type DiscoveredVideo,
  discoverTemplateAssets, loadCascadingConfig, mergeCascadingIntoRenderConfig,
  inspectIRAssets, resolveRenderConfig, addDiscoveredDevAssetUrls,
  resolveDevAssetUrls, resolveDevFonts,
} from "@foxworth/superimg-node/project-tools";
import {
  bundleMediaProgramPair, TEMPLATE_COMPILER_BEHAVIOR,
} from "@superimg/core/bundler";
import { analyzeMediaSource } from "@superimg/core/source-analysis";
import { formatError } from "@superimg/core/errors";
import { createRuntime, inspect as runtimeInspect } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node";
import type { AudioClip, AudioValue, TemplateBundle, DeterministicMediaDefinition, InspectReport, JsonObject, JsonValue, Runtime, RuntimeMediaCoordinates } from "@superimg/types";
import { AssetRegistry, openRegisteredAsset } from "@superimg/playwright";
import { hashBytes, normalizeSourceId } from "@superimg/core";
import { resolveInteractiveClock, resolveInteractiveSize } from "@foxworth/superimg/interactive/define";
import { createDevMediaApi } from "./dev-server-media.js";
import { createDevSourceCache } from "./dev-source-cache.js";
import { randomUUID } from "node:crypto";
import { createCliMediaInteractionSession } from "./cli/utils/media-interactions.js";
import { compileNodeMediaSource, MEDIA_INTERACTION_IDS, type MediaCollectionSnapshot } from "@foxworth/superimg-interactions";

export interface DevServerOptions {
  /** Project explicitly selected by the embedding host. */
  projectRoot?: string;
  port?: number;
  signal?: AbortSignal;
  edition?: string;
  variantId?: string;
  entryId?: string;
  entryData?: Record<string, unknown>;
  collectionSnapshot?: MediaCollectionSnapshot;
  collectionSource?: boolean;
}

export interface DevServer {
  url: string;
  close(): Promise<void>;
}

function inspectionFrame(reqUrl: string): number {
  const raw = new URL(reqUrl, "http://localhost").searchParams.get("frame") ?? "0";
  const frame = Number(raw);
  if (!Number.isSafeInteger(frame) || frame < 0) throw new TypeError("Inspection frame must be a nonnegative integer");
  return frame;
}

type PreviewSelection = Readonly<{ variantId: string; editionId: string }>;

function requestSelection(
  reqUrl: string,
  defaults: PreviewSelection = { variantId: "default", editionId: "default" },
): PreviewSelection {
  const params = new URL(reqUrl, "http://localhost").searchParams;
  return {
    variantId: params.get("variantId") ?? defaults.variantId,
    editionId: params.get("editionId") ?? defaults.editionId,
  };
}

function unsupportedInteractiveInspection(): Error {
  return Object.assign(new Error("Interactive preview does not expose deterministic Media IR or passive inspection."), {
    code: "INTERACTIVE_INSPECTION_UNSUPPORTED",
  });
}

function isUnsupportedInteractiveInspection(error: unknown): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "code") === "INTERACTIVE_INSPECTION_UNSUPPORTED";
}

function assertInteractiveSelection(interactive: unknown, selection: PreviewSelection): void {
  if (interactive && (selection.variantId !== "default" || selection.editionId !== "default")) {
    throw new TypeError("Interactive previews do not support variant or edition selection");
  }
}

type HomeCollectionState = {
  source: string;
  projectionDigest?: string;
  snapshot?: MediaCollectionSnapshot;
  snapshotId?: string;
  generation: number;
  busy: boolean;
};

function homeCollectionInfo(state: HomeCollectionState | undefined, sourceId: string, reqUrl: string): Record<string, unknown> {
  const entries = state?.snapshot?.entries ?? [];
  const params = new URL(reqUrl, "http://localhost").searchParams;
  const requestedEntry = params.get("entryId");
  const selectedEntryId = requestedEntry === null
    ? entries[0]?.id ?? null
    : entries.some((entry) => entry.id === requestedEntry) ? requestedEntry : null;
  return {
    snapshotId: state?.snapshotId ?? null,
    generation: state?.generation ?? 0,
    sourceId,
    source: state?.snapshot ? { id: state.snapshot.sourceId, revision: state.snapshot.providerHash } : null,
    entries: entries.map(({ id, dataDigest }) => ({ id, dataDigest })),
    selectedEntryId,
    stale: state?.snapshot === undefined,
  };
}

function resolveHomeCollectionEntry(state: HomeCollectionState | undefined, reqUrl: string) {
  if (!state?.snapshot || !state.snapshotId) return undefined;
  const params = new URL(reqUrl, "http://localhost").searchParams;
  const requestedId = params.get("entryId");
  if (requestedId === null) return state.snapshot.entries[0];
  if (params.get("snapshotId") !== state.snapshotId || params.get("generation") !== String(state.generation)) {
    throw Object.assign(new Error("Collection snapshot is stale; refresh entries."), { statusCode: 409 });
  }
  const entry = state.snapshot.entries.find((item) => item.id === requestedId);
  if (!entry) throw Object.assign(new Error(`Unknown collection entry ${JSON.stringify(requestedId)}`), { statusCode: 409 });
  return entry;
}

async function homeCollectionProjectionDigest(projectRoot: string, source: string): Promise<string> {
  // Use the same canonical provider-free source compiler as snapshot/export.
  // A paired browser preview bundle has a different module-read identity.
  const compiled = await compileNodeMediaSource(projectRoot, source);
  return compiled.bundle.inputIdentity ?? hashBytes(compiled.bundle.code);
}

/** The compiled default is one fulfilled projection of the authored selection. */
function scopeProjectedInspection(report: InspectReport, coordinates: RuntimeMediaCoordinates) {
  const projectionCoordinates = report.coordinates[0];
  if (report.coordinates.length !== 1 || projectionCoordinates?.entryId !== undefined ||
      projectionCoordinates?.variantId !== "default" || projectionCoordinates.editionId !== "default") {
    throw new Error("Dev inspection requires one default selection of the compiled media projection");
  }
  const canonical: RuntimeMediaCoordinates & JsonObject = { ...coordinates };
  const object = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
  const scopedCoordinates = (value: unknown) => {
    if (!object(value) || value.entryId !== undefined || value.variantId !== "default" || value.editionId !== "default") {
      throw new Error("Dev inspection returned coordinates outside the compiled media projection");
    }
    return canonical;
  };
  const scopeRecord = (value: JsonValue): JsonObject => {
    if (!object(value)) throw new Error("Dev inspection returned an invalid semantic sample");
    return { ...value, ...(value.coordinates === undefined ? {} : { coordinates: scopedCoordinates(value.coordinates) }) };
  };
  const scopeSample = (value: JsonValue): JsonObject => {
    const sample = scopeRecord(value);
    const coverage = sample.coverage;
    return { ...sample, ...(object(coverage) && Array.isArray(coverage.samples)
      ? { coverage: { ...coverage, samples: coverage.samples.map(scopeRecord) } } : {}) };
  };
  // Only documented runtime scope locations are adapted; authored trees and
  // arbitrary metadata remain unchanged. The digest still describes the value.
  const scoped: InspectReport = {
    ...report,
    coordinates: [canonical],
    findings: report.findings.map(finding => ({ ...finding,
      ...(finding.coordinates === undefined ? {} : { coordinates: scopedCoordinates(finding.coordinates) }),
    })),
    ...(report.coverage === undefined ? {} : { coverage: { ...report.coverage,
      samples: report.coverage.samples.map(sample => ({ ...sample,
        ...(sample.coordinates === undefined ? {} : { coordinates: scopedCoordinates(sample.coordinates) }),
      })),
    } }),
    ...(report.metadata === undefined ? {} : { metadata: { ...report.metadata,
      ...(Array.isArray(report.metadata.samples) ? { samples: report.metadata.samples.map(scopeSample) } : {}),
      ...(Array.isArray(report.metadata.semanticIR) ? { semanticIR: report.metadata.semanticIR.map(scopeRecord) } : {}),
    } }),
  };
  return { report: scoped, selection: { coordinates: canonical, projectionCoordinates } };
}

export async function startDevServer(
  template: string | undefined,
  options?: DevServerOptions
): Promise<DevServer> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const packagedDevRoot = join(moduleDirectory, "dev-ui");
  const devRoot = existsSync(packagedDevRoot)
    ? packagedDevRoot
    : join(moduleDirectory, "..", "dist", "dev-ui");
  const port = options?.port ?? 4747;
  const homeMode = !template || template.trim() === "";

  const server = homeMode
    ? await startHomeMode(port, devRoot, options?.projectRoot)
    : await startSingleVideoMode(
        template!,
        port,
        devRoot,
        options?.edition,
        options?.variantId,
        options?.entryId,
        options?.entryData,
        options?.collectionSnapshot,
        options?.collectionSource,
        options?.projectRoot,
      );

  if (options?.signal) {
    options.signal.addEventListener("abort", () => server.close(), { once: true });
  }

  return server;
}

type ModuleSets = Map<string, NonNullable<TemplateBundle["outputs"]>>;
function registerModuleSet(sets: ModuleSets, bundle: TemplateBundle): string | undefined {
  const entry = bundle.outputs?.find(output => output.type === "chunk" && output.isEntry);
  if (!bundle.outputs || !bundle.outputSetIdentity || !entry) return undefined;
  sets.set(bundle.outputSetIdentity, bundle.outputs);
  return `/api/template-output/${bundle.outputSetIdentity}/${entry.fileName}`;
}
function registerNativeModuleSets(sets: ModuleSets, media: { config?: { nativeModuleSets?: readonly import("@superimg/types").PreparedNativeModuleSet[] } } | undefined): void {
  for (const module of media?.config?.nativeModuleSets ?? []) sets.set(module.identity, module.outputs);
}
function serveModuleSet(pathname: string, res: ServerResponse, sets: ModuleSets): boolean {
  const match = pathname.match(/^\/api\/template-output\/([a-f0-9]{64})\/(.+)$/);
  if (!match) return false;
  let fileName: string;
  try { fileName = decodeURIComponent(match[2]!); }
  catch { res.statusCode = 400; res.end(); return true; }
  const file = sets.get(match[1]!)?.find(item => item.fileName === fileName);
  if (!file) { res.statusCode = 404; res.end(); return true; }
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  const extension = file.fileName.split(".").pop()?.toLowerCase();
  const assetMime: Record<string, string> = { wasm: "application/wasm", json: "application/json", map: "application/json", png: "image/png", svg: "image/svg+xml", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  res.setHeader("Content-Type", file.type === "chunk" ? "application/javascript; charset=utf-8" : assetMime[extension ?? ""] ?? "application/octet-stream");
  const source = file.type === "chunk" ? file.code : file.source;
  res.end(typeof source === "string" ? source : Buffer.from(source));
  return true;
}

async function serveVideosApi(
  pathname: string,
  res: ServerResponse,
  videos: DiscoveredVideo[],
  projectRoot: string,
  inspectionRuntime: Runtime,
  reqUrl: string,
  assetRegistry: AssetRegistry,
  collectionStates?: Map<string, HomeCollectionState>,
  moduleSets?: ModuleSets,
): Promise<boolean> {
  if (pathname === "/api/videos") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.end(
      JSON.stringify(
        videos.map((v) => ({
          name: v.name,
          shortName: v.shortName,
          relativePath: v.relativePath,
          hasLocalConfig: v.hasLocalConfig,
          sourceKind: analyzeMediaSource(readFileSync(v.entrypoint, "utf8"), v.entrypoint).kind,
        })),
      ),
    );
    return true;
  }

  const videosMatch = pathname.match(
    /^\/api\/videos\/(.+)\/(template-bundle|template|config|ir|inspect)$/,
  );
  if (!videosMatch) return false;

  const name = decodeURIComponent(videosMatch[1] ?? "");
  const type = videosMatch[2];
  const video = videos.find((v) => v.name === name);
  if (!video) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Video not found" }));
    return true;
  }
  let isCollection = false;
  let defaultCollectionPair: Awaited<ReturnType<typeof bundleMediaProgramPair>> | undefined;
  try {
    isCollection = analyzeMediaSource(readFileSync(video.entrypoint, "utf8"), video.entrypoint).kind === "collection";
  } catch (error) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: formatError(error).json }));
    return true;
  }
  const selection = requestSelection(reqUrl);
  let selectedEntryId: string | undefined;
  let selectedEntryData: Record<string, unknown> | undefined;
  let collectionInfo: Record<string, unknown> | undefined;
  if (isCollection) {
    const sourceId = video.name;
    const state = collectionStates?.get(sourceId);
    if (state) {
      collectionStates!.delete(sourceId);
      collectionStates!.set(sourceId, state);
    }
    defaultCollectionPair = await bundleMediaProgramPair(video.entrypoint, { selection: { variantId: "default", editionId: "default" } });
    const currentDigest = await homeCollectionProjectionDigest(projectRoot, video.name);
    if (state?.projectionDigest !== undefined && state.projectionDigest !== currentDigest) {
        delete state.snapshot;
        delete state.snapshotId;
        state.projectionDigest = currentDigest;
        state.generation += 1;
    }
      collectionInfo = { ...homeCollectionInfo(state, sourceId, reqUrl), sourcePath: `/api/videos/${encodeURIComponent(video.name)}/collection` };
    try {
      const selected = resolveHomeCollectionEntry(state, reqUrl);
      selectedEntryId = selected?.id;
      selectedEntryData = selected?.data;
      if (type !== "config" && !selected) {
        res.statusCode = 409;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { code: "COLLECTION_SNAPSHOT_REQUIRED", message: "Materialize collection entries before previewing this source." } }));
        return true;
      }
    } catch (error) {
      if (type !== "config") {
        res.statusCode = typeof error === "object" && error !== null && typeof Reflect.get(error, "statusCode") === "number" ? Reflect.get(error, "statusCode") as number : 409;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: { code: "COLLECTION_SNAPSHOT_REQUIRED", message: error instanceof Error ? error.message : String(error) } }));
        return true;
      }
      collectionInfo = { ...collectionInfo, staleRequest: true };
    }
  }
  const bundleSelection = { ...selection, ...(selectedEntryData === undefined ? {} : { entryData: selectedEntryData as JsonObject }) };
  const getPair = () => defaultCollectionPair && selectedEntryData === undefined && selection.variantId === "default" && selection.editionId === "default"
    ? Promise.resolve(defaultCollectionPair)
    : bundleMediaProgramPair(video.entrypoint, { selection: bundleSelection });
  if (type === "template") {
    try {
      const pair = await getPair();
      const { compileTemplate } = await import("@superimg/core");
      const compiled = compileTemplate(pair.iife);
      if (compiled.error) throw compiled.error;
      assertInteractiveSelection(compiled.interactive, selection);
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "no-cache");
      res.end(pair.esm.code);
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatError(err).json }));
    }
  } else if (type === "template-bundle") {
    try {
      const pair = await getPair();
      const { compileTemplate } = await import("@superimg/core");
      const compiled = compileTemplate(pair.iife);
      if (compiled.error) throw compiled.error;
      assertInteractiveSelection(compiled.interactive, selection);
      const bundle = pair.esm;
      if (moduleSets) registerNativeModuleSets(moduleSets, compiled.media);
      const moduleUrl = moduleSets && registerModuleSet(moduleSets, bundle);
      const { nativeModuleSets: _nativeModuleSets, ...previewBundle } = bundle;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.end(JSON.stringify({ ...previewBundle, generation: 0, ...(moduleUrl ? { moduleUrl } : {}), source: { id: video.name, revision: bundle.outputIdentity ?? hashBytes(bundle.code) } }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatError(err).json }));
    }
  } else if (type === "inspect") {
    const controller = new AbortController();
    res.once("close", () => { if (!res.writableEnded) controller.abort(); });
    try {
      const frame = inspectionFrame(reqUrl);
      const pair = await getPair();
      const { compileTemplate } = await import("@superimg/core");
      const compiled = compileTemplate(pair.iife);
      if (compiled.error || (!compiled.media && !compiled.interactive)) throw compiled.error ?? new Error("Template compilation failed");
      assertInteractiveSelection(compiled.interactive, selection);
      if (compiled.interactive) throw unsupportedInteractiveInspection();
      const selectedMedia = compiled.media;
      if (!selectedMedia) throw new Error("Template did not compile to deterministic media");
      const cascading = await loadCascadingConfig(video.entrypoint, projectRoot);
      const media = { ...selectedMedia, config: mergeCascadingIntoRenderConfig(selectedMedia.config, cascading) } as DeterministicMediaDefinition<JsonObject>;
      if (!media.animated && frame !== 0) throw new TypeError("Static media only has frame 0");
      const report = await runtimeInspect(inspectionRuntime, media, { at: media.animated ? `${frame}f` : 0, providers: "skip", renderedLayout: false, signal: controller.signal });
      if (controller.signal.aborted) return true;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.end(JSON.stringify({ source: { id: video.name, revision: pair.esm.outputIdentity }, inputIdentity: pair.esm.inputIdentity, frame, generation: 0, ...scopeProjectedInspection(report, { ...selection, ...(selectedEntryId === undefined ? {} : { entryId: selectedEntryId }) }) }));
    } catch (err) {
      if (controller.signal.aborted) return true;
      res.statusCode = isUnsupportedInteractiveInspection(err) ? 409 : (typeof err === "object" && err !== null && typeof Reflect.get(err, "statusCode") === "number") ? Reflect.get(err, "statusCode") as number : err instanceof TypeError ? 400 : 500;
      res.end(JSON.stringify({ error: formatError(err).json }));
    }
  } else if (type === "config") {
    try {
      const cascadingConfig = await loadCascadingConfig(video.entrypoint, projectRoot);
      const pair = await getPair();
      const { compileTemplate } = await import("@superimg/core");
      const compiled = compileTemplate(pair.iife);
      if (compiled.error || (!compiled.media && !compiled.interactive)) throw compiled.error ?? new Error("Template compilation failed");
      assertInteractiveSelection(compiled.interactive, selection);
      if (compiled.interactive) {
        const clock = resolveInteractiveClock(compiled.interactive.guide as never);
        const size = compiled.interactive.size ? resolveInteractiveSize(compiled.interactive.size) : { width: 1920, height: 1080 };
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ previewKind: "interactive", sourceKind: "interactive", ...size, fps: clock.fps, duration: clock.durationSeconds, variants: [], editions: [], sourceId: video.name, source: { id: video.name, revision: pair.esm.outputIdentity }, previewSource: { id: video.name, revision: pair.esm.outputIdentity }, inputIdentity: pair.esm.inputIdentity, generation: 0 }));
        return true;
      }
      const media = compiled.media!;
      const config = mergeCascadingIntoRenderConfig(media.config, cascadingConfig);
      const resolved = resolveRenderConfig({ templateConfig: config });
      const registerDevAsset = (path: string) => `/api/assets/${assetRegistry.register(path)}`;
      const assetUrls = resolveDevAssetUrls(config.assets, video.directory, registerDevAsset);
      addDiscoveredDevAssetUrls(assetUrls, discoverTemplateAssets(video.directory), registerDevAsset);
      const fonts = await resolveDevFonts(config.fonts, video.directory);
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          sourceId: video.name,
          previewKind: isCollection && !selectedEntryId ? "collection-unavailable" : "media",
          sourceKind: isCollection ? "collection" : "media",
          ...(collectionInfo === undefined ? {} : { collection: collectionInfo }),
          ...(selectedEntryId === undefined ? {} : { entryId: selectedEntryId }),
          mediaKind: media.media,
          variants: Object.keys(media.variants ?? {}).map((id) => ({ id })),
          editions: Object.keys(media.editions ?? {}).map((id) => ({ id })),
          variantId: selection.variantId,
          editionId: selection.editionId,
          source: { id: video.name, revision: pair.iife.outputIdentity },
          previewSource: { id: video.name, revision: pair.esm.outputIdentity },
          inputIdentity: pair.iife.inputIdentity,
          width: resolved.width,
          height: resolved.height,
          fps: resolved.fps,
          duration: resolved.duration,
          audio: resolveDevAudio(config.audio, video.directory, assetRegistry),
          assetUrls,
          ...(fonts ? { fonts } : {}),
          templateDir: video.directory,
        }),
      );
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: formatError(err).json }));
    }
  } else {
    try {
      const [
        iife,
        { compileTemplate, resolveMediaIR, hashBytes, normalizeSourceId },
      ] = await Promise.all([
        getPair().then((bundle) => bundle.iife),
        import("@superimg/core"),
      ]);
      const compiled = compileTemplate(iife);
      if (compiled.error || (!compiled.media && !compiled.interactive)) {
        throw compiled.error ?? new Error("Template compilation failed");
      }
      assertInteractiveSelection(compiled.interactive, selection);
      if (compiled.interactive) throw unsupportedInteractiveInspection();
      const cascadingConfig = await loadCascadingConfig(
        video.entrypoint,
        projectRoot,
      );
      const media = compiled.media;
      if (!media) throw new Error("Template did not compile to deterministic media");
      media.config = mergeCascadingIntoRenderConfig(
        media.config,
        cascadingConfig,
      );
      const inspected = inspectIRAssets(video.entrypoint, media);
      const { ir } = await resolveMediaIR(media, {
        sourceId: video.name,
        programHash: hashBytes(iife.code),
        additionalAssets: inspected.additionalAssets,
        additionalIssues: inspected.additionalIssues,
        sourceDir: dirname(video.entrypoint),
      });
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.end(JSON.stringify({ schemaVersion: 0, media: ir, generation: 0, source: { id: video.name, revision: ir.hashes.programHash } }));
    } catch (err) {
      res.statusCode = isUnsupportedInteractiveInspection(err) ? 409 : 500;
      res.end(JSON.stringify({ error: formatError(err).json }));
    }
  }
  return true;
}

async function startHomeMode(port: number, devRoot: string, selectedProjectRoot?: string): Promise<DevServer> {
  const projectRoot = normalizeProjectRoot(selectedProjectRoot === undefined ? findProjectRoot() : findProjectRoot(selectedProjectRoot));
  const videos = discoverVideos(projectRoot);
  const url = `http://localhost:${port}`;
  const collectionStates = new Map<string, HomeCollectionState>();
  const interactionSession = createCliMediaInteractionSession(projectRoot);
  const mediaApi = createDevMediaApi({
    origin: url,
    sources: new Map(videos.map((video) => [video.name, video.entrypoint])),
    collectionRoute: async (req, res, pathname, authorize) => {
      const match = pathname.match(/^\/api\/videos\/(.+)\/collection\/(snapshot|export)$/);
      if (!match) return false;
      if (req.method !== "POST") { res.statusCode = 405; res.end(); return true; }
      if (!authorize(req, res)) return true;
      const videoName = decodeURIComponent(match[1] ?? "");
      const video = videos.find((item) => item.name === videoName);
      if (!video) { res.statusCode = 404; res.end(JSON.stringify({ error: "Video not found" })); return true; }
      const sourceId = video.name;
      let heldState: HomeCollectionState | undefined;
      try {
        if (analyzeMediaSource(readFileSync(video.entrypoint, "utf8"), video.entrypoint).kind !== "collection") {
          res.statusCode = 409; res.end(JSON.stringify({ error: { code: "NOT_A_COLLECTION", message: "This source is not a collection." } })); return true;
        }
        let state = collectionStates.get(sourceId);
        if (state) { collectionStates.delete(sourceId); collectionStates.set(sourceId, state); }
        if (match[2] === "snapshot") {
          if (!state) {
            if (collectionStates.size >= 32) {
              const evict = [...collectionStates].find(([, candidate]) => !candidate.busy)?.[0];
              if (!evict) { res.statusCode = 409; res.end(JSON.stringify({ error: "collection_operation_busy" })); return true; }
              collectionStates.delete(evict);
            }
            state = { source: relative(projectRoot, video.entrypoint), generation: 0, busy: false };
            collectionStates.set(sourceId, state);
          }
        } else if (!state?.snapshot || !state.snapshotId) {
          res.statusCode = 409; res.end(JSON.stringify({ error: { code: "STALE_COLLECTION_SNAPSHOT", message: "Collection snapshot is stale; refresh entries." } })); return true;
        }
        if (state.busy) { res.statusCode = 409; res.end(JSON.stringify({ error: "collection_operation_busy" })); return true; }
        state.busy = true;
        heldState = state;
        const body = await parseRequestJson(req);
        if (match[2] === "snapshot") {
          const projectionBefore = await homeCollectionProjectionDigest(projectRoot, state.source);
          const snapshot = await interactionSession.mount.dispatch({
            interactionId: MEDIA_INTERACTION_IDS.snapshot,
            input: { source: state.source },
          }, {});
          const projectionAfter = await homeCollectionProjectionDigest(projectRoot, state.source);
          if (projectionBefore !== projectionAfter) {
            res.statusCode = 409; res.end(JSON.stringify({ error: { code: "COLLECTION_SOURCE_CHANGED", message: "Collection source changed during snapshot. Refresh entries again." } })); return true;
          }
          state.snapshot = snapshot;
          state.projectionDigest = projectionAfter;
          state.snapshotId = randomUUID();
          state.generation += 1;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(homeCollectionInfo(state, sourceId, "/")));
          return true;
        }
        const projectionDigest = await homeCollectionProjectionDigest(projectRoot, state.source);
        if (!state.snapshot || !state.snapshotId || state.projectionDigest !== projectionDigest || body.snapshotId !== state.snapshotId || body.generation !== state.generation) {
          res.statusCode = 409; res.end(JSON.stringify({ error: { code: "STALE_COLLECTION_SNAPSHOT", message: "Collection snapshot is stale; refresh entries." } })); return true;
        }
        if (typeof body.entryId !== "string" || !state.snapshot.entries.some((entry) => entry.id === body.entryId)) {
          res.statusCode = 409; res.end(JSON.stringify({ error: { code: "STALE_COLLECTION_SELECTION", message: "Collection entry is not in the accepted snapshot." } })); return true;
        }
        const destinations = Array.isArray(body.destinations) && body.destinations.every((value) => typeof value === "string") ? body.destinations as string[] : [];
        if (destinations.length === 0) throw new TypeError("Export requires at least one destination");
        const receipt = await interactionSession.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.export,
          input: {
            source: state.snapshot.source,
            publication: { targetId: "project-output", publicationId: `${sourceId}.${randomUUID()}.export` },
            destinations,
            entryIds: [body.entryId],
            variantIds: [typeof body.variantId === "string" ? body.variantId : "default"],
            editionIds: [typeof body.editionId === "string" ? body.editionId : "default"],
            snapshot: state.snapshot,
          },
        }, { expectedInputIdentity: projectionDigest });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(receipt));
        return true;
      } catch (error) {
        const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
        res.statusCode = code === "COLLECTION_SOURCE_CHANGED" ? 409 : error instanceof TypeError ? 400 : code === "COLLECTION_EMPTY" ? 422 : 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: code === "COLLECTION_EMPTY"
          ? { code, message: "Collection is empty: providers must return at least one entry." }
          : code === "COLLECTION_SOURCE_CHANGED"
            ? { code, message: error instanceof Error ? error.message : "Collection source changed before export." }
            : formatError(error).json }));
        return true;
      } finally {
        if (heldState) heldState.busy = false;
      }
    },
  });

  const inspectionRuntime = createRuntime(createNodeRuntimeAdapter());
  const assetRegistry = new AssetRegistry();
  const moduleSets: ModuleSets = new Map();
  const server = createHttpServer(async (req, res) => {
    const pathname = (req.url || "/").split("?")[0] ?? "/";
    if (serveModuleSet(pathname, res, moduleSets)) return;
    if (await mediaApi.handle(req, res, pathname)) return;
    if (await serveVideosApi(pathname, res, videos, projectRoot, inspectionRuntime, req.url || "/", assetRegistry, collectionStates, moduleSets)) return;
    if (pathname.startsWith("/api/assets/")) {
      serveRegisteredAsset(req, res, assetRegistry, pathname.slice("/api/assets/".length));
      return;
    }
    if (pathname === "/ws") return;
    serveStaticFile(pathname, devRoot, res);
  });

  await listen(server, port);

  return {
    url,
    close: async () => {
      await mediaApi.dispose();
      await interactionSession.dispose();
      await inspectionRuntime.dispose();
      assetRegistry.clear();
      server.closeAllConnections();
      await closeServer(server);
    },
  };
}

async function startSingleVideoMode(
  template: string,
  port: number,
  devRoot: string,
  requestedEdition?: string,
  requestedVariant?: string,
  entryId?: string,
  entryData?: Record<string, unknown>,
  initialCollectionSnapshot?: MediaCollectionSnapshot,
  collectionSource = false,
  selectedProjectRoot?: string,
): Promise<DevServer> {
  const templatePath = resolveTemplatePath(template, selectedProjectRoot);
  const projectRoot = normalizeProjectRoot(findProjectRoot(selectedProjectRoot ?? dirname(templatePath)));
  const library = discoverVideos(projectRoot);
  const url = `http://localhost:${port}?template=/api/template${requestedVariant ? `&variantId=${encodeURIComponent(requestedVariant)}` : ""}${requestedEdition ? `&editionId=${encodeURIComponent(requestedEdition)}` : ""}`;
  const assetRegistry = new AssetRegistry();
  let collectionSnapshot = initialCollectionSnapshot;
  const isCollectionSource = initialCollectionSnapshot !== undefined || collectionSource;
  const collectionSourceId = initialCollectionSnapshot?.sourceId ?? normalizeSourceId(basename(templatePath));
  let collectionSnapshotId = initialCollectionSnapshot ? randomUUID() : undefined;
  let collectionSnapshotGeneration = 0;
  let collectionMutationInFlight = false;
  const collectionControllers = new Set<AbortController>();
  const interactionSession = createCliMediaInteractionSession(projectRoot);
  const collectionInfo = () => isCollectionSource ? {
    sourcePath: "/api/collection",
    snapshotId: collectionSnapshotId ?? null,
    generation: collectionSnapshotGeneration,
    sourceId: collectionSnapshot?.sourceId ?? collectionSourceId,
    source: collectionSnapshot ? { id: collectionSnapshot.sourceId, revision: collectionSnapshot.providerHash } : null,
    entries: collectionSnapshot?.entries.map(({ id, dataDigest }) => ({ id, dataDigest })) ?? [],
    selectedEntryId: collectionSnapshot ? collectionSnapshot.entries.find((item) => item.id === entryId)?.id ?? collectionSnapshot.entries[0]?.id ?? null : null,
    stale: collectionSnapshot === undefined,
  } : undefined;
  const mediaApi = createDevMediaApi({
    origin: `http://localhost:${port}`,
    sources: new Map([...library.map((video) => [normalizeSourceId(video.name), video.entrypoint] as const), [normalizeSourceId(basename(templatePath)), templatePath]]),
    collectionRoute: async (req, res, pathname, authorize) => {
      if (pathname !== "/api/collection/snapshot" && pathname !== "/api/collection/export") return false;
      if (req.method !== "POST") { res.statusCode = 405; res.end(); return true; }
      if (!authorize(req, res)) return true;
      if (collectionMutationInFlight) { res.statusCode = 409; res.end(JSON.stringify({ error: "collection_operation_busy" })); return true; }
      collectionMutationInFlight = true;
      const operationController = new AbortController();
      collectionControllers.add(operationController);
      const operationGeneration = sourceGeneration;
      try {
        const body = await parseRequestJson(req);
        if (pathname.endsWith("/snapshot")) {
          const next = await interactionSession.mount.dispatch({
            interactionId: MEDIA_INTERACTION_IDS.snapshot,
            input: { source: collectionSnapshot?.source ?? relative(projectRoot, templatePath) },
          }, { signal: operationController.signal });
          if (operationController.signal.aborted || operationGeneration !== sourceGeneration) {
            res.statusCode = 409; res.end(JSON.stringify({ error: "collection_source_changed" })); return true;
          }
          collectionSnapshot = next;
          collectionSnapshotId = randomUUID();
          collectionSnapshotGeneration += 1;
          bundleCache.invalidate();
          irCache = null;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(collectionInfo()));
          return true;
        }
        if (!collectionSnapshot || !collectionSnapshotId || body.snapshotId !== collectionSnapshotId) {
          res.statusCode = 409; res.end(JSON.stringify({ error: "stale_collection_snapshot" })); return true;
        }
        if (body.generation !== collectionSnapshotGeneration || typeof body.entryId !== "string" || !collectionSnapshot.entries.some((entry) => entry.id === body.entryId)) {
          res.statusCode = 409; res.end(JSON.stringify({ error: "stale_collection_selection" })); return true;
        }
        const variantId = typeof body.variantId === "string" ? body.variantId : "default";
        const editionId = typeof body.editionId === "string" ? body.editionId : "default";
        const destinations = Array.isArray(body.destinations) && body.destinations.every((value) => typeof value === "string") ? body.destinations as string[] : [];
        if (destinations.length === 0) throw new TypeError("Export requires at least one destination");
        if (body.snapshotId !== collectionSnapshotId || body.generation !== collectionSnapshotGeneration) {
          res.statusCode = 409; res.end(JSON.stringify({ error: "stale_collection_snapshot" })); return true;
        }
        const receipt = await interactionSession.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.export,
          input: {
            source: collectionSnapshot.source,
            publication: { targetId: "project-output", publicationId: `${collectionSnapshot.sourceId}.${randomUUID()}.export` },
            destinations,
            entryIds: [body.entryId],
            variantIds: [variantId],
            editionIds: [editionId],
            snapshot: collectionSnapshot,
          },
        }, { signal: operationController.signal });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(receipt));
      } catch (error) {
        const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
        res.statusCode = operationController.signal.aborted || operationGeneration !== sourceGeneration ? 409 : error instanceof TypeError ? 400 : code === "COLLECTION_EMPTY" ? 422 : 500;
        res.end(JSON.stringify({ error: code === "COLLECTION_EMPTY"
          ? { code, message: "Collection is empty: providers must return at least one entry." }
          : formatError(error).json }));
      } finally {
        collectionControllers.delete(operationController);
        collectionMutationInFlight = false;
      }
      return true;
    },
  });

  /** Local publish epoch — discard stale async results / WS sends. */
  type DevIR = { media: import("@superimg/types").MediaIR; generation: number; source: NonNullable<TemplateBundle["source"]>; previewSource: NonNullable<TemplateBundle["source"]>; inputIdentity?: string; projectionIdentity?: string };
  let irCache: { generation: number; key: string; value: DevIR } | null = null;
  /** In-flight compile keyed by bundle content — concurrent /api/ir share one resolve. */
  let irCompileInFlight: { generation: number; key: string; promise: Promise<DevIR> } | null = null;
  let watcher: ReturnType<typeof chokidar.watch> | null = null;
  const dependencyWatcher = chokidar.watch([], {
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });
  const dependencyDirectories = new Set<string>();
  function watchDependencies(inputs: { files: readonly string[]; directories: readonly string[] }) {
    // Missing extensionless imports have no file to watch until creation. Watch
    // their parent directories as well, so a repaired module can recover.
    const paths = [...inputs.files, ...inputs.directories].filter((path) => !dependencyDirectories.has(path));
    for (const path of paths) dependencyDirectories.add(path);
    dependencyWatcher.add(paths);
  }

  const inspectionRuntime = createRuntime(createNodeRuntimeAdapter());
  let sourceGeneration = 0;
  async function compileSelectedBundle(selection: PreviewSelection, selectedEntryId = entryId) {
    const selectedEntry = selectedEntryId === undefined
      ? undefined
      : collectionSnapshot?.entries.find((item) => item.id === selectedEntryId);
    if (collectionSnapshot && selectedEntryId !== undefined && !selectedEntry) throw new TypeError(`Unknown collection entry ${JSON.stringify(selectedEntryId)}`);
    const { iife: rawIife, esm: rawEsm } = await bundleMediaProgramPair(templatePath, {
      projectRoot,
      onDependencies: watchDependencies,
      selection: { variantId: selection.variantId, editionId: selection.editionId, ...((selectedEntry?.data ?? (isCollectionSource ? undefined : entryData)) === undefined ? {} : { entryData: (selectedEntry?.data ?? entryData) as JsonObject }) },
    });
    const { compileTemplate } = await import("@superimg/core");
    const compiled = compileTemplate(rawIife);
    if (compiled.error || (!compiled.media && !compiled.interactive)) throw compiled.error ?? new Error("Template compilation failed");
    assertInteractiveSelection(compiled.interactive, selection);
    const cascading = await loadCascadingConfig(templatePath, projectRoot);
    const media = compiled.media && Object.freeze({ ...compiled.media, config: Object.freeze(mergeCascadingIntoRenderConfig(compiled.media.config, cascading)) }) as DeterministicMediaDefinition<JsonObject>;
    const interactive = compiled.interactive;
    const coordinates = Object.freeze({ ...(selectedEntryId === undefined ? {} : { entryId: selectedEntryId }), variantId: selection.variantId, editionId: selection.editionId });
    const sourceId = normalizeSourceId(basename(templatePath));
    const source = { id: sourceId, revision: rawIife.outputIdentity ?? hashBytes(rawIife.code) };
    const previewSource = { id: sourceId, revision: rawEsm.outputIdentity ?? hashBytes(rawEsm.code) };
    const esm = { ...rawEsm, source: previewSource };
    return { iife: rawIife.code, esm, source, previewSource, media, interactive, coordinates, inputIdentity: rawIife.inputIdentity, projectionIdentity: rawIife.projectionIdentity };
  }
  type SelectedBundle = Awaited<ReturnType<typeof compileSelectedBundle>>;
  const bundleCaches = new Map<string, ReturnType<typeof createDevSourceCache<SelectedBundle>>>();
  const bundleCache = {
    get generation() { return sourceGeneration; },
    invalidate() { sourceGeneration += 1; bundleCaches.clear(); },
    get(selection: PreviewSelection = { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }, selectedEntryId = entryId): Promise<{ generation: number; value: SelectedBundle }> {
      const key = JSON.stringify([collectionSnapshotId, selection, selectedEntryId]);
      let cache = bundleCaches.get(key);
      if (!cache) { cache = createDevSourceCache(() => compileSelectedBundle(selection, selectedEntryId), () => TEMPLATE_COMPILER_BEHAVIOR); bundleCaches.set(key, cache); if (bundleCaches.size > 32) bundleCaches.delete(bundleCaches.keys().next().value!); }
      const requestedGeneration = sourceGeneration;
      return cache.get().then(({ value }) => requestedGeneration === sourceGeneration
        ? ({ generation: requestedGeneration, value })
        : this.get(selection, selectedEntryId));
    },
  };
  function invalidateSource(invalidateCollection = true) {
    for (const controller of collectionControllers) controller.abort(new Error("Collection source changed during operation"));
    bundleCache.invalidate();
    irCache = null;
    if (invalidateCollection && collectionSnapshot) {
      collectionSnapshot = undefined;
      collectionSnapshotId = undefined;
      collectionSnapshotGeneration += 1;
    }
  }
  const getBundle = (selection?: PreviewSelection, selectedEntryId?: string) => bundleCache.get(selection, selectedEntryId);

  function requestEntry(reqUrl: string): string | undefined {
    if (!collectionSnapshot) {
      if (isCollectionSource) throw Object.assign(new Error("Collection snapshot is stale; refresh entries."), { statusCode: 409 });
      if (new URL(reqUrl, url).searchParams.has("entryId")) throw Object.assign(new Error("Collection snapshot is stale; refresh entries."), { statusCode: 409 });
      return entryId;
    }
    const params = new URL(reqUrl, url).searchParams;
    const requestedId = params.get("entryId");
    if (requestedId === null) return collectionSnapshot.entries.find((item) => item.id === entryId)?.id ?? collectionSnapshot.entries[0]?.id;
    const activeId = params.get("snapshotId");
    const generation = params.get("generation");
    if (activeId !== collectionSnapshotId || generation === null || Number(generation) !== collectionSnapshotGeneration) {
      throw Object.assign(new Error("Collection snapshot is stale; refresh entries."), { statusCode: 409 });
    }
    if (!collectionSnapshot.entries.some((item) => item.id === requestedId)) throw new TypeError(`Unknown collection entry ${JSON.stringify(requestedId)}`);
    return requestedId;
  }

  async function getMediaIR(selection?: PreviewSelection, selectedEntryId?: string): Promise<DevIR> {
    const { value: { iife, source, previewSource, media, inputIdentity, projectionIdentity }, generation: gen } = await getBundle(selection, selectedEntryId);
    if (!media) throw unsupportedInteractiveInspection();
    const { resolveMediaIR } = await import("@superimg/core");
    if (gen !== bundleCache.generation) return getMediaIR(selection, selectedEntryId);
    const inspected = inspectIRAssets(templatePath, media);
    watcher?.add(inspected.watchPaths);
    const assetKey = inspected.additionalAssets
      .map((asset) => `${asset.id}:${asset.contentHash ?? asset.src}`)
      .join("|");
    const key = hashBytes(`${iife}\n${assetKey}\n${JSON.stringify([selection ?? { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }, selectedEntryId])}`);
    if (gen !== bundleCache.generation) return getMediaIR(selection, selectedEntryId);
    if (irCache && irCache.key === key && irCache.generation === gen) return irCache.value;
    if (irCompileInFlight && irCompileInFlight.key === key && irCompileInFlight.generation === gen) {
      return irCompileInFlight.promise;
    }

    // Capture the local epoch so concurrent resolves cannot supersede each other.
    const compile = (async () => {
      const result = await resolveMediaIR(media, {
        sourceId: normalizeSourceId(basename(templatePath)),
        programHash: source.revision,
        additionalAssets: inspected.additionalAssets,
        additionalIssues: inspected.additionalIssues,
        sourceDir: dirname(templatePath),
      });
      const ir = result.ir;
      // Only publish cache if no newer invalidation happened while we resolved.
      if (gen === bundleCache.generation) {
        const value: DevIR = { media: ir, generation: gen, source, previewSource,
          ...(inputIdentity === undefined ? {} : { inputIdentity }),
          ...(projectionIdentity === undefined ? {} : { projectionIdentity }),
        };
        irCache = { generation: gen, key, value };
        return value;
      }
      return getMediaIR(selection, selectedEntryId);
    })().catch((error) => {
      if (gen !== bundleCache.generation) return getMediaIR(selection, selectedEntryId);
      throw error;
    });
    irCompileInFlight = { generation: gen, key, promise: compile };
    try {
      return await compile;
    } finally {
      if (irCompileInFlight?.promise === compile) irCompileInFlight = null;
    }
  }

  async function loadTemplateConfig(selection?: PreviewSelection, selectedEntryId?: string): Promise<Record<string, unknown>> {
    const { value: { source, previewSource, media, interactive, coordinates, inputIdentity, projectionIdentity }, generation } = await getBundle(selection, selectedEntryId);
    if (generation !== bundleCache.generation) return loadTemplateConfig(selection, selectedEntryId);
    if (interactive) {
      const clock = resolveInteractiveClock(interactive.guide as never);
      const size = interactive.size ? resolveInteractiveSize(interactive.size) : { width: 1920, height: 1080 };
      return { previewKind: "interactive", sourceKind: "interactive", ...size, fps: clock.fps, duration: clock.durationSeconds, sourceId: normalizeSourceId(basename(templatePath)), source, previewSource, inputIdentity, projectionIdentity, generation, variants: [], editions: [], ...coordinates };
    }
    if (!media) throw new Error("Template did not compile to a previewable media definition");
    const templateConfig = media.config;
    const resolved = resolveRenderConfig(templateConfig === undefined ? {} : { templateConfig });
    const registerDevAsset = (path: string) => `/api/assets/${assetRegistry.register(path)}`;
    const assetUrls = resolveDevAssetUrls(templateConfig?.assets, dirname(templatePath), registerDevAsset);
    addDiscoveredDevAssetUrls(assetUrls, discoverTemplateAssets(dirname(templatePath)), registerDevAsset);
    return {
      previewKind: "media",
      sourceKind: isCollectionSource ? "collection" : "media",
      ...(collectionInfo() === undefined ? {} : { collection: collectionInfo() }),
      mediaKind: media.media,
      variants: Object.keys(media.variants ?? {}).map((id) => ({ id })),
      editions: Object.keys(media.editions ?? {}).map((id) => ({ id })),
      width: resolved.width,
      height: resolved.height,
      fps: resolved.fps,
      duration: resolved.duration,
      audio: resolveDevAudio(templateConfig?.audio, dirname(templatePath), assetRegistry),
      assetUrls,
      fonts: await resolveDevFonts(templateConfig?.fonts, dirname(templatePath)),
      templateDir: dirname(templatePath),
      sourceId: normalizeSourceId(basename(templatePath)),
      source,
      previewSource,
      inputIdentity,
      projectionIdentity,
      generation,
      ...coordinates,
    };
  }

  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  // Collect _config.ts files from template dir up to project root so config
  // changes also trigger a reload (mirroring the loadCascadingConfig walk).
  const configsToWatch: string[] = [];
  {
    let dir = dirname(templatePath);
    while (dir && dir.length >= projectRoot.length) {
      const cp = join(dir, "_config.ts");
      configsToWatch.push(cp);
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  watcher = chokidar.watch(
    [templatePath, join(dirname(templatePath), "assets"), ...configsToWatch],
    {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
    },
  );
  /** Last published IR for hot-reload classification (hashes + clock). */
  let lastPublishedIR: import("@superimg/types").MediaIR | null = null;

  function broadcast(payload: Record<string, unknown>): void {
    const msg = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  }

  function onSourceChange(event: string) {
    if (!["add", "change", "unlink", "addDir", "unlinkDir"].includes(event)) {
      return;
    }
    invalidateSource();
    // Epoch for this watch event — late async completions with older epochs are ignored.
    const publishEpoch = bundleCache.generation;
    // Watcher-driven IR compile + hot-reload classification (no separate ir-update).
    void (async () => {
      try {
        const { classifyHotReload } = await import("./hot-reload.js");
        const { media, source, previewSource } = await getMediaIR();
        const { shouldBroadcastWatchSuccess } = await import("./dev-server-ir.js");
        // Superseded by a newer file change — do not broadcast.
        if (!shouldBroadcastWatchSuccess(publishEpoch, bundleCache.generation)) return;

        const decision = classifyHotReload({
          prev: lastPublishedIR,
          next: media,
        });
        lastPublishedIR = media;
        const type =
          decision.class === "intent-compatible"
            ? "intent-compatible"
            : decision.class === "clock-change"
              ? "clock-change"
              : decision.class;
        broadcast({
          type,
          nextPlayheadFrame: decision.nextPlayheadFrame,
          keepStalePreview: decision.keepStalePreview,
          source,
          previewSource,
          generation: publishEpoch,
        });
      } catch (err) {
        const { shouldBroadcastCompileError } = await import("./dev-server-ir.js");
        if (!shouldBroadcastCompileError(err, publishEpoch, bundleCache.generation)) {
          return;
        }

        broadcast({
          type: "compile-error",
          keepStalePreview: true,
          message: err instanceof Error ? err.message : String(err),
          error: formatError(err).json,
          generation: publishEpoch,
        });
      }
    })();
  }
  watcher.on("all", onSourceChange);
  dependencyWatcher.on("all", (event, changedPath) => {
    // Track only compiler-resolved dependency files. Provider data read dynamically
    // at runtime belongs to the retained snapshot and must not trigger a replay.
    if (changedPath === templatePath || configsToWatch.includes(changedPath)) return;
    if (/\.(?:(?:media\.)?[cm]?[jt]sx?|script\.md)$/i.test(changedPath)) onSourceChange(event);
  });

  const moduleSets = new Map<string, NonNullable<TemplateBundle["outputs"]>>();
  const server = createHttpServer(async (req, res) => {
    const reqUrl = req.url || "/";
    const pathname = reqUrl.split("?")[0] ?? "/";

    if (serveModuleSet(pathname, res, moduleSets)) return;

    if (await mediaApi.handle(req, res, pathname)) return;
    if (await serveVideosApi(pathname, res, library, projectRoot, inspectionRuntime, reqUrl, assetRegistry, undefined, moduleSets)) return;

    if (pathname === "/api/config") {
      try {
        if (isCollectionSource && !collectionSnapshot) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ previewKind: "collection-unavailable", sourceKind: "collection", sourceId: collectionSourceId, collection: collectionInfo(), width: 1920, height: 1080, fps: 30, duration: 1 }));
          return;
        }
        const selectedEntryId = requestEntry(reqUrl);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(await loadTemplateConfig(requestSelection(reqUrl, { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }), selectedEntryId)));
      } catch (err) {
        if (isCollectionSource && typeof err === "object" && err !== null && "statusCode" in err && Number(err.statusCode) === 409) {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ previewKind: "collection-unavailable", sourceKind: "collection", sourceId: collectionSourceId, collection: { ...collectionInfo(), staleRequest: true }, width: 1920, height: 1080, fps: 30, duration: 1 }));
          return;
        }
        res.statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/template") {
      try {
        const selectedEntryId = requestEntry(reqUrl);
        const { value: { esm } } = await getBundle(requestSelection(reqUrl, { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }), selectedEntryId);
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-cache");
        res.end(esm.code);
      } catch (err) {
        res.statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/template-bundle") {
      try {
        if (new URL(reqUrl, url).searchParams.get("reload") === "1") invalidateSource(false);
        const selectedEntryId = requestEntry(reqUrl);
        const { value: { esm, media }, generation } = await getBundle(requestSelection(reqUrl, { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }), selectedEntryId);
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        const moduleUrl = registerModuleSet(moduleSets, esm);
        registerNativeModuleSets(moduleSets, media);
        const { nativeModuleSets: _nativeModuleSets, ...previewBundle } = esm;
        res.end(JSON.stringify({ ...previewBundle, generation, ...(moduleUrl ? { moduleUrl } : {}) }));
      } catch (err) {
        res.statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/inspect") {
      const controller = new AbortController();
      res.once("close", () => { if (!res.writableEnded) controller.abort(); });
      try {
        const frame = inspectionFrame(reqUrl);
        const read = async (): Promise<unknown> => {
          const selection = requestSelection(reqUrl, { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" });
          const selectedEntryId = requestEntry(reqUrl);
          const { value: { media, coordinates, previewSource, inputIdentity, interactive }, generation } = await getBundle(selection, selectedEntryId);
          if (interactive) throw unsupportedInteractiveInspection();
          if (!media) throw new Error("Template did not compile to deterministic media");
          if (!media.animated && frame !== 0) throw new TypeError("Static media only has frame 0");
          const report = await runtimeInspect(inspectionRuntime, media, { at: media.animated ? `${frame}f` : 0, providers: "skip", renderedLayout: false, signal: controller.signal });
          if (generation !== bundleCache.generation) return read();
          return { source: previewSource, inputIdentity, generation, frame, ...scopeProjectedInspection(report, coordinates) };
        };
        const packet = await read();
        if (controller.signal.aborted) return;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(JSON.stringify(packet));
      } catch (err) {
        if (controller.signal.aborted) return;
        res.statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : isUnsupportedInteractiveInspection(err) ? 409 : err instanceof TypeError ? 400 : 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    if (pathname === "/api/ir") {
      try {
        const selectedEntryId = requestEntry(reqUrl);
        const value = await getMediaIR(requestSelection(reqUrl, { variantId: requestedVariant ?? "default", editionId: requestedEdition ?? "default" }), selectedEntryId);
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-cache");
        res.end(JSON.stringify({ schemaVersion: 0, ...value }));
      } catch (err) {
        res.statusCode = typeof err === "object" && err !== null && "statusCode" in err ? Number(err.statusCode) : isUnsupportedInteractiveInspection(err) ? 409 : 500;
        res.end(JSON.stringify({ error: formatError(err).json }));
      }
      return;
    }

    const assetMatch = pathname.match(/^\/api\/assets\/([0-9a-f-]{36})$/i);
    if (assetMatch) {
      serveRegisteredAsset(req, res, assetRegistry, assetMatch[1]);
      return;
    }

    if (pathname === "/ws") return;
    serveStaticFile(pathname, devRoot, res);
  });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(request.url || "", `http://localhost:${port}`);
    if (reqUrl.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
    } else {
      socket.destroy();
    }
  });

  await listen(server, port);

  return {
    url,
    close: async () => {
      for (const controller of collectionControllers) controller.abort(new Error("Dev server closed"));
      await watcher?.close();
      await dependencyWatcher.close();
      await inspectionRuntime.dispose();
      await interactionSession.dispose();
      wss.close();
      await mediaApi.dispose();
      server.closeAllConnections();
      await closeServer(server);
      assetRegistry.clear();
    },
  };
}

function resolveDevAudio(
  audio: AudioValue | undefined,
  templateDir: string,
  registry: AssetRegistry,
): AudioValue | undefined {
  if (!audio) return audio;
  const resolveClip = (clip: AudioClip): AudioClip => {
    if (/^(https?:|data:|blob:)/.test(clip.src)) return clip;
    const absolutePath = isAbsolute(clip.src) ? clip.src : resolve(templateDir, clip.src);
    return { ...clip, src: `/api/assets/${registry.register(absolutePath)}` };
  };
  if (Array.isArray(audio)) return audio.map(resolveClip);
  if ("clips" in audio) return { ...audio, clips: audio.clips.map(resolveClip) };
  return resolveClip(audio);
}

function serveRegisteredAsset(
  req: IncomingMessage,
  res: ServerResponse,
  registry: AssetRegistry,
  id: string | undefined,
): void {
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  const result = openRegisteredAsset(registry, id, {
    method: req.method === "HEAD" ? "HEAD" : "GET",
    ...(typeof req.headers.range === "string" ? { range: req.headers.range } : {}),
    signal: controller.signal,
  });
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  if (!result.body) {
    res.end();
    return;
  }
  result.body.on("error", (error) => {
    if (!controller.signal.aborted) res.destroy(error);
  });
  result.body.pipe(res);
}

function serveStaticFile(pathname: string, devRoot: string, res: ServerResponse): void {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = join(devRoot, safePath);
  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  const ext = filePath.split(".").pop();
  const types: Record<string, string> = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
  };
  res.setHeader("Content-Type", types[ext ?? ""] ?? "application/octet-stream");
  res.end(readFileSync(filePath));
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function parseRequestJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > 1_000_000) throw new TypeError("Collection request exceeds size limit");
    chunks.push(bytes);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Collection request must be an object");
  return value as Record<string, unknown>;
}
