//! Media-first runtime calls over the positional kernel.
//!
//! One shared default runtime per binder. Pass `runtime` to use another.
//! `idleDisposeMs` (Node) drops the default runtime after a quiet period.

import {
  CapabilityUnavailableError,
  MediaPreflightError,
  RuntimeInfrastructureError,
  type CheckOptions,
  type CheckReport,
  type ConversionArtifact,
  type ConversionRequest,
  type ExportBundle,
  type ExportOptions,
  type ExportableMedia,
  type InitOptions,
  type InspectOptions,
  type InspectReport,
  type JobEvent,
  type JobState,
  type JsonObject,
  type MediaInput,
  type MediaInspectOptions,
  type MediaInspection,
  type MediaRenderOptions,
  type MediaRenderResult,
  type MediaValue,
  type PausableJob,
  type RenderFormat,
  type Runtime,
  type RuntimeMediaCoordinates,
} from "@superimg/types";
import { createMemoryRenderResult } from "./bundle.js";
import {
  check as kernelCheck,
  exportMedia as kernelExportMedia,
  inspect as kernelInspect,
  inspectFile as kernelInspectFile,
  render as kernelRender,
  startConversion as kernelStartConversion,
  startExport as kernelStartExport,
} from "./kernel.js";
import type { AdapterRenderOptions } from "./adapter.js";

const ANIMATED_FORMATS = ["mp4", "webm", "mov", "gif"] as const;
type AnimatedRenderFormat = (typeof ANIMATED_FORMATS)[number];

export interface RuntimeApi {
  check<D>(media: MediaValue<D>, options?: CheckOptions<D>): Promise<CheckReport>;
  inspect<D>(media: MediaValue<D>, options?: InspectOptions<D>): Promise<InspectReport>;
  inspectFile(input: MediaInput, options?: MediaInspectOptions): Promise<MediaInspection>;
  render<D>(media: ExportableMedia<D>, options: MediaRenderOptions<D>): Promise<MediaRenderResult>;
  renderResponse<D>(
    media: ExportableMedia<D>,
    options: MediaRenderOptions<D> & { readonly headers?: HeadersInit },
  ): Promise<Response>;
  exportMedia<D>(media: ExportableMedia<D>, options: ExportOptions<D>): Promise<ExportBundle>;
  startExport<D>(media: ExportableMedia<D>, options: ExportOptions<D>): PausableJob<ExportBundle>;
  startConversion(
    request: ConversionRequest,
    options?: { readonly runtime?: Runtime },
  ): PausableJob<ConversionArtifact>;
  shutdown(): Promise<void>;
}

export function bindRuntimeApi(
  init: (options?: InitOptions) => Promise<Runtime>,
  bindOptions: { readonly idleDisposeMs?: number } = {},
): RuntimeApi {
  let shared: Promise<Runtime> | undefined;
  let inflight = 0;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let boundSequence = 0;

  const clearIdle = (): void => {
    if (idleTimer === undefined) return;
    clearTimeout(idleTimer);
    idleTimer = undefined;
  };

  const scheduleIdle = (): void => {
    clearIdle();
    if (bindOptions.idleDisposeMs === undefined || inflight > 0 || shared === undefined) return;
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      if (inflight > 0 || shared === undefined) return;
      const current = shared;
      shared = undefined;
      void current.then((runtime) => runtime.dispose()).catch(() => {});
    }, bindOptions.idleDisposeMs);
  };

  const beginFlight = (): void => {
    inflight += 1;
    clearIdle();
  };

  const endFlight = (): void => {
    inflight -= 1;
    scheduleIdle();
  };

  const ensureShared = (): Promise<Runtime> => {
    if (shared !== undefined) return shared;
    const pending = Promise.resolve().then(() => init()).catch((error: unknown) => {
      if (shared === pending) shared = undefined;
      throw error;
    });
    shared = pending;
    return pending;
  };

  async function using<T>(
    explicit: Runtime | undefined,
    run: (runtime: Runtime) => Promise<T>,
  ): Promise<T> {
    if (explicit !== undefined) return run(explicit);
    beginFlight();
    try {
      return await run(await ensureShared());
    } finally {
      endFlight();
    }
  }

  function trackJob<T>(create: (runtime: Runtime) => PausableJob<T>): PausableJob<T> {
    beginFlight();
    const job = delegateJob(() => ensureShared().then(create), () => {
      boundSequence += 1;
      return `runtime-${boundSequence.toString(36)}`;
    });
    void job.result.finally(() => endFlight());
    return job;
  }

  const api: RuntimeApi = {
    check(media, options = {}) {
      const { runtime, ...rest } = options;
      return using(runtime, (selected) => kernelCheck(selected, media as MediaValue, rest as CheckOptions));
    },
    inspect(media, options = {}) {
      const { runtime, ...rest } = options;
      return using(runtime, (selected) => kernelInspect(selected, media as MediaValue, rest as InspectOptions));
    },
    inspectFile(input, options = {}) {
      const { runtime, ...rest } = options;
      return using(runtime, (selected) => kernelInspectFile(selected, input, rest));
    },
    render(media, options) {
      const { runtime, ...rest } = options;
      return using(runtime, (selected) => renderWithRuntime(selected, media as ExportableMedia, rest));
    },
    async renderResponse(media, options) {
      const { headers: extra, ...renderOptions } = options;
      const result = await api.render(media, renderOptions);
      const bytes = await result.bytes();
      const body = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(body).set(bytes);
      const headers = new Headers({
        "content-type": result.mimeType,
        "content-length": String(result.byteLength),
        etag: `"${result.sha256}"`,
      });
      if (extra !== undefined) {
        new Headers(extra).forEach((value, key) => {
          headers.set(key, value);
        });
      }
      return new Response(body, { headers });
    },
    exportMedia(media, options) {
      const { runtime, ...rest } = options;
      return using(runtime, (selected) => kernelExportMedia(selected, media as ExportableMedia, rest as ExportOptions));
    },
    startExport(media, options) {
      const { runtime, ...rest } = options;
      if (runtime !== undefined) return kernelStartExport(runtime, media as ExportableMedia, rest as ExportOptions);
      return trackJob((selected) => kernelStartExport(selected, media as ExportableMedia, rest as ExportOptions));
    },
    startConversion(request, options) {
      const runtime = options?.runtime;
      if (runtime !== undefined) return kernelStartConversion(runtime, request);
      return trackJob((selected) => kernelStartConversion(selected, request));
    },
    async shutdown() {
      clearIdle();
      const current = shared;
      shared = undefined;
      if (current === undefined) return;
      const runtime = await current;
      await runtime.dispose();
    },
  };

  return api;

  async function renderWithRuntime<D>(
    runtime: Runtime,
    media: ExportableMedia<D>,
    options: Omit<MediaRenderOptions<D>, "runtime">,
  ): Promise<MediaRenderResult> {
    if (isAnimatedRenderFormat(options.as)) {
      if (!runtime.capabilities.animated.includes(options.as)) {
        throw new CapabilityUnavailableError(`${options.as} rendering`);
      }
      return renderAnimated(runtime, media, options, options.as);
    }
    return kernelRender(
      runtime,
      media as ExportableMedia,
      libraryStillOptions(media, options) as AdapterRenderOptions,
    );
  }
}

function authoredMedium(media: ExportableMedia): "html" | "svg" {
  return (media.kind === "collection" ? media.media : media).medium;
}

/** Library stills match authored pixels unless the caller sets capture DPR. Native SVG rejects any capture block. */
function libraryStillOptions<D>(
  media: ExportableMedia<D>,
  options: Omit<MediaRenderOptions<D>, "runtime">,
): Omit<MediaRenderOptions<D>, "runtime"> {
  if (options.encoding?.capture?.dpr !== undefined || authoredMedium(media) === "svg") {
    return options;
  }
  return {
    ...options,
    encoding: {
      ...options.encoding,
      capture: { ...options.encoding?.capture, dpr: 1 },
    },
  };
}

function isAnimatedRenderFormat(format: RenderFormat): format is AnimatedRenderFormat {
  return (ANIMATED_FORMATS as readonly string[]).includes(format);
}

async function renderAnimated<D>(
  runtime: Runtime,
  media: ExportableMedia<D>,
  options: Omit<MediaRenderOptions<D>, "runtime">,
  format: AnimatedRenderFormat,
): Promise<MediaRenderResult> {
  const size = options.size ?? authoredSize(media);
  const bundle = await kernelExportMedia(runtime, media, {
    for: [{ id: format, format, width: size.width, height: size.height }],
    ...(options.data !== undefined ? { data: options.data as JsonObject } : {}),
    ...(options.entryId !== undefined ? { entryIds: [options.entryId] } : {}),
    ...(options.variantId !== undefined ? { variantIds: [options.variantId] } : {}),
    ...(options.editionId !== undefined ? { editionIds: [options.editionId] } : {}),
    ...(options.at !== undefined ? { at: options.at } : {}),
    ...(options.encoding !== undefined ? { encoding: options.encoding } : {}),
    ...(options.providers !== undefined ? { providers: options.providers } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  try {
    const artifact = bundle.artifacts[0];
    if (bundle.artifacts.length !== 1 || artifact === undefined) {
      throw new RuntimeInfrastructureError("Animated render must produce exactly one artifact", {
        count: bundle.artifacts.length,
      });
    }
    const bytes = await artifact.bytes();
    return createMemoryRenderResult({
      as: format,
      mimeType: artifact.mimeType,
      coordinates: mediaCoordinates(artifact.coordinates),
      bytes,
      byteLength: artifact.byteLength,
      sha256: artifact.sha256,
    });
  } finally {
    await bundle.dispose();
  }
}

function authoredSize(media: ExportableMedia): { width: number; height: number } {
  const definition = media.kind === "collection" ? media.media : media;
  const width = definition.config?.width;
  const height = definition.config?.height;
  if (
    width === undefined || height === undefined
    || !Number.isInteger(width) || width <= 0
    || !Number.isInteger(height) || height <= 0
  ) {
    throw new MediaPreflightError([{
      severity: "error",
      category: "authoring",
      code: "RENDER_SIZE_INVALID",
      message: "Animated render size must contain positive integer width and height",
    }]);
  }
  return { width, height };
}

function mediaCoordinates(value: {
  readonly entryId?: string;
  readonly variantId: string;
  readonly editionId: string;
}): RuntimeMediaCoordinates {
  return {
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  };
}

function delegateJob<T>(
  load: () => Promise<PausableJob<T>>,
  nextId: () => string,
): PausableJob<T> {
  let innerPromise: Promise<PausableJob<T>> | undefined;
  const once = (): Promise<PausableJob<T>> => (innerPromise ??= load());
  let state: JobState = "queued";
  let reason: string | undefined;
  const listeners = new Set<(event: JobEvent) => void>();
  const id = nextId();
  const emit = (event: JobEvent): void => {
    state = event.state;
    if (event.reason !== undefined) reason = event.reason;
    for (const listener of listeners) {
      try { listener(event); } catch { /* observers cannot affect a job */ }
    }
  };
  const result = once().then((job) => {
    job.subscribe((event) => emit(event));
    return job.result;
  }).catch((error: unknown) => {
    state = "failed";
    throw error;
  });
  void result.catch(() => {});

  let disposePromise: Promise<void> | undefined;
  const job: PausableJob<T> = Object.freeze({
    id,
    get state() { return state; },
    result,
    async pause() {
      await (await once()).pause();
    },
    async resume() {
      await (await once()).resume();
    },
    async cancel(nextReason?: string) {
      reason = nextReason;
      const inner = await once().catch(() => undefined);
      if (inner !== undefined) await inner.cancel(nextReason);
      else state = "cancelled";
    },
    dispose() {
      disposePromise ??= (async () => {
        const inner = await once().catch(() => undefined);
        if (inner !== undefined) await inner.dispose();
      })();
      return disposePromise;
    },
    subscribe(listener: (event: JobEvent) => void) {
      listeners.add(listener);
      try {
        listener(Object.freeze({
          schemaVersion: 0,
          kind: "@foxworth/superimg/job",
          jobId: id,
          state,
          ...(reason !== undefined ? { reason } : {}),
        }));
      } catch { /* observers cannot affect a job */ }
      return () => listeners.delete(listener);
    },
    [Symbol.asyncDispose]: async () => { await job.dispose(); },
  });
  return job;
}
