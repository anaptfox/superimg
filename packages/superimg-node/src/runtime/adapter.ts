import {
  parseDuration,
  renderTemplateFrame,
  resolveAudioTimeline,
} from "@superimg/core";
import { createPreparedStdlibForTemplate } from "@superimg/core/player-core";
import { buildPageShell } from "@superimg/core/html";
import {
  nodeEnsureInit,
  rasterizeSvgSync,
  countSvgTextElements,
} from "@superimg/core/rendering/resvg-rasterizer.node";
import {
  parseRuntimeAt,
  prepareRuntimeCompositionMedia,
  type RuntimeAdapter,
  type RuntimeAdapterExportRequest,
  type RuntimeAdapterPreflight,
  type RuntimeAdapterPreflightRequest,
  type RuntimeAdapterRenderRequest,
  type RuntimeAdapterArtifactData,
  type RuntimeArtifactBacking,
} from "@superimg/core/runtime";
import { PlaywrightEngine } from "@superimg/playwright/engine";
import { randomUUID } from "node:crypto";
import { ExportArtifactStorage } from "./artifact-storage.js";
import {
  RuntimeCancelledError,
  SuperImgError,
  resolveCaptureDefaults,
  isAlphaCodecContainerCompatible,
  resolveCaptureRegion,
  type DeterministicMediaDefinition,
  type EncodingOptions,
  type ExactRenderFormat,
  type ExportProgressEvent,
  type ExportProgressItem,
  type ExportProgressWork,
  type JsonObject,
  type MediaRuntimeCapabilities,
  type OutputFormat,
  type RuntimeAnimatedFormat,
  type RuntimeFinding,
  type RuntimeRasterFormat,
  type RuntimeRenditionCoordinates,
} from "@superimg/types";
import { accessSync, constants as fsConstants, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { delimiter, dirname, join, resolve } from "node:path";
import { deterministicDefinition, mediaForRendition, prepareExportPlan, withoutSource, type PreparedExportPlan } from "./plan.js";
import { prepareRuntimeResources, type PreparedRuntimeResources, type RuntimeFetch } from "./resources.js";
import { convertNativeMedia, inspectNativeMedia } from "./media.js";
import { CompositionFrameCache, type CompositionFrameCacheOptions } from "./composition-frame-cache.js";
import { aliasSvgFont, UnsupportedSvgFontAliasError } from "@superimg/core/edge";

const ABI = "superimg-runtime-v0/node";
/** Host-owned, operation-scoped optional capture; image bytes never enter portable reports. */
export interface InspectionPaintCapture {
  enabled: boolean;
  dpr: number;
  pair?: { visible: Uint8Array; background: Uint8Array };
}
export interface NodeRuntimeAdapterOptions {
  /** Host-only diagnostics; no observer enters authored media or portable IR. */
  readonly onTiming?: import("@superimg/types").FrameCaptureOptions["onTiming"];
  readonly onInspectionDiagnostics?: (value: JsonObject) => void;
  readonly inspectionPaintCapture?: InspectionPaintCapture;
  /** Record Playwright inspection traces only when rendered layout is requested. */
  readonly inspectionTraceDirectory?: string;
  readonly fetch?: RuntimeFetch;
  readonly createEngine?: () => PlaywrightEngine;
  /** Reuse Chromium still pages. Off unless a long-lived host opts in. */
  readonly poolStillPages?: boolean;
  /** Private test/embedding override; defaults to cheap backing detection. */
  readonly rasterFormats?: readonly RuntimeRasterFormat[];
  /** Private test/embedding override; defaults to cheap backing detection. */
  readonly animatedFormats?: readonly RuntimeAnimatedFormat[];
  readonly defaultFonts?: import("@superimg/types").InitOptions["defaultFonts"];
  /** Opt-in bounded reuse of captured retained-composition frames. */
  readonly compositionFrameCache?: CompositionFrameCacheOptions;
  /** Maximum total bytes fetched during `prepareNodeMediaExport`. Defaults to 64 MiB. */
  readonly maxFetchedBytes?: number;
}

export function nodePlaywrightEngineOptions(
  options: Pick<NodeRuntimeAdapterOptions, "poolStillPages" | "onTiming"> = {},
): { perRenderContext: true; poolStillPages?: true; onTiming?: NonNullable<import("@superimg/types").FrameCaptureOptions["onTiming"]> } {
  return {
    perRenderContext: true,
    ...(options.poolStillPages === true ? { poolStillPages: true as const } : {}),
    ...(options.onTiming ? { onTiming: options.onTiming } : {}),
  };
}

export interface NodePreparedState {
  readonly resources: PreparedRuntimeResources;
  readonly exportPlan?: PreparedExportPlan;
  readonly render?: PreparedCompositionMedia;
  readonly renditions?: ReadonlyMap<string, PreparedCompositionMedia>;
}

interface PreparedCompositionMedia {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly resources?: PreparedRuntimeResources;
}

function renditionKey(coordinates: RuntimeRenditionCoordinates): string {
  return JSON.stringify([
    coordinates.entryId ?? null,
    coordinates.variantId,
    coordinates.editionId,
    coordinates.renditionId,
  ]);
}

/**
 * A retained composition first plans on the canvas and clock recorded by
 * time(). A destination applies its canvas and delivery frame rate afterward.
 */
function compositionPreparation(
  definition: DeterministicMediaDefinition<JsonObject>,
  requested: { readonly width: number; readonly height: number },
  fps: number,
): { readonly size: { readonly width: number; readonly height: number }; readonly fps: number } {
  const composition = definition.composition;
  return composition
    ? { size: composition.outputSize, fps: composition.schedule.fps }
    : { size: requested, fps };
}

export function createNodeRuntimeAdapter(options: NodeRuntimeAdapterOptions = {}): RuntimeAdapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new TypeError("The Node runtime requires global fetch support");
  const capabilities = nodeCapabilities(options);
  const compositionFrameCache = new CompositionFrameCache(options.compositionFrameCache);
  let enginePromise: Promise<PlaywrightEngine> | undefined;
  let disposed = false;

  const getEngine = (): Promise<PlaywrightEngine> => {
    if (disposed) return Promise.reject(new Error("Node runtime adapter has been disposed"));
    if (enginePromise === undefined) {
      const engine = options.createEngine?.() ?? new PlaywrightEngine(nodePlaywrightEngineOptions(options));
      enginePromise = engine.init().then(() => engine).catch((error) => {
        enginePromise = undefined;
        return engine.dispose().catch(() => undefined).then(() => Promise.reject(error));
      });
    }
    return enginePromise;
  };

  return {
    abi: ABI,
    capabilities,

    async inspect(request) {
      // Semantic analysis resolves collection entry, variant, and edition before
      // this adapter runs. Resources may differ by edition, so never fall back
      // to the collection's base media when selections are available.
      const definitions = request.selections?.map((selection) => selection.media) ?? [
        deterministicDefinition(request.media as never),
      ];
      const resources = await Promise.all(
        definitions.map((definition) =>
          prepareRuntimeResources(definition, fetcher, request.options.signal, options.defaultFonts)
        ),
      );
      const findings = resources.flatMap((resource) => resource.findings);
      const renderedLayout: JsonObject[] = [];
      if (request.options.renderedLayout === true) {
        for (let index = 0; index < definitions.length; index++) {
          request.options.signal?.throwIfAborted();
          const definition = definitions[index]!;
          const selection = request.selections?.[index];
          const coordinates = selection?.coordinates ?? { variantId: "default", editionId: "default" };
          const width = definition.config?.width ?? 1920;
          const height = definition.config?.height ?? 1080;
          try {
            const frame = await renderedFrame(definition, selection?.data ?? definition.sample ?? {}, width, height, request.options.at ?? 0, resources[index]!);
            const engine = await getEngine();
            const paint = options.inspectionPaintCapture;
            const observation = await engine.inspectFrame(
              definition.medium === "svg" ? svgDocument(frame.svg ?? frame.html, definition, resources[index]!) : frame.compositeHtml,
              rendererConfig(definition, width, height, resources[index]!, { format: "png", capture: { dpr: paint?.enabled ? paint.dpr : 1 } }),
              { time: frame.frame / (definition.config?.fps ?? 30), ...(request.options.signal ? { signal: request.options.signal } : {}) },
              { ...(options.inspectionTraceDirectory ? { tracePath: join(options.inspectionTraceDirectory, `frame-${frame.frame}-${randomUUID()}.zip`) } : {}), ...(paint?.enabled ? { captureTextPair: true } : {}) },
            );
            try { options.onInspectionDiagnostics?.({ ...JSON.parse(JSON.stringify(observation.diagnostics)), ...(observation.trace ? { trace: observation.trace } : {}) }); } catch { /* Observation cannot change inspection success. */ }
            const { paintPair, ...layout } = observation;
            if (paint?.enabled && paintPair) paint.pair = paintPair;
            renderedLayout.push({ ...JSON.parse(JSON.stringify(layout)), coordinates, frame: frame.frame, width, height });
            if (observation.coverage.truncated) findings.push({ severity: "warning", category: "render", code: "RENDERED_LAYOUT_TRUNCATED", message: `Browser layout observation was truncated (limits: ${observation.coverage.maxNodes} nodes, ${observation.coverage.maxTextLength} characters per text field)`, coordinates });
          } catch (error) {
            const captured = (error && typeof error === "object" ? error : {}) as { inspectionDiagnostics?: JsonObject; inspectionTrace?: JsonObject };
            const details = { ...(captured.inspectionDiagnostics ? { diagnostics: captured.inspectionDiagnostics } : {}), ...(captured.inspectionTrace ? { trace: captured.inspectionTrace } : {}) };
            try { if (Object.keys(details).length) options.onInspectionDiagnostics?.(details); } catch { /* Preserve the original failure. */ }
            request.options.signal?.throwIfAborted();
            findings.push({ ...nativeFinding("RENDERED_LAYOUT_FAILED", error instanceof Error ? error.message : String(error)), coordinates, ...(Object.keys(details).length ? { details } : {}) });
          }
        }
      }
      return {
        findings,
        assets: resources.flatMap((resource) => resource.assets),
        fonts: resources.flatMap((resource) => resource.fonts),
        metadata: Object.freeze({ resourcePreflight: "frozen-bytes", ...(request.options.renderedLayout === true ? { renderedLayout } : {}) }),
      };
    },

    async inspectFile(input, signal) {
      return await inspectNativeMedia(input, fetcher, signal);
    },

    async convertMedia(request) {
      return await convertNativeMedia(request.request, fetcher, request.checkpoint, request.finalizing, request.preflight);
    },

    async resolveCollectionEntries({ collection, signal }) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      if (typeof collection.entries !== "function") return collection.entries;
      if (collection.entries.length !== 0) {
        throw new TypeError("Collection providers must be zero-argument functions");
      }
      return await collection.entries();
    },

    async preflight(request) {
      return await preflightNode(request, fetcher, capabilities, options.defaultFonts);
    },

    async render(request) {
      const prepared = preparedState(request.preflight);
      const selection = prepared.render ?? {
        definition: request.selection.media,
        data: request.selection.data,
      };
      const definition = selection.definition;
      const width = request.options.size?.width ?? definition.config?.width ?? 1920;
      const height = request.options.size?.height ?? definition.config?.height ?? 1080;
      const bytes = await renderExact({
        definition,
        data: selection.data,
        format: request.options.as,
        width,
        height,
        ...(request.options.at !== undefined ? { at: request.options.at } : {}),
        ...(request.options.encoding !== undefined ? { encoding: request.options.encoding } : {}),
        resources: prepared.resources,
        getEngine,
        compositionFrameCache,
        ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
      });
      return {
        as: request.options.as,
        mimeType: mimeType(request.options.as),
        coordinates: request.selection.coordinates,
        bytes,
      };
    },

    async exportMedia(request) {
      return await executeExport(request, getEngine, compositionFrameCache);
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      const pending = enginePromise;
      enginePromise = undefined;
      if (pending !== undefined) {
        const engine = await pending.catch(() => undefined);
        await engine?.dispose();
      }
    },
  };
}

async function preflightNode(
  request: RuntimeAdapterPreflightRequest,
  fetcher: RuntimeFetch,
  capabilities: MediaRuntimeCapabilities,
  defaultFonts: NodeRuntimeAdapterOptions["defaultFonts"],
): Promise<RuntimeAdapterPreflight> {
  let definition = request.selection?.media ?? deterministicDefinition(request.media);
  let render: PreparedCompositionMedia | undefined;
  let renditions: ReadonlyMap<string, PreparedCompositionMedia> | undefined;
  if (request.operation === "render") {
    const renderOptions = request.options as RuntimeAdapterRenderRequest["options"];
    const width = renderOptions.size?.width ?? definition.config?.width ?? 1920;
    const height = renderOptions.size?.height ?? definition.config?.height ?? 1080;
    const fps = definition.config?.fps ?? 30;
    const preparation = compositionPreparation(definition, { width, height }, fps);
    const prepared = await prepareRuntimeCompositionMedia(
      definition,
      request.selection?.data ?? Object.freeze({}) as JsonObject,
      {
        size: preparation.size,
        fps: preparation.fps,
        ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
      },
    );
    if (prepared !== undefined) {
      render = { definition: prepared.media, data: prepared.data };
      definition = prepared.media;
    }
  }
  const resources = await prepareRuntimeResources(definition, fetcher, request.options.signal, defaultFonts);
  const findings: RuntimeFinding[] = [...resources.findings];
  let exportPlan: PreparedExportPlan | undefined;

  if (request.operation === "render") {
    const renderOptions = request.options as RuntimeAdapterRenderRequest["options"];
    if (renderOptions.encoding?.capture?.colorProfile === "display-p3") findings.push(nativeFinding("UNSUPPORTED_CAPTURE", "Node capture currently preserves sRGB only; Display-P3 is not available"));
    if (renderOptions.as === "html" && definition.medium !== "html") {
      findings.push(formatMismatch("html", definition.medium));
    }
  } else {
    const result = prepareExportPlan({
      programDigest: request.programDigest,
      media: request.media,
      ...(request.selections !== undefined ? { selections: request.selections } : {}),
      options: request.options as RuntimeAdapterExportRequest["options"],
      ...(request.entries !== undefined ? { entries: request.entries } : {}),
      capabilities,
    });
    findings.push(...result.findings);
    exportPlan = result.plan;
    if (exportPlan !== undefined) {
      const preparedRenditions = new Map<string, PreparedCompositionMedia>();
      for (const rendition of exportPlan.renditions) {
        const renditionDefinition = mediaForRendition(exportPlan.definition, rendition, exportPlan.selections);
        const fps = rendition.fps ?? renditionDefinition.config?.fps ?? 30;
        const preparation = compositionPreparation(renditionDefinition, rendition.canvas, fps);
        const prepared = await prepareRuntimeCompositionMedia(
          renditionDefinition,
          rendition.data,
          {
            size: preparation.size,
            fps: preparation.fps,
            ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
          },
        );
        const resolvedDefinition = prepared?.media ?? renditionDefinition;
        const renditionResources = await prepareRuntimeResources(resolvedDefinition, fetcher, request.options.signal, defaultFonts);
        findings.push(...renditionResources.findings);
        preparedRenditions.set(renditionKey(rendition.coordinates), {
          definition: resolvedDefinition,
          data: prepared?.data ?? rendition.data,
          resources: renditionResources,
        });
      }
      renditions = preparedRenditions;
      findings.push(...await validateNativeEncoding(exportPlan));
    }
  }

  const prepared: NodePreparedState = Object.freeze({
    resources,
    ...(exportPlan !== undefined ? { exportPlan } : {}),
    ...(render !== undefined ? { render } : {}),
    ...(renditions !== undefined ? { renditions } : {}),
  });
  return Object.freeze({
    findings: Object.freeze(findings),
    assets: resources.assets,
    fonts: resources.fonts,
    metadata: Object.freeze({ resourcePreflight: "frozen-bytes" }),
    prepared,
  });
}

/** Native codec probing stays in preflight so importing the runtime remains cold. */
async function validateNativeEncoding(plan: PreparedExportPlan): Promise<RuntimeFinding[]> {
  const findings: RuntimeFinding[] = [];
  for (const rendition of plan.renditions) {
    try {
      resolveCaptureRegion(rendition.canvas.width, rendition.canvas.height, rendition.encoding?.capture);
      if (rendition.encoding?.capture?.colorProfile === "display-p3") throw new TypeError("Node capture currently preserves sRGB only; Display-P3 requires an end-to-end color pipeline");
      if (rendition.encoding?.capture?.reconcile) throw new TypeError("Node capture does not support layout reconciliation");
      if (plan.definition.medium === "svg" && rendition.encoding?.capture !== undefined) throw new TypeError("Node native SVG rasterization does not support capture options");
    } catch (error) { findings.push(nativeFinding("UNSUPPORTED_CAPTURE", String(error))); }
  }
  if (plan.definition.config?.audio !== undefined) {
    for (const rendition of plan.renditions) {
      if (rendition.format === "gif") {
        findings.push(nativeFinding("NATIVE_GIF_AUDIO_UNSUPPORTED", "Node GIF exports do not support authored audio timelines"));
      }
    }
  }
  const videoRenditions = plan.renditions.filter((rendition) => ["mp4", "webm", "mov", "mkv"].includes(rendition.format));
  if (videoRenditions.length === 0) return findings;
  const media = await import("mediabunny");
  const { resolveNodeVideoQualityOptions, resolveNodeAudioQualityOptions } = await import("@superimg/playwright/engine");
  (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@mediabunny/server")).registerMediabunnyServer();
  (await import("@mediabunny/dts")).registerDtsEncoder();
  for (const rendition of videoRenditions) {
    try {
      const encoding = rendition.encoding;
      const format = rendition.format === "webm" ? new media.WebMOutputFormat() : rendition.format === "mkv" ? new media.MkvOutputFormat() : rendition.format === "mov" ? new media.MovOutputFormat() : new media.Mp4OutputFormat();
      const region = resolveCaptureRegion(rendition.canvas.width, rendition.canvas.height, encoding?.capture);
      const requested = encoding?.video?.codec ?? (rendition.format === "webm" ? ["vp9", "av1"] as const : ["avc", "vp9", "av1"] as const);
      const candidates = (typeof requested === "string" ? [requested] : [...requested]).filter((codec) => format.getSupportedVideoCodecs().includes(codec) && (encoding?.video?.alpha !== "keep" || isAlphaCodecContainerCompatible(rendition.format, codec)));
      const codec = await media.getFirstEncodableVideoCodec(candidates, { width: region.width, height: region.height, quality: new media.Quality(resolveNodeVideoQualityOptions(encoding?.video?.quality, encoding?.video?.hardwareAcceleration)), ...(encoding?.video?.alpha ? { alpha: encoding.video.alpha } : {}), ...(encoding?.video?.latencyMode ? { latencyMode: encoding.video.latencyMode } : {}), ...(encoding?.video?.hardwareAcceleration ? { hardwareAcceleration: encoding.video.hardwareAcceleration } : {}) });
      if (!codec) findings.push(nativeFinding("NATIVE_VIDEO_CODEC_UNAVAILABLE", `${rendition.format} cannot encode the requested video quality, codec and alpha combination`));
      const audio = encoding?.audio?.codec;
      if (audio !== undefined) {
        const candidates = (typeof audio === "string" ? [audio] : audio).filter((codec) => format.getSupportedAudioCodecs().includes(codec));
        let audioSupported = false;
        for (const candidate of candidates) {
          if (await media.getFirstEncodableAudioCodec([candidate], { numberOfChannels: 2, sampleRate: 48_000, quality: new media.Quality(resolveNodeAudioQualityOptions(candidate, encoding?.audio?.quality)) })) {
            audioSupported = true;
            break;
          }
        }
        if (!audioSupported) findings.push(nativeFinding("NATIVE_AUDIO_CODEC_UNAVAILABLE", `${rendition.format} cannot encode the requested audio codec and quality`));
      }
    } catch (error) { findings.push(nativeFinding("NATIVE_ENCODING_INVALID", String(error))); }
  }
  return findings;
}

function nativeFinding(code: string, message: string): RuntimeFinding { return Object.freeze({ severity: "error", category: "render", code, message }); }

async function executeExport(
  request: RuntimeAdapterExportRequest,
  getEngine: () => Promise<PlaywrightEngine>,
  compositionFrameCache: CompositionFrameCache,
) {
  const prepared = preparedState(request.preflight);
  const plan = prepared.exportPlan;
  if (plan === undefined) throw new TypeError("Node export executed without a prepared export plan");
  const artifacts = [];
  const storage = new ExportArtifactStorage();
  const diagnostics: JsonObject[] = [];
  const totalRenditions = plan.renditions.length;
  let completedRenditions = 0;
  await emitExportProgress(request.options.onProgress, stageProgress(
    "started",
    renditionWork(completedRenditions, totalRenditions),
  ));
  await emitExportProgress(request.options.onProgress, stageProgress(
    "running",
    renditionWork(completedRenditions, totalRenditions),
  ));

  try {
    for (const rendition of plan.renditions) {
      const preparedRendition = prepared.renditions?.get(renditionKey(rendition.coordinates));
      const definition = preparedRendition?.definition ?? mediaForRendition(plan.definition, rendition, plan.selections);
      const renditionData = preparedRendition?.data ?? rendition.data;
      const format = rendition.format;
      const item = renditionProgressItem(rendition);
      const totalFrames = isAnimatedFormat(format)
        ? animationFrameCount(definition, rendition.fps)
        : 1;
      let completedFrames = 0;
      await emitExportProgress(request.options.onProgress, itemProgress(
        item,
        "started",
        frameWork(completedFrames, totalFrames),
      ));

      let content: { bytes: Uint8Array } | { backing: RuntimeArtifactBacking };
      try {
        if (request.options.signal?.aborted) {
          throw request.options.signal.reason ?? new DOMException("Aborted", "AbortError");
        }
        if (isAnimatedFormat(format)) {
          content = await renderAnimated({
            definition,
            data: renditionData,
            format,
            width: rendition.canvas.width,
            height: rendition.canvas.height,
            ...(rendition.fps !== undefined ? { fps: rendition.fps } : {}),
            totalFrames,
            ...(request.lifecycle ? { lifecycle: request.lifecycle } : {}),
            ...(rendition.encoding ? { encoding: rendition.encoding } : {}),
            resources: preparedRendition?.resources ?? prepared.resources,
            getEngine,
            compositionFrameCache,
            storage,
            onDiagnostics: (value) => diagnostics.push({ renditionId: item.renditionId, ...value }),
            onProgress: async (completed) => {
              completedFrames = completed;
              await emitExportProgress(request.options.onProgress, itemProgress(
                item,
                "running",
                frameWork(completedFrames, totalFrames),
              ));
            },
            ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
          });
        } else {
          content = { bytes: await renderExact({
            definition,
            data: renditionData,
            format: format as ExactRenderFormat,
            width: rendition.canvas.width,
            height: rendition.canvas.height,
            ...(rendition.stillFrame !== undefined ? { at: rendition.stillFrame.at } : {}),
            ...(rendition.encoding !== undefined ? { encoding: rendition.encoding } : {}),
            resources: preparedRendition?.resources ?? prepared.resources,
            getEngine,
            compositionFrameCache,
            ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
          }) };
          completedFrames = 1;
          await emitExportProgress(request.options.onProgress, itemProgress(
            item,
            "running",
            frameWork(completedFrames, totalFrames),
          ));
        }
        await emitExportProgress(request.options.onProgress, itemProgress(
          item,
          "succeeded",
          frameWork(completedFrames, totalFrames),
        ));
      } catch (error) {
        const cancellation = exportCancellation(error, request.options.signal);
        await emitExportProgress(request.options.onProgress, itemProgress(
          item,
          cancellation === undefined ? "failed" : "cancelled",
          frameWork(completedFrames, totalFrames),
          error,
        ));
        throw cancellation ?? error;
      }

      const coordinates = withoutSource(rendition.coordinates);
      artifacts.push(Object.freeze({
        path: rendition.relativePath,
        mimeType: mimeType(format),
        coordinates: Object.freeze({ ...coordinates, renditionId: rendition.coordinates.renditionId }),
        ...content,
      } satisfies RuntimeAdapterArtifactData));
      completedRenditions += 1;
      await emitExportProgress(request.options.onProgress, stageProgress(
        "running",
        renditionWork(completedRenditions, totalRenditions),
      ));
    }
    await emitExportProgress(request.options.onProgress, stageProgress(
      "succeeded",
      renditionWork(completedRenditions, totalRenditions),
    ));
  } catch (error) {
    await storage.dispose();
    const cancellation = exportCancellation(error, request.options.signal);
    await emitExportProgress(request.options.onProgress, stageProgress(
      cancellation === undefined ? "failed" : "cancelled",
      renditionWork(completedRenditions, totalRenditions),
      error,
    ));
    throw cancellation ?? error;
  }
  return Object.freeze({
    coordinates: plan.coordinates,
    artifacts: Object.freeze(artifacts),
    metadata: Object.freeze({ encoding: diagnostics }),
  });
}

async function renderExact(input: {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly format: ExactRenderFormat;
  readonly width: number;
  readonly height: number;
  readonly at?: number | string;
  readonly encoding?: Omit<EncodingOptions, "format">;
  readonly resources: PreparedRuntimeResources;
  readonly getEngine: () => Promise<PlaywrightEngine>;
  readonly compositionFrameCache: CompositionFrameCache;
  readonly signal?: AbortSignal;
}): Promise<Uint8Array> {
  const fps = input.definition.config?.fps ?? 30;
  const frameIndex = renderFrameIndex(input.definition, input.at, fps);
  // Document outputs are source representations, never captured frame bytes.
  // Keep them outside this raster cache even when the composed root is HTML.
  if (input.format === "html" || input.format === "svg") {
    const frame = await renderedFrame(input.definition, input.data, input.width, input.height, input.at, input.resources);
    if (input.format === "html") {
      return new TextEncoder().encode(htmlDocument(frame.compositeHtml, input.definition, input.resources));
    }
    if (frame.lane === "svg" && frame.svg !== undefined) return new TextEncoder().encode(frame.svg);
    if (input.definition.medium === "svg") {
      return new TextEncoder().encode(svgDocument(frame.html, input.definition, input.resources));
    }
    throw new SuperImgError(
      `Cannot render ${input.definition.medium} media as an exact svg document`,
      "DOCUMENT_MEDIUM_MISMATCH",
      { medium: input.definition.medium, as: "svg", reasons: frame.browserReasons.map(reasonText) },
      "Request svg only when the still lowers to SVG, or render png/html.",
    );
  }
  const encoding: EncodingOptions = {
    ...(input.encoding ?? {}), format: input.format,
    ...(input.definition.medium === "svg" && input.encoding?.capture === undefined ? { capture: { dpr: 1 } } : {}),
  };
  const outputSize = capturedOutputSize(input.width, input.height, encoding);
  if (encoding.capture?.colorProfile === "display-p3") throw new TypeError("Node capture currently preserves sRGB only");
  const frameCache = input.definition.medium === "html"
    ? input.compositionFrameCache.lookup({
      definition: input.definition, data: input.data, resources: input.resources, width: input.width, height: input.height,
      outputFps: fps, outputFrame: frameIndex, authoredFps: fps, authoredFrame: frameIndex,
      format: input.format, ...(input.encoding === undefined ? {} : { encoding: input.encoding }),
    })
    : undefined;
  const cached = frameCache?.bytes;
  const deliverStill = async (bytes: Uint8Array, expected: { width: number; height: number }) => {
    if (input.format === "png" || input.format === "jpeg" || input.format === "webp") {
      await assertStillOutputSize(bytes, input.format, expected);
    }
    return bytes;
  };
  if (cached !== undefined) {
    if (input.format === "png" && input.encoding?.still === undefined) return deliverStill(cached, outputSize);
    return deliverStill(await transcodeStill(cached, input.format, outputSize.width, outputSize.height, input.encoding), outputSize);
  }
  const frame = await renderedFrame(input.definition, input.data, input.width, input.height, input.at, input.resources);
  if (frame.lane === "svg" && frame.svg !== undefined) {
    if (input.definition.medium === "svg" && input.encoding?.capture !== undefined) {
      throw new TypeError("Node native SVG rasterization does not support capture options");
    }
    let fontBuffers: Uint8Array[] | undefined;
    try {
      fontBuffers = countSvgTextElements(frame.svg) === 0 ? [...input.resources.fontBuffers]
        : input.resources.fontBuffers.map((bytes, index) => {
          const face = input.resources.fonts[index]!;
          return aliasSvgFont(bytes, face.family, face.weight ?? 400, face.style ?? "normal");
        });
    } catch (error) {
      if (!(error instanceof UnsupportedSvgFontAliasError)) throw error;
      if (input.resources.fontBuffers.some(bytes => bytes.length >= 12 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0) === 0x74746366 && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8) > 1)) {
        throw new TypeError("SVG font collections with unsupported face metadata cannot be selected reliably; provide a standalone font");
      }
      // Chromium implements @font-face aliases for containers this native
      // path cannot safely rewrite. The original owned font bytes are used.
    }
    if (fontBuffers !== undefined) {
      await nodeEnsureInit();
      const outputSize = input.definition.medium === "svg"
        ? { width: input.width, height: input.height }
        : capturedOutputSize(input.width, input.height, encoding);
      const png = rasterizeSvgSync(frame.svg, {
        width: outputSize.width,
        height: outputSize.height,
        fontBuffers,
        defaultFontFamily: "Inter",
      });
      return deliverStill(
        await transcodeStill(png, input.format, outputSize.width, outputSize.height, input.encoding),
        outputSize,
      );
    }
  }

  const engine = await input.getEngine();
  const { renderer, encoder } = engine.createAdapters({ encoding });
  try {
    await renderer.init(rendererConfig(input.definition, input.width, input.height, input.resources, encoding));
    const captured = await renderer.rasterize(frame.compositeHtml, {
      time: frame.frame / frame.ctx.fps,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    });
    if (input.definition.medium === "html") {
      input.compositionFrameCache.store(frameCache, Uint8Array.from(captured));
    }
    if (input.format === "png" && input.encoding?.still === undefined) {
      return deliverStill(Uint8Array.from(captured), outputSize);
    }
    return deliverStill(
      await transcodeStill(
        Uint8Array.from(captured),
        input.format,
        outputSize.width,
        outputSize.height,
        input.encoding,
      ),
      outputSize,
    );
  } finally {
    await Promise.allSettled([renderer.dispose(), encoder.dispose()]);
  }
}

/** Compare a still's pixel size to the planned canvas. PNG is read from IHDR; JPEG/WebP use sharp. */
export async function assertStillOutputSize(
  bytes: Uint8Array,
  format: "png" | "jpeg" | "webp",
  expected: { readonly width: number; readonly height: number },
): Promise<void> {
  const actual = await readStillPixelSize(bytes, format);
  if (actual === undefined) return;
  if (actual.width === expected.width && actual.height === expected.height) return;
  throw new SuperImgError(
    `Still ${format} is ${actual.width}×${actual.height}; expected ${expected.width}×${expected.height}`,
    "OUTPUT_SIZE_MISMATCH",
    {
      format,
      expectedWidth: expected.width,
      expectedHeight: expected.height,
      actualWidth: actual.width,
      actualHeight: actual.height,
    },
    "The written still must match the planned canvas times capture DPR.",
  );
}

async function readStillPixelSize(
  bytes: Uint8Array,
  format: "png" | "jpeg" | "webp",
): Promise<{ width: number; height: number } | undefined> {
  if (format === "png") return pngIhdrSize(bytes);
  const { default: sharp } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "sharp");
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) return undefined;
    return { width: meta.width, height: meta.height };
  } catch {
    return undefined;
  }
}

function pngIhdrSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.byteLength < 24) return undefined;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return undefined;
  }
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function capturedOutputSize(width: number, height: number, encoding: EncodingOptions): { width: number; height: number } {
  const region = resolveCaptureRegion(width, height, encoding.capture);
  const capture = resolveCaptureDefaults(encoding.format, encoding.capture, encoding.video?.alpha === "keep");
  const scale = capture.scale === "device" ? capture.dpr : 1;
  return { width: Math.round(region.width * scale), height: Math.round(region.height * scale) };
}

async function renderAnimated(input: {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly format: "mp4" | "webm" | "mov" | "mkv" | "gif";
  readonly width: number;
  readonly height: number;
  readonly fps?: number;
  readonly encoding?: Omit<EncodingOptions, "format">;
  readonly resources: PreparedRuntimeResources;
  readonly getEngine: () => Promise<PlaywrightEngine>;
  readonly compositionFrameCache: CompositionFrameCache;
  readonly totalFrames: number;
  readonly storage: ExportArtifactStorage;
  readonly onDiagnostics: (value: JsonObject) => void;
  readonly onProgress?: (completed: number) => void | Promise<void>;
  readonly lifecycle?: RuntimeAdapterExportRequest["lifecycle"];
  readonly signal?: AbortSignal;
}): Promise<{ bytes: Uint8Array } | { backing: RuntimeArtifactBacking }> {
  const fps = input.fps ?? input.definition.config?.fps ?? 30;
  const authoredFps = input.definition.composition?.schedule.fps ?? fps;
  const durationSeconds = duration(input.definition, authoredFps);
  const authoredFrames = input.definition.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(durationSeconds * authoredFps));
  const totalFrames = input.totalFrames;
  const encoding: EncodingOptions = { ...(input.encoding ?? {}), format: input.format };
  const resolvedAudio = resolveAudioTimeline(input.resources.audio, {
    fps,
    videoDurationSeconds: durationSeconds,
  });
  const engine = await input.getEngine();
  const { renderer, encoder } = engine.createAdapters({ encoding });
  let pendingEncode: Promise<void> = Promise.resolve();
  try {
    await renderer.init({ ...rendererConfig(input.definition, input.width, input.height, input.resources, encoding), fps });
    const region = resolveCaptureRegion(input.width, input.height, encoding.capture);
    const outputPath = encoder.finalizeToFile === undefined ? undefined : await input.storage.allocate(input.format);
    await encoder.init({
      width: Math.round(region.width), height: Math.round(region.height), fps, encoding,
      durationSeconds: totalFrames / fps,
      ...(resolvedAudio !== null ? { resolvedAudio } : {}),
      ...(outputPath === undefined ? {} : { output: { kind: "file", path: outputPath } }),
      onDiagnostics: (value) => input.onDiagnostics({ ...value }),
    });
    const preparedStdlib = await createPreparedStdlibForTemplate(input.definition as never);
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      await input.lifecycle?.checkpoint(frameIndex, totalFrames);
      if (input.signal?.aborted) throw input.signal.reason ?? new DOMException("Aborted", "AbortError");
      const authoredFrame = input.definition.composition === undefined
        ? frameIndex
        : Math.min(authoredFrames - 1, Math.floor(frameIndex * authoredFps / fps));
      const frameCache = input.definition.medium === "html"
        ? input.compositionFrameCache.lookup({
          definition: input.definition, data: input.data, resources: input.resources, width: input.width, height: input.height,
          outputFps: fps, outputFrame: frameIndex, authoredFps, authoredFrame,
          format: input.format, ...(input.encoding === undefined ? {} : { encoding: input.encoding }),
        })
        : undefined;
      let captured = frameCache?.bytes;
      if (captured === undefined) {
        const frame = renderTemplateFrame({
          template: input.definition as never,
          frame: authoredFrame,
          fps: authoredFps,
          durationSeconds,
          width: input.width,
          height: input.height,
          data: input.data,
          assets: input.resources.assetMetadata,
          assetResolver: (name) => input.resources.assetUrls[name] ?? name,
          composite: input.definition.medium === "html",
          preparedStdlib,
          fonts: metricFonts(input.resources),
        });
        captured = Uint8Array.from(await renderer.rasterize(
          frame.lane === "svg" ? (frame.svg ?? frame.html) : frame.compositeHtml,
          {
            time: frameIndex / fps,
            alpha: encoding.video?.alpha === "keep",
            ...(input.signal !== undefined ? { signal: input.signal } : {}),
          },
        ));
        if (input.definition.medium === "html") {
          input.compositionFrameCache.store(frameCache, captured);
        }
      }
      // Keep one ordered encoder write in flight while Chromium captures the
      // next frame. At most two captured buffers are live; failure is observed
      // before the next write and drained before adapter disposal.
      await pendingEncode;
      pendingEncode = encoder.addFrame(Buffer.from(captured), frameIndex / fps).then(async () => {
        await input.onProgress?.(frameIndex + 1);
      });
      void pendingEncode.catch(() => undefined);
    }
    await pendingEncode;
    await input.lifecycle?.checkpoint(totalFrames, totalFrames);
    input.lifecycle?.finalizing();
    if (outputPath !== undefined) {
      const result = await encoder.finalizeToFile!();
      if (result.path !== outputPath) throw new Error("Encoder returned a different output file");
      const backing = await input.storage.seal(outputPath, input.signal);
      if (backing.byteLength !== result.byteLength) throw new Error("Encoded file size changed during finalization");
      return { backing };
    }
    return { bytes: await encoder.finalize() };
  } finally {
    await pendingEncode.catch(() => undefined);
    await Promise.allSettled([renderer.dispose(), encoder.dispose()]);
  }
}

async function transcodeStill(
  png: Uint8Array,
  format: "png" | "jpeg" | "webp",
  width: number,
  height: number,
  encoding?: Omit<EncodingOptions, "format">,
): Promise<Uint8Array> {
  if (format === "png" && encoding?.still === undefined) return png;
  const { SharpStillEncoder } = await import("@superimg/playwright/sharp-still-encoder");
  const encoder = new SharpStillEncoder(format);
  try {
    const resolved: EncodingOptions = { ...(encoding ?? {}), format };
    await encoder.init({ width, height, fps: 1, encoding: resolved });
    await encoder.addFrame(Buffer.from(png));
    return Uint8Array.from(await encoder.finalize());
  } finally {
    await encoder.dispose();
  }
}

async function renderedFrame(
  definition: DeterministicMediaDefinition<JsonObject>,
  data: JsonObject,
  width: number,
  height: number,
  at: number | string | undefined,
  resources: PreparedRuntimeResources,
) {
  const fps = definition.config?.fps ?? 30;
  const durationSeconds = duration(definition, fps);
  const frame = renderFrameIndex(definition, at, fps);
  const preparedStdlib = await createPreparedStdlibForTemplate(definition as never);
  return renderTemplateFrame({
    template: definition as never,
    frame,
    fps,
    durationSeconds,
    ...(definition.composition ? { totalFrames: definition.composition.schedule.totalFrames } : {}),
    width,
    height,
    data,
    assets: resources.assetMetadata,
    assetResolver: (name) => resources.assetUrls[name] ?? name,
    composite: definition.medium === "html",
    preparedStdlib,
    fonts: metricFonts(resources),
  });
}

function renderFrameIndex(
  definition: DeterministicMediaDefinition<JsonObject>,
  at: number | string | undefined,
  fps: number,
): number {
  const authoredAt = at ?? definition.poster;
  const seconds = authoredAt === undefined ? 0 : parseRuntimeAt(authoredAt, fps);
  const totalFrames = definition.composition?.schedule.totalFrames ?? Math.ceil(duration(definition, fps) * fps);
  return Math.max(0, Math.min(totalFrames - 1, Math.round(seconds * fps)));
}

function metricFonts(resources: PreparedRuntimeResources) {
  return resources.fonts.flatMap((font, index) => {
    const data = resources.fontBuffers[index];
    if (!data) return [];
    return [{
      family: font.family,
      weight: font.weight ?? 400,
      style: font.style === "italic" ? "italic" as const : "normal" as const,
      data,
    }];
  });
}

function rendererConfig(
  definition: DeterministicMediaDefinition<JsonObject>,
  width: number,
  height: number,
  resources: PreparedRuntimeResources,
  encoding: EncodingOptions,
) {
  const capture = resolveCaptureDefaults(encoding.format, encoding.capture, encoding.video?.alpha === "keep");
  return {
    width,
    height,
    fps: definition.config?.fps ?? 30,
    fonts: [],
    inlineCss: [...(definition.config?.inlineCss ?? []), ...resources.fontCss],
    nativeModuleSets: resources.nativeModuleSets,
    stylesheets: definition.config?.stylesheets ?? [],
    ...(definition.config?.tailwind !== undefined ? { tailwind: definition.config.tailwind } : {}),
    mode: definition.config?.mode ?? "frame",
    ...(definition.config?.readiness !== undefined ? { readiness: definition.config.readiness } : {}),
    dpr: capture.dpr,
    capture: { ...capture, ...encoding.capture },
    ...(encoding.format ? { format: encoding.format } : {}),
  };
}

function htmlDocument(
  body: string,
  definition: DeterministicMediaDefinition<JsonObject>,
  resources: PreparedRuntimeResources,
): string {
  return injectFrame(buildPageShell({
    fonts: [],
    stylesheets: definition.config?.stylesheets ?? [],
    inlineCss: [...(definition.config?.inlineCss ?? []), ...resources.fontCss],
    ...(definition.config?.tailwind !== undefined ? { tailwind: definition.config.tailwind } : {}),
  }), body);
}

function svgDocument(
  svg: string,
  definition: DeterministicMediaDefinition<JsonObject>,
  resources: PreparedRuntimeResources,
): string {
  const css = [...(definition.config?.inlineCss ?? []), ...resources.fontCss].join("\n");
  if (css.length === 0) return svg;
  return svg.replace(/<svg\b([^>]*)>/i, `<svg$1><style>${css}</style>`);
}

function duration(definition: DeterministicMediaDefinition<JsonObject>, fps: number): number {
  if (!definition.animated) return 1 / fps;
  if (definition.composition) return definition.composition.schedule.totalFrames / definition.composition.schedule.fps;
  return parseDuration(definition.config?.duration, "duration", fps);
}

function animationFrameCount(
  definition: DeterministicMediaDefinition<JsonObject>,
  authoredFps?: number,
): number {
  const fps = authoredFps ?? definition.config?.fps ?? 30;
  const clock = definition.composition?.schedule;
  if (clock) return fps === clock.fps ? clock.totalFrames : Math.max(1, Math.ceil(clock.totalFrames * fps / clock.fps));
  return Math.max(1, Math.ceil(duration(definition, fps) * fps));
}

function renditionProgressItem(
  rendition: PreparedExportPlan["renditions"][number],
): ExportProgressItem {
  const coordinates = rendition.coordinates;
  const itemId = `runtime.render:${JSON.stringify([
    rendition.relativePath,
    coordinates.entryId ?? null,
    coordinates.variantId,
    coordinates.editionId,
    coordinates.renditionId,
  ])}`;
  return Object.freeze({
    itemId,
    kind: "rendition" as const,
    ...(coordinates.entryId === undefined ? {} : { entryId: coordinates.entryId }),
    variantId: coordinates.variantId,
    editionId: coordinates.editionId,
    renditionId: coordinates.renditionId,
  });
}

function renditionWork(completed: number, total: number): ExportProgressWork {
  return Object.freeze({ unit: "renditions", completed, total });
}

function frameWork(completed: number, total: number): ExportProgressWork {
  return Object.freeze({ unit: "frames", completed, total });
}

function stageProgress(
  state: ExportProgressEvent["state"],
  work: ExportProgressWork,
  error?: unknown,
): ExportProgressEvent {
  return progressEvent({ state, work, ...(error === undefined ? {} : { error }) });
}

function itemProgress(
  item: ExportProgressItem,
  state: ExportProgressEvent["state"],
  work: ExportProgressWork,
  error?: unknown,
): ExportProgressEvent {
  return progressEvent({ item, state, work, ...(error === undefined ? {} : { error }) });
}

function progressEvent(input: Readonly<{
  item?: ExportProgressItem;
  state: ExportProgressEvent["state"];
  work: ExportProgressWork;
  error?: unknown;
}>): ExportProgressEvent {
  const base = {
    schemaVersion: 0 as const,
    kind: "@foxworth/superimg/export-progress" as const,
    stageId: "runtime.render" as const,
    ...(input.item === undefined ? {} : { item: input.item }),
    work: input.work,
  };
  if (input.state === "failed") {
    return Object.freeze({
      ...base,
      state: "failed",
      error: portableProgressError(input.error),
    });
  }
  if (input.state === "cancelled") {
    const reason = errorMessage(input.error);
    return Object.freeze({
      ...base,
      state: "cancelled",
      ...(reason.length === 0 ? {} : { reason }),
    });
  }
  return Object.freeze({ ...base, state: input.state });
}

async function emitExportProgress(
  observer: RuntimeAdapterExportRequest["options"]["onProgress"],
  event: ExportProgressEvent,
): Promise<void> {
  if (observer === undefined) return;
  try {
    await observer(event);
  } catch {
    // Observation has no authority over export execution or output.
  }
}

function exportCancellation(
  error: unknown,
  signal?: AbortSignal,
): RuntimeCancelledError | undefined {
  if (!isExportCancelled(error, signal)) return undefined;
  if (isRuntimeCancelledError(error)) return error;
  const code = errorCode(error);
  return new RuntimeCancelledError({
    reason: errorMessage(error),
    ...(code === undefined ? {} : { causeCode: code }),
  });
}

function isExportCancelled(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted === true) return true;
  const name = errorName(error);
  if (name === "AbortError" || name === "TimeoutError") {
    return true;
  }
  const code = errorCode(error);
  return code === "aborted" || code === "deadline_exceeded" || code === "RUNTIME_CANCELLED";
}

function portableProgressError(error: unknown): Readonly<{ code?: string; message: string }> {
  const code = errorCode(error);
  return Object.freeze({
    ...(code === undefined ? {} : { code }),
    message: errorMessage(error),
  });
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    if (!("code" in error)) return undefined;
    return typeof error.code === "string" && error.code.length > 0 ? error.code : undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  try {
    if (
      error instanceof RuntimeCancelledError &&
      typeof error.details.reason === "string" &&
      error.details.reason.length > 0
    ) {
      return error.details.reason;
    }
    if (error instanceof Error && error.message.length > 0) return error.message;
    const message = String(error);
    return message.length > 0 ? message : "Runtime export failed";
  } catch {
    return "Runtime export failed";
  }
}

function errorName(error: unknown): string | undefined {
  try {
    return error instanceof Error && typeof error.name === "string"
      ? error.name
      : undefined;
  } catch {
    return undefined;
  }
}

function isRuntimeCancelledError(error: unknown): error is RuntimeCancelledError {
  try {
    return error instanceof RuntimeCancelledError;
  } catch {
    return false;
  }
}

export function preparedState(preflight: RuntimeAdapterPreflight): NodePreparedState {
  const prepared = preflight.prepared as NodePreparedState | undefined;
  if (prepared === undefined) throw new TypeError("Node runtime preflight state is missing");
  return prepared;
}

function reasonText(reason: { nodeId?: string; reason: string }): string {
  return reason.nodeId ? `${reason.reason}#${reason.nodeId}` : reason.reason;
}

function formatMismatch(requested: "html" | "svg", medium: "html" | "svg"): RuntimeFinding {
  return Object.freeze({
    severity: "error",
    category: "render",
    code: "DOCUMENT_MEDIUM_MISMATCH",
    message: `Cannot render ${medium} media as an exact ${requested} document`,
  });
}

function isAnimatedFormat(value: OutputFormat): value is RuntimeAnimatedFormat {
  return value === "mp4" || value === "webm" || value === "mov" || value === "mkv" || value === "gif";
}

/** Same probes `nodeCapabilities` uses for mp4, gif, and jpeg/webp. */
export function nodeEncoderAvailability(): {
  readonly mp4: boolean;
  readonly gif: boolean;
  readonly jpegWebp: boolean;
} {
  return Object.freeze({
    mp4: hasResolvableNodeAvBinding(),
    gif: hasExecutableOnPath(process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"),
    jpegWebp: hasResolvableSharpBinding(),
  });
}

function nodeCapabilities(options: NodeRuntimeAdapterOptions): MediaRuntimeCapabilities {
  const encoders = nodeEncoderAvailability();
  const rasters = Object.freeze([
    "png" as const,
    ...(encoders.jpegWebp ? (["jpeg", "webp"] as const) : []),
  ] satisfies RuntimeRasterFormat[]);
  const animated = Object.freeze([
    ...(encoders.mp4 ? (["mp4", "webm", "mov", "mkv"] as const) : []),
    ...(encoders.gif ? (["gif"] as const) : []),
  ] satisfies RuntimeAnimatedFormat[]);
  return Object.freeze({
    schemaVersion: 0,
    check: true,
    inspect: true,
    documents: Object.freeze(["html", "svg"] as const),
    rasters: Object.freeze([...(options.rasterFormats ?? rasters)]),
    animated: Object.freeze([...(options.animatedFormats ?? animated)]),
    collections: Object.freeze({ static: true, providers: true }),
    assets: Object.freeze({ url: true, bytes: true }),
    fonts: Object.freeze({ logical: true, frozenBytes: true }),
  });
}

const localRequire = createRequire(import.meta.url);

function optionalPackage(codes: readonly number[]): string {
  let name = "";
  for (const code of codes) name += String.fromCharCode(code);
  return name;
}

function isAbsoluteModulePath(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value));
}

function hasResolvableNodeAvBinding(): boolean {
  let entry: string;
  try {
    // Char codes so Turbopack cannot const-fold these into resolve("node-av") / the native binding.
    const nodeAv = [110, 111, 100, 101, 45, 97, 118];
    const mediaServer = [64, 109, 101, 100, 105, 97, 98, 117, 110, 110, 121, 47, 115, 101, 114, 118, 101, 114];
    try { entry = localRequire.resolve(optionalPackage(nodeAv)); }
    catch { entry = createRequire(localRequire.resolve(optionalPackage(mediaServer))).resolve(optionalPackage(nodeAv)); }
  } catch {
    return false;
  }
  // Bundlers may replace resolve() with a module id. That is not a filesystem path.
  if (!isAbsoluteModulePath(entry)) return false;
  const fromNodeAv = createRequire(entry);
  const platformArch = `${process.platform}-${process.arch}`;
  const candidates = process.platform === "win32"
    ? [`@seydx/node-av-${platformArch}-mingw`, `@seydx/node-av-${platformArch}-msvc`]
    : [`@seydx/node-av-${platformArch}`];
  if (candidates.some((name) => canResolve(fromNodeAv, name))) return true;
  const packageRoot = resolve(dirname(entry), "..");
  return [
    join(packageRoot, "build", "Release", "node-av.node"),
    join(packageRoot, "binary", "node-av.node"),
    join(packageRoot, "node-av.node"),
  ].some(existsSync);
}

function hasResolvableSharpBinding(): boolean {
  let entry: string;
  try {
    entry = localRequire.resolve("sharp");
  } catch {
    return false;
  }
  if (!isAbsoluteModulePath(entry)) return false;
  const fromSharp = createRequire(entry);
  const platformArch = `${process.platform}-${process.arch}`;
  if (process.platform === "linux") {
    return [
      `@img/sharp-linux-${process.arch}`,
      `@img/sharp-linuxmusl-${process.arch}`,
    ].some((name) => hasSharpBindingCandidate(fromSharp, name));
  }
  return hasSharpBindingCandidate(fromSharp, `@img/sharp-${platformArch}`);
}

/** Sharp's platform packages expose their native loader as `./sharp.node`, not as the package root. */
export function hasSharpBindingCandidate(fromSharp: NodeJS.Require, packageName: string): boolean {
  return canResolve(fromSharp, `${packageName}/sharp.node`);
}

function canResolve(resolver: NodeJS.Require, specifier: string): boolean {
  try {
    resolver.resolve(specifier);
    return true;
  } catch {
    return false;
  }
}

function hasExecutableOnPath(name: string): boolean {
  for (const directory of process.env.PATH?.split(delimiter) ?? []) {
    if (directory.length === 0) continue;
    try {
      accessSync(join(directory, name), fsConstants.X_OK);
      return true;
    } catch {
      // Keep scanning PATH without spawning the executable.
    }
  }
  return false;
}

const EMPTY_FRAME = '<div id="frame" style="position:relative;width:100%;height:100%;"></div>';

function injectFrame(shell: string, body: string): string {
  if (!shell.includes(EMPTY_FRAME)) throw new Error("Canonical SuperImg page shell is missing its frame root");
  return shell.replace(EMPTY_FRAME, `<div id="frame" style="position:relative;width:100%;height:100%;">${body}</div>`);
}

function mimeType(format: OutputFormat): string {
  switch (format) {
    case "html": return "text/html;charset=utf-8";
    case "svg": return "image/svg+xml";
    case "png": return "image/png";
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "webm": return "video/webm";
    case "mp4": return "video/mp4";
    case "mov": return "video/quicktime";
    case "mkv": return "video/x-matroska";
  }
}
