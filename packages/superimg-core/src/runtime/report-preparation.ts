//! Native command-owned reuse. Never serialized or accepted as portable options.
import type { CheckOptions, InspectOptions, MediaValue, Runtime } from "@superimg/types";
import type { SemanticAnalysis } from "./semantic.js";

const PREPARED_REPORT = Symbol("superimg.runtime.prepared-report");
type SelectionOptions = CheckOptions | InspectOptions;

export interface PreparedRuntimeReport {
  readonly [PREPARED_REPORT]: true;
  readonly runtime: Runtime;
  readonly media: MediaValue;
  readonly selectionKey: string;
  readonly analysis: SemanticAnalysis;
}

function selectionKey(options: SelectionOptions): string {
  return JSON.stringify([options.entryId ?? null, options.variantId ?? "default",
    options.editionId ?? "default", options.data ?? null, options.providers ?? "skip"]);
}

export function createPreparedRuntimeReport(
  runtime: Runtime,
  media: MediaValue,
  options: SelectionOptions,
  analysis: SemanticAnalysis,
): PreparedRuntimeReport {
  return Object.freeze({ [PREPARED_REPORT]: true as const, runtime, media,
    selectionKey: selectionKey(options), analysis });
}

export function assertPreparedRuntimeReport(
  prepared: PreparedRuntimeReport,
  runtime: Runtime,
  media: MediaValue,
  options: SelectionOptions,
): void {
  if (prepared[PREPARED_REPORT] !== true || prepared.runtime !== runtime ||
      prepared.media !== media || prepared.selectionKey !== selectionKey(options)) {
    throw new Error("Prepared report does not match this runtime, media or selection");
  }
}
