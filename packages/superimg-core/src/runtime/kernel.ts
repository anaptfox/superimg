//! Deep, value-first runtime kernel shared by platform binders.

import {
  CapabilityUnavailableError,
  MediaPreflightError,
  RuntimeCancelledError,
  RuntimeDisposedError,
  RuntimeInfrastructureError,
  SuperImgError,
  type CheckOptions,
  type ConversionArtifact,
  type ConversionRequest,
  type CheckReport,
  type ExportBundle,
  type ExportOptions,
  type ExportableMedia,
  type InspectOptions,
  type MediaInput,
  type MediaInspection,
  type MediaInspectOptions,
  type PausableJob,
  type InspectReport,
  type InitOptions,
  type JsonObject,
  type MediaRenderResult,
  type MediaValue,
  type Runtime,
  type RuntimeFinding,
  type RuntimeMediaCoordinates,
} from "@superimg/types";
import {
  freezeRuntimeAdapter,
  type AdapterRenderOptions,
  type RuntimeAdapter,
  type RuntimeAdapterConversionOutput,
  type RuntimeAdapterPreflight,
} from "./adapter.js";
import { createExportBundle, createMediaRenderResult, disposeAdapterExport, freezeJsonObject } from "./bundle.js";
import { createConversionArtifact } from "./conversion.js";
import { createPausableJob, type JobContext } from "./job.js";
import {
  analyzeExportMediaValue,
  analyzeMediaValue,
  sampleMediaAnalysis,
  includeSemanticIR,
  programDigestWithFonts,
  type RuntimeInspectionContribution,
  type SemanticAnalysis,
} from "./semantic.js";
import {
  isCollectionMediaValue,
  isDeterministicMediaValue,
  isInteractiveMediaValue,
  normalizeCollectionEntries,
  selectRuntimeMedia,
  resolveRuntimeSelection,
  staticCollectionEntries,
  type RuntimeCollectionEntry,
} from "./selection.js";
import { assertPreparedRuntimeReport, createPreparedRuntimeReport, type PreparedRuntimeReport } from "./report-preparation.js";

import { withRenderedLayoutCoverage } from "./coverage.js";

const RUNTIME_STATE = Symbol("superimg.runtime.state");

type RuntimeStatus = "active" | "disposing" | "disposed";

interface RuntimeState {
  readonly adapter: RuntimeAdapter;
  readonly concurrency: number;
  readonly queue: AdmissionWaiter[];
  readonly jobs: Set<PausableJob<unknown>>;
  status: RuntimeStatus;
  activeOperations: number;
  drain: Promise<void> | undefined;
  resolveDrain: (() => void) | undefined;
  disposePromise: Promise<void> | undefined;
}

interface AdmissionWaiter {
  readonly operation: string;
  readonly signal: AbortSignal | undefined;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly onAbort: (() => void) | undefined;
  settled: boolean;
}

type KernelRuntime = Runtime & { readonly [RUNTIME_STATE]: RuntimeState };

/** Create a public Runtime from one private, immutable platform adapter set. */
export function createRuntime(adapterInput: RuntimeAdapter, options: InitOptions = {}): Runtime {
  assertNotCancelled(options.signal, "runtime initialization");
  const concurrency = resolveConcurrency(options.concurrency);
  const adapter = freezeRuntimeAdapter(adapterInput);
  const state: RuntimeState = {
    adapter,
    concurrency,
    queue: [],
    jobs: new Set(),
    status: "active",
    activeOperations: 0,
    drain: undefined,
    resolveDrain: undefined,
    disposePromise: undefined,
  };

  const dispose = (): Promise<void> => {
    if (state.disposePromise !== undefined) return state.disposePromise;
    state.status = "disposing";
    rejectQueuedOperations(state);
    for (const job of state.jobs) void job.cancel("runtime disposed");
    state.disposePromise = (async () => {
      if (state.activeOperations > 0) {
        state.drain = new Promise<void>((resolve) => {
          state.resolveDrain = resolve;
        });
        await state.drain;
      }
      try {
        await adapter.dispose();
      } catch (error) {
        throw infrastructureError("dispose", error);
      } finally {
        state.status = "disposed";
        state.resolveDrain = undefined;
      }
    })();
    return state.disposePromise;
  };

  const runtime = {
    abi: adapter.abi,
    capabilities: adapter.capabilities,
    dispose,
    [Symbol.asyncDispose]: dispose,
  } as unknown as KernelRuntime;
  Object.defineProperty(runtime, RUNTIME_STATE, {
    value: state,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(runtime);
}

export async function check(
  runtime: Runtime,
  media: MediaValue,
  options: CheckOptions = {},
  prepared?: PreparedRuntimeReport,
): Promise<CheckReport> {
  return withRuntime(runtime, "check", options.signal, async (state) => {
    if (!state.adapter.capabilities.check) throw new CapabilityUnavailableError("check");
    if (prepared) assertPreparedRuntimeReport(prepared, runtime, media, options);
    const reportInput = await analyzeForReport(state.adapter, "check", media, options, prepared);
    return Object.freeze({
      schemaVersion: 0,
      ok: !reportInput.analysis.findings.some((finding) => finding.severity === "error"),
      programDigest: reportInput.analysis.programDigest,
      kind: reportInput.analysis.kind,
      coordinates: reportInput.analysis.coordinates,
      findings: freezeFindings(reportInput.analysis.findings),
      ...(reportInput.analysis.coverage ? { coverage: reportInput.analysis.coverage } : {}),
    });
  });
}

export async function inspect(
  runtime: Runtime,
  media: MediaValue,
  options: InspectOptions = {},
  prepared?: PreparedRuntimeReport,
): Promise<InspectReport> {
  return withRuntime(runtime, "inspect", options.signal, async (state) => {
    if (!state.adapter.capabilities.inspect) throw new CapabilityUnavailableError("inspect");
    if (prepared) assertPreparedRuntimeReport(prepared, runtime, media, options);
    const { analysis, contribution } = await analyzeForReport(
      state.adapter,
      "inspect",
      media,
      options,
      prepared,
    );
    return Object.freeze({
      schemaVersion: 0,
      programDigest: analysis.programDigest,
      kind: analysis.kind,
      ...(analysis.config !== undefined ? { config: analysis.config } : {}),
      coordinates: analysis.coordinates,
      findings: freezeFindings(analysis.findings),
      ...(analysis.coverage ? { coverage: analysis.coverage } : {}),
      assets: Object.freeze((contribution.assets ?? []).map((asset) => Object.freeze({ ...asset }))),
      fonts: Object.freeze((contribution.fonts ?? []).map((font) => Object.freeze({ ...font }))),
      ...(analysis.collection !== undefined ? { collection: analysis.collection } : {}),
      ...((contribution.metadata ?? analysis.metadata) !== undefined
        ? { metadata: freezeJsonObject({ ...(analysis.metadata ?? {}), ...(contribution.metadata ?? {}) }) }
        : {}),
    });
  });
}

/** @internal Resolve a native command selection once; keep sampling/resources fresh. */
export async function prepareRuntimeReport(
  runtime: Runtime,
  media: MediaValue,
  options: CheckOptions | InspectOptions = {},
): Promise<PreparedRuntimeReport> {
  return withRuntime(runtime, "prepare report", options.signal, async (state) => {
    if (options.providers === "resolve") throw new Error("Prepared reports require deferred providers");
    const analysis = await analyzeMediaValue(media, options, state.adapter.capabilities, {
      sample: false, ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    return createPreparedRuntimeReport(runtime, media, options, analysis);
  });
}

/** Inspect host-supplied bytes or URLs without assigning authored-program identity. */
export async function inspectFile(
  runtime: Runtime,
  input: MediaInput,
  options: MediaInspectOptions = {},
): Promise<MediaInspection> {
  return withRuntime(runtime, "inspectFile", options.signal, async (state) => {
    if (state.adapter.inspectFile === undefined) throw new CapabilityUnavailableError("native media inspection");
    return await callAdapter("media inspection", options.signal, () => state.adapter.inspectFile!(input, options.signal));
  });
}

/** Start a conversion. Pause is observed only at adapter checkpoints. */
export function startConversion(runtime: Runtime, request: ConversionRequest): PausableJob<ConversionArtifact> {
  return managedJob(runtime, "conversion", request.signal, async (job) => {
    if (request.signal?.aborted) throw new RuntimeCancelledError({ operation: "conversion" });
    return await withRuntime(runtime, "conversion", job.signal, async (state) => {
      await job.checkpoint();
      if (state.adapter.convertMedia === undefined) throw new CapabilityUnavailableError("native media conversion");
      let cleanupFailed = false;
      let cleanupFailure: unknown;
      let output: RuntimeAdapterConversionOutput;
      try {
        output = await callAdapter("media conversion", job.signal, () => state.adapter.convertMedia!({
          request: { ...request, signal: job.signal },
          checkpoint: job.checkpoint,
          preflight: job.preflight,
          finalizing: job.finalizing,
        }), async (rejected) => {
          try { await rejected.backing?.dispose(); }
          catch (error) { cleanupFailed = true; cleanupFailure = error; }
        });
      } catch (error) {
        if (cleanupFailed) throw new AggregateError([error, cleanupFailure], "Cancelled conversion cleanup failed");
        throw error;
      }
      try {
        return createConversionArtifact(output);
      } catch (error) {
        try { await output.backing?.dispose(); }
        catch (cleanupError) { throw new AggregateError([error, cleanupError], "Conversion adoption cleanup failed"); }
        throw error;
      }
    });
  });
}

/** Run normal authored export behind the common pausable-job lifecycle. */
export function startExport(
  runtime: Runtime,
  media: ExportableMedia,
  options: ExportOptions,
): PausableJob<ExportBundle> {
  return managedJob(runtime, "export", options.signal, async (job) => {
    return await exportWithLifecycle(runtime, media, { ...options, signal: job.signal }, job);
  });
}

function managedJob<T>(runtime: Runtime, kind: string, signal: AbortSignal | undefined, run: (job: JobContext) => Promise<T>): PausableJob<T> {
  const state = stateFor(runtime);
  const job = createPausableJob(nextJobId(kind), run, { deferStart: true, ...(signal ? { signal } : {}) });
  state.jobs.add(job);
  void job.result.finally(() => state.jobs.delete(job)).catch(() => {});
  return job;
}

let jobSequence = 0;
function nextJobId(kind: string): string {
  jobSequence += 1;
  return `${kind}-${jobSequence.toString(36)}`;
}

export async function render(
  runtime: Runtime,
  media: ExportableMedia,
  options: AdapterRenderOptions,
  prepared?: PreparedRuntimeReport,
): Promise<MediaRenderResult> {
  return withRuntime(runtime, "render", options.signal, async (state) => {
    const authored = media as MediaValue;
    if (prepared) assertPreparedRuntimeReport(prepared, runtime, authored, options);
    if (isInteractiveMediaValue(authored)) {
      throw new MediaPreflightError([interactiveArtifactFinding()]);
    }
    assertRenderCapability(state.adapter, options.as);

    const entries = await resolveEntries(state.adapter, authored, options.providers, options.signal);
    let selection;
    try {
      selection = prepared?.analysis.selections.length === 1 ? prepared.analysis.selections[0]!
        : await resolveRuntimeSelection(selectRuntimeMedia(media, {
        ...(options.data !== undefined ? { data: options.data as JsonObject } : {}),
        ...(options.entryId !== undefined ? { entryId: options.entryId } : {}),
        ...(options.variantId !== undefined ? { variant: options.variantId } : {}),
        ...(options.editionId !== undefined ? { edition: options.editionId } : {}),
      }, entries ?? undefined), options.signal);
    } catch (error) {
      throw new MediaPreflightError([authoredSelectionFinding(error)]);
    }

    const effectiveAt = options.at ?? selection.media.poster;
    const effectiveOptions: AdapterRenderOptions = effectiveAt === undefined || options.at !== undefined
      ? options
      : { ...options, at: effectiveAt };
    const analysisOptions = {
      sample: true,
      selections: [selection],
      ...(entries !== null ? { entries } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    };
    const analysis = prepared ? await sampleMediaAnalysis(
      prepared.analysis, selectionFromRender(effectiveOptions), analysisOptions,
    ) : await analyzeMediaValue(
      authored,
      selectionFromRender(effectiveOptions),
      state.adapter.capabilities,
      analysisOptions,
    );
    const programDigest = analysis.programDigest;
    const findings = [...analysis.findings];
    if (selection.media.animated && options.at === undefined && selection.media.poster === undefined) {
      findings.push({
        severity: "error",
        category: "render",
        code: "ANIMATED_STILL_TIME_REQUIRED",
        message: "Rendering animated media to one exact result requires an authored poster or explicit at time",
        coordinates: selection.coordinates,
      });
    }
    if (options.size !== undefined && !validSize(options.size.width, options.size.height)) {
      findings.push({
        severity: "error",
        category: "authoring",
        code: "RENDER_SIZE_INVALID",
        message: "Render size must contain positive integer width and height",
        coordinates: selection.coordinates,
      });
    }

    const preflight = await callAdapter(
      "render preflight",
      options.signal,
      () => state.adapter.preflight({
        operation: "render",
        programDigest,
        media,
        options: effectiveOptions,
        selection,
        ...(entries !== null ? { entries } : {}),
      }),
    );
    try {
      findings.push(...preflight.findings);
      throwOnPreflightFindings(findings);
      const output = await callAdapter(
        "render",
        options.signal,
        () => state.adapter.render({
          operation: "render",
          programDigest,
          media,
          options: effectiveOptions,
          selection,
          preflight,
          ...(entries !== null ? { entries } : {}),
        }),
      );
      if (output.as !== options.as) {
        throw new RuntimeInfrastructureError("Runtime adapter returned the wrong render format", {
          requested: options.as,
          received: output.as,
        });
      }
      assertSameCoordinates(selection.coordinates, output.coordinates);
      try {
        return createMediaRenderResult(output);
      } catch (error) {
        if (error instanceof SuperImgError) throw error;
        throw infrastructureError("render result validation", error);
      }
    } finally {
      await disposePreflight(preflight);
    }
  });
}

export async function exportMedia(
  runtime: Runtime,
  media: ExportableMedia,
  options: ExportOptions,
): Promise<ExportBundle> {
  return exportWithLifecycle(runtime, media, options);
}

async function exportWithLifecycle(
  runtime: Runtime,
  media: ExportableMedia,
  options: ExportOptions,
  lifecycle?: JobContext,
): Promise<ExportBundle> {
  return withRuntime(runtime, "export", options.signal, async (state) => {
    await lifecycle?.checkpoint();
    const authored = media as MediaValue;
    if (isInteractiveMediaValue(authored)) {
      throw new MediaPreflightError([interactiveArtifactFinding()]);
    }
    if (options.for.length === 0) {
      throw new MediaPreflightError([{
        severity: "error",
        category: "authoring",
        code: "EXPORT_TARGET_REQUIRED",
        message: "exportMedia() requires at least one destination or rendition target",
      }]);
    }
    const emptySelectorFindings = exportEmptySelectorFindings(options);
    if (emptySelectorFindings.length > 0) {
      throw new MediaPreflightError(emptySelectorFindings);
    }

    const entries = await resolveEntries(state.adapter, authored, options.providers, options.signal);
    const analysis = await analyzeExportMediaValue(
      media,
      options,
      state.adapter.capabilities,
      entries,
    );
    const findings = [...analysis.findings];
    if (isCollectionMediaValue(authored) && entries === null) {
      findings.push(providerResolutionFinding());
    }

    const executionMedia = mediaWithExportData(media, options.data);
    const preflight = await callAdapter(
      "export preflight",
      options.signal,
      () => state.adapter.preflight({
        operation: "export",
        programDigest: analysis.programDigest,
        media: executionMedia,
        options,
        selections: analysis.selections,
        ...(entries !== null ? { entries } : {}),
      }),
    );
    let bundle: ExportBundle | undefined;
    try {
      findings.push(...preflight.findings);
      throwOnPreflightFindings(findings);
      const output = await callAdapter(
        "export",
        options.signal,
        () => state.adapter.exportMedia({
          operation: "export",
          programDigest: analysis.programDigest,
          media: executionMedia,
          options,
          selections: analysis.selections,
          preflight,
          ...(lifecycle ? { lifecycle } : {}),
          ...(entries !== null ? { entries } : {}),
        }),
        disposeAdapterExport,
      );
      try {
        lifecycle?.finalizing();
        bundle = createExportBundle({
          programDigest: programDigestWithFonts(analysis.programDigest, preflight.fonts),
          expectedCoordinates: analysis.coordinates,
          output,
          assets: preflight.assets,
          fonts: preflight.fonts,
          ...((output.metadata ?? preflight.metadata) !== undefined
            ? { metadata: { ...(preflight.metadata ?? {}), ...(output.metadata ?? {}) } }
            : {}),
        });
        return bundle;
      } catch (error) {
        await disposeAdapterExport(output);
        if (error instanceof SuperImgError) throw error;
        throw infrastructureError("export bundle validation", error);
      }
    } finally {
      try {
        await disposePreflight(preflight);
        assertNotCancelled(options.signal, "export");
      } catch (error) {
        // Ownership is transferred only when the entire operation succeeds.
        // A failed preflight cleanup must not strand an otherwise valid movie.
        if (bundle) {
          try { await bundle.dispose(); }
          catch (cleanupError) { throw new AggregateError([error, cleanupError], "Export cleanup failed"); }
        }
        throw error;
      }
    }
  });
}

async function analyzeForReport(
  adapter: RuntimeAdapter,
  operation: "check" | "inspect",
  media: MediaValue,
  options: CheckOptions | InspectOptions,
  prepared?: PreparedRuntimeReport,
): Promise<{ analysis: SemanticAnalysis; contribution: RuntimeInspectionContribution }> {
  let entries: readonly RuntimeCollectionEntry[] | null = null;
  if (isCollectionMediaValue(media) && !Array.isArray(media.entries) && options.providers === "resolve") {
    entries = await resolveEntries(adapter, media, "resolve", options.signal);
  }
  const analysisOptions = {
    sample: true,
    captureSample: operation === "inspect",
    craft: operation === "check" && "craft" in options && options.craft === true,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(entries !== null ? { entries } : {}),
  };
  let analysis = prepared
    ? await sampleMediaAnalysis(prepared.analysis, options, analysisOptions)
    : await analyzeMediaValue(media, options, adapter.capabilities, analysisOptions);
  if (operation === "inspect" && "includeIR" in options && options.includeIR === true) {
    try {
      analysis = await includeSemanticIR(analysis, options.signal);
    } catch (error) {
      if (options.signal?.aborted === true) {
        throw new RuntimeCancelledError({ operation: "inspect semantic IR" });
      }
      throw error;
    }
  }

  const contribution = adapter.inspect === undefined
    ? {}
    : await callAdapter(
        `${operation} inspection`,
        options.signal,
        () => adapter.inspect!({
          operation,
          media,
          options,
          allowProviderExecution: false,
          selections: analysis.selections,
          ...(entries !== null ? { entries } : {}),
        }),
      );
  const findings = freezeFindings([
    ...analysis.findings,
    ...(contribution.findings ?? []),
  ]);
  const coverage = withRenderedLayoutCoverage(analysis.coverage, contribution.metadata, findings);
  analysis = Object.freeze({
    ...analysis,
    ...(coverage ? { coverage } : {}),
    programDigest: programDigestWithFonts(analysis.programDigest, contribution.fonts),
    findings,
  });
  return { analysis, contribution };
}

async function resolveEntries(
  adapter: RuntimeAdapter,
  media: MediaValue,
  providers: "skip" | "resolve" | undefined,
  signal: AbortSignal | undefined,
): Promise<readonly RuntimeCollectionEntry[] | null> {
  if (!isCollectionMediaValue(media)) return null;
  let staticEntries: ReturnType<typeof staticCollectionEntries>;
  try {
    staticEntries = staticCollectionEntries(media);
  } catch (error) {
    throw new MediaPreflightError([{
      severity: "error",
      category: "collection",
      code: "COLLECTION_SNAPSHOT_INVALID",
      message: error instanceof Error ? error.message : "Static collection entries are invalid",
    }]);
  }
  if (staticEntries !== null) return staticEntries;
  if (providers !== "resolve") return null;
  if (!adapter.capabilities.collections.providers || adapter.resolveCollectionEntries === undefined) {
    throw new CapabilityUnavailableError("collection provider execution");
  }
  const raw = await callAdapter(
    "collection provider",
    signal,
    () => adapter.resolveCollectionEntries!({
      collection: media,
      ...(signal !== undefined ? { signal } : {}),
    }),
  );
  try {
    return Object.freeze(normalizeCollectionEntries(media, raw));
  } catch (error) {
    throw new MediaPreflightError([{
      severity: "error",
      category: "collection",
      code: "COLLECTION_SNAPSHOT_INVALID",
      message: error instanceof Error ? error.message : "Collection provider returned an invalid snapshot",
    }]);
  }
}

function selectionFromRender(options: AdapterRenderOptions): CheckOptions {
  return {
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.entryId !== undefined ? { entryId: options.entryId } : {}),
    ...(options.variantId !== undefined ? { variantId: options.variantId } : {}),
    ...(options.editionId !== undefined ? { editionId: options.editionId } : {}),
    ...(options.at !== undefined ? { at: options.at } : {}),
    ...(options.providers !== undefined ? { providers: options.providers } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  };
}

function exportEmptySelectorFindings(options: ExportOptions): RuntimeFinding[] {
  const findings: RuntimeFinding[] = [];
  if (options.entryIds !== undefined && options.entryIds.length === 0) {
    findings.push({
      severity: "error",
      category: "collection",
      code: "EXPORT_ENTRY_SELECTOR_EMPTY",
      message: "entryIds must be omitted to select all entries or contain at least one entry id",
    });
  }
  if (options.variantIds !== undefined && options.variantIds.length === 0) {
    findings.push({
      severity: "error",
      category: "authoring",
      code: "EXPORT_VARIANT_SELECTOR_EMPTY",
      message: "variantIds must be omitted to use authored defaults or contain at least one variant id",
    });
  }
  if (options.editionIds !== undefined && options.editionIds.length === 0) {
    findings.push({
      severity: "error",
      category: "authoring",
      code: "EXPORT_EDITION_SELECTOR_EMPTY",
      message: "editionIds must be omitted to use destination art direction or contain at least one edition id",
    });
  }
  return findings;
}

function mediaWithExportData(
  media: ExportableMedia,
  data: ExportOptions["data"],
): ExportableMedia {
  if (data === undefined || isCollectionMediaValue(media)) return media;
  return Object.freeze({
    ...media,
    sample: Object.freeze({
      ...((media.sample ?? {}) as JsonObject),
      ...data,
    }),
  }) as ExportableMedia;
}

function assertRenderCapability(adapter: RuntimeAdapter, format: AdapterRenderOptions["as"]): void {
  const supported = format === "html" || format === "svg"
    ? adapter.capabilities.documents.includes(format)
    : adapter.capabilities.rasters.includes(format);
  if (!supported) throw new CapabilityUnavailableError(`${format} rendering`);
}

function throwOnPreflightFindings(findings: readonly RuntimeFinding[]): void {
  const blocking = findings.filter((finding) => finding.severity === "error");
  if (blocking.length > 0) throw new MediaPreflightError(Object.freeze(blocking));
}

function freezeFindings(findings: readonly RuntimeFinding[]): readonly RuntimeFinding[] {
  return Object.freeze(findings.map((finding) => Object.freeze({
    ...finding,
    ...(finding.coordinates !== undefined
      ? { coordinates: Object.freeze({ ...finding.coordinates }) }
      : {}),
    ...(finding.details !== undefined ? { details: freezeJsonObject(finding.details) } : {}),
  })));
}

function providerResolutionFinding(): RuntimeFinding {
  return {
    severity: "error",
    category: "collection",
    code: "COLLECTION_PROVIDER_RESOLUTION_REQUIRED",
    message: "Exporting a provider collection requires providers: \"resolve\" in a capable runtime",
  };
}

function interactiveArtifactFinding(): RuntimeFinding {
  return {
    severity: "error",
    category: "interactive",
    code: "INTERACTIVE_DETERMINISTIC_ARTIFACT_UNAVAILABLE",
    message: "Interactive media is host-driven and cannot be rendered or exported deterministically",
  };
}

function authoredSelectionFinding(error: unknown): RuntimeFinding {
  return {
    severity: "error",
    category: "authoring",
    code: "MEDIA_SELECTION_INVALID",
    message: error instanceof Error ? error.message : "Media selection is invalid",
  };
}

function validSize(width: number, height: number): boolean {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0;
}

function assertSameCoordinates(
  expected: RuntimeMediaCoordinates,
  actual: RuntimeMediaCoordinates,
): void {
  if (
    expected.entryId !== actual.entryId ||
    expected.variantId !== actual.variantId ||
    expected.editionId !== actual.editionId
  ) {
    throw new RuntimeInfrastructureError("Runtime adapter returned mismatched media coordinates", {
      expected: coordinatesJson(expected),
      actual: coordinatesJson(actual),
    });
  }
}

function coordinatesJson(value: RuntimeMediaCoordinates): JsonObject {
  return {
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  };
}

async function disposePreflight(preflight: RuntimeAdapterPreflight): Promise<void> {
  if (preflight.dispose === undefined) return;
  try {
    await preflight.dispose();
  } catch (error) {
    throw infrastructureError("preflight disposal", error);
  }
}

async function callAdapter<T>(
  operation: string,
  signal: AbortSignal | undefined,
  call: () => Promise<T>,
  disposeRejected?: (result: T) => Promise<void>,
): Promise<T> {
  assertNotCancelled(signal, operation);
  try {
    const result = await call();
    if (signal?.aborted === true) await disposeRejected?.(result);
    assertNotCancelled(signal, operation);
    return result;
  } catch (error) {
    if (signal?.aborted === true) throw new RuntimeCancelledError({ operation });
    if (error instanceof SuperImgError) throw error;
    throw infrastructureError(operation, error);
  }
}

function infrastructureError(operation: string, error: unknown): RuntimeInfrastructureError {
  return new RuntimeInfrastructureError(
    `${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    {
      operation,
      ...(error instanceof Error ? { causeName: error.name } : {}),
    },
    { cause: error },
  );
}

function assertNotCancelled(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted === true) throw new RuntimeCancelledError({ operation });
}

async function withRuntime<T>(
  runtime: Runtime,
  operation: string,
  signal: AbortSignal | undefined,
  run: (state: RuntimeState) => Promise<T>,
): Promise<T> {
  const state = stateFor(runtime);
  await acquireAdmission(state, operation, signal);
  try {
    return await run(state);
  } finally {
    releaseAdmission(state);
  }
}

function resolveConcurrency(value: number | undefined): number {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("Runtime concurrency must be a positive safe integer");
  }
  return value;
}

function acquireAdmission(
  state: RuntimeState,
  operation: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (state.status !== "active") return Promise.reject(new RuntimeDisposedError());
  try {
    assertNotCancelled(signal, operation);
  } catch (error) {
    return Promise.reject(error);
  }

  if (state.activeOperations < state.concurrency && state.queue.length === 0) {
    state.activeOperations += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const waiter: AdmissionWaiter = {
      operation,
      signal,
      resolve,
      reject,
      onAbort: signal === undefined
        ? undefined
        : () => cancelQueuedOperation(state, waiter),
      settled: false,
    };
    state.queue.push(waiter);
    if (waiter.onAbort !== undefined) {
      signal!.addEventListener("abort", waiter.onAbort, { once: true });
      // Abort can race listener installation in hosts with a non-native signal.
      if (signal!.aborted) cancelQueuedOperation(state, waiter);
    }
  });
}

function releaseAdmission(state: RuntimeState): void {
  state.activeOperations -= 1;
  if (state.activeOperations < 0) {
    state.activeOperations = 0;
    throw new RuntimeInfrastructureError("Runtime admission accounting underflowed");
  }
  if (state.status === "active") pumpAdmissionQueue(state);
  if (state.activeOperations === 0 && state.status === "disposing") state.resolveDrain?.();
}

function pumpAdmissionQueue(state: RuntimeState): void {
  while (
    state.status === "active" &&
    state.activeOperations < state.concurrency &&
    state.queue.length > 0
  ) {
    const waiter = state.queue.shift()!;
    if (waiter.settled) continue;
    if (waiter.signal?.aborted === true) {
      settleWaiter(waiter, new RuntimeCancelledError({ operation: waiter.operation }));
      continue;
    }
    waiter.settled = true;
    detachAbort(waiter);
    state.activeOperations += 1;
    waiter.resolve();
  }
}

function cancelQueuedOperation(state: RuntimeState, waiter: AdmissionWaiter): void {
  if (waiter.settled) return;
  const index = state.queue.indexOf(waiter);
  if (index !== -1) state.queue.splice(index, 1);
  settleWaiter(waiter, new RuntimeCancelledError({ operation: waiter.operation }));
  // A cancelled head waiter must not prevent an available permit reaching the
  // next FIFO waiter.
  if (state.status === "active") pumpAdmissionQueue(state);
}

function rejectQueuedOperations(state: RuntimeState): void {
  const queued = state.queue.splice(0);
  for (const waiter of queued) settleWaiter(waiter, new RuntimeDisposedError());
}

function settleWaiter(waiter: AdmissionWaiter, error: unknown): void {
  if (waiter.settled) return;
  waiter.settled = true;
  detachAbort(waiter);
  waiter.reject(error);
}

function detachAbort(waiter: AdmissionWaiter): void {
  if (waiter.signal !== undefined && waiter.onAbort !== undefined) {
    waiter.signal.removeEventListener("abort", waiter.onAbort);
  }
}

function stateFor(runtime: Runtime): RuntimeState {
  const state = (runtime as Partial<KernelRuntime>)[RUNTIME_STATE];
  if (state === undefined) {
    throw new TypeError("Runtime was not created by the SuperImg runtime kernel");
  }
  return state;
}
