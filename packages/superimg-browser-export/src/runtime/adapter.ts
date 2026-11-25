import { assertNoNativeSurfaceMarkup, parseDuration, renderTemplateFrame, resolveAudioTimeline, textMeasurerFromFaces } from "@superimg/core/edge";
import { buildPageShell } from "@superimg/core/html";
import {
  parseRuntimeAt,
  prepareRuntimeCompositionMedia,
  type RuntimeAdapter,
  type RuntimeAdapterExportRequest,
  type RuntimeAdapterPreflight,
  type RuntimeAdapterPreflightRequest,
  type RuntimeAdapterRenderRequest,
} from "@superimg/core/runtime";
import type {
  DeterministicMediaDefinition,
  EncodingOptions,
  ExactRenderFormat,
  JsonObject,
  MediaRuntimeCapabilities,
  OutputFormat,
  RuntimeAnimatedFormat,
  RuntimeFinding,
  RuntimeRenditionCoordinates,
  RuntimeRasterFormat,
  VideoCodecPreference,
} from "@superimg/types";
import { isAlphaCodecContainerCompatible, resolveCaptureRegion, normalizeEncodingQuality } from "@superimg/types";
import type { BrowserRenderOptions } from "../preview.js";
import {
  browserEncodingFindings,
  deterministicDefinition,
  mediaForRendition,
  prepareExportPlan,
  withoutSource,
  type PreparedExportPlan,
} from "./plan.js";
import { prepareRuntimeResources, type PreparedRuntimeResources, type RuntimeFetch } from "./resources.js";
import { convertNativeMedia, inspectNativeMedia } from "./media.js";

const ABI = "superimg-runtime-v0/browser";
type ExportLifecycle = {
  checkpoint(completed?: number, total?: number): Promise<void>;
  finalizing(): void;
};

export interface BrowserRuntimeAdapterOptions {
  readonly fetch?: RuntimeFetch;
  readonly document?: Document;
  readonly defaultFonts?: import("@superimg/types").InitOptions["defaultFonts"];
}

interface BrowserPreparedState {
  readonly resources: PreparedRuntimeResources;
  readonly getMeasurer: () => ReturnType<typeof textMeasurerFromFaces>;
  readonly exportPlan?: PreparedExportPlan;
  readonly render?: PreparedCompositionMedia;
  readonly renditions?: ReadonlyMap<string, PreparedCompositionMedia>;
}

interface PreparedCompositionMedia {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
}

function renditionKey(coordinates: RuntimeRenditionCoordinates): string {
  return JSON.stringify([
    coordinates.entryId ?? null,
    coordinates.variantId,
    coordinates.editionId,
    coordinates.renditionId,
  ]);
}

/** Plan retained children on the canvas and clock chosen by time(). */
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

export function createBrowserRuntimeAdapter(options: BrowserRuntimeAdapterOptions = {}): RuntimeAdapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new TypeError("The browser runtime requires fetch support");
  const documentRef = options.document ?? globalThis.document;
  const rasters = detectRasterFormats(documentRef);
  const animated = detectAnimatedFormats(documentRef);
  const capabilities: MediaRuntimeCapabilities = Object.freeze({
    schemaVersion: 0,
    check: true,
    inspect: true,
    documents: Object.freeze(["html", "svg"] as const),
    rasters,
    animated,
    collections: Object.freeze({ static: true, providers: false }),
    assets: Object.freeze({ url: true, bytes: true }),
    fonts: Object.freeze({ logical: true, frozenBytes: true }),
  });
  let disposed = false;

  return {
    abi: ABI,
    capabilities,

    async inspect(request) {
      const resources = await prepareRuntimeResources(
        deterministicDefinition(request.media as never) as DeterministicMediaDefinition<JsonObject>,
        fetcher,
        request.options.signal,
        options.defaultFonts,
      );
      return {
        findings: resources.findings,
        assets: resources.assets,
        fonts: resources.fonts,
        metadata: Object.freeze({ resourcePreflight: "frozen-bytes" }),
      };
    },

    async inspectFile(input, signal) {
      return await inspectNativeMedia(input, fetcher, signal);
    },

    async convertMedia(request) {
      return await convertNativeMedia(request.request, fetcher, request.checkpoint, request.finalizing, request.preflight);
    },

    async preflight(request) {
      if (disposed) throw new Error("Browser runtime adapter has been disposed");
      return await preflightBrowser(request, fetcher, capabilities, options.defaultFonts);
    },

    async render(request) {
      if (disposed) throw new Error("Browser runtime adapter has been disposed");
      const prepared = preparedState(request.preflight);
      const definition = prepared.render?.definition ?? request.selection.media;
      const data = prepared.render?.data ?? request.selection.data;
      const width = request.options.size?.width ?? definition.config?.width ?? 1920;
      const height = request.options.size?.height ?? definition.config?.height ?? 1080;
      return {
        as: request.options.as,
        mimeType: mimeType(request.options.as),
        coordinates: request.selection.coordinates,
        bytes: await renderExact({
          definition,
          data,
          format: request.options.as,
          width,
          height,
          ...(request.options.at !== undefined ? { at: normalizeAt(request.options.at) } : {}),
          ...(request.options.encoding !== undefined ? { encoding: request.options.encoding } : {}),
          resources: prepared.resources,
          measurer: prepared.getMeasurer(),
          document: documentRef,
          ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
        }),
      };
    },

    async exportMedia(request) {
      if (disposed) throw new Error("Browser runtime adapter has been disposed");
      const prepared = preparedState(request.preflight);
      const plan = prepared.exportPlan;
      if (plan === undefined) throw new TypeError("Browser export executed without a prepared export plan");
      const artifacts = [];
      for (const rendition of plan.renditions) {
        if (request.options.signal?.aborted) throw request.options.signal.reason ?? new DOMException("Aborted", "AbortError");
        const preparedRendition = prepared.renditions?.get(renditionKey(rendition.coordinates));
        const definition = preparedRendition?.definition ?? mediaForRendition(plan.definition, rendition, plan.selections);
        const renditionData = preparedRendition?.data ?? rendition.data;
        const format = rendition.format;
        const bytes = isAnimatedFormat(format)
          ? await renderAnimated({
              definition,
              data: renditionData,
              format,
              width: rendition.canvas.width,
              height: rendition.canvas.height,
              ...(rendition.fps !== undefined ? { fps: rendition.fps } : {}),
              ...(rendition.encoding !== undefined ? { encoding: rendition.encoding } : {}),
              resources: prepared.resources,
              measurer: prepared.getMeasurer(),
              document: documentRef,
              ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
              ...((request as RuntimeAdapterExportRequest & { lifecycle?: ExportLifecycle }).lifecycle !== undefined ? { lifecycle: (request as RuntimeAdapterExportRequest & { lifecycle: ExportLifecycle }).lifecycle } : {}),
            })
          : await renderExact({
              definition,
              data: renditionData,
              format: format as ExactRenderFormat,
              width: rendition.canvas.width,
              height: rendition.canvas.height,
              ...(rendition.stillFrame !== undefined ? { at: normalizeAt(rendition.stillFrame.at) } : {}),
              ...(rendition.encoding !== undefined ? { encoding: rendition.encoding } : {}),
              resources: prepared.resources,
              measurer: prepared.getMeasurer(),
              document: documentRef,
              ...(request.options.signal !== undefined ? { signal: request.options.signal } : {}),
            });
        const coordinates = withoutSource(rendition.coordinates);
        artifacts.push(Object.freeze({
          path: rendition.relativePath,
          mimeType: mimeType(format),
          coordinates: Object.freeze({ ...coordinates, renditionId: rendition.coordinates.renditionId }),
          bytes,
        }));
      }
      return Object.freeze({
        coordinates: plan.coordinates,
        artifacts: Object.freeze(artifacts),
      });
    },

    async dispose() {
      disposed = true;
    },
  };
}

async function preflightBrowser(
  request: RuntimeAdapterPreflightRequest,
  fetcher: RuntimeFetch,
  capabilities: MediaRuntimeCapabilities,
  defaultFonts: BrowserRuntimeAdapterOptions["defaultFonts"],
): Promise<RuntimeAdapterPreflight> {
  let definition = request.selection?.media ?? (deterministicDefinition(request.media) as DeterministicMediaDefinition<JsonObject>);
  let render: PreparedCompositionMedia | undefined;
  let renditions: ReadonlyMap<string, PreparedCompositionMedia> | undefined;
  if (request.operation === "render") {
    const renderOptions = request.options as RuntimeAdapterRenderRequest["options"];
    const width = renderOptions.size?.width ?? definition.config?.width ?? 1920;
    const height = renderOptions.size?.height ?? definition.config?.height ?? 1080;
    const preparation = compositionPreparation(definition, { width, height }, definition.config?.fps ?? 30);
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
  if (definition.config?.nativeModuleSets?.length) findings.push({
    severity: "error", category: "render", code: "NATIVE_SURFACE_UNSUPPORTED",
    message: "The browser export runtime cannot load prepared native surfaces.",
    suggestion: "Use the trusted Node runtime or development preview for this media.",
  });
  let exportPlan: PreparedExportPlan | undefined;
  if (request.operation === "render") {
    const options = request.options as RuntimeAdapterRenderRequest["options"];
    if (options.as === "html" && definition.medium !== "html") findings.push(formatMismatch("html", definition.medium));
    if (options.as === "svg" && definition.medium !== "svg") findings.push(formatMismatch("svg", definition.medium));
    findings.push(...browserEncodingFindings(options.as, options.encoding));
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
      findings.push(...await browserAnimatedPreflightFindings(exportPlan));
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
        if (prepared !== undefined) {
          preparedRenditions.set(renditionKey(rendition.coordinates), {
            definition: prepared.media,
            data: prepared.data,
          });
        }
      }
      renditions = preparedRenditions;
    }
  }
  return Object.freeze({
    findings: Object.freeze(findings),
    assets: resources.assets,
    fonts: resources.fonts,
    metadata: Object.freeze({ resourcePreflight: "frozen-bytes" }),
    prepared: Object.freeze({
      resources,
      getMeasurer: lazyMeasurer(resources),
      ...(exportPlan !== undefined ? { exportPlan } : {}),
      ...(render !== undefined ? { render } : {}),
      ...(renditions !== undefined ? { renditions } : {}),
    } satisfies BrowserPreparedState),
  });
}

async function renderAnimated(input: {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly format: "mp4" | "webm" | "mov" | "mkv";
  readonly width: number;
  readonly height: number;
  readonly fps?: number;
  readonly encoding?: Omit<EncodingOptions, "format">;
  readonly resources: PreparedRuntimeResources;
  readonly measurer: ReturnType<typeof textMeasurerFromFaces>;
  readonly document: Document;
  readonly signal?: AbortSignal;
  readonly lifecycle?: { checkpoint(completed?: number, total?: number): Promise<void>; finalizing(): void };
}): Promise<Uint8Array> {
  const fps = input.fps ?? input.definition.config?.fps ?? 30;
  const authoredFps = input.definition.composition?.schedule.fps ?? fps;
  const durationSeconds = duration(input.definition, authoredFps);
  const authoredFrames = input.definition.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(durationSeconds * authoredFps));
  const totalFrames = input.definition.composition
    ? fps === authoredFps ? authoredFrames : Math.max(1, Math.ceil(authoredFrames * fps / authoredFps))
    : Math.max(1, Math.ceil(durationSeconds * fps));
  const outputWidth = input.encoding?.capture?.region?.width ?? input.width;
  const outputHeight = input.encoding?.capture?.region?.height ?? input.height;
  const { BrowserRenderer } = await import("../preview.js");
  // Loading a module cannot be interrupted. Do not create resources for an
  // operation that was cancelled while that shared module was loading.
  if (input.signal?.aborted) throw input.signal.reason ?? new DOMException("Aborted", "AbortError");
  const renderer = new BrowserRenderer();
  try {
    await renderer.init({
      width: input.width,
      height: input.height,
      fonts: [],
      inlineCss: [...(input.definition.config?.inlineCss ?? []), ...input.resources.fontCss],
      stylesheets: input.definition.config?.stylesheets ?? [],
      ...(input.definition.config?.tailwind !== undefined ? { tailwind: input.definition.config.tailwind } : {}),
      ...(input.encoding?.capture !== undefined ? { capture: input.encoding.capture } : {}),
      format: input.format,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
      ...(input.definition.config?.readiness !== undefined ? { readiness: input.definition.config.readiness } : {}),
      ...(input.encoding?.video?.alpha !== undefined ? { alpha: input.encoding.video.alpha } : {}),
    });
    const { exportImageDataToVideo } = await import("../export.js");
    const rawAudio = input.definition.config?.audio !== undefined
      ? resolveAudioTimeline(input.definition.config.audio, {
          fps: authoredFps,
          videoDurationSeconds: totalFrames / fps,
        })
      : null;
    const resolvedAudio = rawAudio
      ? {
          ...rawAudio,
          clips: rawAudio.clips.map((clip) => ({
            ...clip,
            src: input.resources.assetUrls[clip.src] ?? clip.src,
          })),
        }
      : null;
    const blob = await exportImageDataToVideo(
      {
        width: outputWidth,
        height: outputHeight,
        fps,
        duration: totalFrames / fps,
        ...(resolvedAudio ? { resolvedAudio } : {}),
        encoding: { ...(input.encoding ?? {}), format: input.format },
      },
      async (frameIndex) => {
        if (input.signal?.aborted) {
          throw input.signal.reason ?? new DOMException("Aborted", "AbortError");
        }
        const frame = renderTemplateFrame({
          template: input.definition as never,
          frame: input.definition.composition === undefined
            ? frameIndex
            : Math.min(authoredFrames - 1, Math.floor(frameIndex * authoredFps / fps)),
          fps: authoredFps,
          durationSeconds,
          width: input.width,
          height: input.height,
          data: input.data,
          assets: input.resources.assetMetadata,
          assetResolver: (name) => input.resources.assetUrls[name] ?? name,
          composite: input.definition.medium === "html",
          ...(input.measurer !== undefined ? { measurer: input.measurer } : {}),
        });
        assertNoNativeSurfaceMarkup(frame.html);
        const captured = await renderer.captureFrame(
          input.definition.medium === "svg" ? frame.html : frame.compositeHtml,
          { time: frameIndex / fps, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
        );
        return scaleImageData(input.document, captured, outputWidth, outputHeight);
      },
      {
        ...(input.signal !== undefined ? { signal: input.signal } : {}),
        yieldEveryFrames: 1,
        ...(input.lifecycle !== undefined ? { lifecycle: input.lifecycle } : {}),
      },
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    await renderer.dispose();
  }
}

async function browserAnimatedPreflightFindings(
  plan: PreparedExportPlan,
): Promise<readonly RuntimeFinding[]> {
  const renditions = plan.renditions.filter(
    (rendition): rendition is typeof rendition & { readonly format: "mp4" | "webm" | "mov" | "mkv" } =>
      rendition.format === "mp4" || rendition.format === "webm" || rendition.format === "mov" || rendition.format === "mkv",
  );
  if (renditions.length === 0) return Object.freeze([]);

  const findings: RuntimeFinding[] = [];
  if (plan.definition.config?.mode === "animation") {
    for (const rendition of renditions) {
      findings.push(browserAnimatedFinding(
        "BROWSER_CSS_ANIMATION_EXPORT_UNAVAILABLE",
        "The browser runtime cannot deterministically export authored CSS-animation mode",
        rendition,
      ));
    }
    return Object.freeze(findings);
  }
  if (plan.definition.config?.audio !== undefined) {
    try {
      const fps = plan.definition.config.fps ?? 30;
      const videoDurationSeconds = duration(plan.definition, fps);
      resolveAudioTimeline(plan.definition.config.audio, { fps, videoDurationSeconds });
    } catch (error) {
      for (const rendition of renditions) {
        findings.push(browserAnimatedFinding(
          "BROWSER_AUDIO_TIMELINE_INVALID",
          error instanceof Error ? error.message : "Authored audio timeline could not be resolved",
          rendition,
        ));
      }
      return Object.freeze(findings);
    }
  }

  let mediaBunny: typeof import("mediabunny");
  try {
    mediaBunny = await import("mediabunny");
  } catch {
    for (const rendition of renditions) {
      findings.push(browserAnimatedFinding(
        "BROWSER_VIDEO_ENCODER_UNAVAILABLE",
        "The browser video encoder implementation is unavailable",
        rendition,
      ));
    }
    return Object.freeze(findings);
  }

  for (const rendition of renditions) {
    const video = rendition.encoding?.video;
    const requested = video?.codec ?? (rendition.format === "webm" ? ["vp9", "av1"] : ["avc", "vp9", "av1"]);
    const requestedCodecs = (Array.isArray(requested) ? requested : [requested]) as VideoCodecPreference[];
    const container = rendition.format === "webm"
      ? new mediaBunny.WebMOutputFormat({
          ...(rendition.encoding?.webm?.minimumClusterDuration !== undefined
            ? { minimumClusterDuration: rendition.encoding.webm.minimumClusterDuration }
            : {}),
        })
      : rendition.format === "mkv" ? new mediaBunny.MkvOutputFormat() : rendition.format === "mov" ? new mediaBunny.MovOutputFormat() : new mediaBunny.Mp4OutputFormat({
          ...(rendition.encoding?.mp4?.fastStart !== undefined
            ? { fastStart: rendition.encoding.mp4.fastStart }
            : {}),
        });
    const containerCodecs = new Set(container.getSupportedVideoCodecs());
    const codecs = requestedCodecs.filter((codec) => containerCodecs.has(codec) && (video?.alpha !== "keep" || isAlphaCodecContainerCompatible(rendition.format, codec)));
    const region = resolveCaptureRegion(rendition.canvas.width, rendition.canvas.height, rendition.encoding?.capture);
    const quality = browserVideoQuality(mediaBunny, video?.quality);
    let supported = false;
    for (const codec of codecs) {
      try {
        if (await mediaBunny.canEncodeVideo(codec, {
          width: region.width,
          height: region.height,
          ...(quality !== undefined ? { quality } : {}),
          ...(video?.alpha !== undefined ? { alpha: video.alpha } : {}),
          ...(video?.latencyMode !== undefined ? { latencyMode: video.latencyMode } : {}),
          ...(video?.hardwareAcceleration !== undefined
            ? { hardwareAcceleration: video.hardwareAcceleration }
            : {}),
        })) {
          supported = true;
          break;
        }
      } catch {
        // A probe rejection is an unavailable exact encoder configuration.
      }
    }
    if (!supported) {
      findings.push(browserAnimatedFinding(
        "BROWSER_VIDEO_CODEC_UNAVAILABLE",
        `No requested ${rendition.format.toUpperCase()} codec is available for ${rendition.canvas.width}x${rendition.canvas.height}`,
        rendition,
      ));
    }
  }
  return Object.freeze(findings);
}

function browserVideoQuality(
  mediaBunny: typeof import("mediabunny"),
  value: import("@superimg/types").EncodingQuality | undefined,
) {
  value = normalizeEncodingQuality(value);
  if (value === undefined) return undefined;
  if (typeof value === "string") return new mediaBunny.Quality(value);
  if ("bitrate" in value) return new mediaBunny.Quality({ bitrate: value.bitrate, ...(value.mode !== undefined ? { bitrateMode: value.mode } : {}) });
  return new mediaBunny.Quality({ quantizer: value.quantizer });
}

function browserAnimatedFinding(
  code: string,
  message: string,
  rendition: PreparedExportPlan["renditions"][number],
): RuntimeFinding {
  return Object.freeze({
    severity: "error",
    category: "capability",
    code,
    message,
    coordinates: withoutSource(rendition.coordinates),
    details: Object.freeze({ renditionId: rendition.coordinates.renditionId }),
  });
}

async function renderExact(input: {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly format: ExactRenderFormat;
  readonly width: number;
  readonly height: number;
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  readonly encoding?: Omit<EncodingOptions, "format">;
  readonly resources: PreparedRuntimeResources;
  readonly measurer: ReturnType<typeof textMeasurerFromFaces>;
  readonly document: Document;
  readonly signal?: AbortSignal;
}): Promise<Uint8Array> {
  const frame = renderedFrame(input.definition, input.data, input.width, input.height, input.at, input.resources, input.measurer);
  assertNoNativeSurfaceMarkup(frame.html);
  if (input.format === "html") return new TextEncoder().encode(htmlDocument(frame.compositeHtml, input.definition, input.resources));
  if (input.format === "svg") return new TextEncoder().encode(svgDocument(frame.html, input.definition, input.resources));

  const { BrowserRenderer } = await import("../preview.js");
  // Loading a module cannot be interrupted. Do not create resources for an
  // operation that was cancelled while that shared module was loading.
  if (input.signal?.aborted) throw input.signal.reason ?? new DOMException("Aborted", "AbortError");
  const renderer = new BrowserRenderer();
  try {
    await renderer.init({
      width: input.width,
      height: input.height,
      fonts: [],
      inlineCss: [...(input.definition.config?.inlineCss ?? []), ...input.resources.fontCss],
      stylesheets: input.definition.config?.stylesheets ?? [],
      ...(input.definition.config?.tailwind !== undefined ? { tailwind: input.definition.config.tailwind } : {}),
      ...(input.encoding?.capture !== undefined ? { capture: input.encoding.capture } : {}),
      format: input.format,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
      ...(input.definition.config?.readiness !== undefined ? { readiness: input.definition.config.readiness } : {}),
      ...(input.encoding?.video?.alpha !== undefined ? { alpha: input.encoding.video.alpha } : {}),
    });
    const image = await renderer.captureFrame(
      input.definition.medium === "svg" ? frame.html : frame.compositeHtml,
      { time: frame.frame / frame.ctx.fps, ...(input.signal !== undefined ? { signal: input.signal } : {}) },
    );
    const outputWidth = image.width;
    const outputHeight = image.height;
    return await encodeImageData(
      input.document,
      image,
      outputWidth,
      outputHeight,
      input.format,
      input.encoding,
    );
  } finally {
    await renderer.dispose();
  }
}

function renderedFrame(
  definition: DeterministicMediaDefinition<JsonObject>,
  data: JsonObject,
  width: number,
  height: number,
  at: number | `${number}s` | `${number}ms` | `${number}f` | undefined,
  resources: PreparedRuntimeResources,
  measurer: ReturnType<typeof textMeasurerFromFaces>,
) {
  const fps = definition.config?.fps ?? 30;
  const durationSeconds = definition.animated ? parseDuration(definition.config?.duration, "duration", fps) : 1 / fps;
  const authoredAt = at ?? definition.poster;
  const seconds = authoredAt === undefined ? 0 : parseRuntimeAt(authoredAt, fps);
  const totalFrames = definition.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(durationSeconds * fps));
  const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(seconds * fps)));
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
    ...(measurer !== undefined ? { measurer } : {}),
  });
}

/** One preparation per frozen resource set, including an unmeasurable set. */
function lazyMeasurer(resources: PreparedRuntimeResources): BrowserPreparedState["getMeasurer"] {
  let prepared = false;
  let measurer: ReturnType<typeof textMeasurerFromFaces>;
  return () => {
    if (prepared) return measurer;
    const faces = resources.fonts.flatMap((font, index) => {
      const data = resources.fontBuffers[index];
      if (!data) return [];
      return [{
        family: font.family,
        weight: font.weight ?? 400,
        style: font.style === "italic" ? "italic" as const : "normal" as const,
        data,
      }];
    });
    measurer = textMeasurerFromFaces(faces);
    prepared = true;
    return measurer;
  };
}

async function encodeImageData(
  documentRef: Document,
  image: ImageData,
  width: number,
  height: number,
  format: RuntimeRasterFormat,
  encoding?: Omit<EncodingOptions, "format">,
): Promise<Uint8Array> {
  const scaled = scaleImageData(documentRef, image, width, height);
  const target = documentRef.createElement("canvas");
  target.width = width;
  target.height = height;
  const targetContext = target.getContext("2d");
  if (targetContext === null) throw new Error("Browser canvas 2D context is unavailable");
  targetContext.putImageData(scaled, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    const quality = format === "jpeg" || format === "webp"
      ? encoding?.still?.quality === undefined
        ? undefined
        : encoding.still.quality / 100
      : undefined;
    target.toBlob(
      (value) => value === null ? reject(new Error(`Canvas could not encode ${format}`)) : resolve(value),
      mimeType(format),
      quality,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function scaleImageData(
  documentRef: Document,
  image: ImageData,
  width: number,
  height: number,
): ImageData {
  if (image.width === width && image.height === height) return image;
  const source = documentRef.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceContext = source.getContext("2d");
  if (sourceContext === null) throw new Error("Browser canvas 2D context is unavailable");
  sourceContext.putImageData(image, 0, 0);
  const target = documentRef.createElement("canvas");
  target.width = width;
  target.height = height;
  const targetContext = target.getContext("2d");
  if (targetContext === null) throw new Error("Browser canvas 2D context is unavailable");
  targetContext.drawImage(source, 0, 0, width, height);
  return targetContext.getImageData(0, 0, width, height);
}

function detectRasterFormats(documentRef: Document | undefined): readonly RuntimeRasterFormat[] {
  if (documentRef === undefined) return Object.freeze([]);
  try {
    const canvas = documentRef.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    if (canvas.getContext("2d") === null || typeof canvas.toBlob !== "function") return Object.freeze([]);
    const formats: RuntimeRasterFormat[] = ["png"];
    if (canvas.toDataURL("image/jpeg").startsWith("data:image/jpeg")) formats.push("jpeg");
    if (canvas.toDataURL("image/webp").startsWith("data:image/webp")) formats.push("webp");
    return Object.freeze(formats);
  } catch {
    return Object.freeze([]);
  }
}

function detectAnimatedFormats(documentRef: Document | undefined): readonly RuntimeAnimatedFormat[] {
  if (documentRef === undefined) return Object.freeze([]);
  const scope = globalThis as typeof globalThis & {
    readonly VideoEncoder?: unknown;
    readonly VideoFrame?: unknown;
    readonly OffscreenCanvas?: unknown;
  };
  if (
    typeof scope.VideoEncoder !== "function" ||
    typeof scope.VideoFrame !== "function" ||
    typeof scope.OffscreenCanvas !== "function"
  ) {
    return Object.freeze([]);
  }
  return Object.freeze(["mp4", "webm", "mov", "mkv"] as const);
}

function htmlDocument(body: string, definition: DeterministicMediaDefinition<JsonObject>, resources: PreparedRuntimeResources): string {
  return injectFrame(buildPageShell({
    fonts: [],
    stylesheets: definition.config?.stylesheets ?? [],
    inlineCss: [...(definition.config?.inlineCss ?? []), ...resources.fontCss],
    ...(definition.config?.tailwind !== undefined ? { tailwind: definition.config.tailwind } : {}),
  }), body);
}

function svgDocument(svg: string, definition: DeterministicMediaDefinition<JsonObject>, resources: PreparedRuntimeResources): string {
  const css = [...(definition.config?.inlineCss ?? []), ...resources.fontCss].join("\n");
  return css.length === 0 ? svg : svg.replace(/<svg\b([^>]*)>/i, `<svg$1><style>${css}</style>`);
}

function duration(definition: DeterministicMediaDefinition<JsonObject>, fps: number): number {
  if (!definition.animated) return 1 / fps;
  if (definition.composition) return definition.composition.schedule.totalFrames / definition.composition.schedule.fps;
  return parseDuration(definition.config?.duration, "duration", fps);
}

function preparedState(preflight: RuntimeAdapterPreflight): BrowserPreparedState {
  const prepared = preflight.prepared as BrowserPreparedState | undefined;
  if (prepared === undefined) throw new TypeError("Browser runtime preflight state is missing");
  return prepared;
}

function formatMismatch(requested: "html" | "svg", medium: "html" | "svg"): RuntimeFinding {
  return Object.freeze({
    severity: "error",
    category: "render",
    code: "DOCUMENT_MEDIUM_MISMATCH",
    message: `Cannot render ${medium} media as an exact ${requested} document`,
  });
}

function isAnimatedFormat(value: OutputFormat): value is "mp4" | "webm" | "mov" | "mkv" {
  return value === "mp4" || value === "webm" || value === "mov" || value === "mkv";
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
  throw new TypeError(`Unsupported browser output format: ${format}`);
}

type RuntimeAt = number | `${number}s` | `${number}ms` | `${number}f`;

function normalizeAt(value: string | number): RuntimeAt {
  if (typeof value === "number") return value;
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:s|ms|f)$/.test(value)) return value as RuntimeAt;
  throw new TypeError(`Invalid frame time: ${value}`);
}

const EMPTY_FRAME = '<div id="frame" style="position:relative;width:100%;height:100%;"></div>';

function injectFrame(shell: string, body: string): string {
  if (!shell.includes(EMPTY_FRAME)) throw new Error("Canonical SuperImg page shell is missing its frame root");
  return shell.replace(EMPTY_FRAME, `<div id="frame" style="position:relative;width:100%;height:100%;">${body}</div>`);
}
