import {
  digestData,
  ExportPlannerError,
  planMediaExport,
  type PlannedRendition,
} from "@superimg/core/export";
import type { RuntimeCollectionEntry, RuntimeMediaSelection } from "@superimg/core/runtime";
import type {
  DeterministicMediaDefinition,
  ExportOptions,
  ExportRenditionRequest,
  ExportableMedia,
  JsonObject,
  MediaRuntimeCapabilities,
  RuntimeFinding,
  RuntimeMediaCoordinates,
} from "@superimg/types";

export interface PreparedExportPlan {
  readonly selections?: readonly RuntimeMediaSelection[];
  readonly definition: DeterministicMediaDefinition<JsonObject>;
  readonly renditions: readonly PlannedRendition<JsonObject>[];
  readonly coordinates: readonly RuntimeMediaCoordinates[];
}

export function prepareExportPlan(input: {
  readonly programDigest: string;
  readonly media: ExportableMedia;
  readonly options: ExportOptions;
  readonly entries?: readonly RuntimeCollectionEntry[];
  readonly capabilities: MediaRuntimeCapabilities;
  readonly selections?: readonly RuntimeMediaSelection[];
}): { readonly plan?: PreparedExportPlan; readonly findings: readonly RuntimeFinding[] } {
  const definition = deterministicDefinition(input.media);
  const findings: RuntimeFinding[] = [];
  try {
    appendEmptySelectorFindings(input.options, findings);
    const raw = planRuntimeExport(input, definition);
    const requestedEditions = input.options.editionIds;
    if (requestedEditions !== undefined) {
      const known = new Set(["default", ...Object.keys(definition.editions ?? {})]);
      for (const editionId of requestedEditions) {
        if (!known.has(editionId)) findings.push(finding("EXPORT_EDITION_UNKNOWN", `Unknown media edition ${JSON.stringify(editionId)}`));
      }
    }
    const renditions = raw.renditions.filter((rendition) => requestedEditions === undefined || requestedEditions.includes(rendition.coordinates.editionId)).map((rendition) => {
      const selected = selectionForRendition(input.selections, rendition);
      return selected === undefined ? rendition : {
        ...rendition, data: selected.data, dataDigest: digestData(selected.data),
      };
    });
    if (requestedEditions !== undefined && renditions.length === 0 && findings.length === 0) {
      findings.push(finding("EXPORT_EDITION_NOT_SELECTED", "No requested target selects one of the requested exact-aspect editions"));
    }
    for (const rendition of renditions) {
      if (!supportsFormat(input.capabilities, rendition.format)) {
        findings.push(Object.freeze({
          severity: "error",
          category: "capability",
          code: "EXPORT_FORMAT_UNAVAILABLE",
          message: `This runtime cannot export ${rendition.format}`,
          coordinates: withoutSource(rendition.coordinates),
        }));
      }
    }
    const coordinates = uniqueCoordinates(renditions.map((rendition) => withoutSource(rendition.coordinates)));
    return Object.freeze({
      findings: Object.freeze(findings),
      ...(findings.some((item) => item.severity === "error") ? {} : {
        plan: Object.freeze({ definition, ...(input.selections !== undefined ? { selections: input.selections } : {}), renditions: Object.freeze(renditions), coordinates }),
      }),
    });
  } catch (error) {
    findings.push(finding("EXPORT_PLAN_INVALID", error instanceof Error ? error.message : "Export targets could not be planned"));
    return Object.freeze({ findings: Object.freeze(findings) });
  }
}

function planRuntimeExport(
  input: {
    readonly programDigest: string;
    readonly media: ExportableMedia;
    readonly options: ExportOptions;
    readonly entries?: readonly RuntimeCollectionEntry[];
  },
  definition: DeterministicMediaDefinition<JsonObject>,
) {
  const runtimeData = input.options.data;
  const plannerMedia = runtimeData === undefined || input.media.kind === "collection"
    ? input.media
    : ({
        ...input.media,
        sample: { ...((input.media.sample ?? {}) as JsonObject), ...runtimeData } as JsonObject,
      } as ExportableMedia);
  const entries = input.entries?.map((entry) => {
    const data = runtimeData === undefined
      ? entry.data
      : Object.freeze({ ...entry.data, ...runtimeData }) as JsonObject;
    return { id: entry.entryId, data, dataDigest: digestData(data) };
  });
  const run = (at?: ExportOptions["at"]) => planMediaExport<JsonObject>({
    sourceId: input.programDigest,
    definition: plannerMedia as never,
    ...(entries !== undefined ? { entries } : {}),
    targets: input.options.for.map(exportTarget),
    ...(input.options.encoding !== undefined ? { encoding: input.options.encoding } : {}),
    selector: {
      ...(input.options.entryIds !== undefined ? { entryIds: input.options.entryIds } : {}),
      ...(input.options.variantIds !== undefined ? { variantIds: input.options.variantIds } : {}),
    },
    ...(at !== undefined ? { stillFrame: { kind: "at" as const, at } } : {}),
  });

  if (input.options.at !== undefined) return run(input.options.at);
  try {
    return run();
  } catch (error) {
    if (
      definition.poster !== undefined &&
      error instanceof ExportPlannerError &&
      error.code === "EXPORT_STILL_FRAME_REQUIRED"
    ) {
      return run(definition.poster);
    }
    throw error;
  }
}

function appendEmptySelectorFindings(options: ExportOptions, findings: RuntimeFinding[]): void {
  if (options.entryIds?.length === 0) {
    findings.push(finding("EXPORT_ENTRY_SELECTOR_EMPTY", "entryIds must contain at least one entry when provided"));
  }
  if (options.variantIds?.length === 0) {
    findings.push(finding("EXPORT_VARIANT_SELECTOR_EMPTY", "variantIds must contain at least one variant when provided"));
  }
  if (options.editionIds?.length === 0) {
    findings.push(finding("EXPORT_EDITION_SELECTOR_EMPTY", "editionIds must contain at least one edition when provided"));
  }
}

export function deterministicDefinition(media: ExportableMedia): DeterministicMediaDefinition<JsonObject> {
  return (media.kind === "collection" ? media.media : media) as DeterministicMediaDefinition<JsonObject>;
}

export function mediaForRendition(
  definition: DeterministicMediaDefinition<JsonObject>,
  rendition: PlannedRendition<JsonObject>,
  selections?: readonly RuntimeMediaSelection[],
): DeterministicMediaDefinition<JsonObject> {
  const selected = selectionForRendition(selections, rendition);
  if (selected !== undefined) return selected.media;
  const editionId = rendition.coordinates.editionId;
  if (editionId === "default") return definition;
  const edition = definition.editions?.[editionId];
  if (edition === undefined) throw new TypeError(`Missing planned edition ${JSON.stringify(editionId)}`);
  return {
    ...definition,
    render: (edition.render ?? definition.render) as DeterministicMediaDefinition<JsonObject>["render"],
    config: { ...definition.config, width: edition.size.width, height: edition.size.height },
  } as DeterministicMediaDefinition<JsonObject>;
}

function selectionForRendition(
  selections: readonly RuntimeMediaSelection[] | undefined,
  rendition: PlannedRendition<JsonObject>,
): RuntimeMediaSelection | undefined {
  if (selections === undefined) return undefined;
  const coordinates = rendition.coordinates;
  const selected = selections.find((candidate) =>
    candidate.coordinates.entryId === coordinates.entryId &&
    candidate.coordinates.variantId === coordinates.variantId &&
    candidate.coordinates.editionId === coordinates.editionId
  );
  if (selected === undefined) throw new TypeError("Missing resolved export selection");
  return selected;
}

export function withoutSource(value: { readonly sourceId: string; readonly entryId?: string; readonly variantId: string; readonly editionId: string }): RuntimeMediaCoordinates {
  return Object.freeze({
    ...(value.entryId !== undefined ? { entryId: value.entryId } : {}),
    variantId: value.variantId,
    editionId: value.editionId,
  });
}

function exportTarget(target: string | ExportRenditionRequest) {
  if (typeof target === "string") return target;
  return {
    kind: "custom" as const,
    id: target.id,
    width: target.width,
    height: target.height,
    format: target.format,
    ...(target.encoding === undefined ? {} : { encoding: target.encoding }),
  };
}

function supportsFormat(capabilities: MediaRuntimeCapabilities, format: PlannedRendition<JsonObject>["format"]): boolean {
  if (format === "html" || format === "svg") return capabilities.documents.includes(format);
  if (format === "png" || format === "jpeg" || format === "webp") return capabilities.rasters.includes(format);
  return capabilities.animated.includes(format);
}

function uniqueCoordinates(values: readonly RuntimeMediaCoordinates[]): readonly RuntimeMediaCoordinates[] {
  const seen = new Set<string>();
  return Object.freeze(values.filter((value) => {
    const key = `${value.entryId ?? ""}\0${value.variantId}\0${value.editionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }));
}

function finding(code: string, message: string): RuntimeFinding {
  return Object.freeze({ severity: "error", category: "authoring", code, message });
}
