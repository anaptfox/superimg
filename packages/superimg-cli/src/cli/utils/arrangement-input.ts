import { basename, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { parseDuration } from "@superimg/core";
import { inspect } from "@superimg/core/runtime";
import { resolveDestinationTarget } from "@superimg/core/destinations";
import { publishPortableBundle, type MediaJsonObject } from "@foxworth/superimg-interactions";
import { prepareNodeArrangement, readNodeArrangement, assertArrangementEditions, assertArrangementDestinations, resolveArrangementStillSelection, exportPreparedNodeArrangement } from "@foxworth/superimg-node/arrangement";
import type { Duration } from "@superimg/types";
import { createCliValueRuntime, exportWithCliControls } from "./media-interactions.js";
import { buildEncodingOptions } from "../commands/render-encoding.js";
import { arrangementSelectionFindings } from "./arrangement-selection.js";
import type { ExportOptions } from "../commands/export.js";
import type { InspectionPaintCapture } from "@superimg/node/runtime";

declare const __SUPERIMG_VERSION__: string;

export class ArrangementFailure extends Error {
  readonly code = "ARRANGEMENT_REFUSED";
  readonly path = "spec";
  readonly phase = "admission";
  readonly suggestion = "Repair the listed pattern failures in the arrangement spec and retry.";
  readonly effect = "publication";
  readonly effectState = "not-started";
  constructor(readonly failures: readonly { code: string; message: string }[]) {
    super("Arrangement admission failed");
  }
}

type ArrangementInput = Awaited<ReturnType<typeof readNodeArrangement>>;

/** Classify an explicit JSON file once; malformed JSON never reaches a code loader. */
export async function classifyArrangement(path: string | undefined): Promise<ArrangementInput | undefined> {
  if (!path?.toLowerCase().endsWith(".json")) return undefined;
  let raw: unknown;
  try { raw = JSON.parse(await readFile(resolve(path), "utf8")) as unknown; }
  catch (error) { throw annotate(error, "INVALID_JSON_INPUT", "preparation", "not-started"); }
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (record.schemaVersion === 0 && !("pattern" in record) && !("spec" in record)) return undefined;
    if (record.schemaVersion === 0) throw annotate(new Error("JSON input mixes media artifact and arrangement fields"), "AMBIGUOUS_JSON_INPUT", "preparation", "not-started");
  }
  try { return await readNodeArrangement(path, { raw }); }
  catch (error) { throw annotate(error, "PREPARATION_FAILED", "preparation", "not-started"); }
}

export async function checkArrangement(path: string, classified?: ArrangementInput, editionIds: readonly string[] = []): Promise<{ ok: boolean; kind: "arrangement-admission"; scope: "admission"; pattern: string; failures: readonly { code: string; message: string }[] }> {
  let input: Awaited<ReturnType<typeof readNodeArrangement>>;
  try { input = classified ?? await readNodeArrangement(path); } catch (error) { throw annotate(error, "PREPARATION_FAILED", "preparation", "not-started"); }
  assertEditionIds(input, editionIds);
  return { ok: input.failures.length === 0, kind: "arrangement-admission", scope: "admission", pattern: input.request.pattern, failures: input.failures };
}

function assertEditionIds(input: ArrangementInput, ids: readonly string[]) {
  try { assertArrangementEditions(input.request, ids); }
  catch (error) { throw annotate(error, "UNKNOWN_EDITION", "admission", "not-started"); }
}

/** Inspect the prepared value without fabricating module or review metadata. */
export async function inspectArrangement(input: ArrangementInput, renderedLayout: boolean, edition?: string, at?: string, review = false, output?: string) {
  if (input.failures.length) throw new ArrangementFailure(input.failures);
  let prepared: Awaited<ReturnType<typeof prepareNodeArrangement>>;
  try { prepared = await prepareNodeArrangement(input); }
  catch (error) { throw annotate(error, "PREPARATION_FAILED", "preparation", "not-started"); }
  let selection: { frame: number; seconds: number; timelineSeconds: number; progress: number } | undefined;
  let requestedInspectSeconds: number | undefined;
  if (at !== undefined) {
    const { parseAtList, resolveAtSample } = await import("./inspect-at.js");
    const samples = parseAtList(at);
    if (samples.length !== 1) throw Object.assign(new Error("Arrangement inspection accepts one --at sample"), { code: "UNSUPPORTED_SELECTION" });
    const fps = prepared.media.config?.fps ?? 30;
    const duration = parseDuration(prepared.media.config?.duration ?? "1f", "duration", fps);
    const sample = samples[0]!;
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    requestedInspectSeconds = sample.kind === "seconds" ? sample.seconds : sample.kind === "frame" ? sample.frame / fps : sample.progress * Math.max(0, totalFrames - 1) / fps;
    selection = resolveAtSample(sample, { fps, duration, totalFrames });
  }
  const paintCapture: InspectionPaintCapture = { enabled: false, dpr: 1 };
  const runtime = createCliValueRuntime(paintCapture);
  try {
    const report = await inspect(runtime, prepared.media, { renderedLayout, ...(edition === undefined ? {} : { editionId: edition }), ...(selection === undefined ? {} : { at: selection.seconds }) });
    if (!review) return { ...report, input: { kind: prepared.kind, identity: prepared.identity, sourcePath: prepared.sourcePath }, ...(selection === undefined ? {} : { selection }) };
    const clock = resolveArrangementStillSelection(prepared.media, requestedInspectSeconds);
    const { fps, duration, totalFrames } = clock;
    const selectedEdition = edition ?? "default";
    const size = selectedEdition === "default" ? { width: prepared.media.config?.width ?? 1080, height: prepared.media.config?.height ?? 1080 } : prepared.media.editions?.[selectedEdition]?.size;
    if (!size) throw Object.assign(new Error(`Unknown arrangement edition '${selectedEdition}'`), { code: "UNKNOWN_EDITION" });
    const { writeArrangementReview, arrangementProducerIdentity } = await import("./arrangement-review.js");
    const { createReviewCapture, publishProjectReview } = await import("./project-review-store.js");
    const capture = await createReviewCapture(input.sourcePath, selectedEdition);
    const result = await writeArrangementReview({ runtime, media: prepared.media, paintCapture, sourcePath: input.sourcePath, outRoot: output ? join(resolve(output), basename(capture.directory)) : capture.directory, selection: { inputDigest: prepared.identity, producer: await arrangementProducerIdentity(__SUPERIMG_VERSION__), editionId: selectedEdition, renditionId: "inspection", ...size, fps, duration, totalFrames, frame: clock.frame, encodedSeconds: clock.encodedSeconds, requestedSeconds: clock.requestedSeconds, clamped: clock.clamped, origin: clock.origin } });
    const indexed = await publishProjectReview(capture.indexPath, { kind: "arrangement", renditionId: "inspection", config: result.packet.config, coordinates: result.packet.coordinates, selection: result.packet.selection }, result.packet);
    return { ...report, input: { kind: prepared.kind, identity: prepared.identity, sourcePath: prepared.sourcePath }, selection: clock, review: { state: "completed", path: capture.indexPath, selectionPath: indexed.selectionPath, captureSelectionDigest: result.captureSelectionDigest, technical: result.packet.technical.status, visual: result.packet.visual.status } };
  } finally { await runtime.dispose(); }
}

export async function exportArrangement(path: string, options: ExportOptions & { duration?: string }, classified?: ArrangementInput) {
  if (!options.for?.length) throw Object.assign(new Error("Export requires at least one --for destination"), { code: "MISSING_DESTINATION" });
  if (options.review && (options.for.length !== 1 || !/\.png$/i.test(options.for[0]!))) throw Object.assign(new Error("--review currently requires one explicit WIDTHxHEIGHT.png destination"), { code: "UNSUPPORTED_SELECTION" });
  if (options.entry?.length || options.variant?.length || options.dryRun || options.rasterizer || options.providerTimeout || options.timeout) {
    throw Object.assign(new Error("Arrangement inputs do not support entry, variant, dry-run, rasterizer, debug-html, timeout or provider-timeout selection"), { code: "UNSUPPORTED_SELECTION" });
  }
  if (options.at !== undefined && options.poster) throw Object.assign(new Error("Pass either --poster or --at, not both"), { code: "INVALID_SELECTION" });
  let at: number | undefined;
  try { at = options.at === undefined ? undefined : parseDuration(options.at, "--at"); }
  catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: "INVALID_TIME" }); }
  if (at !== undefined && (!Number.isFinite(at) || at < 0)) throw Object.assign(new Error("--at must be non-negative and finite"), { code: "INVALID_TIME" });
  if (options.duration !== undefined && !/^\d+(\.\d+)?(s|ms|f)$/.test(options.duration)) throw Object.assign(new Error("--duration must look like 6s, 1500ms, or 180f"), { code: "INVALID_DURATION" });
  let input: Awaited<ReturnType<typeof readNodeArrangement>>;
  try { input = classified ?? await readNodeArrangement(path); } catch (error) { throw annotate(error, "PREPARATION_FAILED", "preparation", "not-started"); }
  if (input.failures.length) throw new ArrangementFailure(input.failures);
  assertEditionIds(input, options.edition ?? []);
  let prepared: Awaited<ReturnType<typeof prepareNodeArrangement>>;
  try { prepared = await prepareNodeArrangement(input, options.duration as Duration | undefined); } catch (error) { throw annotate(error, "PREPARATION_FAILED", "preparation", "not-started"); }
  try { assertArrangementDestinations(prepared.media, options.for, options.edition); }
  catch (error) { throw annotate(error, "MISSING_EDITION", "admission", "not-started"); }
  const isStill = options.for.some(destination => {
    const target = resolveDestinationTarget(destination);
    return target.kind === "custom" && ["png", "jpeg", "webp", "svg"].includes(target.format ?? (prepared.media.animated ? "mp4" : "png"));
  });
  let clock: ReturnType<typeof resolveArrangementStillSelection> | undefined;
  try { clock = isStill && prepared.media.animated ? resolveArrangementStillSelection(prepared.media, at) : undefined; }
  catch (error) {
    const failure = annotate(error, "EXPORT_FAILED", "render", "not-started");
    failure.suggestion = "Use a longer duration for an unambiguous answer poster, or pass --at 0s to select the first frame explicitly.";
    throw failure;
  }
  const paintCapture: InspectionPaintCapture = { enabled: false, dpr: 1 };
  const runtime = createCliValueRuntime(paintCapture);
  const finalPath = resolve(options.output ?? join("output", `${basename(path, ".arrange.json")}.export`));
  const sourceId = basename(path, ".arrange.json");
  try {
    const encoding = buildEncodingOptions(options);
    let bundle: Awaited<ReturnType<typeof exportWithCliControls>>;
    try { ({ bundle } = await exportPreparedNodeArrangement(runtime, prepared, {
      for: options.for,
      ...(options.edition?.length ? { editionIds: options.edition } : {}),
      ...(clock === undefined ? at === undefined ? {} : { at } : { at: clock.encodedSeconds }),
      ...(encoding === undefined ? {} : { encoding }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    }, exportWithCliControls)); } catch (error) {
      const failure = annotate(error, "EXPORT_FAILED", "render", "not-started");
      const findings = (error as { findings?: readonly { code?: string }[] })?.findings;
      if (prepared.media.animated && prepared.media.poster === undefined && at === undefined && findings?.some(f => f.code === "EXPORT_STILL_FRAME_REQUIRED")) {
        failure.suggestion = "Use a longer duration for an unambiguous answer poster, or pass --at 0s to select the first frame explicitly.";
      }
      throw failure;
    }
    try {
      const stillArtifacts = bundle.artifacts.filter(a => a.mimeType === "image/png" || a.mimeType === "image/jpeg" || a.mimeType === "image/webp");
      let stillSelection: { requestedSeconds: number; frame: number; encodedSeconds: number; origin: string; artifacts: string[] } | undefined;
      if (stillArtifacts.length && clock !== undefined) {
        stillSelection = { requestedSeconds: clock.requestedSeconds, frame: clock.frame, encodedSeconds: clock.encodedSeconds, origin: at === undefined ? "pattern-poster" : "explicit", artifacts: stillArtifacts.map(a => a.path) };
      }
      let commitStarted = false;
      let receipt;
      try { receipt = await publishPortableBundle({
        bundle, finalPath, sourceId, targetId: "cli-publication", publicationId: basename(finalPath),
        request: { source: sourceId, publication: { targetId: "cli-publication", publicationId: basename(finalPath) }, destinations: options.for,
          ...(options.edition?.length ? { editionIds: options.edition } : {}),
          ...(at !== undefined ? { stillFrame: { kind: "at", at } } : stillSelection ? { stillFrame: { kind: "poster" } } : {}),
          ...(encoding === undefined ? {} : { encoding: encoding as unknown as MediaJsonObject }) },
        inputIdentity: { schemaVersion: 1, kind: "arrangement", digest: prepared.identity },
        ...(stillSelection === undefined ? {} : { stillSelection }),
        producerVersion: __SUPERIMG_VERSION__,
        onCommitStart: () => { commitStarted = true; },
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      }); } catch (error) { throw annotate(error, "PUBLICATION_FAILED", "publication", commitStarted ? "unknown" : "not-completed"); }
      const retained = receipt.manifest.renditions as readonly { path: string; mimeType: string; bytes: number; sha256: string }[];
      const artifacts = retained.map(item => ({ ...item, path: join(finalPath, item.path) }));
      const warnings = clock === undefined ? [] : arrangementSelectionFindings(clock);
      const findings = warnings.length ? warnings.map(warning => ({ ...warning, requestedSeconds: warning.details.requestedSeconds, resolvedSeconds: warning.details.resolvedSeconds })) : undefined;
      let review: { state: "completed"; path: string; selectionPath: string; captureSelectionDigest: string; technical: "pass" | "fail"; visual: "unreviewed" } | { state: "unknown"; message: string } | undefined;
      if (options.review) {
        try {
          const png = bundle.artifacts.find(item => item.mimeType === "image/png");
          if (!png) throw new Error("Export did not retain a PNG for review");
          const target = resolveDestinationTarget(options.for[0]!);
          if (target.kind !== "custom") throw new Error("Review needs an exact-size target");
          const { writeArrangementReview, arrangementProducerIdentity } = await import("./arrangement-review.js");
          const { createReviewCapture, publishProjectReview } = await import("./project-review-store.js");
          const reviewClock = clock ?? resolveArrangementStillSelection(prepared.media, at);
          const { fps, duration, totalFrames } = reviewClock;
          const capture = await createReviewCapture(input.sourcePath, png.coordinates.editionId);
          const result = await writeArrangementReview({ runtime, media: prepared.media, paintCapture, ...(options.signal ? { signal: options.signal } : {}), sourcePath: input.sourcePath, outRoot: capture.directory, retainedPng: await png.bytes(), selection: { inputDigest: prepared.identity, producer: await arrangementProducerIdentity(__SUPERIMG_VERSION__), editionId: png.coordinates.editionId, renditionId: png.coordinates.renditionId, width: target.width, height: target.height, fps, duration, totalFrames, frame: reviewClock.frame, encodedSeconds: reviewClock.encodedSeconds, requestedSeconds: reviewClock.requestedSeconds, clamped: reviewClock.clamped, origin: reviewClock.origin } });
          const indexed = await publishProjectReview(capture.indexPath, { kind: "arrangement", renditionId: png.coordinates.renditionId, config: result.packet.config, coordinates: result.packet.coordinates, selection: result.packet.selection }, result.packet, options.signal);
          review = { state: "completed", path: capture.indexPath, selectionPath: indexed.selectionPath, captureSelectionDigest: result.captureSelectionDigest, technical: result.packet.technical.status, visual: result.packet.visual.status };
          if (result.packet.technical.status === "fail") process.exitCode = 1;
        } catch (error) { review = { state: "unknown", message: error instanceof Error ? error.message : String(error) }; process.exitCode = 1; }
      }
      return { ...receipt, input: { kind: prepared.kind, identity: prepared.identity, sourcePath: prepared.sourcePath }, path: finalPath, artifacts, effectState: "completed" as const, ...(stillSelection === undefined ? {} : { stillSelection }), ...(findings === undefined ? {} : { findings }), ...(review === undefined ? {} : { review }) };
    } finally { await bundle.dispose().catch(error => { process.stderr.write(`Bundle cleanup failed: ${String(error)}\n`); }); }
  } finally { await runtime.dispose().catch(error => { process.stderr.write(`Runtime cleanup failed: ${String(error)}\n`); }); }
}

function annotate(error: unknown, fallback: string, phase: string, effectState: "not-started" | "not-completed" | "unknown") {
  const cause = error as { code?: string; path?: string; message?: string; suggestion?: string; findings?: unknown; details?: unknown };
  return Object.assign(new Error(cause?.message ?? String(error), { cause: error }), { code: cause?.code ?? fallback, path: cause?.path, suggestion: cause?.suggestion, findings: cause?.findings, details: cause?.details, phase, effect: "publication", effectState });
}
