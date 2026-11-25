import { capturePreparedReview } from "@foxworth/superimg-node/review/advanced";
import { inspectPreparedSource } from "@foxworth/superimg-node/source";
import { withFrozenSourceFindings, semanticsFromCapture, observeSourceSamples } from "@foxworth/superimg-node/source/advanced";
import { profileStage } from "../utils/command-profile.js";
//! inspect — runtime-true multi-progress template debug report (JSON stdout).
//! Primary path: evaluateTemplateIR (Media IR). Point-in-time --diff is NOT
//! the same as `superimg diff` / diffMediaIR (cross-revision IR compare).

import { mkdirSync, writeFileSync } from "node:fs";
import { commandResult } from "../utils/command-result.js";
import { dirname, join, relative, resolve, sep } from "node:path";
import { selectBoundaryFrames } from "@superimg/core/ir";
import { renderTemplateFrame } from "@superimg/core/testing";
import {
  inspect as runtimeInspect,
  render as runtimeRender,
  prepareRuntimeReport,
  type PreparedRuntimeReport,
} from "@foxworth/superimg/internal/runtime-kernel";
import { analyzeMediaSourceFindings } from "@superimg/core/source-analysis";
import { analyzeTechnicalSequence, mergeTechnicalFindings, mergeTechnicalScopes, stageBackground, type TechnicalFrame } from "@superimg/core/validation";
import type {
  ExportableMedia,
  InspectReport as RuntimeInspectReport,
  JsonObject,
} from "@superimg/types";
import {
  MEDIA_INTERACTION_IDS,
  type MediaSourceDescription,
} from "@foxworth/superimg-interactions";
import { resolveTemplatePath } from "../utils/resolve-template.js";
import { scrapeHtmlSemantics } from "../utils/html-semantics.js";
import { parseAtList, parseDiffPair, resolveAtSample, type AtSample } from "../utils/inspect-at.js";
import { diffSemantics } from "../utils/inspect-diff.js";
import { loadDataInput } from "../utils/data-loader.js";
import { evaluateTemplateIR } from "../utils/ir-eval.js";
import { activePhaseName, derivePhasesFromIR } from "../utils/ir-phases.js";
import { createPreparedStdlibForTemplate, textMeasurerForDeclarations, walkMediaTree } from "@superimg/core";
import type { MediaIRFrameCapture } from "@superimg/core";
import {
  buildInspectTreeSnapshot,
  type InspectTreeSnapshot,
  type SemanticTreeNode,
} from "../utils/tree-check.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { createCliMediaInteractionSession } from "../utils/media-interactions.js";
import { loadCliMediaValue, prepareCliMediaSource } from "../utils/runtime-source.js";
import { applyDestinationTarget } from "@foxworth/superimg-node/source/advanced";
import { boundReviewSamples, loadReviewPlan, reviewAtSamples, reviewOutputDirectory, reviewSelectionDigest, validateReviewCoordinates, writeReviewPacket, type LoadedReviewPlan } from "../utils/review-packet.js";

type TextMeasurer = NonNullable<Awaited<ReturnType<typeof textMeasurerForDeclarations>>>;

export interface InspectOptions {
  renderedLayout?: boolean;
  at?: string;
  diff?: string;
  png?: boolean;
  output?: string;
  pretty?: boolean;
  summary?: boolean;
  data?: string;
  entry?: string;
  json?: boolean;
  variant?: string;
  /** Inspect an explicit art-directed edition. */
  edition?: string;
  /** Destination id or WIDTHxHEIGHT[.format]. Sets the evaluated canvas. */
  for?: string;
  /** Capture a compact packet of authored review beats and observations. */
  review?: boolean;
  /** Include bounded motion evidence for authored ranges. */
  reviewClips?: boolean;
  reviewFile?: string;
}

export interface InspectPhase {
  name: string;
  start: number;
  end: number;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
}

export interface InspectSample {
  at: string;
  progress: number;
  frame: number;
  seconds: number;
  /** Actual root timeline.seconds, endpoint-inclusive and distinct from encoded time. */
  timelineSeconds?: number;
  activePhase: string | null;
  phaseLocal: number | null;
  htmlBytes: number;
  text: string[];
  colors: string[];
  eqKeys: string[];
  waitLabels: string[];
  cameraScale: number | null;
  /** Raster lane for this sample. `"svg"` did not need Chromium. */
  lane?: "svg" | "html";
  /** Versioned semantic tree plus explicit inspectable/opaque coverage. */
  tree?: InspectTreeSnapshot;
  htmlPath?: string;
  pngPath?: string;
  error?: { message: string; code?: string };
}

export interface InspectReport {
  schemaVersion: 0;
  template: string;
  evaluationMode: "runtime" | "ir" | "runtime-fallback";
  fallbackReason?: string;
  config: {
    width: number;
    height: number;
    fps: number;
    duration: number;
    totalFrames: number;
  };
  phases: InspectPhase[] | null;
  scenePhases?: Record<string, InspectPhase[]>;
  samples: InspectSample[];
  /** Point-in-time HTML diff within one render. */
  diff?: ReturnType<typeof diffSemantics>;
  coordinates: { entryId?: string; editionId: string; variantId: string };
  /** Canonical value-runtime report; CLI fields above are presentation detail. */
  runtime: RuntimeInspectReport;
  /** Host source bundle identity includes imported helper implementations. */
  sourceIdentity?: { mediaBundleHash: string; valueDigest: string };
}

function sampleProgress(
  sample: AtSample,
  fps: number,
  duration: number,
  totalFrames: number,
): { progress: number; frame: number } {
  return resolveAtSample(sample, { fps, duration, totalFrames });
}

/** Frame-exact samples on both sides of every retained composition handoff. */
function compositionBoundarySamples(
  ir: import("@superimg/types").MediaIR | undefined,
): AtSample[] {
  if (ir?.extensions["superimg.composition"] === undefined) return [];
  return selectBoundaryFrames(ir.scenes.map((scene) => scene.range), ir.clock.totalFrames)
    .map((frame) => ({ kind: "frame" as const, frame, label: `f:${frame}` }));
}

function dedupeSamples(
  samples: readonly AtSample[],
  fps: number,
  duration: number,
  totalFrames: number,
): AtSample[] {
  const byFrame = new Map<number, AtSample>();
  for (const sample of samples) {
    const { frame } = sampleProgress(sample, fps, duration, totalFrames);
    const previous = byFrame.get(frame);
    // Prefer explicit boundary labels when a generic progress sample lands on
    // the same frame; otherwise preserve the user's or phase sampler's label.
    if (previous === undefined || sample.kind === "frame") byFrame.set(frame, sample);
  }
  return [...byFrame.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, sample]) => sample);
}

function printPretty(report: InspectReport): void {
  const { config, phases, samples, diff } = report;
  console.error(`\n  Inspect: ${report.template}`);
  console.error(
    `  ${config.width}×${config.height} @ ${config.fps}fps · ${config.duration}s · ${config.totalFrames} frames\n`,
  );
  if (phases && phases.length > 0) {
    console.error("  Phases:");
    for (const p of phases) {
      console.error(
        `    ${p.name.padEnd(16)} ${p.startSec.toFixed(2)}s–${p.endSec.toFixed(2)}s  (${(p.start * 100).toFixed(0)}–${(p.end * 100).toFixed(0)}%)`,
      );
    }
    console.error("");
  } else {
    console.error("  Phases: (none — director not called with layout)\n");
  }
  console.error("  Samples:");
  for (const s of samples) {
    if (s.error) {
      console.error(`    @${s.at}  ERROR: ${s.error.message}`);
      continue;
    }
    const phase = s.activePhase ? `${s.activePhase}@${(s.phaseLocal ?? 0).toFixed(2)}` : "—";
    const colors = s.colors.slice(0, 4).join(",") || "—";
    const textPreview = s.text.slice(0, 6).join(" ");
    const coverage = s.tree?.coverage;
    const treeSummary = coverage
      ? ` tree=${coverage.inspectableNodes}/${coverage.totalNodes} opaque=${coverage.opaqueRegions}`
      : "";
    console.error(
      `    @${String(s.at).padEnd(6)} f${s.frame}  lane=${s.lane ?? "—"}  phase=${phase.padEnd(18)} colors=${colors}  ${textPreview}${treeSummary}`,
    );
  }
  if (diff) {
    console.error("\n  Diff:");
    console.error(`    +text: ${diff.addedText.join(" ") || "—"}`);
    console.error(`    -text: ${diff.removedText.join(" ") || "—"}`);
    console.error(`    +colors: ${diff.addedColors.join(" ") || "—"}`);
    console.error(`    -colors: ${diff.removedColors.join(" ") || "—"}`);
    if (
      diff.addedNodes.length ||
      diff.removedNodes.length ||
      diff.changedNodes.length ||
      diff.boxDeltas.length
    ) {
      console.error(`    +nodes: ${diff.addedNodes.join(" ") || "—"}`);
      console.error(`    -nodes: ${diff.removedNodes.join(" ") || "—"}`);
      if (diff.changedNodes.length) {
        console.error(
          `    ~nodes: ${diff.changedNodes.map((node) => `${node.id}[${node.fields.join(",")}]`).join(" ")}`,
        );
      }
      if (diff.boxDeltas.length) {
        console.error(
          `    boxes: ${diff.boxDeltas.map((d) => `${d.id}(${d.dx},${d.dy})`).join(" ")}`,
        );
      }
    }
  }
  console.error("");
}

export async function inspectCommand(
  templateArg: string,
  options: InspectOptions = {},
): Promise<void> {
  const resolvedPath = resolveTemplatePath(templateArg);

  let atList: AtSample[];
  let review: LoadedReviewPlan | undefined;
  try {
    if ((options.reviewClips || options.reviewFile) && !options.review) throw new Error("--review-clips and --review-file require --review");
    if (options.review && options.summary) throw new Error("--review requires sampled frames and cannot be combined with --summary");
    review = options.review ? await loadReviewPlan(resolvedPath, options.reviewFile) : undefined;
    atList = review === undefined ? parseAtList(options.at) : reviewAtSamples(review.plan);
    if (review !== undefined && options.at !== undefined) atList.push(...parseAtList(options.at));
  } catch (err) { throw err; }

  let dataOverride: Record<string, unknown> | undefined;
  if (options.data) {
    try {
      const loaded = await loadDataInput(options.data, dirname(resolvedPath));
      if (loaded && typeof loaded === "object" && !Array.isArray(loaded)) {
        dataOverride = loaded as Record<string, unknown>;
      } else {
        throw Object.assign(new Error("--data for inspect must be a single object (not an array)"), { code: "INVALID_DATA" });
      }
    } catch (err) {
      throw err;
    }
  }

  const captureProgresses: number[] = [];
  const captureFrames: number[] = [];
  const captureSeconds: number[] = [];
  const phaseAwareReview = Boolean(options.review && review === undefined && options.at === undefined);
  if (!options.summary && !phaseAwareReview) {
    for (const at of atList) {
      if (at.kind === "frame") captureFrames.push(at.frame);
      else if (at.kind === "progress") captureProgresses.push(at.progress);
      else captureSeconds.push(at.seconds);
    }
  }
  // Ensure --diff endpoints are captured too
  if (options.diff) {
    try {
      const pair = parseDiffPair(options.diff);
      captureProgresses.push(pair.from, pair.to);
    } catch {
      /* validated later */
    }
  }

  const projectRoot = findProjectRoot(dirname(resolvedPath));
  const source = relative(projectRoot, resolvedPath).split(sep).join("/");
  let evalResult!: Awaited<ReturnType<typeof evaluateTemplateIR>>;
  let runtimeReport: RuntimeInspectReport;
  let preparedReport: PreparedRuntimeReport;
  const session = createCliMediaInteractionSession(projectRoot);
  try {
    let loaded: Awaited<ReturnType<typeof loadCliMediaValue>>;
    let selectedEntry: string | undefined;
    let edition = options.edition;
    try {
      const preparedSource = await prepareCliMediaSource(resolvedPath);
      const commandContext = { preparedSource };
      const description = await session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.describe,
        input: { source },
      }, commandContext);
      if (
        description.sourceKind === "collection" &&
        description.collectionEntries === "provider"
      ) {
        if (options.for) throw Object.assign(new Error("--for requires a materialized media value"), { code: "UNSUPPORTED_SELECTION" });
        if (options.review) throw new Error("Review packets require a frozen deterministic entry; provider collections cannot supply visual evidence without a snapshot");
        if (options.entry !== undefined) {
          throw new Error("--entry requires an explicit frozen snapshot for provider collections");
        }
        const firstAt = atList[0];
        const result = await session.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.inspect,
          input: {
            source,
            ...(dataOverride === undefined ? {} : { data: dataOverride as JsonObject }),
            ...(options.variant === undefined ? {} : { variantId: options.variant }),
            ...(options.edition === undefined ? {} : { editionId: options.edition }),
            ...(firstAt === undefined
              ? {}
              : { at: inspectInteractionAt(firstAt, description) }),
            includeIR: true,
          ...(options.renderedLayout ? { renderedLayout: true } : {}),
          },
        }, commandContext);
        emitDeferredInspect(resolvedPath, options, description, result.report);
        return;
      }
      const applied = applyDestinationTarget(await loadCliMediaValue(resolvedPath, { preparedSource }), options.for, options.edition);
      loaded = applied.loaded;
      edition = applied.edition;
      selectedEntry = options.entry ?? loaded.snapshot?.entries[0]?.id;
      if (loaded.value.kind !== "interactive") {
        const result = await inspectPreparedSource({
          runtime: session.runtime, loaded,
          ...(dataOverride === undefined ? {} : { data: dataOverride as JsonObject }),
          ...(selectedEntry === undefined ? {} : { entryId: selectedEntry }),
          ...(options.variant === undefined ? {} : { variantId: options.variant }),
          ...(edition === undefined ? {} : { editionId: edition }),
          frames: captureFrames, progresses: captureProgresses, seconds: captureSeconds,
          ...(atList[0] === undefined ? {} : { at: atList[0] }),
          ...(options.renderedLayout !== undefined ? { renderedLayout: options.renderedLayout } : {}), includeIR: !options.review, enrich: false,
        });
        evalResult = result.evaluation;
        preparedReport = result.preparedReport;
        runtimeReport = withFrozenSourceFindings(result.report, loaded);
      } else {
        preparedReport = await prepareRuntimeReport(session.runtime, loaded.value, { providers: "skip" });
        runtimeReport = withFrozenSourceFindings(await runtimeInspect(session.runtime, loaded.value, { providers: "skip" }, preparedReport), loaded);
        if (options.review) throw new Error("Review packets require deterministic media; interactive captures are host-driven");
        emitInteractiveInspect(resolvedPath, options, runtimeReport);
        return;
      }

    } catch (err) { throw err; }

  const { config } = evalResult;
  const measurer = await textMeasurerForDeclarations(evalResult.template.config?.fonts);
  const { fps, duration, width, height, totalFrames } = config;

  let phases: InspectPhase[] | null = null;
  let scenePhases: Record<string, InspectPhase[]> | undefined;
  let phaseList = null as ReturnType<typeof derivePhasesFromIR>["phases"];
  if (evalResult.mode === "ir" && evalResult.ir) {
    const derived = derivePhasesFromIR(evalResult.ir);
    phases = derived.phases;
    phaseList = derived.allPhases;
    if (Object.keys(derived.scenePhases).length > 1) {
      scenePhases = derived.scenePhases;
    }
  }

  if (review !== undefined) validateReviewCoordinates(review.plan, config);
  const coordinates = {
    ...(evalResult.entryId === undefined ? {} : { entryId: evalResult.entryId }),
    variantId: evalResult.variantId,
    editionId: evalResult.editionId,
  };
  const defaultSamples = options.summary
    ? []
    : options.at === undefined && review === undefined
      ? dedupeSamples([...atList, ...compositionBoundarySamples(evalResult.ir)], fps, duration, totalFrames)
      : atList;
  const holdSamples = phaseAwareReview && phaseList !== null && phaseList.length > 0
    ? phaseList.map((phase) => ({
        kind: "progress" as const,
        progress: Number(((phase.start + phase.end) / 2).toFixed(6)),
        label: `${phase.name}@hold`,
      }))
    : undefined;
  const reviewSamplesBase = holdSamples ?? defaultSamples;
  const requestedSamples = options.review && review === undefined
    ? boundReviewSamples(reviewSamplesBase, (sample) => resolveAtSample(sample, config).frame,
      evalResult.ir?.extensions["superimg.composition"] === undefined
        ? []
        : evalResult.ir.scenes.flatMap((scene) => [scene.range.startFrame, scene.range.endFrame]))
    : reviewSamplesBase;
  const captureSelectionDigest = options.review ? reviewSelectionDigest({
    config, coordinates, data: evalResult.resolvedData, samples: requestedSamples,
    ...(review === undefined ? {} : { plan: review.plan }),
    clips: options.reviewClips ?? false,
    renderedLayout: options.renderedLayout ?? false,
    resources: runtimeReport,
  }) : undefined;
  const outDir = options.output
    ? resolve(options.output)
    : options.review
      ? reviewOutputDirectory(resolvedPath, evalResult.programHash, review?.bundleHash, captureSelectionDigest!)
      : join(dirname(resolvedPath), "output", ".superimg", "inspect");
  const capturePng = options.png || options.review;
  if (capturePng || options.output) {
    mkdirSync(outDir, { recursive: true });
  }

  if (!options.summary) {
    await ensureReviewCaptures(evalResult, requestedSamples, measurer);
  }

  const samples: InspectSample[] = [];
  const technicalFrames: TechnicalFrame[] = [];
  let hadError = false;
  const sampledFrames = new Set<number>();

  for (const at of requestedSamples) {
    const { progress, frame } = sampleProgress(at, fps, duration, totalFrames);
    if (sampledFrames.has(frame)) continue;
    sampledFrames.add(frame);
    const seconds = frame / fps;
    const active = activePhaseName(phaseList, progress);

    try {
      const cap = evalResult.captures?.get(frame);
      if (!cap) throw new Error(`No capture for frame ${frame}`);
      const html = cap.html;
      const observed = await observeSourceSamples(evalResult, [at]);
      const sample: InspectSample = observed.samples[0]!;
      technicalFrames.push(...observed.technicalFrames);

      if (!options.review && (options.output || options.png)) {
        const htmlPath = join(outDir, `p${progress}.html`);
        writeFileSync(htmlPath, html);
        sample.htmlPath = htmlPath;
      }

      if (capturePng) {
        const pngPath = join(outDir, options.review ? `frame-${frame}.png` : `p${progress}.png`);
        const result = await profileStage("raster.render", () => runtimeRender(session.runtime, loaded.value as ExportableMedia, {
          as: "png",
          at: `${frame}f`,
          ...(selectedEntry !== undefined ? { entryId: selectedEntry } : {}),
          ...(options.variant !== undefined ? { variantId: options.variant } : {}),
          ...(edition !== undefined ? { editionId: edition } : {}),
          ...(dataOverride !== undefined ? { data: dataOverride as JsonObject } : {}),
          providers: "skip",
        }, preparedReport));
        writeFileSync(pngPath, await profileStage("artifact.read", () => readRuntimeBytes(result.stream())));
        sample.pngPath = pngPath;
      }

      samples.push(sample);
    } catch (err) {
      hadError = true;
      const message = err instanceof Error ? err.message : String(err);
      samples.push({
        at: at.label,
        progress,
        frame,
        seconds,
        timelineSeconds: resolveAtSample(at, config).timelineSeconds,
        activePhase: active?.name ?? null,
        phaseLocal: active?.phaseLocal ?? null,
        htmlBytes: 0,
        text: [],
        colors: [],
        eqKeys: [],
        waitLabels: [],
        cameraScale: null,
        error: { message },
      });
    }
  }

  const technical = analyzeTechnicalSequence(technicalFrames);
  runtimeReport = { ...runtimeReport,
    coverage: mergeTechnicalScopes({ ...technical.coverage, samples: technical.coverage.samples.map(sample => ({ ...sample, coordinates })) }, runtimeReport.coverage),
    findings: mergeTechnicalFindings(runtimeReport.findings, technical, coordinates),
  };
  const report: InspectReport = {
    schemaVersion: 0,
    template: resolvedPath,
    evaluationMode: evalResult.mode,
    ...(evalResult.fallbackReason !== undefined
      ? { fallbackReason: evalResult.fallbackReason }
      : {}),
    config: { width, height, fps, duration, totalFrames },
    phases,
    ...(scenePhases !== undefined ? { scenePhases } : {}),
    samples,
    coordinates: {
      ...(evalResult.entryId !== undefined ? { entryId: evalResult.entryId } : {}),
      variantId: evalResult.variantId,
      editionId: evalResult.editionId,
    },
    runtime: runtimeReport,
    sourceIdentity: { mediaBundleHash: evalResult.programHash, valueDigest: runtimeReport.programDigest },
  };
  // Diff-only endpoints provide semantics, while review evidence follows the
  // bounded selection already captured and identified by its digest above.
  const reviewSamples = options.review ? [...samples] : undefined;

  if (options.diff) {
    try {
      const pair = parseDiffPair(options.diff);
      const findNear = (p: number) =>
        samples.find((s) => !s.error && Math.abs(s.progress - p) < 1e-9) ??
        samples
          .filter((s) => !s.error)
          .sort((a, b) => Math.abs(a.progress - p) - Math.abs(b.progress - p))[0];

      // Ensure both ends are sampled from captures
      for (const p of [pair.from, pair.to]) {
        if (!samples.some((s) => !s.error && Math.abs(s.progress - p) < 1e-9)) {
          const resolved = resolveAtSample({ kind: "progress", progress: p, label: String(p) }, config);
          const { frame } = resolved;
          const cap = evalResult.captures?.get(frame);
          if (!cap) continue;
          const html = cap.html;
          const semantics = semanticsFromCapture(cap, {
        width,
        height,
        ...(measurer !== undefined ? { measurer } : {}),
      });
          const active = activePhaseName(phaseList, p);
          const sample: InspectSample = {
            at: String(p),
            progress: p,
            frame,
            seconds: resolved.seconds,
            timelineSeconds: resolved.timelineSeconds,
            activePhase: active?.name ?? null,
            phaseLocal: active?.phaseLocal ?? null,
            htmlBytes: Buffer.byteLength(html, "utf8"),
            ...(cap.lane !== undefined ? { lane: cap.lane } : {}),
            ...semantics,
          };
          samples.push(sample);
        }
      }

      const a = findNear(pair.from);
      const b = findNear(pair.to);
      if (a && b) {
        report.diff = diffSemantics(
          pair.from,
          pair.to,
          { ...a, ...(a.tree?.nodes === undefined ? {} : { nodes: a.tree.nodes }) },
          { ...b, ...(b.tree?.nodes === undefined ? {} : { nodes: b.tree.nodes }) },
        );
      }
    } catch (err) { throw err; }
  }

  if (options.review) {
    const packet = await capturePreparedReview({
      runtime: session.runtime, loaded, preparedReport,
      report: reviewSamples === undefined ? report : { ...report, samples: reviewSamples },
      mediaBundleHash: evalResult.programHash,
      captureSelectionDigest: captureSelectionDigest!,
      ...(evalResult.ir === undefined ? {} : { capabilities: evalResult.ir.capabilities }),
      ...(review === undefined ? {} : { companion: review }),
      outDir,
      data: evalResult.resolvedData,
      clips: options.reviewClips ?? false,
      renderSelection: {
        ...(selectedEntry === undefined ? {} : { entryId: selectedEntry }),
        ...(options.variant === undefined ? {} : { variantId: options.variant }),
        ...(edition === undefined ? {} : { editionId: edition }),
        ...(dataOverride === undefined ? {} : { data: dataOverride as JsonObject }),
      },
    });
    const sheet = packet.evidence.find((item) => item.kind === "contact-sheet");
    if (sheet) console.error(resolve(sheet.path));
    for (const line of packet.coverage.unverified) {
      if (line.includes("capture failed")) console.error(line);
    }
    const ok = !(packet.technical.status === "fail" || packet.authored.status === "fail" || packet.coverage.fullFrameCaptures !== packet.beats.length || (options.reviewClips && packet.coverage.unverified.some((entry) => entry.includes("clip failed"))));
    console.log(JSON.stringify(commandResult(packet, { ok, code: "REVIEW_FAILED", message: "Review completed with failed or incomplete findings." }), null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (options.output || options.png) {
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  }

  if (options.pretty) {
    printPretty(report);
  }

  const ok = !hadError && !runtimeReport.findings.some((finding) => finding.severity === "error");
  console.log(JSON.stringify(commandResult(report, { ok, code: "INSPECT_FAILED", message: "Inspection completed with failed findings." }), null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
  } finally {
    await session.dispose();
  }
}

async function ensureReviewCaptures(
  evalResult: Awaited<ReturnType<typeof evaluateTemplateIR>>,
  samples: readonly AtSample[],
  measurer: TextMeasurer | undefined,
): Promise<void> {
  const captures = evalResult.captures ?? new Map();
  const { fps, duration, totalFrames, width, height } = evalResult.config;
  const missing: number[] = [];
  const seen = new Set<number>();
  for (const sample of samples) {
    const { frame } = resolveAtSample(sample, { fps, duration, totalFrames });
    if (captures.has(frame) || seen.has(frame)) continue;
    seen.add(frame);
    missing.push(frame);
  }
  if (missing.length === 0) {
    evalResult.captures = captures;
    return;
  }
  const preparedStdlib = await createPreparedStdlibForTemplate(evalResult.template);
  for (const frame of missing) {
    try {
      const rendered = renderTemplateFrame({
        template: evalResult.template,
        frame,
        fps,
        durationSeconds: duration,
        totalFrames,
        width,
        height,
        data: evalResult.resolvedData,
        composite: false,
        preparedStdlib,
        ...(measurer !== undefined ? { measurer } : {}),
      });
      captures.set(frame, {
        html: rendered.html,
        lane: rendered.lane,
        ...(rendered.tree !== undefined ? { tree: rendered.tree } : {}),
      });
    } catch {
      // The sample loop records a missing capture as a sample error.
    }
  }
  evalResult.captures = captures;
}

async function readRuntimeBytes(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function emitInteractiveInspect(
  resolvedPath: string,
  options: InspectOptions,
  runtime: RuntimeInspectReport,
): void {
  const config = runtime.config;
  const width = config?.width ?? 1920;
  const height = config?.height ?? 1080;
  const coordinates = runtime.coordinates[0];
  const samples: InspectSample[] = options.png
    ? [{
        at: options.at ?? "0",
        progress: 0,
        frame: 0,
        seconds: 0,
        activePhase: null,
        phaseLocal: null,
        htmlBytes: 0,
        text: [],
        colors: [],
        eqKeys: [],
        waitLabels: [],
        cameraScale: null,
        error: {
          code: "INTERACTIVE_ARTIFACT_UNSUPPORTED",
          message: "Interactive media is host-driven and cannot produce deterministic PNG inspection artifacts",
        },
      }]
    : [];
  const report: InspectReport = {
    schemaVersion: 0,
    template: resolvedPath,
    evaluationMode: "runtime",
    config: {
      width,
      height,
      fps: config?.fps ?? 1,
      duration: config?.durationSeconds ?? 1,
      totalFrames: config?.totalFrames ?? 1,
    },
    phases: null,
    samples,
    coordinates: {
      ...(coordinates?.entryId === undefined ? {} : { entryId: coordinates.entryId }),
      variantId: coordinates?.variantId ?? options.variant ?? "default",
      editionId: coordinates?.editionId ?? options.edition ?? "default",
    },
    runtime,
  };
  if (options.output || options.png) {
    const outDir = options.output
      ? resolve(options.output)
      : join(dirname(resolvedPath), "output", ".superimg", "inspect");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  }
  if (options.pretty) printPretty(report);
  const ok = !samples.some((sample) => sample.error !== undefined) && !runtime.findings.some((finding) => finding.severity === "error");
  console.log(JSON.stringify(commandResult(report, { ok, code: "INSPECT_FAILED", message: "Inspection completed with failed findings." }), null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

function emitDeferredInspect(
  resolvedPath: string,
  options: InspectOptions,
  description: MediaSourceDescription,
  runtime: RuntimeInspectReport,
): void {
  const coordinates = runtime.coordinates[0];
  const report: InspectReport = {
    schemaVersion: 0,
    template: resolvedPath,
    evaluationMode: "runtime",
    config: {
      width: description.canvas.width,
      height: description.canvas.height,
      fps: description.fps,
      duration: description.duration,
      totalFrames: description.totalFrames,
    },
    phases: description.phases.length === 0
      ? null
      : description.phases.map((phase) => ({
          name: phase.name,
          start: phase.start,
          end: phase.end,
          startSec: phase.startSeconds,
          endSec: phase.endSeconds,
          startFrame: Math.floor(phase.startSeconds * description.fps),
          endFrame: Math.ceil(phase.endSeconds * description.fps),
        })),
    samples: [],
    coordinates: {
      ...(coordinates?.entryId === undefined ? {} : { entryId: coordinates.entryId }),
      variantId: coordinates?.variantId ?? options.variant ?? "default",
      editionId: coordinates?.editionId ?? options.edition ?? "default",
    },
    runtime,
  };
  if (options.output || options.png) {
    const outDir = options.output
      ? resolve(options.output)
      : join(dirname(resolvedPath), "output", ".superimg", "inspect");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  }
  if (options.pretty) printPretty(report);
  const ok = !runtime.findings.some((finding) => finding.severity === "error");
  console.log(JSON.stringify(commandResult(report, { ok, code: "INSPECT_FAILED", message: "Inspection completed with failed findings." }), null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

function inspectInteractionAt(
  sample: AtSample,
  description: MediaSourceDescription,
): number | `${number}f` {
  return sample.kind === "frame"
    ? `${sample.frame}f`
    : sample.kind === "seconds" ? sample.seconds : sample.progress * description.duration;
}
