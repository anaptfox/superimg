//! High-level value and trusted source review. Evidence is retained until disposed.
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspect, prepareRuntimeReport, render, type PreparedRuntimeReport } from "@superimg/core/runtime";
import { resolveRuntimeTemplateInfo } from "@superimg/core";
import type { ExportableMedia, JsonObject, MediaValue, ReviewPlan, Runtime } from "@superimg/types";
import { loadNodeMediaValue, type LoadNodeMediaValueOptions, type LoadedNodeMediaValue } from "./source.js";
import { loadReviewPlan, reviewSelectionDigest, validateReviewPlan, writeReviewPacket, type ReviewPacket } from "./review.js";
import { inspectPreparedSource } from "./source-inspect.js";
import { parseAtList, resolveAtSample } from "./review-clock.js";

export interface CaptureReviewOptions {
  readonly runtime: Runtime;
  readonly plan?: ReviewPlan;
  readonly data?: JsonObject;
  readonly entryId?: string;
  readonly variantId?: string;
  readonly editionId?: string;
  readonly clips?: boolean;
  readonly signal?: AbortSignal;
}
export interface OwnedReviewEvidence {
  readonly packet: ReviewPacket;
  /** Removes the temporary packet and evidence; idempotent. */
  dispose(): Promise<void>;
}

type CaptureIdentity = { template: string; mediaBundleHash?: string; companion?: Awaited<ReturnType<typeof loadReviewPlan>>; loaded?: LoadedNodeMediaValue };
async function capture(media: MediaValue, options: CaptureReviewOptions, identity: CaptureIdentity): Promise<OwnedReviewEvidence> {
  options.signal?.throwIfAborted();
  if (media.kind === "interactive") throw new TypeError("Interactive media cannot be captured as a review packet");
  const selection = { providers: "skip" as const, ...(options.data ? { data: options.data } : {}), ...(options.entryId ? { entryId: options.entryId } : {}), ...(options.variantId ? { variantId: options.variantId } : {}), ...(options.editionId ? { editionId: options.editionId } : {}), ...(options.signal ? { signal: options.signal } : {}) };
  if (options.plan?.observe) throw new TypeError("Inline review plans cannot identify observe closures; use a source review companion");
  const plan = options.plan ?? identity.companion?.plan;
  if (plan) validateReviewPlan(plan);
  const samples = plan ? plan.beats.flatMap(beat => parseAtList(beat.at)) : parseAtList(undefined);
  const sourceInspection = identity.loaded ? await inspectPreparedSource({
    runtime: options.runtime, loaded: identity.loaded,
    ...(options.data ? { data: options.data } : {}), ...(options.entryId ? { entryId: options.entryId } : {}),
    ...(options.variantId ? { variantId: options.variantId } : {}), ...(options.editionId ? { editionId: options.editionId } : {}),
    frames: samples.filter(sample => sample.kind === "frame").map(sample => sample.frame),
    progresses: samples.filter(sample => sample.kind === "progress").map(sample => sample.progress),
    seconds: samples.filter(sample => sample.kind === "seconds").map(sample => sample.seconds),
    ...(options.signal ? { signal: options.signal } : {}),
  }) : undefined;
  const prepared = sourceInspection?.preparedReport ?? await prepareRuntimeReport(options.runtime, media, selection);
  if (prepared.analysis.selections.length !== 1) throw new Error("Review requires exactly one resolved media selection");
  const resolved = prepared.analysis.selections[0]!;
  const info = resolveRuntimeTemplateInfo(resolved.media, { data: resolved.data });
  const config = sourceInspection?.evaluation.config ?? { width: info.width, height: info.height, fps: info.fps, duration: info.duration, totalFrames: info.totalFrames };
  const runtime = sourceInspection?.report ?? await inspect(options.runtime, media, selection, prepared);
  const digest = reviewSelectionDigest({ config, coordinates: resolved.coordinates, data: resolved.data, samples, ...(plan ? { plan } : {}), clips: options.clips ?? false, renderedLayout: false, resources: runtime });
  const outDir = await mkdtemp(join(tmpdir(), "superimg-review-owned-"));
  try {
    const companion = options.plan ? undefined : identity.companion;
    const packet = await capturePacket(options.runtime, media as ExportableMedia, prepared, selection, {
      report: { template: identity.template, config, coordinates: resolved.coordinates, samples: sourceInspection?.samples ?? samples.map(sample => ({ at: sample.label, frame: resolveAtSample(sample, config).frame, activePhase: null })), runtime },
      mediaBundleHash: identity.mediaBundleHash ?? `value:${runtime.programDigest}`, captureSelectionDigest: digest, outDir, data: resolved.data, clips: options.clips ?? false,
      ...(companion ? { companion } : {}), ...(options.plan ? { plan: options.plan } : {}), ...(sourceInspection?.evaluation.ir ? { capabilities: sourceInspection.evaluation.ir.capabilities } : {}), ...(options.signal ? { signal: options.signal } : {}),
    });
    return { packet, dispose: async () => { await rm(outDir, { recursive: true, force: true }); } };
  } catch (error) { await rm(outDir, { recursive: true, force: true }); throw error; }
}

/** Review a runtime value. Providers are never executed; select a frozen entry. */
export function captureValueReview(media: MediaValue, options: CaptureReviewOptions): Promise<OwnedReviewEvidence> {
  return capture(media, options, { template: "<value>" });
}

/** Capture a previously loaded source without rerunning its collection provider. */
export async function captureLoadedSourceReview(loaded: LoadedNodeMediaValue, options: CaptureReviewOptions & { readonly reviewFile?: string }): Promise<OwnedReviewEvidence> {
  const companion = options.plan ? undefined : await loadReviewPlan(loaded.source.templatePath, options.reviewFile);
  const mediaBundleHash = createHash("sha256").update(loaded.bundle.code).digest("hex");
  return capture(loaded.value, options, { template: loaded.source.templatePath, mediaBundleHash, loaded, ...(companion ? { companion } : {}) });
}

/** Compile/load a trusted source and capture it. Collection loading may execute its provider. */
export async function captureSourceReview(projectRoot: string, source: string, options: CaptureReviewOptions & { readonly load?: LoadNodeMediaValueOptions; readonly reviewFile?: string }): Promise<OwnedReviewEvidence> {
  const loaded = await loadNodeMediaValue(projectRoot, source, { ...options.load, ...(options.signal ? { signal: options.signal } : {}) });
  return captureLoadedSourceReview(loaded, options);
}

/** Review an encoded, already published movie. This writes review capture and indexes. */
export async function captureDeliveryReview(input: {
  readonly loaded: import("./source.js").LoadedNodeMediaValue;
  readonly destination: string;
  readonly variantId?: string;
  readonly editionId?: string;
  readonly receipt: { readonly targetId: string; readonly publicationId: string; readonly manifestDigest: string; readonly manifest: unknown };
  readonly publicationPath: string;
  readonly signal?: AbortSignal;
}) {
  const { prepareMovieExportReview } = await import("./movie-review.js");
  const value = input.loaded.value;
  if (value.kind === "collection" || value.kind === "interactive") throw new TypeError("Delivery review requires an animated authored source");
  const description = { sourceKind: "media" as const, animated: value.animated, variantIds: Object.keys(value.variants ?? {}), editionIds: Object.keys(value.editions ?? {}) };
  const review = await prepareMovieExportReview(input.loaded.source.templatePath, description, { for: [input.destination], ...(input.variantId ? { variant: [input.variantId] } : {}), ...(input.editionId ? { edition: [input.editionId] } : {}) });
  review.retainSource(input.loaded);
  return review.write(input.receipt, input.publicationPath, input.signal);
}

/** Advanced adapter for a host which has already sampled and selected a prepared inspection. */
export async function capturePreparedReview(input: {
  readonly runtime: Runtime;
  readonly loaded: LoadedNodeMediaValue;
  readonly preparedReport: PreparedRuntimeReport;
  readonly report: import("./review.js").ReviewReport;
  readonly mediaBundleHash: string;
  readonly captureSelectionDigest: string;
  readonly data: Record<string, unknown>;
  readonly outDir: string;
  readonly clips: boolean;
  readonly companion?: import("./review.js").LoadedReviewPlan;
  readonly capabilities?: import("@superimg/types").MediaIRCapabilities;
  readonly renderSelection?: { readonly entryId?: string; readonly variantId?: string; readonly editionId?: string; readonly data?: JsonObject };
  readonly signal?: AbortSignal;
}) {
  return capturePacket(input.runtime, input.loaded.value as ExportableMedia, input.preparedReport,
    { ...(input.renderSelection ?? {}), providers: "skip", ...(input.signal ? { signal: input.signal } : {}) }, input);
}

async function capturePacket(runtime: Runtime, media: ExportableMedia, prepared: PreparedRuntimeReport, selection: { readonly entryId?: string; readonly variantId?: string; readonly editionId?: string; readonly data?: JsonObject; readonly providers: "skip"; readonly signal?: AbortSignal }, input: Omit<Parameters<typeof writeReviewPacket>[0], "renderPng">) {
  return writeReviewPacket({ ...input,
    renderPng: async frame => (await render(runtime, media, { ...selection, as: "png", at: `${frame}f` }, prepared)).bytes(),
  });
}
