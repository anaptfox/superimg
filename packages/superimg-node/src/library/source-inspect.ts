import { analyzeMediaSourceFindings } from "@superimg/core/source-analysis";
import { textMeasurerForDeclarations, walkMediaTree, type MediaIRFrameCapture } from "@superimg/core";
import { scrapeHtmlSemantics } from "./html-semantics.js";
import { buildInspectTreeSnapshot, type InspectTreeSnapshot, type SemanticTreeNode } from "./tree-check.js";
import type { InspectReport as RuntimeInspectReport } from "@superimg/types";
type TextMeasurer = NonNullable<Awaited<ReturnType<typeof textMeasurerForDeclarations>>>;
import { inspect, prepareRuntimeReport, type PreparedRuntimeReport } from "@superimg/core/runtime";
import type { JsonObject, Runtime } from "@superimg/types";
import type { LoadedNodeMediaValue } from "./source.js";
import { activePhaseName, derivePhasesFromIR } from "./ir-phases.js";
import { analyzeTechnicalSequence, mergeTechnicalFindings, mergeTechnicalScopes, stageBackground, type TechnicalFrame } from "@superimg/core/validation";
import type { IrEvalResult } from "./source-evaluate.js";
import { resolveAtSample, type AtSample, type ResolvedAtSample } from "./review-clock.js";
import { evaluatePreparedSourceIR } from "./source-evaluate.js";

/** A sampled frame observed while inspecting a prepared source. */
export interface SourceInspectionSample extends ResolvedAtSample {
  at: string;
  activePhase: string | null;
  phaseLocal: number | null;
  htmlBytes: number;
  lane?: "svg" | "html";
  text: string[];
  colors: string[];
  eqKeys: string[];
  waitLabels: string[];
  cameraScale: number | null;
  tree: InspectTreeSnapshot;
}

/** Prepared report identity is retained for later inspection of the same runtime and selection. */
export interface PreparedSourceInspection {
  evaluation: IrEvalResult;
  report: RuntimeInspectReport;
  preparedReport: PreparedRuntimeReport;
  samples: SourceInspectionSample[];
}

/** Inspect one already-loaded source and its explicitly frozen collection snapshot. */
export async function inspectPreparedSource(input: Readonly<{
  runtime: Runtime;
  loaded: LoadedNodeMediaValue;
  data?: JsonObject;
  entryId?: string;
  variantId?: string;
  editionId?: string;
  frames?: number[];
  progresses?: number[];
  seconds?: number[];
  renderedLayout?: boolean;
  at?: AtSample;
  includeIR?: boolean;
  /** Skip enrichment when a host will choose and observe a later bounded selection. */
  enrich?: boolean;
  signal?: AbortSignal;
}>): Promise<PreparedSourceInspection> {
  input.signal?.throwIfAborted();
  const selection = {
    ...(input.data === undefined ? {} : { data: input.data }),
    ...(input.entryId === undefined ? {} : { entryId: input.entryId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.editionId === undefined ? {} : { editionId: input.editionId }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
    providers: "skip" as const,
  };
  const preparedReport = await prepareRuntimeReport(input.runtime, input.loaded.value, selection);
  if (input.loaded.value.kind === "interactive") throw new TypeError("Prepared source sampling requires deterministic media");
  const evaluation = await evaluatePreparedSourceIR({
    loaded: input.loaded, preparedReport,
    ...(input.data === undefined ? {} : { data: input.data }),
    ...(input.entryId === undefined ? {} : { entry: input.entryId }),
    ...(input.variantId === undefined ? {} : { variant: input.variantId }),
    ...(input.editionId === undefined ? {} : { edition: input.editionId }),
    ...(input.frames === undefined ? {} : { captureFrames: input.frames }),
    ...(input.progresses === undefined ? {} : { captureProgresses: input.progresses }),
    ...(input.seconds === undefined ? {} : { captureSeconds: input.seconds }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  const firstFrame = input.at === undefined ? undefined : resolveAtSample(input.at, evaluation.config).frame;
  const report = await inspect(input.runtime, input.loaded.value, {
    ...selection,
    ...(firstFrame === undefined ? {} : { at: `${firstFrame}f` as const }),
    ...(input.renderedLayout ? { renderedLayout: true } : {}),
    includeIR: input.includeIR ?? true,
  }, preparedReport);
  const requested: AtSample[] = [
    ...(input.frames ?? []).map(frame => ({ kind: "frame" as const, frame, label: `${frame}f` })),
    ...(input.progresses ?? []).map(progress => ({ kind: "progress" as const, progress, label: String(progress) })),
    ...(input.seconds ?? []).map(seconds => ({ kind: "seconds" as const, seconds, label: `${seconds}s` })),
  ];
  const observed = input.enrich === false ? { samples: [], technicalFrames: [] } : await observeSourceSamples(evaluation, requested, input.signal);
  const coordinates = { ...(evaluation.entryId === undefined ? {} : { entryId: evaluation.entryId }), variantId: evaluation.variantId, editionId: evaluation.editionId };
  const technical = analyzeTechnicalSequence(observed.technicalFrames);
  const enrichedReport = input.enrich === false ? report : withFrozenSourceFindings({ ...report,
    coverage: mergeTechnicalScopes({ ...technical.coverage, samples: technical.coverage.samples.map(sample => ({ ...sample, coordinates })) }, report.coverage),
    findings: mergeTechnicalFindings(report.findings, technical, coordinates),
  }, input.loaded);
  return { evaluation, report: enrichedReport, preparedReport, samples: observed.samples };

}

/** Keep source-only warnings tied to the entry bytes in the compiled snapshot. */
export function withFrozenSourceFindings(
  report: RuntimeInspectReport,
  loaded: LoadedNodeMediaValue,
): RuntimeInspectReport {
  const source = loaded.sourceText;
  const value = loaded.value;
  const isAnimated = value.kind === "interactive" ? true : value.kind === "collection" ? value.media.animated : value.animated;
  const seen = new Set(report.findings.map((finding) => `${finding.code}\0${finding.message}`));
  const sourceFindings = analyzeMediaSourceFindings(source, { isAnimated }).filter((finding) => {
    const key = `${finding.code}\0${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...report, findings: [...report.findings, ...sourceFindings] };
}

export function semanticsFromCapture(
  cap: MediaIRFrameCapture,
  canvas: { width: number; height: number; measurer?: TextMeasurer },
): ReturnType<typeof scrapeHtmlSemantics> & { tree: InspectTreeSnapshot } {
  const scraped = scrapeHtmlSemantics(cap.html);
  if (!cap.tree || typeof cap.tree === "string") {
    return { ...scraped, tree: buildInspectTreeSnapshot(undefined) };
  }
  const nodes = walkMediaTree(cap.tree, canvas) as SemanticTreeNode[];
  const text = [
    ...new Set([
      ...scraped.text,
      ...nodes.flatMap((node) => {
        const value = node.directText ?? node.text;
        return value ? value.split(/\s+/) : [];
      }),
    ]),
  ].slice(0, 50);
  const colors = [
    ...new Set([
      ...scraped.colors,
      ...nodes.flatMap((node) =>
        [node.color, node.paint?.fill, node.paint?.stroke].filter(
          (value): value is string => typeof value === "string",
        ),
      ),
    ]),
  ];
  return {
    ...scraped,
    text,
    colors,
    tree: buildInspectTreeSnapshot(nodes),
  };
}


/** Produce technical observations from already-captured frames without publishing files. */
export async function observeSourceSamples(evaluation: IrEvalResult, requested: readonly AtSample[], signal?: AbortSignal) {
  const { config } = evaluation;
  const measurer = await textMeasurerForDeclarations(evaluation.template.config?.fonts, signal);
  const phases = evaluation.ir ? derivePhasesFromIR(evaluation.ir).allPhases : null;
  const samples = [];
  const technicalFrames: TechnicalFrame[] = [];
  const seen = new Set<number>();
  for (const at of requested) {
    signal?.throwIfAborted();
    const clock = resolveAtSample(at, config);
    if (seen.has(clock.frame)) continue;
    seen.add(clock.frame);
    const active = activePhaseName(phases, clock.progress);
    const cap = evaluation.captures?.get(clock.frame);
    if (!cap) throw new Error(`No capture for frame ${clock.frame}`);
    const semantics = semanticsFromCapture(cap, { width: config.width, height: config.height, ...(measurer === undefined ? {} : { measurer }) });
    samples.push({ at: at.label, ...clock, activePhase: active?.name ?? null, phaseLocal: active?.phaseLocal ?? null, htmlBytes: Buffer.byteLength(cap.html, "utf8"), ...(cap.lane === undefined ? {} : { lane: cap.lane }), ...semantics });
    const background = stageBackground(evaluation.template.config?.background);
    technicalFrames.push({ html: cap.html, frame: clock.frame, progress: clock.progress, width: config.width, height: config.height, ...(semantics.tree.source === "tree" ? { nodes: semantics.tree.nodes as unknown as SemanticTreeNode[] } : {}), ...(background === undefined ? {} : { background }) });
  }
  return { samples, technicalFrames };
}
