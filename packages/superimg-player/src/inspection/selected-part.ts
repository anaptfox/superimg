//! A read-only join. Identity and editability never confer authority to execute.
import type { EditManifest, EditSourceBinding, MediaCoordinates, MediaEditCommand } from "@superimg/types";
import type { PreviewNode, PreviewSnapshot } from "./types.js";

export interface SelectedPartCompilation {
  readonly source: string;
  readonly sourceRevision: string;
  readonly surfaceId: string;
  readonly generation: number;
  readonly presentedRevision: number;
  readonly coordinates: MediaCoordinates;
  readonly acceptedCoordinates: MediaCoordinates;
  readonly manifest: EditManifest;
  readonly sourceHashes: Readonly<Record<string, string>>;
}

export interface SelectedPart {
  readonly node: PreviewNode | null;
  readonly state: "editable" | "inspect-only" | "opaque";
  readonly reason?: string;
  readonly bindings: readonly EditSourceBinding[];
  readonly compilation: SelectedPartCompilation;
}

const coordinateKey = (c: MediaCoordinates) => JSON.stringify([c.sourceId, c.entryId ?? null, c.variantId, c.editionId]);

export function describeSelectedPart(input: {
  readonly snapshot: PreviewSnapshot;
  readonly target: { readonly id: string; readonly occurrence: string | null };
  readonly compilation: SelectedPartCompilation;
}): SelectedPart {
  const { snapshot: s, compilation: c } = input;
  const result = (node: PreviewNode | null, state: SelectedPart["state"], reason: string | undefined, bindings: readonly EditSourceBinding[] = []): SelectedPart =>
    Object.freeze({ node, state, ...(reason ? { reason } : {}), bindings: Object.freeze([...bindings]), compilation: c });
  if (s.disposed || s.surfaceId !== c.surfaceId || s.source?.id !== c.acceptedCoordinates.sourceId || s.source?.revision !== c.sourceRevision || s.generation !== c.generation || s.presented?.revision !== c.presentedRevision || s.readiness.status !== "ready") {
    return result(null, "inspect-only", "stale-or-unready-presentation");
  }
  if (coordinateKey(c.coordinates) !== coordinateKey(c.acceptedCoordinates) || coordinateKey(c.manifest.coordinates) !== coordinateKey(c.coordinates)) {
    return result(null, "inspect-only", "coordinate-mismatch");
  }
  const matches = s.nodes.filter(n => n.id === input.target.id && n.occurrence === input.target.occurrence);
  if (matches.length !== 1) return result(null, "inspect-only", matches.length ? "ambiguous-target" : "missing-target");
  const node = matches[0]!;
  // Root source bindings do not prove provenance of an imported/repeated child.
  if (node.occurrence !== null) return result(node, "inspect-only", "occurrence-source-binding-unavailable");
  const ids = new Set([node.id, ...(node.sceneId ? [`${node.sceneId}::${node.id}`] : [])]);
  const bindings = c.manifest.bindings.filter(b => ids.has(b.targetId));
  if (!bindings.length) return result(node, "opaque", "source-binding-unavailable");
  return result(node, bindings.some(b => b.capability === "exact") ? "editable" : "inspect-only", undefined, bindings);
}

/** Construct the existing native command; the host still admits each invocation. */
export function selectedPartTransform(part: SelectedPart, value: { readonly x: number; readonly y: number }): MediaEditCommand {
  if (part.state !== "editable" || !Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new Error(part.reason ?? "Transform is not editable");
  const x = part.bindings.filter(b => b.propertyPath === "initial.transform.x" && b.capability === "exact");
  const y = part.bindings.filter(b => b.propertyPath === "initial.transform.y" && b.capability === "exact");
  if (x.length !== 1 || y.length !== 1 || x[0]!.targetId !== y[0]!.targetId) throw new Error("Transform requires two unambiguous exact source bindings");
  return { schemaVersion: 0, source: part.compilation.source, kind: "set-node-transform",
    target: { nodeId: x[0]!.targetId, xBindingId: x[0]!.bindingId, yBindingId: y[0]!.bindingId },
    value: { ...value }, expected: { intentHash: part.compilation.manifest.intentHash, sourceHashes: { ...part.compilation.sourceHashes } } };
}
