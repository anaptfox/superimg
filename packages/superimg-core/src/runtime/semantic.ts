//! Environment-neutral semantic analysis for authored media values.

import type {
  AnyTemplateModule,
  CheckOptions,
  CollectionInspection,
  ExportOptions,
  ExportRenditionRequest,
  ExportableMedia,
  FrozenAssetMetadata,
  FrozenFontMetadata,
  InspectOptions,
  JsonObject,
  MediaRuntimeCapabilities,
  MediaValue,
  DeterministicMediaValue,
  RuntimeFinding,
  RuntimeMediaConfig,
  RuntimeMediaCoordinates,
  RuntimeMediaKind,
  RuntimeTechnicalCoverage,
} from "@superimg/types";
import { critiqueTemplate } from "../critique/motion-critique.js";
import type { DestinationTarget } from "../destinations/index.js";
import {
  digestData,
  ExportPlannerError,
  planMediaExport,
  type PlannedRendition,
} from "../export/planner.js";
import { resolveMediaIR } from "../ir/resolve-media-ir.js";
import { renderTemplateFrame } from "../rendering/render-frame.js";
import { cancellationError, isAbortError, raceSignal } from "../rendering/abort-signal.js";
import { textMeasurerForDeclarations } from "../rendering/text-measurer-declarations.js";
import { createPreparedStdlibForTemplate } from "../shared/stdlib-capabilities.js";
import { walkMediaTree } from "@superimg/stdlib/tree";
import { parseDuration } from "../shared/utils.js";
import { resolveEncodedFrame } from "../shared/frame-clock.js";
import { analyzeTechnicalFrame, mergeTechnicalCoverage, technicalRuntimeFindings } from "../validation/analysis.js";
import { stageBackground } from "../validation/tree-paint.js";
import { sha256Hex } from "../ir/pure/sha256.js";
import { fontDeclarationIssue } from "@superimg/types";
import {
  isCollectionMediaValue,
  isDeterministicMediaValue,
  isInteractiveMediaValue,
  selectRuntimeMedia,
  resolveRuntimeSelection,
  staticCollectionEntries,
  type RuntimeCollectionEntry,
  type RuntimeMediaSelection,
} from "./selection.js";

export interface RuntimeInspectionContribution {
  readonly findings?: readonly RuntimeFinding[];
  readonly assets?: readonly FrozenAssetMetadata[];
  readonly fonts?: readonly FrozenFontMetadata[];
  readonly metadata?: Readonly<JsonObject>;
}

export interface SemanticAnalysis {
  readonly coverage?: RuntimeTechnicalCoverage;
  readonly programDigest: string;
  readonly kind: RuntimeMediaKind;
  readonly config?: RuntimeMediaConfig;
  readonly coordinates: readonly RuntimeMediaCoordinates[];
  readonly findings: readonly RuntimeFinding[];
  readonly collection?: CollectionInspection;
  readonly metadata?: Readonly<JsonObject>;
  /** Internal, value-only selections used by artifact preflight and IR inspection. */
  readonly selections: readonly RuntimeMediaSelection[];
}

type SelectionOptions = Pick<
  CheckOptions | InspectOptions,
  "data" | "entryId" | "variantId" | "editionId" | "at"
>;

interface SemanticAnalysisOptions {
  readonly sample?: boolean;
  readonly captureSample?: boolean;
  readonly craft?: boolean;
  readonly entries?: readonly RuntimeCollectionEntry[];
  readonly selections?: readonly RuntimeMediaSelection[];
  /** Export resolves only the selected entry/variant/edition matrix below. */
  readonly resolve?: boolean;
  readonly signal?: AbortSignal;
}

interface SemanticSampleOverride {
  readonly width?: number;
  readonly height?: number;
  readonly at?: SelectionOptions["at"];
  readonly details?: Readonly<JsonObject>;
}

export function digestMediaProgram(media: MediaValue): string {
  return sha256Hex(stableProgramText(media));
}

/** Fold resolved face hashes into a program digest. Order does not matter. */
export function programDigestWithFonts(
  programDigest: string,
  faces: readonly Pick<FrozenFontMetadata, "family" | "weight" | "style" | "sha256">[] | undefined,
): string {
  if (!faces || faces.length === 0) return programDigest;
  const lines = faces
    .map((face) => `${face.family}\t${face.weight ?? ""}\t${face.style ?? ""}\t${face.sha256}`)
    .sort();
  return sha256Hex(`${programDigest}\n${lines.join("\n")}`);
}

export async function analyzeMediaValue(
  media: MediaValue,
  options: SelectionOptions,
  capabilities: MediaRuntimeCapabilities,
  analysisOptions: SemanticAnalysisOptions = {},
): Promise<SemanticAnalysis> {
  const findings: RuntimeFinding[] = [];
  const programDigest = digestMediaProgram(media);
  const variantId = options.variantId ?? "default";
  const editionId = options.editionId ?? "default";
  const baseCoordinates = { variantId, editionId } satisfies RuntimeMediaCoordinates;

  if (isInteractiveMediaValue(media)) {
    const size = media.size;
    if (size !== undefined && !validSize(size.width, size.height)) {
      findings.push(finding(
        "error",
        "interactive",
        "INTERACTIVE_SIZE_INVALID",
        "Interactive media size must contain positive integer width and height",
      ));
    }
    findings.push(finding(
      "info",
      "interactive",
      "INTERACTIVE_HOST_DRIVEN",
      "Interactive media is host-driven; check and inspect do not execute actions or navigation",
    ));
    return freezeAnalysis({
      programDigest,
      kind: "interactive",
      ...(size !== undefined && validSize(size.width, size.height)
        ? {
            config: {
              medium: "html",
              animated: true,
              width: size.width,
              height: size.height,
            },
          }
        : {}),
      coordinates: [baseCoordinates],
      findings,
      metadata: {
        deterministicArtifacts: false,
        hasSample: media.sample !== undefined,
      },
      selections: [],
    });
  }

  if (!isDeterministicMediaValue(media) && !isCollectionMediaValue(media)) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_VALUE_INVALID",
      "Expected a media, collection, or interactive value authored by SuperImg",
    ));
    return freezeAnalysis({
      programDigest,
      kind: "image",
      coordinates: [baseCoordinates],
      findings,
      selections: [],
    });
  }

  const collection = isCollectionMediaValue(media) ? media : undefined;
  const definition = (collection?.media ?? media) as DeterministicMediaValue;
  validateVariantAndEdition(definition, options, findings);

  let collectionInspection: CollectionInspection | undefined;
  let entries: readonly RuntimeCollectionEntry[] | null = null;
  if (collection) {
    entries = analysisOptions.entries ?? collectionEntries(collection, findings);
    if (entries === null) {
      collectionInspection = { source: "provider", resolved: false };
      findings.push(finding(
        "info",
        "collection",
        "COLLECTION_PROVIDER_DEFERRED",
        "Collection provider execution is deferred unless the caller explicitly requests it",
      ));
    } else {
      collectionInspection = {
        source: Array.isArray(collection.entries) ? "static" : "provider",
        resolved: true,
        entryCount: entries.length,
        entryIds: entries.map((entry) => entry.entryId),
      };
      if (entries.length === 0) {
        findings.push(finding(
          "error",
          "collection",
          "COLLECTION_EMPTY",
          "A deterministic collection must contain at least one entry",
        ));
      }
      const selected = selectCollectionEntries(entries, options.entryId);
      if (options.entryId !== undefined && selected.length === 0) {
        findings.push(finding(
          "error",
          "collection",
          "COLLECTION_ENTRY_UNKNOWN",
          `Unknown collection entry ${JSON.stringify(options.entryId)}`,
        ));
      }
    }
  }

  const selections = analysisOptions.selections ?? await selectSemanticValues(
    media, options, entries, findings, analysisOptions,
  );
  const selectedDefinition = selections[0]?.media ?? selectDefinition(definition, options, findings);
  const config = analysisOptions.resolve === false && selectedDefinition.resolve !== undefined
    ? undefined
    : inspectConfig(selectedDefinition, findings);
  inspectAssetsAndFonts(selectedDefinition, findings);
  const coordinates = selections.length > 0
    ? selections.map((selection) => selection.coordinates)
    : collection && entries === null && options.entryId !== undefined
      ? [{ entryId: options.entryId, variantId, editionId }]
      : collection
        ? []
        : [baseCoordinates];

  if (selectedDefinition.medium === "html" && !capabilities.documents.includes("html")) {
    findings.push(finding(
      "warning",
      "capability",
      "HTML_DOCUMENT_UNAVAILABLE",
      "This runtime cannot produce HTML documents, but semantic inspection remains available",
    ));
  }
  if (selectedDefinition.medium === "svg" && !capabilities.documents.includes("svg")) {
    findings.push(finding(
      "warning",
      "capability",
      "SVG_DOCUMENT_UNAVAILABLE",
      "This runtime cannot produce SVG documents, but semantic inspection remains available",
    ));
  }

  return sampleMediaAnalysis(freezeAnalysis({
    programDigest,
    kind: collection ? "collection" : definition.media,
    ...(config !== undefined ? { config } : {}),
    coordinates,
    findings,
    ...(collectionInspection !== undefined ? { collection: collectionInspection } : {}),
    selections,
  }), options, analysisOptions);
}

/** @internal Add operation-specific samples to one already-resolved analysis. */
export async function sampleMediaAnalysis(
  analysis: SemanticAnalysis,
  options: SelectionOptions,
  analysisOptions: Pick<SemanticAnalysisOptions, "sample" | "captureSample" | "craft" | "signal">,
): Promise<SemanticAnalysis> {
  const findings = [...analysis.findings];
  const selections = analysis.selections;
  const samples = analysisOptions.sample === false
    ? []
    : await sampleSelections(
      selections,
      options,
      findings,
      analysisOptions.captureSample === true,
      analysisOptions.signal,
    );
  if (analysisOptions.craft === true) inspectCraft(selections, findings);
  return freezeAnalysis({
    ...analysis,
    findings,
    ...(samples.length > 0 ? { coverage: mergeTechnicalCoverage(samples.map(sample => sample.coverage as unknown as RuntimeTechnicalCoverage)) } : {}),
    ...(samples.length > 0 ? { metadata: { samples } } : {}),
  });
}

/**
 * Build the same destination matrix as platform adapters and semantically
 * probe every planned rendition at its exact canvas and still-frame time.
 */
export async function analyzeExportMediaValue(
  media: ExportableMedia,
  options: ExportOptions,
  capabilities: MediaRuntimeCapabilities,
  entries: readonly RuntimeCollectionEntry[] | null,
): Promise<SemanticAnalysis> {
  const base = await analyzeMediaValue(media, {}, capabilities, {
    sample: false,
    resolve: false,
    ...(entries !== null ? { entries } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  const findings = [...base.findings];
  if (isCollectionMediaValue(media) && entries === null) return base;

  const definition = deterministicDefinition(media);
  const plannedMedia = !isCollectionMediaValue(media) && options.data !== undefined
    ? Object.freeze({
        ...media,
        sample: Object.freeze({
          ...((media.sample ?? {}) as JsonObject),
          ...options.data,
        }),
      }) as ExportableMedia
    : media;
  const plannedEntries = entries !== null && isCollectionMediaValue(media)
    ? entries.map((entry) => {
        const data = options.data === undefined
          ? entry.data
          : Object.freeze({ ...entry.data, ...options.data }) as JsonObject;
        return {
          id: entry.entryId,
          data,
          dataDigest: digestData(data),
        };
      })
    : undefined;

  let renditions: readonly PlannedRendition<JsonObject>[];
  try {
    const runPlan = (at: ExportOptions["at"]) => planMediaExport<JsonObject>({
      sourceId: base.programDigest,
      definition: plannedMedia as never,
      ...(plannedEntries !== undefined ? { entries: plannedEntries } : {}),
      targets: options.for.map(plannerExportTarget),
      selector: {
        ...(options.entryIds !== undefined ? { entryIds: options.entryIds } : {}),
        ...(options.variantIds !== undefined ? { variantIds: options.variantIds } : {}),
      },
      ...(options.encoding !== undefined ? { encoding: options.encoding } : {}),
      ...(at !== undefined ? { stillFrame: { kind: "at", at } } : {}),
    });
    if (options.at !== undefined) {
      renditions = runPlan(options.at).renditions;
    } else {
      try {
        renditions = runPlan(undefined).renditions;
      } catch (error) {
        if (
          definition.poster === undefined ||
          !(error instanceof ExportPlannerError) ||
          error.code !== "EXPORT_STILL_FRAME_REQUIRED"
        ) {
          throw error;
        }
        renditions = runPlan(definition.poster).renditions;
      }
    }
  } catch (error) {
    findings.push(finding(
      "error",
      "authoring",
      error instanceof ExportPlannerError ? error.code : "EXPORT_PLAN_INVALID",
      error instanceof Error ? error.message : "Export targets could not be planned",
    ));
    return freezeAnalysis({ ...base, findings });
  }

  if (options.editionIds !== undefined) {
    const known = new Set(["default", ...Object.keys(definition.editions ?? {})]);
    for (const editionId of options.editionIds) {
      if (!known.has(editionId)) {
        findings.push(finding(
          "error",
          "authoring",
          "EXPORT_EDITION_UNKNOWN",
          `Unknown media edition ${JSON.stringify(editionId)}`,
        ));
      }
    }
    renditions = renditions.filter((rendition) =>
      options.editionIds!.includes(rendition.coordinates.editionId)
    );
    if (renditions.length === 0 && !findings.some((item) => item.code === "EXPORT_EDITION_UNKNOWN")) {
      findings.push(finding(
        "error",
        "authoring",
        "EXPORT_EDITION_NOT_SELECTED",
        "No requested target selects one of the requested exact-aspect editions",
      ));
    }
  }

  const selections = new Map<string, RuntimeMediaSelection>();
  const coordinates = new Map<string, RuntimeMediaCoordinates>();
  const sampleRecords: JsonObject[] = [];
  const sampledRenditions = new Set<string>();
  for (const rendition of renditions) {
    const runtimeCoordinates = withoutSourceCoordinates(rendition.coordinates);
    const coordinateKey = semanticCoordinateKey(runtimeCoordinates);
    coordinates.set(coordinateKey, runtimeCoordinates);
    let selection: RuntimeMediaSelection;
    try {
      const selected = selections.get(coordinateKey) ?? await resolveRuntimeSelection({
        ...selectRuntimeMedia(plannedMedia, {
          ...(runtimeCoordinates.entryId !== undefined
            ? { entryId: runtimeCoordinates.entryId }
            : {}),
          variant: runtimeCoordinates.variantId,
          edition: runtimeCoordinates.editionId,
        }, entries ?? undefined),
        data: Object.freeze({ ...rendition.data }),
      }, options.signal);
      const isNewSelection = !selections.has(coordinateKey);
      selection = selected;
      selections.set(coordinateKey, selection);
      if (isNewSelection) {
        appendResolvedCueFindings(selection, findings);
      }
    } catch (error) {
      findings.push(authoredRenderFailureFinding(error, runtimeCoordinates, {
        stage: "selection",
        renditionId: rendition.coordinates.renditionId,
      }));
      continue;
    }

    const sampleKey = JSON.stringify([
      coordinateKey,
      rendition.canvas.width,
      rendition.canvas.height,
      rendition.stillFrame?.at ?? 0,
      rendition.dataDigest,
    ]);
    if (sampledRenditions.has(sampleKey)) continue;
    sampledRenditions.add(sampleKey);
    const sampled = await sampleSelection(selection, {}, findings, false, options.signal, {
      width: rendition.canvas.width,
      height: rendition.canvas.height,
      ...(rendition.stillFrame !== undefined ? { at: rendition.stillFrame.at as SelectionOptions["at"] } : {}),
      details: {
        renditionId: rendition.coordinates.renditionId,
        format: rendition.format,
        width: rendition.canvas.width,
        height: rendition.canvas.height,
      },
    });
    if (sampled !== undefined) sampleRecords.push(sampled);
  }

  return freezeAnalysis({
    ...base,
    ...(selections.size > 0
      ? { config: inspectConfig(selections.values().next().value!.media, findings) }
      : {}),
    coordinates: [...coordinates.values()],
    findings,
    selections: [...selections.values()],
    ...(sampleRecords.length > 0 ? { coverage: mergeTechnicalCoverage(sampleRecords.map(sample => sample.coverage as unknown as RuntimeTechnicalCoverage)) } : {}),
    ...(sampleRecords.length > 0 ? { metadata: { samples: sampleRecords } } : {}),
  });
}

/** Attach schema-0, host-neutral semantic IR summaries to an inspection. */
export async function includeSemanticIR(
  analysis: SemanticAnalysis,
  signal?: AbortSignal,
): Promise<SemanticAnalysis> {
  if (analysis.selections.length === 0) return analysis;
  const findings = [...analysis.findings];
  const semanticIR: JsonObject[] = [];
  for (const selection of analysis.selections) {
    if (signal?.aborted === true) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    try {
      const result = await resolveMediaIR(selection.media as unknown as AnyTemplateModule, {
        ...(selection.preparedResolve !== undefined ? { preparedResolve: selection.preparedResolve } : {}),
        data: selection.data,
        sourceId: analysis.programDigest,
        programHash: analysis.programDigest,
        ...(selection.coordinates.entryId !== undefined
          ? { entryId: selection.coordinates.entryId }
          : {}),
        variantId: selection.coordinates.variantId,
        editionId: selection.coordinates.editionId,
        ...(signal !== undefined ? { signal } : {}),
      });
      semanticIR.push(semanticIRSummary(result.ir, selection.coordinates));
    } catch (error) {
      if (runtimeSignalAborted(signal)) throw error;
      findings.push({
        severity: "error",
        category: "render",
        code: "SEMANTIC_IR_FAILED",
        message: error instanceof Error ? error.message : "Media IR compilation failed",
        coordinates: selection.coordinates,
      });
    }
  }
  return freezeAnalysis({
    ...analysis,
    findings,
    metadata: {
      ...(analysis.metadata ?? {}),
      semanticIR,
    },
  });
}

function collectionEntries(
  collection: Extract<MediaValue, { readonly kind: "collection" }>,
  findings: RuntimeFinding[],
): readonly RuntimeCollectionEntry[] | null {
  try {
    return staticCollectionEntries(collection);
  } catch (error) {
    findings.push(finding(
      "error",
      "collection",
      "COLLECTION_SNAPSHOT_INVALID",
      error instanceof Error ? error.message : "Static collection entries are invalid",
    ));
    return [];
  }
}

function selectCollectionEntries(
  entries: readonly RuntimeCollectionEntry[],
  entryId: string | undefined,
): readonly RuntimeCollectionEntry[] {
  return entryId === undefined
    ? entries
    : entries.filter((entry) => entry.entryId === entryId);
}

function appendResolvedCueFindings(
  selection: RuntimeMediaSelection,
  findings: RuntimeFinding[],
): void {
  const cueFindings = selection.preparedResolve?.resolved?.cueFindings;
  if (!cueFindings || cueFindings.length === 0) return;
  for (const cueFinding of cueFindings) {
    findings.push(Object.freeze({
      severity: cueFinding.severity ?? "error",
      category: "authoring",
      code: cueFinding.code ?? "SCRIPT_CUE_FINDING",
      message: cueFinding.message,
      coordinates: selection.coordinates,
      details: Object.freeze({
        blockId: cueFinding.id,
        nodeId: cueFinding.id,
      }),
    }));
  }
}

async function selectSemanticValues(
  media: import("@superimg/types").ExportableMedia,
  options: SelectionOptions,
  entries: readonly RuntimeCollectionEntry[] | null,
  findings: RuntimeFinding[],
  analysisOptions: SemanticAnalysisOptions,
): Promise<readonly RuntimeMediaSelection[]> {
  if (isCollectionMediaValue(media) && entries === null) return [];
  const entryIds = isCollectionMediaValue(media)
    ? selectCollectionEntries(entries ?? [], options.entryId).map((entry) => entry.entryId)
    : [undefined];
  const selections: RuntimeMediaSelection[] = [];
  for (const entryId of entryIds) {
    try {
      const selected = selectRuntimeMedia(media, {
        ...(options.data !== undefined ? { data: options.data as JsonObject } : {}),
        ...(entryId !== undefined ? { entryId } : {}),
        ...(options.variantId !== undefined ? { variant: options.variantId } : {}),
        ...(options.editionId !== undefined ? { edition: options.editionId } : {}),
      }, entries ?? undefined);
      const resolvedSelection = analysisOptions.resolve === false
        ? selected
        : await resolveRuntimeSelection(selected, analysisOptions.signal);
      selections.push(resolvedSelection);
      appendResolvedCueFindings(resolvedSelection, findings);
    } catch (error) {
      // Unknown variants/editions and entries already have dedicated findings.
      if (!selectionErrorAlreadyReported(error, findings)) {
        findings.push(finding(
          "error",
          "authoring",
          "MEDIA_SELECTION_INVALID",
          error instanceof Error ? error.message : "Media selection is invalid",
        ));
      }
      break;
    }
  }
  return Object.freeze(selections);
}

function selectDefinition(
  definition: DeterministicMediaValue,
  options: SelectionOptions,
  findings: RuntimeFinding[],
): DeterministicMediaValue {
  try {
    return selectRuntimeMedia(definition as never, {
      ...(options.data !== undefined ? { data: options.data as JsonObject } : {}),
      ...(options.variantId !== undefined ? { variant: options.variantId } : {}),
      ...(options.editionId !== undefined ? { edition: options.editionId } : {}),
    }).media;
  } catch (error) {
    if (!selectionErrorAlreadyReported(error, findings)) {
      findings.push(finding(
        "error",
        "authoring",
        "MEDIA_SELECTION_INVALID",
        error instanceof Error ? error.message : "Media selection is invalid",
      ));
    }
    return definition;
  }
}

function selectionErrorAlreadyReported(error: unknown, findings: readonly RuntimeFinding[]): boolean {
  const message = error instanceof Error ? error.message : "";
  return (message.startsWith("Unknown media variant") && findings.some((item) => item.code === "MEDIA_VARIANT_UNKNOWN")) ||
    (message.startsWith("Unknown media edition") && findings.some((item) => item.code === "MEDIA_EDITION_UNKNOWN")) ||
    (message.startsWith("Unknown collection entry") && findings.some((item) => item.code === "COLLECTION_ENTRY_UNKNOWN"));
}

function inspectConfig(
  media: ReturnType<typeof deterministicDefinition>,
  findings: RuntimeFinding[],
): RuntimeMediaConfig {
  const config = media.config ?? {};
  const width = config.width ?? 1920;
  const height = config.height ?? 1080;
  if (!validSize(width, height)) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_SIZE_INVALID",
      "Media width and height must be positive integers",
    ));
  }

  if (!media.animated) {
    return Object.freeze({
      medium: media.medium,
      animated: false,
      width,
      height,
    });
  }

  const fps = config.fps ?? 30;
  let durationSeconds: number | undefined;
  try {
    durationSeconds = parseDuration(config.duration, "duration", fps);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      throw new TypeError("duration must be positive");
    }
  } catch (error) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_DURATION_INVALID",
      error instanceof Error ? error.message : "Media duration is invalid",
    ));
  }
  if (!Number.isInteger(fps) || fps <= 0) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_FPS_INVALID",
      "Animated media fps must be a positive integer",
    ));
  }
  return Object.freeze({
    medium: media.medium,
    animated: true,
    width,
    height,
    fps,
    ...(durationSeconds !== undefined
      ? {
          durationSeconds,
          totalFrames: media.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(durationSeconds * fps)),
        }
      : {}),
  });
}

function deterministicDefinition(
  media: MediaValue,
): DeterministicMediaValue {
  return isCollectionMediaValue(media) ? media.media : media as DeterministicMediaValue;
}

function inspectAssetsAndFonts(
  media: ReturnType<typeof deterministicDefinition>,
  findings: RuntimeFinding[],
): void {
  for (const [name, declaration] of Object.entries(media.config?.assets ?? {})) {
    if ("url" in declaration) {
      try {
        const value = declaration.url instanceof URL
          ? declaration.url
          : new URL(declaration.url);
        if (value.protocol !== "http:" && value.protocol !== "https:" && value.protocol !== "data:" && value.protocol !== "file:") {
          throw new TypeError("unsupported URL protocol");
        }
      } catch {
        findings.push(finding(
          "error",
          "asset",
          "ASSET_URL_INVALID",
          `Asset ${JSON.stringify(name)} must declare an absolute HTTP, HTTPS, file, or data URL`,
        ));
      }
    } else if (!(declaration.bytes instanceof Uint8Array) || declaration.bytes.byteLength === 0) {
      findings.push(finding(
        "error",
        "asset",
        "ASSET_BYTES_INVALID",
        `Asset ${JSON.stringify(name)} must declare non-empty Uint8Array bytes`,
      ));
    } else if (!declaration.mimeType.includes("/")) {
      findings.push(finding(
        "error",
        "asset",
        "ASSET_MIME_INVALID",
        `Asset ${JSON.stringify(name)} must declare a MIME type`,
      ));
    }
  }

  for (const request of media.config?.fonts ?? []) {
    const issue = fontDeclarationIssue(request);
    if (issue) {
      findings.push(finding("error", "font", issue.code, issue.message));
    }
  }
}

function validateVariantAndEdition(
  media: ReturnType<typeof deterministicDefinition>,
  options: SelectionOptions,
  findings: RuntimeFinding[],
): void {
  if (options.variantId !== undefined &&
      options.variantId !== "default" &&
      media.variants?.[options.variantId] === undefined) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_VARIANT_UNKNOWN",
      `Unknown media variant ${JSON.stringify(options.variantId)}`,
    ));
  }
  if (options.editionId !== undefined &&
      options.editionId !== "default" &&
      media.editions?.[options.editionId] === undefined) {
    findings.push(finding(
      "error",
      "authoring",
      "MEDIA_EDITION_UNKNOWN",
      `Unknown media edition ${JSON.stringify(options.editionId)}`,
    ));
  }
}

async function sampleSelections(
  selections: readonly RuntimeMediaSelection[],
  options: SelectionOptions,
  findings: RuntimeFinding[],
  capture: boolean,
  signal?: AbortSignal,
): Promise<JsonObject[]> {
  const samples: JsonObject[] = [];
  for (const selected of selections) {
    const sample = await sampleSelection(selected, options, findings, capture, signal);
    if (sample !== undefined) samples.push(sample);
  }
  return samples;
}

async function sampleSelection(
  selected: RuntimeMediaSelection,
  options: SelectionOptions,
  findings: RuntimeFinding[],
  capture: boolean,
  signal: AbortSignal | undefined,
  override: SemanticSampleOverride = {},
): Promise<JsonObject | undefined> {
  const config = selected.media.config ?? {};
  const fps = config.fps ?? 30;
  let durationSeconds = 0;
  try {
    durationSeconds = selected.media.animated
      ? parseDuration(config.duration, "duration", fps)
      : 0;
  } catch {
    // inspectConfig already records the stable authored duration finding.
    return undefined;
  }

  let seconds = 0;
  try {
    const at = override.at ?? options.at;
    seconds = at === undefined ? 0 : parseRuntimeAt(at, fps);
  } catch (error) {
    findings.push({
      severity: "error",
      category: "render",
      code: "RENDER_TIME_INVALID",
      message: error instanceof Error ? error.message : "Render time is invalid",
      coordinates: selected.coordinates,
      ...(override.details !== undefined ? { details: override.details } : {}),
    });
    return undefined;
  }
  const totalFrames = selected.media.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(durationSeconds * fps));
  const frame = resolveEncodedFrame(seconds, fps, totalFrames).frame;
  const progress = totalFrames <= 1 ? 0 : frame / (totalFrames - 1);

  try {
    const width = override.width ?? config.width ?? 1920;
    const height = override.height ?? config.height ?? 1080;
    const preparedStdlib = await raceSignal(createPreparedStdlibForTemplate(
      selected.media as unknown as AnyTemplateModule,
    ), signal);
    const measurer = await textMeasurerForDeclarations(selected.media.config?.fonts, signal);
    const rendered = renderTemplateFrame({
      template: selected.media as unknown as AnyTemplateModule,
      frame,
      fps,
      durationSeconds,
      totalFrames,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      data: selected.data,
      composite: false,
      preparedStdlib,
      ...(measurer !== undefined ? { measurer } : {}),
    });
    const background = stageBackground(selected.media.config?.background);
    const technical = analyzeTechnicalFrame({
      frame: rendered.frame, progress, width, height, html: rendered.html,
      ...(rendered.tree ? { nodes: walkMediaTree(rendered.tree, { width, height, ...(measurer ? { measurer } : {}) }) } : {}),
      ...(background !== undefined ? { background } : {}),
    });
    findings.push(...technicalRuntimeFindings(technical, selected.coordinates).map(finding => ({
      ...finding,
      ...(override.details ? { details: { ...finding.details, ...override.details } } : {}),
    })));
    if (!selected.media.animated && rendered.lane === "html" && rendered.browserReasons.length > 0) {
      const reasons = rendered.browserReasons.map((item) =>
        item.nodeId ? `${item.reason}#${item.nodeId}` : item.reason,
      );
      findings.push({
        severity: "info",
        category: "render",
        code: "NEEDS_BROWSER",
        message: `Still needs a browser (${reasons.join(", ")})`,
        coordinates: selected.coordinates,
        details: { reasons },
      });
    }
    return {
      coordinates: runtimeCoordinatesJson(selected.coordinates),
      frame: rendered.frame,
      progress,
      seconds,
      lane: rendered.lane,
      htmlByteLength: new TextEncoder().encode(rendered.html).byteLength,
      hasSemanticTree: rendered.tree !== undefined,
      coverage: toJsonObject({ ...technical.coverage, samples: technical.coverage.samples.map(sample => ({ ...sample, coordinates: selected.coordinates })) }),
      ...(override.details !== undefined ? { rendition: { ...override.details } } : {}),
      ...(capture ? { html: rendered.html } : {}),
      ...(capture && rendered.tree !== undefined
        ? { tree: toJsonObject(rendered.tree) }
        : {}),
    };
  } catch (error) {
    if (isAbortError(error, signal)) throw cancellationError(error);
    findings.push(authoredRenderFailureFinding(error, selected.coordinates, override.details));
    return undefined;
  }
}

/** Stable adapter-facing taxonomy for authored render exceptions. */
export function authoredRenderFailureFinding(
  error: unknown,
  coordinates: RuntimeMediaCoordinates,
  details?: Readonly<JsonObject>,
): RuntimeFinding {
  return Object.freeze({
    severity: "error",
    category: "render",
    code: "RENDER_EXCEPTION",
    message: error instanceof Error ? error.message : "Media render threw",
    coordinates,
    ...(details !== undefined ? { details } : {}),
  });
}

function plannerExportTarget(target: string | ExportRenditionRequest): string | DestinationTarget {
  if (typeof target === "string") return target;
  return {
    kind: "custom",
    id: target.id,
    width: target.width,
    height: target.height,
    format: target.format,
    ...(target.encoding !== undefined ? { encoding: target.encoding } : {}),
  };
}

function withoutSourceCoordinates(value: PlannedRendition<JsonObject>["coordinates"]): RuntimeMediaCoordinates {
  return Object.freeze({
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  });
}

function semanticCoordinateKey(value: RuntimeMediaCoordinates): string {
  return JSON.stringify([value.entryId ?? null, value.variantId, value.editionId]);
}

function inspectCraft(
  selections: readonly RuntimeMediaSelection[],
  findings: RuntimeFinding[],
): void {
  for (const selection of selections) {
    if (!selection.media.animated) continue;
    try {
      const report = critiqueTemplate(selection.media as unknown as AnyTemplateModule, {
        data: selection.data,
        source: Function.prototype.toString.call(selection.media.render),
      });
      for (const issue of report.issues) {
        findings.push({
          severity: issue.severity,
          category: "render",
          code: `CRAFT_${issue.code}`,
          message: issue.message,
          suggestion: issue.suggestion,
          coordinates: selection.coordinates,
          ...((issue.phase !== undefined || issue.progress !== undefined)
            ? {
                details: {
                  ...(issue.phase !== undefined ? { phase: issue.phase } : {}),
                  ...(issue.progress !== undefined ? { progress: issue.progress } : {}),
                },
              }
            : {}),
        });
      }
    } catch (error) {
      if (!findings.some((item) =>
        item.code === "RENDER_EXCEPTION" && sameCoordinates(item.coordinates, selection.coordinates)
      )) {
        findings.push({
          severity: "error",
          category: "render",
          code: "CRAFT_EVALUATION_FAILED",
          message: error instanceof Error ? error.message : "Motion craft evaluation failed",
          coordinates: selection.coordinates,
        });
      }
    }
  }
}

function semanticIRSummary(
  ir: Awaited<ReturnType<typeof resolveMediaIR>>["ir"],
  coordinates: RuntimeMediaCoordinates,
): JsonObject {
  return toJsonObject({
    kind: "@foxworth/superimg/runtime-semantic-ir",
    schemaVersion: 0,
    programDigest: ir.provenance.programHash,
    coordinates: runtimeCoordinatesJson(coordinates),
    medium: ir.medium,
    animated: ir.animated,
    canvas: ir.canvas,
    clock: ir.clock,
    capabilities: ir.capabilities,
    scenes: ir.scenes,
    tracks: ir.tracks.map(({ src: _src, ...track }) => track),
    motions: ir.motions,
    assets: ir.assets.map(({ src: _src, ...asset }) => asset),
    observations: ir.observations,
    hashes: ir.hashes,
    extensions: ir.extensions,
  });
}

function runtimeCoordinatesJson(value: RuntimeMediaCoordinates): JsonObject {
  return {
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  };
}

function sameCoordinates(
  left: RuntimeMediaCoordinates | undefined,
  right: RuntimeMediaCoordinates,
): boolean {
  return left?.entryId === right.entryId &&
    left?.variantId === right.variantId &&
    left?.editionId === right.editionId;
}

function toJsonObject(value: unknown): JsonObject {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return {};
  return JSON.parse(serialized) as JsonObject;
}

function runtimeSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

export function parseRuntimeAt(
  value: number | string,
  fps: number,
): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new TypeError("Render time must be finite and non-negative");
    return value;
  }
  return parseDuration(value, "at", fps);
}

function validSize(width: number, height: number): boolean {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0;
}

function finding(
  severity: RuntimeFinding["severity"],
  category: RuntimeFinding["category"],
  code: string,
  message: string,
): RuntimeFinding {
  return Object.freeze({ severity, category, code, message });
}

function freezeAnalysis(analysis: SemanticAnalysis): SemanticAnalysis {
  return Object.freeze({
    ...analysis,
    coordinates: Object.freeze([...analysis.coordinates]),
    findings: Object.freeze([...analysis.findings]),
    ...(analysis.collection === undefined ? {} : { collection: Object.freeze(analysis.collection) }),
    ...(analysis.metadata === undefined ? {} : { metadata: Object.freeze(analysis.metadata) }),
  });
}

function stableProgramText(value: unknown): string {
  const seen = new WeakSet<object>();
  const encode = (input: unknown): unknown => {
    if (input instanceof Uint8Array) {
      return { $bytes: sha256Hex(input), byteLength: input.byteLength };
    }
    if (typeof URL !== "undefined" && input instanceof URL) return { $url: input.href };
    if (typeof input === "function") return { $function: Function.prototype.toString.call(input) };
    if (Array.isArray(input)) return input.map(encode);
    if (typeof input !== "object" || input === null) return input;
    if (seen.has(input)) throw new TypeError("Media values must not contain cyclic program state");
    seen.add(input);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      out[key] = encode((input as Record<string, unknown>)[key]);
    }
    seen.delete(input);
    return out;
  };
  return JSON.stringify(encode(value));
}
