import { dirname } from "node:path";
import { critiqueTemplate, renderTemplateFrame } from "@superimg/core/testing";
import { scanSourceFootguns, stageBackground, analyzeTechnicalSequence, mergeTechnicalFindings, mergeTechnicalScopes, technicalRuntimeFindings, type TechnicalFrame } from "@superimg/core/validation";
import { check as runtimeCheck, render as runtimeRender, prepareRuntimeReport, type PreparedRuntimeReport } from "@superimg/core/runtime";
import { lintMediaIR } from "@superimg/core/ir";
import type { CheckReport as RuntimeCheckReport, ExportableMedia, JsonObject, Runtime, RuntimeFinding, RuntimeTechnicalCoverage } from "@superimg/types";
import { scrapeHtmlSemantics } from "./html-semantics.js";
import { parseAtList, resolveAtSample, type AtSample } from "./review-clock.js";
import { createPreparedStdlibForTemplate, parseDuration, textMeasurerForDeclarations, walkMediaTree } from "@superimg/core";
import { evaluatePreparedSourceIR } from "./source-evaluate.js";
import { activePhaseName, derivePhasesFromIR, phaseHoldBoundarySamples, sceneBoundarySamples, type IrDerivedPhase } from "./ir-phases.js";
import { checkLoopSeam, checkLoopSeamVisual, meanPixelDelta, renderLoopBoundary, DEFAULT_SEAM_VISUAL_MAE } from "./loop-seam.js";
import { scanPlateAssetIssues, type SemanticTreeNode } from "./tree-check.js";
import { findProjectRoot } from "./find-project-root.js";
import { applyDestinationTarget } from "./for-target.js";
import type { LoadedNodeMediaValue } from "./source.js";
const profileStage = async <T>(_stage: string, work: () => Promise<T>): Promise<T> => work();
export const CHECK_SCHEMA_VERSION = 0 as const;

export interface CheckOptions {
  renderedLayout?: boolean;
  at?: string;
  data?: string;
  entry?: string[];
  /** Coordinate selected from the frozen collection. */
  selectedEntry?: string;
  craft?: boolean;
  craftStrict?: boolean;
  /** Comma-separated CRAFT_IR_* rule ids to suppress. */
  craftIgnore?: string;
  /** Attach capabilities/hashes block (IR is always computed when possible). */
  ir?: boolean;
  pretty?: boolean;
  summary?: boolean;
  json?: boolean;
  /**
   * For temporal: "loop", rasterize the encoded wrap and its neighboring
   * steps; fail on a local discontinuity (requires Playwright/Chromium).
   */
  seamVisual?: boolean;
  /** MAE threshold 0–255 for --seam-visual (default 2.5). */
  seamVisualThreshold?: string;
  /** Check one art-directed edition. First-class families default to all. */
  edition?: string;
  /** Content-variant coordinate for family reports. */
  variant?: string;
  /** Destination id or WIDTHxHEIGHT[.format]. Sets the evaluated canvas. */
  for?: string;
}

export interface CheckPhase {
  name: string;
  start: number;
  end: number;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
}

export interface CheckSample {
  at: string;
  progress: number;
  frame: number;
  /** Encoded frame timestamp. */
  seconds: number;
  /** Endpoint-inclusive root media timeline, distinct from the encoded timestamp. */
  timelineSeconds: number;
  activePhase: string | null;
  phaseLocal: number | null;
  htmlBytes: number;
  text: string[];
  colors: string[];
  eqKeys: string[];
  error?: { message: string };
}

export interface CheckIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  frame?: number;
  progress?: number;
  suggestion?: string;
  context?: string;
  nodeId?: string;
  nodePath?: string;
  relatedIds?: string[];
  details?: Record<string, unknown>;
}

export interface CheckReport {
  coverage?: RuntimeTechnicalCoverage;
  schemaVersion: typeof CHECK_SCHEMA_VERSION;
  ok: boolean;
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
  phases: CheckPhase[] | null;
  /** Composed templates: per-scene phase layouts. */
  scenePhases?: Record<string, CheckPhase[]>;
  issues: CheckIssue[];
  samples: CheckSample[];
  validationTimeMs: number;
  meta?: { cliVersion?: string };
  coordinates: { entryId?: string; editionId: string; variantId: string };
  /** Present when --ir or when IR compiled successfully and issues need surface. */
  ir?: {
    capabilities: unknown;
    hashes: unknown;
    clock: unknown;
  };
  /** Canonical value-runtime report; CLI fields above are presentation detail. */
  runtime: RuntimeCheckReport;
}

export interface CheckRuntimeContext {
  readonly runtime: Runtime;
  readonly loaded: LoadedNodeMediaValue;
  readonly runtimeReport?: RuntimeCheckReport;
  readonly preparedReport?: PreparedRuntimeReport;
  readonly dataOverride?: Record<string, unknown> | undefined;
  readonly projectRoot?: string;
  readonly signal?: AbortSignal;
}

function sampleProgress(
  sample: AtSample,
  fps: number,
  duration: number,
  totalFrames: number,
): ReturnType<typeof resolveAtSample> {
  return resolveAtSample(sample, { fps, duration, totalFrames });
}

export async function checkPreparedSource(
  resolvedPath: string,
  options: CheckOptions,
  context: CheckRuntimeContext,
): Promise<CheckReport> {
  context.signal?.throwIfAborted();
  const applied = applyDestinationTarget(context.loaded, options.for, options.edition);
  context = { ...context, loaded: applied.loaded };
  if (applied.edition !== undefined) options = { ...options, edition: applied.edition };
  const startTime = performance.now();
  const issues: CheckIssue[] = [];

  let atList: AtSample[];
  try {
    atList = parseAtList(options.at);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
  const userAt = Boolean(options.at?.trim());

  let dataOverride: Record<string, unknown> | undefined = context.dataOverride;

  const source = context.loaded.sourceText;

  if (context.loaded.value.kind === "interactive") {
    const runtimeReport = context.runtimeReport ?? await profileStage("runtime.check", () => runtimeCheck(
      context.runtime,
      context.loaded.value,
      { providers: "skip" },
    ));
    issues.push(...runtimeReport.findings.map((finding) =>
      runtimeFindingToIssue(finding, options.craftStrict === true)
    ));
    if (source && context.runtimeReport === undefined) {
      issues.push(...scanSourceFootguns(source, {
        isAnimated: true,
        isComposed: false,
      }));
    }
    const width = context.loaded.value.size?.width ?? 1920;
    const height = context.loaded.value.size?.height ?? 1080;
    return {
      schemaVersion: CHECK_SCHEMA_VERSION,
      ok: !issues.some((issue) => issue.severity === "error"),
      template: resolvedPath,
      evaluationMode: "runtime",
      config: { width, height, fps: 1, duration: 1, totalFrames: 1 },
      phases: null,
      issues,
      samples: [],
      coordinates: {
        variantId: options.variant ?? "default",
        editionId: options.edition ?? "default",
      },
      runtime: runtimeReport,
      validationTimeMs: performance.now() - startTime,
    };
  }

  // Single IR pass: request captures by progress + absolute frames from --at
  const captureProgresses: number[] = [];
  const captureFrames: number[] = [];
  if (!options.summary) {
    for (const at of atList) {
      if (at.kind === "frame") captureFrames.push(at.frame);
      else if (at.kind === "progress") captureProgresses.push(at.progress);
      // Time selectors resolve after authored duration/fps/edition resolution.
      // The pending-frame pass below captures them at that exact resolved frame.
    }
  }

  const firstAt = atList[0];
  const preparedReport = context.preparedReport ?? await profileStage("runtime.prepare", () => prepareRuntimeReport(context.runtime, context.loaded.value, {
    ...(dataOverride === undefined ? {} : { data: dataOverride as JsonObject }),
    ...(options.selectedEntry === undefined ? {} : { entryId: options.selectedEntry }),
    ...(options.variant === undefined ? {} : { variantId: options.variant }),
    ...(options.edition === undefined ? {} : { editionId: options.edition }),
    providers: "skip",
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  }));
  const runtimeReport = context.runtimeReport ?? await profileStage("runtime.check", () => runtimeCheck(context.runtime, context.loaded.value, {
    ...(dataOverride !== undefined ? { data: dataOverride as JsonObject } : {}),
    ...(options.selectedEntry !== undefined ? { entryId: options.selectedEntry } : {}),
    ...(options.variant !== undefined ? { variantId: options.variant } : {}),
    ...(options.edition !== undefined ? { editionId: options.edition } : {}),
    ...(firstAt === undefined ? {} : { at: runtimeAt(firstAt, context.loaded) }),
    ...(options.renderedLayout ? { renderedLayout: true } : {}),
    ...(options.craft || options.craftStrict ? { craft: true } : {}),
    providers: "skip",
    ...(context.signal === undefined ? {} : { signal: context.signal }),
  }, preparedReport));
  issues.push(...runtimeReport.findings.map((finding) =>
    runtimeFindingToIssue(finding, options.craftStrict === true)
  ));

  const evalResult = await profileStage("ir.evaluate", () => evaluatePreparedSourceIR({
    loaded: context.loaded,
    preparedReport,
    ...(context.signal === undefined ? {} : { signal: context.signal }),
    ...(dataOverride !== undefined ? { data: dataOverride } : {}),
    ...(captureFrames.length > 0 ? { captureFrames } : {}),
    ...(options.selectedEntry !== undefined ? { entry: options.selectedEntry } : {}),
    // Always capture 0 and 1 when sampling — cheap, enables loop seam without a second pass
    ...(!options.summary
      ? {
          captureProgresses: [
            ...new Set([
              ...captureProgresses,
              0,
              1,
            ]),
          ],
        }
      : captureProgresses.length > 0
        ? { captureProgresses }
        : {}),
    ...(options.edition !== undefined ? { edition: options.edition } : {}),
    ...(options.variant !== undefined ? { variant: options.variant } : {}),
  }));

  const resolved = preparedReport.analysis.selections[0]?.preparedResolve?.resolved;
  for (const finding of resolved?.cueFindings ?? []) {
    issues.push({
      severity: finding.severity ?? "error",
      code: finding.code ?? "SCRIPT_CUE_FINDING",
      message: finding.message,
      nodeId: finding.id,
    });
  }

  const { config, template, resolvedData: data } = evalResult;
  const measurer = await textMeasurerForDeclarations(template.config?.fonts);
  const { fps, duration, width, height, totalFrames } = config;
  const isLoop = template.config?.temporal === "loop";

  // Footguns from source
  if (source && context.runtimeReport === undefined) {
    const isAnimated =
      Boolean(template.resolve) ||
      (typeof template.config?.fps === "number" && template.config.fps > 0) ||
      (typeof template.config?.duration !== "undefined" &&
        typeof template.config?.fps === "number") ||
      (fps > 0 && duration > 0);
    issues.push(
      ...scanSourceFootguns(source, {
        isAnimated,
        // Prefer the compiled structure. Source inspection is only a fallback
        // when the compiler could not produce an IR.
        isComposed: Boolean(
          ("composition" in template && template.composition) ||
          (evalResult.ir
            ? evalResult.ir.scenes.length > 1
            : source.includes("export default compose") || source.includes("compose(")),
        ),
      }),
    );
  }

  let phases: CheckPhase[] | null = null;
  let scenePhases: Record<string, CheckPhase[]> | undefined;
  let phaseList: IrDerivedPhase[] | null = null;

  if (evalResult.mode === "ir" && evalResult.ir) {
    const derived = derivePhasesFromIR(evalResult.ir);
    phases = derived.allPhases;
    phaseList = derived.allPhases;
    if (Object.keys(derived.scenePhases).length > 1) {
      scenePhases = derived.scenePhases;
    }
  }

  if (!userAt && !options.summary) {
    const holdSamples = phaseHoldBoundarySamples(phaseList, fps, duration, totalFrames);
    const sceneSamples = evalResult.mode === "ir" && evalResult.ir
      ? sceneBoundarySamples(evalResult.ir)
      : [];
    if (holdSamples.length > 0 || sceneSamples.length > 0) {
      atList = [...sceneSamples, ...holdSamples];
    }
  }

  if (!options.summary) {
    const captures = evalResult.captures ?? new Map();
    const pendingFrames: number[] = [];
    const seenFrames = new Set<number>();
    for (const at of atList) {
      const { frame } = sampleProgress(at, fps, duration, totalFrames);
      if (captures.has(frame) || seenFrames.has(frame)) continue;
      seenFrames.add(frame);
      pendingFrames.push(frame);
    }
    if (pendingFrames.length > 0) {
      const preparedStdlib = await createPreparedStdlibForTemplate(template);
      for (const frame of pendingFrames) {
        const rendered = renderTemplateFrame({
          template,
          frame,
          fps,
          durationSeconds: duration,
          totalFrames,
          width,
          height,
          data,
          composite: false,
          preparedStdlib,
          ...(measurer !== undefined ? { measurer } : {}),
        });
        captures.set(frame, {
          html: rendered.html,
          lane: rendered.lane,
          ...(rendered.tree !== undefined ? { tree: rendered.tree } : {}),
        });
      }
    }
    evalResult.captures = captures;
  }

  const samples: CheckSample[] = [];
  const technicalFrames: TechnicalFrame[] = [];
  let technical = analyzeTechnicalSequence([]);
  let platePreflightDone = false;
  let projectRoot: string;
  try {
    // Match `superimg plate`, which writes relative to the invoked project.
    projectRoot = context.projectRoot ?? findProjectRoot();
  } catch {
    projectRoot = dirname(resolvedPath);
  }

  if (!options.summary) {
    // Sample --at list, plus 0/1 when temporal loop so seam always has endpoints
    const sampleAts: AtSample[] = [...atList];
    if (isLoop) {
      const has0 = sampleAts.some(
        (a) => a.kind === "progress" && a.progress === 0,
      );
      const has1 = sampleAts.some(
        (a) => a.kind === "progress" && a.progress === 1,
      );
      if (!has0) sampleAts.push({ kind: "progress", progress: 0, label: "0" });
      if (!has1) sampleAts.push({ kind: "progress", progress: 1, label: "1" });
    }

    for (const at of sampleAts) {
      context.signal?.throwIfAborted();
      const { progress, frame, seconds, timelineSeconds } = sampleProgress(at, fps, duration, totalFrames);
      const active = activePhaseName(phaseList, progress);
      const cap = evalResult.captures?.get(frame);
      if (!cap) {
        issues.push({
          severity: "error",
          code: "RENDER_EXCEPTION",
          message: `No capture for frame ${frame}`,
          frame,
          progress,
        });
        samples.push({
          at: at.label,
          progress,
          frame,
          seconds,
          timelineSeconds,
          activePhase: active?.name ?? null,
          phaseLocal: active?.phaseLocal ?? null,
          htmlBytes: 0,
          text: [],
          colors: [],
          eqKeys: [],
          error: { message: `No capture for frame ${frame}` },
        });
        continue;
      }
      const html = cap.html;
      const semantics = scrapeHtmlSemantics(html);
      const nodes = cap.tree
        ? walkMediaTree(cap.tree, {
            width,
            height,
            ...(measurer !== undefined ? { measurer } : {}),
          })
        : undefined;
      const background = stageBackground(template.config?.background);
      technicalFrames.push({ html, frame, progress, width, height,
        ...(nodes ? { nodes } : {}), ...(background !== undefined ? { background } : {}) });
      if (cap.tree && !platePreflightDone) {
        issues.push(
          ...scanPlateAssetIssues(cap.tree, projectRoot, { frame, progress }),
        );
        platePreflightDone = true;
      }
      samples.push({
        at: at.label,
        progress,
        frame,
        seconds,
        timelineSeconds,
        activePhase: active?.name ?? null,
        phaseLocal: active?.phaseLocal ?? null,
        htmlBytes: Buffer.byteLength(html, "utf8"),
        text: semantics.text,
        colors: semantics.colors,
        eqKeys: semantics.eqKeys,
      });
      // Stash HTML + nodes for structural seam / identity flicker
      const last = samples[samples.length - 1] as CheckSample & {
        _html?: string;
        _nodes?: typeof nodes;
      };
      // Internal seam/identity evidence must never inflate public JSON reports.
      Object.defineProperty(last, "_html", { value: html, enumerable: false });
      if (nodes) Object.defineProperty(last, "_nodes", { value: nodes, enumerable: false });
    }
    technical = analyzeTechnicalSequence(technicalFrames);
    issues.push(...technicalRuntimeFindings(technical).map(finding => runtimeFindingToIssue(finding)));


    // Encoded frames exclude the endpoint. Verify authored closure at virtual N
    // separately from actual motion across the encoded last→first wrap.
    if (isLoop) {
      const startSamples = samples.filter((s) => s.frame === 0).map((s) => {
        const withHtml = s as CheckSample & { _html?: string };
        return {
          progress: s.progress,
          text: s.text,
          colors: s.colors,
          htmlBytes: s.htmlBytes,
          ...(withHtml._html !== undefined ? { html: withHtml._html } : {}),
          ...(s.error !== undefined ? { error: s.error } : {}),
        };
      });
      try {
        const boundary = renderLoopBoundary({
          template, fps, totalFrames, width, height, data,
          preparedStdlib: await createPreparedStdlibForTemplate(template),
          ...(measurer !== undefined ? { measurer } : {}),
        });
        const semantics = scrapeHtmlSemantics(boundary.html);
        issues.push(...checkLoopSeam([
          ...startSamples,
          { progress: boundary.progress, text: semantics.text, colors: semantics.colors,
            htmlBytes: Buffer.byteLength(boundary.html, "utf8"), html: boundary.html },
        ]));
        issues.push({
          severity: "info", code: "LOOP_SEAM_BOUNDARY",
          message: `Authored closure compared frame 0 with virtual frame ${boundary.frame}; encoded frame ${totalFrames - 1} remains distinct`,
          details: { startFrame: 0, boundaryFrame: boundary.frame, encodedLastFrame: totalFrames - 1, boundaryProgress: boundary.progress, boundaryTimelineSeconds: boundary.timelineSeconds, scope: "authored-boundary; encoded wrap motion requires --seam-visual" },
        });
      } catch (err) {
        issues.push({
          severity: "warning", code: "LOOP_SEAM_UNVERIFIED",
          message: `Authored loop closure is unverified: ${err instanceof Error ? err.message : String(err)}`,
          suggestion: "Review the encoded wrap with --seam-visual and authored periodicity tests; no virtual boundary proof was established",
        });
      }

      if (options.seamVisual) {
        try {
          const lastFrame = totalFrames - 1;
          const pngs = new Map<number, Buffer>();
          // Reuse identical selections (including a one-frame loop) and keep
          // raster capture memory bounded to one active frame.
          for (const frame of new Set([0, Math.min(1, lastFrame), Math.max(0, lastFrame - 1), lastFrame])) {
            const image = await profileStage("raster.render", () => runtimeRender(context.runtime, context.loaded.value as ExportableMedia, {
              as: "png",
              at: `${frame}f`,
              size: { width, height },
              ...(options.selectedEntry !== undefined ? { entryId: options.selectedEntry } : {}),
              ...(options.variant !== undefined ? { variantId: options.variant } : {}),
              ...(options.edition !== undefined ? { editionId: options.edition } : {}),
              ...(dataOverride !== undefined ? { data: dataOverride as JsonObject } : {}),
              providers: "skip",
    ...(context.signal === undefined ? {} : { signal: context.signal }),
            }, preparedReport));
            pngs.set(frame, Buffer.from(await profileStage("artifact.read", () => readRuntimeBytes(image.stream()))));
          }
          const thr = options.seamVisualThreshold
            ? parseFloat(options.seamVisualThreshold)
            : DEFAULT_SEAM_VISUAL_MAE;
          const wrap = await meanPixelDelta(pngs.get(lastFrame)!, pngs.get(0)!);
          const before = await meanPixelDelta(pngs.get(Math.max(0, lastFrame - 1))!, pngs.get(lastFrame)!);
          const after = await meanPixelDelta(pngs.get(0)!, pngs.get(Math.min(1, lastFrame))!);
          issues.push(
            ...checkLoopSeamVisual(
              wrap?.mae ?? null,
              Number.isFinite(thr) ? thr : DEFAULT_SEAM_VISUAL_MAE,
              { before: before?.mae ?? null, after: after?.mae ?? null },
            ),
          );
          issues.push({
            severity: "info", code: "LOOP_SEAM_VISUAL_SCOPE",
            message: "Encoded wrap compared with its neighboring frame steps; this local motion heuristic does not verify audio or overall motion craft",
            details: { wrapMae: wrap?.mae ?? null, beforeMae: before?.mae ?? null, afterMae: after?.mae ?? null, tolerance: Number.isFinite(thr) ? thr : DEFAULT_SEAM_VISUAL_MAE, neighborMultiplier: 1.5 },
          });
        } catch (err) {
          issues.push({
            severity: "error",
            code: "LOOP_SEAM_VISUAL",
            message: `Visual seam check failed: ${err instanceof Error ? err.message : String(err)}`,
            suggestion: "Ensure Playwright Chromium is installed (superimg setup / doctor)",
          });
        }
      }
    }
  }

  if (options.craft || options.craftStrict) {
    const craft = critiqueTemplate(template, {
      source,
      data: data as Record<string, unknown>,
    });
    const codeMap = {
      HOLD_TOO_SHORT: "CRAFT_HOLD_TOO_SHORT",
      EXIT_SLOWER_THAN_ENTER: "CRAFT_EXIT_SLOWER_THAN_ENTER",
      TEXT_HOLD_SHORT: "CRAFT_TEXT_HOLD_SHORT",
      STAGGER_OVER_CAP: "CRAFT_STAGGER_OVER_CAP",
      LINEAR_POSITIONAL: "CRAFT_LINEAR_POSITIONAL",
      LONG_CONTINUOUS_MOVE: "CRAFT_LONG_CONTINUOUS_MOVE",
      NO_HOLD_PHASE: "CRAFT_NO_HOLD_PHASE",
    } as const;
    for (const issue of craft.issues) {
      const mapped = codeMap[issue.code as keyof typeof codeMap];
      if (!mapped) continue;
      issues.push({
        severity:
          options.craftStrict && issue.severity !== "info"
            ? "error"
            : issue.severity === "error"
              ? "error"
              : "warning",
        code: mapped,
        message: issue.message,
        suggestion: issue.suggestion,
        ...(issue.progress !== undefined ? { progress: issue.progress } : {}),
      });
    }
  }

  // Always surface IR capability issues when IR mode; full block when --ir
  let irBlock: CheckReport["ir"];
  if (evalResult.mode === "ir" && evalResult.ir) {
    for (const issue of evalResult.ir.capabilities.issues) {
      issues.push({
        severity: "warning",
        code: `IR_${issue.code}`,
        message: issue.message,
        ...(issue.frame !== undefined ? { frame: issue.frame } : {}),
      });
    }
    if (options.ir) {
      irBlock = {
        capabilities: evalResult.ir.capabilities,
        hashes: evalResult.ir.hashes,
        clock: evalResult.ir.clock,
      };
      // Craft lint over IR motions — opinion channel, --craft-strict escalates.
      const disabledCraftRules = options.craftIgnore
        ?.split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const craftIssues = lintMediaIR(evalResult.ir, {
        strict: options.craftStrict === true,
        ...(disabledCraftRules?.length ? { disable: disabledCraftRules } : {}),
      });
      for (const issue of craftIssues) {
        issues.push({
          severity: issue.severity === "error" ? "error" : "warning",
          code: issue.code,
          message: issue.message,
          ...(issue.suggestion !== undefined ? { suggestion: issue.suggestion } : {}),
          ...(issue.frame !== undefined ? { frame: issue.frame } : {}),
        });
      }
    }
  } else if (options.ir && evalResult.mode === "runtime-fallback") {
    issues.push({
      severity: "error",
      code: "IR_COMPILE_FAILED",
      message: evalResult.fallbackReason ?? "Media IR unavailable",
      suggestion:
        "Fix Media IR authoring (required ids, no mode:animation, deterministic render)",
    });
  }

  const uniqueIssues = issues.filter((issue, index, all) => all.findIndex(other =>
    other.code === issue.code && other.message === issue.message && other.frame === issue.frame && other.nodeId === issue.nodeId && other.nodePath === issue.nodePath
  ) === index);
  const coordinates = { ...(evalResult.entryId !== undefined ? { entryId: evalResult.entryId } : {}), variantId: evalResult.variantId, editionId: evalResult.editionId };
  const findings = mergeTechnicalFindings(runtimeReport.findings, technical, coordinates);
  const coverage = technicalFrames.length ? mergeTechnicalScopes({ ...technical.coverage, samples: technical.coverage.samples.map(sample => ({ ...sample, coordinates })) }, runtimeReport.coverage) : runtimeReport.coverage;
  const expandedRuntimeReport = { ...runtimeReport, findings, ok: !findings.some(finding => finding.severity === "error"), ...(coverage ? { coverage } : {}) };
  const ok = expandedRuntimeReport.ok && !uniqueIssues.some((issue) => issue.severity === "error");

  return {
    schemaVersion: CHECK_SCHEMA_VERSION,
    ok,
    template: resolvedPath,
    evaluationMode: evalResult.mode,
    ...(evalResult.fallbackReason !== undefined
      ? { fallbackReason: evalResult.fallbackReason }
      : {}),
    config: { width, height, fps, duration, totalFrames },
    phases,
    ...(scenePhases !== undefined ? { scenePhases } : {}),
    issues: uniqueIssues,
    samples,
    coordinates: {
      ...(evalResult.entryId !== undefined ? { entryId: evalResult.entryId } : {}),
      variantId: evalResult.variantId,
      editionId: evalResult.editionId,
    },
    ...(irBlock !== undefined ? { ir: irBlock } : {}),
    runtime: expandedRuntimeReport,
    ...(coverage ? { coverage } : {}),
    validationTimeMs: performance.now() - startTime,
  };
}

export function runtimeFindingToIssue(
  finding: RuntimeFinding,
  craftStrict = false,
): CheckIssue {
  return {
    severity:
      finding.severity === "error" ||
      (craftStrict && finding.code.startsWith("CRAFT_") && finding.severity !== "info")
        ? "error"
        : finding.severity === "info"
          ? "info"
          : "warning",
    code: finding.code,
    message: finding.message,
    ...(finding.suggestion === undefined ? {} : { suggestion: finding.suggestion }),
    ...(finding.details === undefined ? {} : { details: finding.details }),
    ...(typeof finding.details?.frame === "number" ? { frame: finding.details.frame } : {}),
    ...(typeof finding.details?.progress === "number" ? { progress: finding.details.progress } : {}),
    ...(typeof finding.details?.nodeId === "string" ? { nodeId: finding.details.nodeId } : {}),
    ...(typeof finding.details?.nodePath === "string" ? { nodePath: finding.details.nodePath } : {}),
  };
}

export function runtimeAt(
  sample: AtSample,
  loaded: LoadedNodeMediaValue,
): number | `${number}f` {
  if (sample.kind === "frame") return `${sample.frame}f`;
  if (sample.kind === "seconds") return sample.seconds;
  if (loaded.value.kind === "interactive") return 0;
  const media = loaded.value.kind === "collection"
    ? loaded.value.media
    : loaded.value;
  const fps = media.config?.fps ?? 30;
  let duration = 0;
  try {
    duration = media.animated
      ? parseDuration(media.config?.duration, "duration", fps)
      : 0;
  } catch {
    // Runtime emits the authored duration finding; sampling at zero is safe.
  }
  return `${resolveAtSample(sample, {
    fps,
    duration,
    totalFrames: media.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(duration * fps)),
  }).frame}f`;
}

async function readRuntimeBytes(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}


/** Check one already-loaded source; selection and data are explicit and providers are not run. */
export async function checkNodeSource(input: Readonly<{
  runtime: Runtime;
  loaded: LoadedNodeMediaValue;
  data?: Record<string, unknown>;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  samples?: readonly AtSample[];
  renderedLayout?: boolean;
  craft?: boolean;
  craftStrict?: boolean;
  signal?: AbortSignal;
  projectRoot?: string;
}>) {
  const at = input.samples?.map(sample => sample.kind === "frame" ? `${sample.frame}f` : sample.kind === "progress" ? String(sample.progress) : `${sample.seconds}s`).join(",");
  return checkPreparedSource(input.loaded.source.templatePath, {
    ...(at === undefined ? {} : { at }),
    ...(input.entryId === undefined ? {} : { selectedEntry: input.entryId }),
    ...(input.variantId === undefined ? {} : { variant: input.variantId }),
    ...(input.editionId === undefined ? {} : { edition: input.editionId }),
    ...(input.renderedLayout === undefined ? {} : { renderedLayout: input.renderedLayout }),
    ...(input.craft === undefined ? {} : { craft: input.craft }),
    ...(input.craftStrict === undefined ? {} : { craftStrict: input.craftStrict }),
  }, { runtime: input.runtime, loaded: input.loaded, ...(input.data === undefined ? {} : { dataOverride: input.data }), ...(input.projectRoot === undefined ? {} : { projectRoot: input.projectRoot }), ...(input.signal === undefined ? {} : { signal: input.signal }) });
}
