import type { CortexBundle, JsonObject, VisualAtom } from "@superimg/types";

function atomLabel(atom: VisualAtom): string {
  return atom.label ?? atom.text ?? atom.id ?? atom.kind;
}

function atomValue(atom: VisualAtom): string {
  if (atom.value === undefined) return atom.text ?? "";
  return atom.unit === undefined ? String(atom.value) : `${atom.value}${atom.unit}`;
}

export function cortexSample(bundle: CortexBundle): JsonObject {
  const events = bundle.atoms
    .filter((atom) => atom.kind === "event")
    .map((atom, index) => ({
      id: atom.id ?? `event-${index}`,
      at: atom.at ?? "",
      label: atomLabel(atom),
    }));
  const metrics = bundle.atoms
    .filter((atom) => atom.kind === "metric" || atom.kind === "status")
    .map((atom, index) => ({
      id: atom.id ?? `metric-${index}`,
      label: atomLabel(atom),
      value: atomValue(atom),
    }));
  const evidence = (bundle.evidence ?? []).map((item) => item.label ?? item.id);
  const attention = bundle.brief.emphasis?.[0] ?? "";
  return {
    headline: bundle.brief.question,
    intent: bundle.brief.intent,
    events,
    metrics,
    evidence,
    attention,
  };
}
