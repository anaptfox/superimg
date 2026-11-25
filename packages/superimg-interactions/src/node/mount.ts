import { createHash } from "node:crypto";
import {
  probeDirectorPhases,
  resolveRuntimeTemplateInfo,
} from "@superimg/core";
import {
  check as runtimeCheck,
  exportMedia as runtimeExportMedia,
  inspect as runtimeInspect,
  type PreparedRuntimeReport,
} from "@superimg/core/runtime";
import {
  analyzeMediaSourceFindings,
  analyzeMediaSource,
  type MediaSourceAnalysisOptions,
} from "@superimg/core/source-analysis";
import type {
  ExportBundle,
  ExportOptions,
  ExportProgressEvent,
  ExportableMedia,
  CheckOptions,
  CheckReport,
  InspectOptions,
  InspectReport,
  JsonObject as SuperImgJsonObject,
  MediaValue,
  Runtime,
  RuntimeFinding,
} from "@superimg/types";
import {
  MEDIA_INTERACTION_IDS,
  MediaInteractionError,
  type MediaSourceCheckInteractionInput,
  type MediaSourceInspectInteractionInput,
  type MediaExportInteractionInput,
  type MediaInteractionHandlers,
  type MediaProjectDiscovery,
  type MediaSourceDescription,
} from "../contracts.js";
import {
  createMediaInteractionMount,
  MediaInteractionUncertainError,
  type CreateMediaInteractionMountOptions,
  type MediaInteractionMount,
} from "../mount.js";
import type {
  MediaInteractionProgressFailure,
  MediaInteractionProgressReporter,
  MediaInteractionProgressWork,
} from "../progress.js";
import { prepareNodeMediaAnalysis } from "./analysis.js";
import { compileNodeMediaArtifact } from "./artifact.js";
import {
  discoverMediaSources,
  normalizeProjectRoot,
  readMediaSource,
  resolveMediaSource,
  type ResolvedMediaSource,
} from "./discovery.js";
import {
  snapshotCollection,
} from "./provider.js";
import { publishPortableBundle } from "./publication.js";
import {
  compileNodeMediaSource,
  loadNodeMediaValue,
  resolveNodeMediaSourceAnalysis,
  type CompiledNodeMediaSource,
  type LoadedNodeMediaValue,
  type NodeMediaAuthoringOptions,
} from "./source.js";
import {
  createProjectMediaTargetRegistry,
  resolveMediaTargetPath,
  type MediaTargetRegistry,
} from "./targets.js";
import { createMemoryRasterStore, type MediaRasterStore } from "../rasters.js";
import { createNodeArrangeHandler } from "./arrange.js";
import { createNodeThumbnailHandler } from "./thumbnail.js";
import { createNodeNarrationService, type NodeNarrationOptions } from "./narration.js";
import { SpeechDispatchUncertainError } from "./speech/index.js";
import { writeNarrationReview } from "./narration-review.js";

export type NodeMediaExecutionOptions = Readonly<{
  signal?: AbortSignal;
  timeoutMs?: number;
  providerTimeoutMs?: number;
  /** @internal Require an exact browser-safe source projection before export. */
  expectedInputIdentity?: string;
  /** @internal Host-owned request snapshot. Never accepted from portable input. */
  preparedSource?: CompiledNodeMediaSource;
  /** @internal Exact materialized/configured value for this command's source. */
  preparedValue?: LoadedNodeMediaValue;
  /** @internal Native command-owned resolved selection; never portable input. */
  preparedReport?: PreparedRuntimeReport;
  /** @internal Synchronous host retention before export starts. Never wire input. */
  retainExportSource?: (source: LoadedNodeMediaValue) => void;
}>;

export type NodeMediaRuntimeExport = (
  runtime: Runtime,
  media: ExportableMedia,
  options: ExportOptions,
) => Promise<ExportBundle>;

export type NodeMediaRuntimeCheck = (
  runtime: Runtime,
  media: MediaValue,
  options?: CheckOptions,
  prepared?: PreparedRuntimeReport,
) => Promise<CheckReport>;

export type NodeMediaRuntimeInspect = (
  runtime: Runtime,
  media: MediaValue,
  options?: InspectOptions,
  prepared?: PreparedRuntimeReport,
) => Promise<InspectReport>;

export type CreateNodeMediaInteractionMountOptions<Context> = Omit<
  CreateMediaInteractionMountOptions<Context>,
  "handlers"
> & NodeMediaAuthoringOptions & Readonly<{
  projectRoot: string;
  /** Explicit host-owned runtime. The interaction mount never disposes it. */
  runtime: Runtime;
  executionOptions?(context: Context): NodeMediaExecutionOptions;
  producerVersion?: string;
  /** Host-owned logical target registry. Absolute paths never enter contracts. */
  targets?: MediaTargetRegistry<Context>;
  /** Focused test seam; production callers use the value runtime kernel. */
  exportMedia?: NodeMediaRuntimeExport;
  /** Focused test seams; production callers use the value runtime kernel. */
  check?: NodeMediaRuntimeCheck;
  inspect?: NodeMediaRuntimeInspect;
  /** Host-owned decoded pixels. The thumbnail guest never decodes formats. */
  rasters?: MediaRasterStore;
  narration?: NodeNarrationOptions;
}>;

export function createNodeMediaInteractionMount<Context>(
  options: CreateNodeMediaInteractionMountOptions<Context>,
): MediaInteractionMount<Context> {
  const projectRoot = normalizeProjectRoot(options.projectRoot);
  const exportMedia = options.exportMedia ?? runtimeExportMedia;
  const check = options.check ?? runtimeCheck;
  const inspect = options.inspect ?? runtimeInspect;
  const targets = options.targets ?? createProjectMediaTargetRegistry<Context>(projectRoot);
  const sourceAnalysis = resolveNodeMediaSourceAnalysis(options);
  const narration = createNodeNarrationService(options.narration);
  const execution = (context: Context): NodeMediaExecutionOptions =>
    options.executionOptions?.(context) ?? {};

  async function narrationEffect<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error) {
      if (error instanceof SpeechDispatchUncertainError) throw new MediaInteractionUncertainError(error.message, { cause: error });
      throw error;
    }
  }

  const handlers: MediaInteractionHandlers<Context> = {
    async narrationReview({ input, context }) {
      const resolution = await targets.resolve({ kind: "artifact", targetId: input.target.targetId, context });
      const path = resolveMediaTargetPath(resolution, input.target.artifactId);
      const signal = boundedSignal(execution(context));
      const report = await writeNarrationReview(path, {
        ...(signal ? { signal } : {}),
        ...(input.encodedArtifactId === undefined ? {} : { encodedPath: resolveMediaTargetPath(resolution, input.encodedArtifactId) }),
      });
      return JSON.parse(JSON.stringify({ ...report, target: input.target }));
    },
    async speechVoices({ input, context }) {
      return narration.voices(input.provider, boundedSignal(execution(context)));
    },
    async speechSynthesize({ input, context }) {
      const resolution = await targets.resolve({ kind: "artifact", targetId: input.target.targetId, context });
      const path = resolveMediaTargetPath(resolution, input.target.artifactId);
      const signal = boundedSignal(execution(context));
      const result = await narrationEffect(() => narration.synthesize(input.provider, input.request, path, {
        ...(signal === undefined ? {} : { signal }), ...(input.refresh ? { refresh: true } : {}),
      }));
      return { ...result, target: { ...input.target } };
    },
    async narrationPrepare({ input, context, progress }) {
      const resolution = await targets.resolve({ kind: "artifact", targetId: input.target.targetId, context });
      const path = resolveMediaTargetPath(resolution, input.target.artifactId);
      const signal = boundedSignal(execution(context));
      const result = await narrationEffect(() => narration.prepare(input.recipe, path, {
        ...(signal === undefined ? {} : { signal }), ...(input.refresh ? { refresh: true } : {}),
        ...(input.preview ? { preview: true } : {}), ...(progress ? { progress } : {}),
      }));
      return { ...result, target: { ...input.target } };
    },
    discover() {
      return discoverProject(projectRoot, sourceAnalysis);
    },
    async describe({ input, context }) {
      const interaction = execution(context);
      throwIfAborted(interaction.signal);
      const source = resolveMediaSource(projectRoot, input.source);
      const loaded = await compileNodeMediaSource(
        projectRoot,
        source,
        {
          ...(interaction.preparedSource === undefined ? {} : { preparedSource: interaction.preparedSource }),
          ...(interaction.signal === undefined ? {} : { signal: interaction.signal }),
          ...(sourceAnalysis === undefined
            ? {}
            : { sourceAnalysis }),
          ...(options.authoringFacades === undefined
            ? {}
            : { authoringFacades: options.authoringFacades }),
        },
      );
      throwIfAborted(interaction.signal);
      return describeSource(source, loaded);
    },
    async check({ input, context }) {
      const interaction = execution(context);
      const signal = boundedSignal(interaction);
      throwIfAborted(signal);
      const source = resolveMediaSource(projectRoot, input.source);
      const prepared = await prepareNodeMediaAnalysis(projectRoot, source, {
        ...(interaction.preparedSource === undefined ? {} : { preparedSource: interaction.preparedSource }),
        ...(interaction.preparedValue === undefined ? {} : { loaded: interaction.preparedValue }),
        ...(input.snapshot === undefined ? {} : { snapshot: input.snapshot }),
        ...(signal === undefined ? {} : { signal }),
        ...(sourceAnalysis === undefined
          ? {}
          : { sourceAnalysis }),
        ...(options.authoringFacades === undefined
          ? {}
          : { authoringFacades: options.authoringFacades }),
      });
      const report = mergeSourceCheckFindings(
        await check(options.runtime, prepared.value, checkOptions(input, signal), interaction.preparedReport),
        prepared.compiled.sourceText,
        prepared.value,
      );
      return Object.freeze({
        schemaVersion: 0,
        kind: "media-source-check",
        sourceId: source.sourceId,
        relativePath: source.relativePath,
        programHash: programHash(prepared.compiled),
        report,
      });
    },
    async inspect({ input, context }) {
      const interaction = execution(context);
      const signal = boundedSignal(interaction);
      throwIfAborted(signal);
      const source = resolveMediaSource(projectRoot, input.source);
      const prepared = await prepareNodeMediaAnalysis(projectRoot, source, {
        ...(interaction.preparedSource === undefined ? {} : { preparedSource: interaction.preparedSource }),
        ...(interaction.preparedValue === undefined ? {} : { loaded: interaction.preparedValue }),
        ...(input.snapshot === undefined ? {} : { snapshot: input.snapshot }),
        ...(signal === undefined ? {} : { signal }),
        ...(sourceAnalysis === undefined
          ? {}
          : { sourceAnalysis }),
        ...(options.authoringFacades === undefined
          ? {}
          : { authoringFacades: options.authoringFacades }),
      });
      const report = mergeSourceInspectFindings(
        await inspect(options.runtime, prepared.value, inspectOptions(input, signal), interaction.preparedReport),
        prepared.compiled.sourceText,
        prepared.value,
      );
      return Object.freeze({
        schemaVersion: 0,
        kind: "media-source-inspection",
        sourceId: source.sourceId,
        relativePath: source.relativePath,
        programHash: programHash(prepared.compiled),
        report,
      });
    },
    async snapshot({ input, context }) {
      const interaction = execution(context);
      throwIfAborted(interaction.signal);
      const source = resolveMediaSource(projectRoot, input.source);
      const descriptor = analyzeMediaSource(
        readMediaSource(source),
        source.templatePath,
        sourceAnalysis,
      );
      if (descriptor.kind !== "collection") {
        throw new Error(`Collection snapshot requires a collection source: ${source.relativePath}`);
      }
      return snapshotCollection(descriptor, source, projectRoot, {
        ...(interaction.signal === undefined ? {} : { signal: interaction.signal }),
        ...(interaction.providerTimeoutMs === undefined
          ? {}
          : { timeoutMs: interaction.providerTimeoutMs }),
      });
    },
    thumbnail: createNodeThumbnailHandler(options.rasters ?? createMemoryRasterStore()),
    arrange: createNodeArrangeHandler<Context>({ runtime: options.runtime, exportMedia }),
    async compile({ input, context }) {
      const interaction = execution(context);
      const signal = boundedSignal(interaction);
      return compileNodeMediaArtifact({
        projectRoot,
        input,
        context,
        targets,
        ...(signal === undefined ? {} : { signal }),
        ...(sourceAnalysis === undefined
          ? {}
          : { sourceAnalysis }),
        ...(options.authoringFacades === undefined
          ? {}
          : { authoringFacades: options.authoringFacades }),
      });
    },
    async export({ input, context, progress }) {
      const interaction = execution(context);
      const signal = boundedSignal(interaction);
      throwIfAborted(signal);
      rejectUnsupportedHostOverrides(input);
      const source = resolveMediaSource(projectRoot, input.source);
      const loaded = await observeStage({
        ...(progress === undefined ? {} : { progress }),
        stageId: "source.resolve",
        ...(signal === undefined ? {} : { signal }),
        startWork: { unit: "items", completed: 0 },
        successWork: { unit: "items", completed: 1 },
        run: () => loadNodeMediaValue(projectRoot, source, {
          ...(interaction.preparedSource === undefined ? {} : { preparedSource: interaction.preparedSource }),
          ...(signal === undefined ? {} : { signal }),
          ...(interaction.providerTimeoutMs === undefined
            ? {}
            : { providerTimeoutMs: interaction.providerTimeoutMs }),
          ...(input.snapshot === undefined ? {} : { snapshot: input.snapshot }),
          ...(sourceAnalysis === undefined
            ? {}
            : { sourceAnalysis }),
          ...(options.authoringFacades === undefined
            ? {}
            : { authoringFacades: options.authoringFacades }),
        }),
      });
      if (interaction.expectedInputIdentity !== undefined) {
        const actualInputIdentity = loaded.bundle.inputIdentity ?? createHash("sha256").update(loaded.bundle.code).digest("hex");
        if (actualInputIdentity !== interaction.expectedInputIdentity) {
          throw Object.assign(new Error("Collection source changed after preview selection; refresh the snapshot before export."), {
            code: "COLLECTION_SOURCE_CHANGED",
            expectedInputIdentity: interaction.expectedInputIdentity,
            actualInputIdentity,
          });
        }
      }
      if (loaded.compiled.interactive) {
        throw new Error("Interactive media cannot be exported by the deterministic runtime");
      }
      const snapshot = loaded.snapshot;
      const media = loaded.value as ExportableMedia;

      const runtimeOptions: ExportOptions = {
        for: input.destinations,
        ...(input.entryIds === undefined ? {} : { entryIds: input.entryIds }),
        ...(input.variantIds === undefined ? {} : { variantIds: input.variantIds }),
        ...(input.editionIds === undefined ? {} : { editionIds: input.editionIds }),
        ...(input.encoding === undefined ? {} : { encoding: input.encoding }),
        ...(input.stillFrame?.kind === "at"
          ? { at: input.stillFrame.at as NonNullable<ExportOptions["at"]> }
          : {}),
        providers: "skip",
        ...(signal === undefined ? {} : { signal }),
        ...(progress === undefined
          ? {}
          : {
              onProgress: (event: ExportProgressEvent) =>
                reportRuntimeExportProgress(progress, source.sourceId, event),
            }),
      };
      interaction.retainExportSource?.(loaded);
      const bundle = await exportMedia(options.runtime, media, runtimeOptions);
      try {
        const artifactCount = bundle.artifacts.length;
        return await observeStage({
          ...(progress === undefined ? {} : { progress }),
          stageId: "publication.commit",
          ...(signal === undefined ? {} : { signal }),
          startWork: { unit: "items", completed: 0, total: artifactCount },
          successWork: {
            unit: "items",
            completed: artifactCount,
            total: artifactCount,
          },
          run: async () => {
            const target = await targets.resolve({
              kind: "publication",
              targetId: input.publication.targetId,
              context,
            });
            const finalPath = resolveMediaTargetPath(
              target,
              input.publication.publicationId,
            );
            return publishPortableBundle({
              bundle,
              finalPath,
              targetId: input.publication.targetId,
              publicationId: input.publication.publicationId,
              sourceId: source.sourceId,
              request: input,
              ...(snapshot === undefined ? {} : { snapshot }),
              producerVersion: options.producerVersion ?? "0.1.0",
              ...(signal === undefined ? {} : { signal }),
            });
          },
        });
      } finally {
        await bundle.dispose();
      }
    },
  };

  return createMediaInteractionMount({
    handlers,
    ...(options.progress === undefined ? {} : { progress: options.progress }),
  });
}

function discoverProject(
  projectRoot: string,
  sourceAnalysis?: MediaSourceAnalysisOptions,
): MediaProjectDiscovery {
  return Object.freeze({
    schemaVersion: 0,
    kind: "media-project-discovery",
    sources: discoverMediaSources(projectRoot).map((source) => {
      const descriptor = analyzeMediaSource(
        readMediaSource({
          templatePath: source.entrypoint,
          relativePath: source.relativePath,
          sourceId: source.name,
        }),
        source.entrypoint,
        sourceAnalysis,
      );
      return Object.freeze({
        sourceId: source.name,
        relativePath: source.relativePath,
        sourceKind: descriptor.kind === "collection" ? "collection" : "media-module",
      });
    }),
  });
}

type LoadedSource = CompiledNodeMediaSource;

function describeSource(
  source: ResolvedMediaSource,
  loaded: LoadedSource,
): MediaSourceDescription {
  const programHash = createHash("sha256").update(loaded.bundle.code).digest("hex");
  if (loaded.compiled.interactive) {
    return {
      schemaVersion: 0,
      kind: "media-source-description",
      sourceId: source.sourceId,
      relativePath: source.relativePath,
      sourceKind: "interactive",
      programHash,
      animated: true,
      canvas: {
        width: loaded.compiled.interactive.size?.width ?? 1920,
        height: loaded.compiled.interactive.size?.height ?? 1080,
      },
      fps: 1,
      duration: 1,
      totalFrames: 1,
      temporal: "interactive",
      fonts: [],
      phases: [],
      editions: [],
      variantIds: [],
      editionIds: ["default"],
    };
  }
  const media = loaded.compiled.media!;
  const runtime = resolveRuntimeTemplateInfo(media);
  const phases = runtime.isAnimated
    ? probeDirectorPhases(media, {
        fps: runtime.fps,
        durationSeconds: runtime.duration,
        width: runtime.width,
        height: runtime.height,
        data: runtime.data,
      }) ?? []
    : [];
  return {
    schemaVersion: 0,
    kind: "media-source-description",
    sourceId: source.sourceId,
    relativePath: source.relativePath,
    sourceKind: loaded.descriptor.kind === "collection" ? "collection" : "media",
    programHash,
    media: media.media,
    medium: media.medium,
    animated: media.animated,
    canvas: { width: runtime.width, height: runtime.height },
    fps: runtime.fps,
    duration: runtime.duration,
    totalFrames: runtime.totalFrames,
    temporal: runtime.isAnimated ? media.config?.temporal ?? "once" : "static",
    fonts: [...runtime.fonts],
    phases: phases.map((phase) => ({
      name: phase.name,
      start: phase.start,
      end: phase.end,
      startSeconds: phase.start * runtime.duration,
      endSeconds: phase.end * runtime.duration,
    })),
    editions: Object.entries(media.editions ?? {}).map(([id, edition]) => ({
      id,
      width: edition.size.width,
      height: edition.size.height,
    })),
    ...(loaded.descriptor.kind === "collection"
      ? { collectionEntries: loaded.descriptor.entries.kind }
      : {}),
    variantIds: Object.keys(media.variants ?? {}).sort(),
    editionIds: ["default", ...Object.keys(media.editions ?? {}).sort()],
  };
}

function rejectUnsupportedHostOverrides(input: MediaExportInteractionInput): void {
  if (input.rasterizer === "blitz") {
    throw new MediaInteractionError(
      "INVALID_INPUT",
      "media.export.input.rasterizer",
      "The initialized value runtime, not an interaction input, selects rasterizers",
    );
  }
  if (input.debugHtml === true) {
    throw new MediaInteractionError(
      "INVALID_INPUT",
      "media.export.input.debugHtml",
      "Debug HTML artifacts are unavailable from the portable runtime bundle",
    );
  }
}

function checkOptions(
  input: MediaSourceCheckInteractionInput,
  signal: AbortSignal | undefined,
): CheckOptions {
  return {
    providers: "skip",
    ...(input.data === undefined
      ? {}
      : { data: input.data as unknown as SuperImgJsonObject }),
    ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.editionId === undefined ? {} : { editionId: input.editionId }),
    ...(input.at === undefined ? {} : { at: input.at as NonNullable<CheckOptions["at"]> }),
    ...(input.renderedLayout === undefined ? {} : { renderedLayout: input.renderedLayout }),
    ...(input.craft === undefined ? {} : { craft: input.craft }),
    ...(signal === undefined ? {} : { signal }),
  };
}

function inspectOptions(
  input: MediaSourceInspectInteractionInput,
  signal: AbortSignal | undefined,
): InspectOptions {
  return {
    providers: "skip",
    ...(input.data === undefined
      ? {}
      : { data: input.data as unknown as SuperImgJsonObject }),
    ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.editionId === undefined ? {} : { editionId: input.editionId }),
    ...(input.at === undefined ? {} : { at: input.at as NonNullable<InspectOptions["at"]> }),
    ...(input.renderedLayout === undefined ? {} : { renderedLayout: input.renderedLayout }),
    ...(input.includeIR === undefined ? {} : { includeIR: input.includeIR }),
    ...(signal === undefined ? {} : { signal }),
  };
}

function programHash(loaded: CompiledNodeMediaSource): string {
  return createHash("sha256").update(loaded.bundle.code).digest("hex");
}

function sourceFindings(source: string, value: MediaValue): readonly RuntimeFinding[] {
  // A loaded definition knows the helper defaults and survives import aliases.
  // Do not reclassify it using an fps/duration regex over source text.
  const isAnimated = value.kind === "interactive" ? true
    : value.kind === "collection" ? value.media.animated : value.animated;
  return analyzeMediaSourceFindings(source, { isAnimated });
}

function mergeSourceCheckFindings(report: CheckReport, source: string, value: MediaValue): CheckReport {
  const findings = mergeFindings(report.findings, sourceFindings(source, value));
  return Object.freeze({
    ...report,
    ok: report.ok && findings.every((finding) => finding.severity !== "error"),
    findings,
  });
}

function mergeSourceInspectFindings(report: InspectReport, source: string, value: MediaValue): InspectReport {
  return Object.freeze({
    ...report,
    findings: mergeFindings(report.findings, sourceFindings(source, value)),
  });
}

function mergeFindings(
  runtime: readonly RuntimeFinding[],
  source: readonly RuntimeFinding[],
): readonly RuntimeFinding[] {
  const seen = new Set(runtime.map((finding) => `${finding.code}\0${finding.message}`));
  return Object.freeze([
    ...runtime,
    ...source.filter((finding) => {
      const key = `${finding.code}\0${finding.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ]);
}

function boundedSignal(options: NodeMediaExecutionOptions): AbortSignal | undefined {
  const timeout = options.timeoutMs === undefined
    ? undefined
    : AbortSignal.timeout(options.timeoutMs);
  if (!options.signal) return timeout;
  return timeout === undefined ? options.signal : AbortSignal.any([options.signal, timeout]);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw normalizeCancellationError(signal.reason, signal);
}

async function reportRuntimeExportProgress(
  progress: MediaInteractionProgressReporter,
  sourceId: string,
  event: ExportProgressEvent,
): Promise<void> {
  const subject = event.item === undefined
    ? { kind: "stage" as const, stageId: event.stageId }
    : {
        kind: "item" as const,
        stageId: event.stageId,
        item: {
          itemId: event.item.itemId,
          kind: event.item.kind,
          sourceId,
          ...(event.item.entryId === undefined
            ? {}
            : { entryId: event.item.entryId }),
          variantId: event.item.variantId,
          editionId: event.item.editionId,
          renditionId: event.item.renditionId,
        },
      };
  const base = {
    subject,
    ...(event.work === undefined ? {} : { work: event.work }),
  };
  if (event.state === "failed") {
    const error = event.error ?? {
      code: "RUNTIME_EXPORT_FAILED",
      message: "The runtime export failed",
    };
    await progress.report({
      ...base,
      state: "failed",
      error: {
        code: error.code ?? "RUNTIME_EXPORT_FAILED",
        path: event.stageId,
        message: error.message,
      },
    });
  } else if (event.state === "cancelled") {
    await progress.report({
      ...base,
      state: "cancelled",
      ...(event.reason === undefined ? {} : { reason: event.reason }),
    });
  } else {
    await progress.report({ ...base, state: event.state });
  }
}

async function observeStage<Value>(options: Readonly<{
  progress?: MediaInteractionProgressReporter;
  stageId: string;
  signal?: AbortSignal;
  startWork?: MediaInteractionProgressWork;
  successWork?: MediaInteractionProgressWork;
  run(): Promise<Value>;
}>): Promise<Value> {
  if (options.progress === undefined) return options.run();
  const subject = { kind: "stage" as const, stageId: options.stageId };
  await options.progress.report({
    subject,
    state: "started",
    ...(options.startWork === undefined ? {} : { work: options.startWork }),
  });
  try {
    const value = await options.run();
    await options.progress.report({
      subject,
      state: "succeeded",
      ...(options.successWork === undefined ? {} : { work: options.successWork }),
    });
    return value;
  } catch (cause) {
    const normalized = normalizeCancellationError(cause, options.signal);
    if (normalized instanceof MediaInteractionUncertainError) {
      await options.progress.report({
        subject,
        state: "uncertain",
        reason: normalized.reason,
      });
    } else if (isCancellationError(normalized)) {
      const reason = errorMessage(normalized);
      await options.progress.report({
        subject,
        state: "cancelled",
        ...(reason.length === 0 ? {} : { reason }),
      });
    } else {
      await options.progress.report({
        subject,
        state: "failed",
        error: progressFailure(normalized, options.stageId),
      });
    }
    throw normalized;
  }
}

function normalizeCancellationError(
  cause: unknown,
  signal: AbortSignal | undefined,
): unknown {
  if (!signal?.aborted || isCancellationError(cause)) return cause;
  const signalReason = signal.reason;
  const message = errorMessage(signalReason) ||
    errorMessage(cause) ||
    "Media interaction cancelled";
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = isTimeoutError(signalReason) ? "TimeoutError" : "AbortError";
  return error;
}

function isCancellationError(cause: unknown): cause is Error {
  return cause instanceof Error &&
    (
      cause.name === "AbortError" ||
      cause.name === "TimeoutError" ||
      errorCode(cause) === "RUNTIME_CANCELLED"
    );
}

function isTimeoutError(cause: unknown): boolean {
  return cause instanceof Error && cause.name === "TimeoutError";
}

function progressFailure(
  cause: unknown,
  path: string,
): MediaInteractionProgressFailure {
  return {
    code: errorCode(cause) ?? "INTERACTION_FAILED",
    path,
    message: errorMessage(cause) || "The media interaction failed",
  };
}

function errorCode(cause: unknown): string | undefined {
  try {
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
    return typeof cause.code === "string" && cause.code.length > 0
      ? cause.code
      : undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(cause: unknown): string {
  try {
    if (cause instanceof Error) return cause.message;
    return String(cause);
  } catch {
    return "Unknown media interaction error";
  }
}
