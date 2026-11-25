import { profileStage } from "../utils/command-profile.js";
import { commandResult } from "../utils/command-result.js";
//! check — agent pass/fail gate over resolveMediaIR (versioned JSON).

import { dirname, relative, sep } from "node:path";
import { critiqueTemplate, renderTemplateFrame } from "@superimg/core/testing";
import {
  scanSourceFootguns,
  stageBackground,
  analyzeTechnicalSequence,
  mergeTechnicalFindings,
  mergeTechnicalScopes,
  technicalRuntimeFindings,
  type TechnicalFrame,
} from "@superimg/core/validation";
import {
  check as runtimeCheck,
  render as runtimeRender,
} from "@superimg/core/runtime";
import { prepareRuntimeReport, type PreparedRuntimeReport } from "@foxworth/superimg/internal/runtime-kernel";
import { lintMediaIR } from "@superimg/core/ir";
import type {
  CheckReport as RuntimeCheckReport,
  ExportableMedia,
  JsonObject,
  Runtime,
  RuntimeFinding,
  RuntimeTechnicalCoverage,
} from "@superimg/types";
import { MEDIA_INTERACTION_IDS, type MediaSourceDescription } from "@foxworth/superimg-interactions";
import { resolveTemplatePathOrSole } from "../utils/resolve-template.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import { scrapeHtmlSemantics } from "../utils/html-semantics.js";
import { parseAtList, resolveAtSample, type AtSample } from "../utils/inspect-at.js";
import { loadDataInput } from "../utils/data-loader.js";
import { createPreparedStdlibForTemplate, parseDuration, textMeasurerForDeclarations, walkMediaTree } from "@superimg/core";
import { evaluateTemplateIR } from "../utils/ir-eval.js";
import {
  activePhaseName,
  derivePhasesFromIR,
  phaseHoldBoundarySamples,
  sceneBoundarySamples,
  type IrDerivedPhase,
} from "../utils/ir-phases.js";
import {
  checkLoopSeam,
  checkLoopSeamVisual,
  meanPixelDelta,
  renderLoopBoundary,
  DEFAULT_SEAM_VISUAL_MAE,
} from "../utils/loop-seam.js";
import {
  scanPlateAssetIssues,
  type SemanticTreeNode,
} from "../utils/tree-check.js";
import {
  createCliMediaInteractionSession,
  createCliValueRuntime,
} from "../utils/media-interactions.js";
import {
  loadCliMediaValue,
  prepareCliMediaSource,
  type LoadedCliMediaValue,
} from "../utils/runtime-source.js";

export { CHECK_SCHEMA_VERSION } from "@superimg/node/source-check";
export type { CheckPhase, CheckSample, CheckIssue, CheckReport } from "@foxworth/superimg-node/source";
// The CLI report schema constant is not part of the public operation facade.
import { checkNativePortability, type BrowserReason, type NeedsBrowserConfig } from "@superimg/core";
import { CHECK_SCHEMA_VERSION } from "@superimg/node/source-check";
import { applyDestinationTarget, checkPreparedSource, evaluatePreparedSourceIR, runtimeAt, runtimeFindingToIssue, type CheckOptions as NodeCheckOptions, type CheckRuntimeContext } from "@foxworth/superimg-node/source/advanced";
import type { CheckReport, CheckPhase, CheckSample, CheckIssue } from "@foxworth/superimg-node/source";

export type CheckTarget = "web" | "native";
export type CheckOptions = NodeCheckOptions & {
  target?: CheckTarget;
};

function normalizeCheckTarget(target: string | undefined): CheckTarget {
  if (target === undefined || target === "web") return "web";
  if (target === "native") return "native";
  throw Object.assign(
    new Error(`Invalid --target ${JSON.stringify(target)}. Expected "web" or "native".`),
    { code: "INVALID_TARGET" },
  );
}

function nativeUnportableIssue(
  entry: BrowserReason,
  loc: { frame: number; progress: number },
): CheckIssue {
  const { nodeId, reason } = entry;
  const nodeLabel = nodeId ? ` (#${nodeId})` : "";
  let message: string;
  let suggestion: string;

  switch (reason) {
    case "tailwind":
      message = "Native target does not support Tailwind CSS (config.tailwind)";
      suggestion = "Remove config.tailwind and express styling with typed Frame, Stack, Text, and Fill props.";
      break;
    case "stylesheets":
      message = "Native target does not support external stylesheets (config.stylesheets)";
      suggestion = "Remove config.stylesheets and express styling with typed Frame, Stack, Text, and Fill props.";
      break;
    case "inlineCss":
      message = "Native target does not support inline CSS (config.inlineCss)";
      suggestion = "Remove config.inlineCss and express styling with typed Frame, Stack, Text, and Fill props.";
      break;
    case "background":
      message = "Native target only supports plain color config.background values";
      suggestion = "Use a plain color string for config.background or paint backgrounds with Fill()/Image() nodes.";
      break;
    case "Html":
    case "Video":
    case "Plate":
    case "foreignObject":
      message = `Native target does not support browser-only node ${reason}${nodeLabel}`;
      suggestion = `Replace ${reason} with native-portable Frame, Stack, Text, Fill, Image, or Vector primitives, or target --target web.`;
      break;
    case "className":
      message = `Native target does not support CSS class/className${nodeId ? ` on #${nodeId}` : ""}`;
      suggestion = "Remove class/className and express styling with typed Frame, Stack, Text, or Fill props.";
      break;
    case "style":
      message = `Native target does not support raw style strings${nodeId ? ` on #${nodeId}` : ""}`;
      suggestion = "Replace raw style strings with typed Frame, Stack, Text, or Fill props.";
      break;
    default:
      if (reason.startsWith("style:")) {
        message = `Native target does not support CSS ${reason}${nodeId ? ` on #${nodeId}` : ""}`;
        suggestion = `Replace ${reason} with typed Frame, Stack, Text, or Fill props.`;
      } else {
        message = `Native target does not support ${reason}${nodeId ? ` on #${nodeId}` : ""}`;
        suggestion = `Replace or remove unsupported ${reason}${nodeId ? ` on #${nodeId}` : ""} for native target portability.`;
      }
      break;
  }

  return {
    severity: "error",
    code: "NATIVE_UNPORTABLE",
    message,
    frame: loc.frame,
    progress: loc.progress,
    suggestion,
    ...(nodeId !== undefined ? { nodeId } : {}),
    details: { target: "native", reason },
  };
}

async function applyNativeTargetCheck(
  report: CheckReport,
  options: CheckOptions,
  loaded: CheckRuntimeContext["loaded"],
  dataOverride?: Record<string, unknown>,
  preparedReport?: PreparedRuntimeReport,
): Promise<CheckReport> {
  if (loaded.value.kind === "interactive") {
    const issue: CheckIssue = {
      severity: "error",
      code: "NATIVE_UNPORTABLE",
      message: "Interactive media is not portable to native targets",
      frame: 0,
      progress: 0,
      suggestion: "Author a deterministic video(), image(), or svg() template without defineInteractive().",
      details: { target: "native", reason: "interactive" },
    };
    return {
      ...report,
      ok: false,
      issues: [...report.issues, issue],
    };
  }

  const samplePairs = report.samples.length > 0
    ? report.samples.map((sample) => ({ frame: sample.frame, progress: sample.progress }))
    : [{ frame: 0, progress: 0 }];
  const captureFrames = [...new Set(samplePairs.map((sample) => sample.frame))];

  const evalResult = await evaluatePreparedSourceIR({
    loaded,
    ...(preparedReport !== undefined ? { preparedReport } : {}),
    ...(dataOverride !== undefined ? { data: dataOverride } : {}),
    ...(options.selectedEntry !== undefined ? { entry: options.selectedEntry } : {}),
    ...(options.edition !== undefined ? { edition: options.edition } : {}),
    ...(options.variant !== undefined ? { variant: options.variant } : {}),
    captureFrames,
  });

  const cfg = evalResult.template.config;
  const bg = stageBackground(cfg?.background);
  const nativeConfig: NeedsBrowserConfig = {
    ...(cfg?.tailwind !== undefined ? { tailwind: cfg.tailwind } : {}),
    ...(cfg?.stylesheets !== undefined ? { stylesheets: cfg.stylesheets } : {}),
    ...(cfg?.inlineCss !== undefined ? { inlineCss: cfg.inlineCss } : {}),
    ...(bg !== undefined ? { background: bg } : {}),
  };

  const nativeIssues: CheckIssue[] = [];
  const seenReasons = new Set<string>();
  let checkedConfig = false;

  for (const sample of samplePairs) {
    const capture = evalResult.captures?.get(sample.frame);
    if (!capture?.tree) continue;
    const result = checkNativePortability(
      capture.tree,
      checkedConfig ? undefined : nativeConfig,
    );
    checkedConfig = true;
    for (const reason of result.reasons) {
      const key = `${reason.nodeId ?? ""}\0${reason.reason}`;
      if (seenReasons.has(key)) continue;
      seenReasons.add(key);
      nativeIssues.push(nativeUnportableIssue(reason, sample));
    }
  }

  if (nativeIssues.length === 0) return report;
  return {
    ...report,
    ok: false,
    issues: [...report.issues, ...nativeIssues],
  };
}

function printPretty(report: CheckReport): void {
  const { config, phases, issues, samples } = report;
  console.error(`\n  Check: ${report.template}`);
  console.error(
    `  ${config.width}×${config.height} @ ${config.fps}fps · ${config.duration}s · ${config.totalFrames} frames`,
  );
  console.error(
    `  ok=${report.ok}  mode=${report.evaluationMode}  issues=${issues.length}  samples=${samples.length}  ${report.validationTimeMs.toFixed(0)}ms\n`,
  );
  if (phases && phases.length > 0) {
    console.error("  Phases:");
    for (const p of phases) {
      console.error(
        `    ${p.name.padEnd(16)} ${p.startSec.toFixed(2)}s–${p.endSec.toFixed(2)}s`,
      );
    }
    console.error("");
  }
  if (issues.length > 0) {
    console.error("  Issues:");
    for (const i of issues) {
      const mark = i.severity === "error" ? "✗" : i.severity === "info" ? "i" : "⚠";
      const loc =
        i.frame !== undefined
          ? ` f${i.frame}${i.progress !== undefined ? ` @${(i.progress * 100).toFixed(0)}%` : ""}`
          : "";
      const nodeLoc = i.nodeId ? ` #${i.nodeId}` : i.nodePath ? ` ${i.nodePath}` : "";
      console.error(`    ${mark} [${i.code}]${loc}${nodeLoc} ${i.message}`);
      if (i.suggestion) console.error(`      → ${i.suggestion}`);
    }
    console.error("");
  } else {
    console.error("  Issues: none\n");
  }
  if (samples.length > 0) {
    console.error("  Samples:");
    for (const s of samples) {
      if (s.error) {
        console.error(`    @${s.at}  ERROR: ${s.error.message}`);
        continue;
      }
      const phase = s.activePhase ?? "—";
      console.error(
        `    @${String(s.at).padEnd(6)} f${s.frame}  phase=${phase}  text=${s.text.slice(0, 4).join(" ") || "—"}`,
      );
    }
    console.error("");
  }
}

/**
 * Build a CheckReport for a resolved template path (testable without process.exit).
 */
export async function runCheck(resolvedPath: string, options: CheckOptions = {}, context?: CheckRuntimeContext): Promise<CheckReport> {
  const target = normalizeCheckTarget(options.target);
  if (context) {
    const report = await checkPreparedSource(resolvedPath, options, context);
    if (target !== "native") return report;
    return applyNativeTargetCheck(
      report,
      options,
      context.loaded,
      context.dataOverride,
      context.preparedReport,
    );
  }
  const runtime = createCliValueRuntime();
  try {
    const loaded = await loadCliMediaValue(resolvedPath);
    let dataOverride: Record<string, unknown> | undefined;
    if (options.data) {
      const value = await loadDataInput(options.data, dirname(resolvedPath));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("--data for check must be a single object (not an array)");
      dataOverride = value as Record<string, unknown>;
    }
    const applied = applyDestinationTarget(loaded, options.for, options.edition);
    const effectiveOptions = applied.edition === undefined ? options : { ...options, edition: applied.edition };
    const preparedReport = target === "native" && applied.loaded.value.kind !== "interactive"
      ? await prepareRuntimeReport(runtime, applied.loaded.value, {
          ...(dataOverride === undefined ? {} : { data: dataOverride as JsonObject }),
          ...(effectiveOptions.selectedEntry === undefined ? {} : { entryId: effectiveOptions.selectedEntry }),
          ...(effectiveOptions.variant === undefined ? {} : { variantId: effectiveOptions.variant }),
          ...(effectiveOptions.edition === undefined ? {} : { editionId: effectiveOptions.edition }),
          providers: "skip",
        })
      : undefined;
    const report = await checkPreparedSource(resolvedPath, effectiveOptions, {
      runtime,
      loaded: applied.loaded,
      ...(preparedReport !== undefined ? { preparedReport } : {}),
      dataOverride,
    });
    if (target !== "native") return report;
    return await applyNativeTargetCheck(report, effectiveOptions, applied.loaded, dataOverride, preparedReport);
  } finally { await runtime.dispose(); }
}

export async function checkCommand(
  templateArg: string | undefined,
  options: CheckOptions = {},
): Promise<void> {
  normalizeCheckTarget(options.target);
  const resolvedPath = resolveTemplatePathOrSole(templateArg);

  const projectRoot = findProjectRoot(dirname(resolvedPath));
  const source = relative(projectRoot, resolvedPath).split(sep).join("/");
  const session = createCliMediaInteractionSession(projectRoot);
  let reports: CheckReport[] | undefined;
  try {
    const preparedSource = await prepareCliMediaSource(resolvedPath);
    const commandContext = { preparedSource };
    const description = await session.mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.describe,
      input: { source },
    }, commandContext);
    const data = await checkDataOverride(resolvedPath, options.data);
    if (
      description.sourceKind === "collection" &&
      description.collectionEntries === "provider"
    ) {
      if ((options.entry?.length ?? 0) > 0) {
        throw new Error("--entry requires an explicit frozen snapshot for provider collections");
      }
      const result = await profileStage("runtime.check", () => session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.check,
        input: interactionCheckInput(source, options, data),
      }, commandContext));
      reports = [runtimeOnlyCheckReport(resolvedPath, options, description, result.report)];
      return emitCheckReports(resolvedPath, reports, options);
    }
    const loadedRaw = await loadCliMediaValue(resolvedPath, { preparedSource });
    const applied = applyDestinationTarget(loadedRaw, options.for, options.edition);
    const loaded = applied.loaded;
    const selected = applied.edition === undefined ? options : { ...options, edition: applied.edition };
    const loadedContext = { preparedSource, preparedValue: loaded };
    const requested = selected.entry ?? [];
    if (loaded.descriptor.kind !== "collection") {
      if (requested.length > 0) {
        throw new Error("--entry is only valid for deterministic collections");
      }
      const input = interactionCheckInput(source, selected, data, loaded);
      const preparedReport = await profileStage("runtime.prepare", () => prepareRuntimeReport(session.runtime, loaded.value, { ...input, providers: "skip" }));
      const result = await profileStage("runtime.check", () => session.mount.dispatch({
        interactionId: MEDIA_INTERACTION_IDS.check,
        input,
      }, { ...loadedContext, preparedReport }));
      reports = [await runCheck(resolvedPath, selected, {
        runtime: session.runtime,
        loaded,
        runtimeReport: result.report,
        preparedReport,
        dataOverride: data,
      })];
    } else {
      const snapshot = loaded.snapshot;
      if (snapshot === undefined) throw new Error("Collection provider did not produce a snapshot");
      const available = new Set(snapshot.entries.map((entry) => entry.id));
      const entryIds = requested.length > 0
        ? requested
        : snapshot.entries.map((entry) => entry.id);
      const seen = new Set<string>();
      for (const id of entryIds) {
        if (seen.has(id)) throw new Error(`Duplicate --entry ${JSON.stringify(id)}`);
        if (!available.has(id)) throw new Error(`Unknown collection entry ${JSON.stringify(id)}`);
        seen.add(id);
      }
      reports = [];
      for (const entryId of entryIds) {
        const input = interactionCheckInput(source, { ...selected, selectedEntry: entryId }, data, loaded);
        const preparedReport = await profileStage("runtime.prepare", () => prepareRuntimeReport(session.runtime, loaded.value, { ...input, providers: "skip" }));
        const result = await profileStage("runtime.check", () => session.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.check,
          input,
        }, { ...loadedContext, preparedReport }));
        reports.push(await runCheck(resolvedPath, {
          ...selected,
          selectedEntry: entryId,
        }, {
          runtime: session.runtime,
          loaded,
          runtimeReport: result.report,
          preparedReport,
          dataOverride: data,
        }));
      }
    }
  } finally {
    await session.dispose();
  }

  if (reports === undefined) return;

  emitCheckReports(resolvedPath, reports, options);
}

function emitCheckReports(
  resolvedPath: string,
  reports: CheckReport[],
  options: CheckOptions,
): void {
  if (options.pretty) reports.forEach(printPretty);
  const ok = reports.every((report) => report.ok);
  if (reports.length > 1 || reports[0]?.coordinates.entryId !== undefined) {
    console.log(JSON.stringify(commandResult({
      schemaVersion: CHECK_SCHEMA_VERSION,
      ok,
      source: resolvedPath,
      reports,
    }, { ok }), null, 2));
  } else {
    console.log(JSON.stringify(commandResult(reports[0]!, { ok }), null, 2));
  }

  if (!ok) process.exitCode = 1;
}

async function checkDataOverride(
  resolvedPath: string,
  value: string | undefined,
): Promise<JsonObject | undefined> {
  if (value === undefined) return undefined;
  const loaded = await loadDataInput(value, dirname(resolvedPath));
  if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error("--data for check must be a single object (not an array)");
  }
  return loaded as JsonObject;
}

function interactionCheckInput(
  source: string,
  options: CheckOptions,
  data: JsonObject | undefined,
  loaded?: LoadedCliMediaValue,
) {
  const firstAt = parseAtList(options.at)[0];
  return {
    source,
    ...(data === undefined ? {} : { data }),
    ...(options.selectedEntry === undefined ? {} : { entryId: options.selectedEntry }),
    ...(options.variant === undefined ? {} : { variantId: options.variant }),
    ...(options.edition === undefined ? {} : { editionId: options.edition }),
    ...(firstAt === undefined || loaded === undefined
      ? {}
      : { at: runtimeAt(firstAt, loaded) }),
    ...(options.renderedLayout ? { renderedLayout: true } : {}),
    ...(options.craft || options.craftStrict ? { craft: true } : {}),
  };
}

function runtimeOnlyCheckReport(
  resolvedPath: string,
  options: CheckOptions,
  description: MediaSourceDescription,
  runtime: RuntimeCheckReport,
): CheckReport {
  const issues = runtime.findings.map((finding) =>
    runtimeFindingToIssue(finding, options.craftStrict === true)
  );
  return {
    schemaVersion: CHECK_SCHEMA_VERSION,
    ok: runtime.ok,
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
    issues,
    samples: [],
    validationTimeMs: 0,
    coordinates: {
      variantId: options.variant ?? "default",
      editionId: options.edition ?? "default",
    },
    runtime,
  };
}
