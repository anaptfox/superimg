import { readFileSync } from "node:fs";
import { compileTemplate } from "@superimg/core";
import { bundleMediaProgram } from "@superimg/core/bundler";
import { analyzeMediaSource, type SourceDescriptor } from "@superimg/core/source-analysis";
import { loadCollectionEntries, type ResolvedEntry } from "@superimg/node";
import type { CompileResult } from "@superimg/types";

export interface CollectionCommandSnapshot {
  readonly descriptor: SourceDescriptor;
  readonly entries?: readonly ResolvedEntry<Record<string, unknown>>[];
}

/** Resolve a provider at most once for one CLI command snapshot. */
export async function resolveCollectionCommandSnapshot(
  templatePath: string,
  selectedIds: readonly string[] | undefined,
  defaultSelection: "first" | "all",
): Promise<CollectionCommandSnapshot> {
  const descriptor = analyzeMediaSource(readFileSync(templatePath, "utf8"), templatePath);
  if (descriptor.kind !== "collection") {
    if (selectedIds !== undefined && selectedIds.length > 0) {
      throw new Error("--entry is only valid for deterministic collections");
    }
    return { descriptor };
  }

  const bundle = await bundleMediaProgram(templatePath);
  const compiled = compileTemplate(bundle);
  if (compiled.error) throw compiled.error;
  assertCollectionMediaKind(compiled);

  const resolved = await loadCollectionEntries<Record<string, unknown>>(descriptor);
  const byId = new Map(resolved.map((entry) => [entry.id, entry]));
  const ids = selectedIds !== undefined && selectedIds.length > 0
    ? selectedIds
    : defaultSelection === "first"
      ? [resolved[0]!.id]
      : resolved.map((entry) => entry.id);
  const seen = new Set<string>();
  const entries = ids.map((id) => {
    if (seen.has(id)) throw new Error(`Duplicate --entry ${JSON.stringify(id)}`);
    seen.add(id);
    const entry = byId.get(id);
    if (!entry) throw new Error(`Unknown collection entry ${JSON.stringify(id)}`);
    return entry;
  });
  return { descriptor, entries };
}

/** Classify the browser-safe projection before any server provider executes. */
export function assertCollectionMediaKind(compiled: CompileResult): void {
  if (compiled.interactive) {
    throw new Error("Interactive definitions are singular and cannot be wrapped in collection()");
  }
  if (!compiled.media) {
    throw new Error("collection() requires one deterministic media definition and cannot nest collections");
  }
}
