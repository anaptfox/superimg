import {
  parseDuration,
  renderTemplateFrame,
  assertNoNativeSurfaceMarkup,
  aliasSvgFont,
  countSvgTextElements,
} from "@superimg/core/edge";
import { buildPageShell } from "@superimg/core/html";
import {
  parseRuntimeAt,
  type RuntimeAdapter,
  type RuntimeAdapterExportRequest,
  type RuntimeAdapterPreflight,
  type RuntimeAdapterPreflightRequest,
  type RuntimeAdapterRenderRequest,
} from "@superimg/core/runtime";
import {
  SuperImgError,
  type DeterministicMediaDefinition,
  type ExactRenderFormat,
  type JsonObject,
  type MediaRuntimeCapabilities,
  type OutputFormat,
  type RuntimeFinding,
} from "@superimg/types";
import { deterministicDefinition, mediaForRendition, prepareExportPlan, withoutSource, type PreparedExportPlan } from "./plan.js";
import { prepareRuntimeResources, type PreparedRuntimeResources, type RuntimeFetch } from "./resources.js";

const ABI = "superimg-runtime-v0/edge";

export interface EdgeRuntimeAdapterOptions {
  readonly fetch?: RuntimeFetch;
  readonly svgRasterizer?: EdgeSvgRasterizer;
  readonly defaultFonts?: import("@superimg/types").InitOptions["defaultFonts"];
}

export interface EdgeSvgRasterizer {
  prepare(): Promise<void>;
  rasterize(
    svg: string,
    options: Readonly<{
      width: number;
      height: number;
      fontBuffers: readonly Uint8Array[];
    }>,
  ): Promise<Uint8Array>;
}

interface EdgePreparedState {
  readonly resources: PreparedRuntimeResources;
  readonly exportPlan?: PreparedExportPlan;
}

export function createEdgeRuntimeAdapterBase(options: EdgeRuntimeAdapterOptions = {}): RuntimeAdapter {
  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new TypeError("The edge runtime requires fetch support");
  const hasRasterizer = options.svgRasterizer !== undefined;
  const capabilities: MediaRuntimeCapabilities = Object.freeze({
    schemaVersion: 0,
    check: true,
    inspect: true,
    documents: Object.freeze(["html", "svg"] as const),
    rasters: Object.freeze(hasRasterizer ? ["png"] as const : [] as const),
    animated: Object.freeze([]),
    collections: Object.freeze({ static: true, providers: false }),
    assets: Object.freeze({ url: true, bytes: true }),
    fonts: Object.freeze({ logical: true, frozenBytes: true }),
  });
  let disposed = false;

  return {
    abi: ABI,
    capabilities,

    async inspect(request) {
      const resources = await prepareRuntimeResources(deterministicDefinition(request.media as never), fetcher, request.options.signal, options.defaultFonts);
      return {
        findings: resources.findings,
        assets: resources.assets,
        fonts: resources.fonts,
        metadata: Object.freeze({ resourcePreflight: "frozen-bytes" }),
      };
    },

    async preflight(request) {
      if (disposed) throw new Error("Edge runtime adapter has been disposed");
      return await preflightEdge(request, fetcher, capabilities, options.svgRasterizer, options.defaultFonts);
    },

    async render(request) {
      if (disposed) throw new Error("Edge runtime adapter has been disposed");
      const prepared = preparedState(request.preflight);
      const definition = request.selection.media;
      const width = request.options.size?.width ?? definition.config?.width ?? 1920;
      const height = request.options.size?.height ?? definition.config?.height ?? 1080;
      return {
        as: request.options.as,
        mimeType: mimeType(request.options.as),
        coordinates: request.selection.coordinates,
        bytes: await renderExact({
          definition,
          data: request.selection.data,
          format: request.options.as,
          width,
          height,
          ...(request.options.at !== undefined ? { at: request.options.at } : {}),
          resources: prepared.resources,
          ...(options.svgRasterizer !== undefined
            ? { svgRasterizer: options.svgRasterizer }
            : {}),
        }),
      };
    },

    async exportMedia(request) {
      if (disposed) throw new Error("Edge runtime adapter has been disposed");
      const prepared = preparedState(request.preflight);
      const plan = prepared.exportPlan;
      if (plan === undefined) throw new TypeError("Edge export executed without a prepared export plan");
      const artifacts = [];
      for (const rendition of plan.renditions) {
        if (request.options.signal?.aborted) throw request.options.signal.reason ?? new DOMException("Aborted", "AbortError");
        const definition = mediaForRendition(plan.definition, rendition, plan.selections);
        const format = rendition.format as ExactRenderFormat;
        const bytes = await renderExact({
          definition,
          data: rendition.data,
          format,
          width: rendition.canvas.width,
          height: rendition.canvas.height,
          ...(rendition.stillFrame !== undefined ? { at: rendition.stillFrame.at } : {}),
          resources: prepared.resources,
          ...(options.svgRasterizer !== undefined
            ? { svgRasterizer: options.svgRasterizer }
            : {}),
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

async function preflightEdge(
  request: RuntimeAdapterPreflightRequest,
  fetcher: RuntimeFetch,
  capabilities: MediaRuntimeCapabilities,
  svgRasterizer: EdgeSvgRasterizer | undefined,
  defaultFonts: EdgeRuntimeAdapterOptions["defaultFonts"],
): Promise<RuntimeAdapterPreflight> {
  const definition = request.selection?.media ?? deterministicDefinition(request.media);
  const resources = await prepareRuntimeResources(definition, fetcher, request.options.signal, defaultFonts);
  const findings: RuntimeFinding[] = [...resources.findings];
  if (definition.config?.nativeModuleSets?.length) findings.push({
    severity: "error", category: "render", code: "NATIVE_SURFACE_UNSUPPORTED",
    message: "The edge runtime cannot load prepared native surfaces.",
    suggestion: "Use the trusted Node runtime for this media.",
  });
  let exportPlan: PreparedExportPlan | undefined;
  if (request.operation === "render") {
    const renderOptions = request.options as RuntimeAdapterRenderRequest["options"];
    if (renderOptions.as === "html" && definition.medium !== "html") findings.push(formatMismatch("html", definition.medium));
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
  }
  if (
    svgRasterizer !== undefined &&
    requiresSvgRaster(request, exportPlan) &&
    !findings.some((finding) => finding.severity === "error")
  ) {
    try {
      await svgRasterizer.prepare();
    } catch (error) {
      findings.push(Object.freeze({
        severity: "error",
        category: "capability",
        code: "RESVG_WASM_UNAVAILABLE",
        message: `Configured edge SVG rasterization is unavailable: ${errorMessage(error)}`,
      }));
      exportPlan = undefined;
    }
  }
  return Object.freeze({
    findings: Object.freeze(findings),
    assets: resources.assets,
    fonts: resources.fonts,
    metadata: Object.freeze({ resourcePreflight: "frozen-bytes" }),
    prepared: Object.freeze({ resources, ...(exportPlan !== undefined ? { exportPlan } : {}) } satisfies EdgePreparedState),
  });
}

function requiresSvgRaster(
  request: RuntimeAdapterPreflightRequest,
  exportPlan: PreparedExportPlan | undefined,
): boolean {
  if (request.operation === "render") {
    return (request.options as RuntimeAdapterRenderRequest["options"]).as === "png";
  }
  return exportPlan?.renditions.some((rendition) => rendition.format === "png") ?? false;
}

async function renderExact(input: {
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly data: JsonObject;
  readonly format: ExactRenderFormat;
  readonly width: number;
  readonly height: number;
  readonly at?: number | `${number}s` | `${number}ms` | `${number}f`;
  readonly resources: PreparedRuntimeResources;
  readonly svgRasterizer?: EdgeSvgRasterizer;
}): Promise<Uint8Array> {
  const frame = renderedFrame(input.definition, input.data, input.width, input.height, input.at, input.resources);
  assertNoNativeSurfaceMarkup(frame.html);
  if (input.format === "html") return new TextEncoder().encode(htmlDocument(frame.compositeHtml, input.definition, input.resources));
  if (input.format === "svg") {
    if (frame.lane === "svg" && frame.svg !== undefined) return new TextEncoder().encode(frame.svg);
    if (input.definition.medium === "svg") return new TextEncoder().encode(svgDocument(frame.html, input.definition, input.resources));
    throw needsBrowserError(frame.browserReasons, "DOCUMENT_MEDIUM_MISMATCH");
  }
  if (frame.lane !== "svg" || frame.svg === undefined) throw needsBrowserError(frame.browserReasons, "NEEDS_BROWSER");
  if (input.svgRasterizer === undefined) {
    throw new Error("Edge SVG rasterization requires a configured rasterizer");
  }
  return input.svgRasterizer.rasterize(frame.svg, {
    width: input.width,
    height: input.height,
    fontBuffers: countSvgTextElements(frame.svg) === 0 ? [...input.resources.fontBuffers]
      : input.resources.fontBuffers.map((bytes, index) => {
        const face = input.resources.fonts[index]!;
        return aliasSvgFont(bytes, face.family, face.weight ?? 400, face.style ?? "normal");
      }),
  });
}

function renderedFrame(
  definition: DeterministicMediaDefinition<JsonObject>,
  data: JsonObject,
  width: number,
  height: number,
  at: number | `${number}s` | `${number}ms` | `${number}f` | undefined,
  resources: PreparedRuntimeResources,
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
    totalFrames,
    width,
    height,
    data,
    assets: resources.assetMetadata,
    assetResolver: (name) => resources.assetUrls[name] ?? name,
    composite: definition.medium === "html",
    fonts: metricFonts(resources),
  });
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

function preparedState(preflight: RuntimeAdapterPreflight): EdgePreparedState {
  const prepared = preflight.prepared as EdgePreparedState | undefined;
  if (prepared === undefined) throw new TypeError("Edge runtime preflight state is missing");
  return prepared;
}

function needsBrowserError(
  reasons: readonly { nodeId?: string; reason: string }[],
  code: "NEEDS_BROWSER" | "DOCUMENT_MEDIUM_MISMATCH",
): SuperImgError {
  const listed = reasons.map((item) => item.nodeId ? `${item.reason}#${item.nodeId}` : item.reason);
  const message = code === "NEEDS_BROWSER"
    ? `This still needs a browser (${listed.join(", ") || "html lane"})`
    : `Cannot render html media as an exact svg document (${listed.join(", ") || "html lane"})`;
  return new SuperImgError(
    message,
    code,
    { reasons: listed },
    code === "NEEDS_BROWSER"
      ? "Render this still on a runtime with Chromium, or remove the browser-only nodes."
      : "Request svg only when the still lowers to SVG, or render png/html.",
  );
}

function formatMismatch(requested: "html" | "svg", medium: "html" | "svg"): RuntimeFinding {
  return Object.freeze({ severity: "error", category: "render", code: "DOCUMENT_MEDIUM_MISMATCH", message: `Cannot render ${medium} media as an exact ${requested} document` });
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
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const EMPTY_FRAME = '<div id="frame" style="position:relative;width:100%;height:100%;"></div>';

function injectFrame(shell: string, body: string): string {
  if (!shell.includes(EMPTY_FRAME)) throw new Error("Canonical SuperImg page shell is missing its frame root");
  return shell.replace(EMPTY_FRAME, `<div id="frame" style="position:relative;width:100%;height:100%;">${body}</div>`);
}
