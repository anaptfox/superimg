import { Frame, Fill, Image, Text } from "../tree/primitives.js";
import { isMediaElement } from "../tree/h.js";
import type { MediaElement } from "../tree/node-types.js";
import { ArrangeError } from "./error.js";
import type {
  ArrangeBase,
  ArrangeFailure,
  EvidenceKind,
  Specimen,
  SrcView,
} from "./types.js";

export const PAPER = "#F5F2EA";
export const INK = "#1C1E22";
export const MUTED = "#625E54";
export const HAIR = "rgba(28,30,34,0.14)";
export const ACCENT = "#1C1E22";

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  observation: "Observed",
  derived: "Derived",
  interpretation: "Interpreted",
  proposal: "Proposed",
};

export const DEFAULT_SIZE = { width: 1080, height: 1080 };

export function fail(code: ArrangeFailure["code"], message: string): ArrangeFailure {
  return { code, message };
}

export function checkBase(spec: ArrangeBase): ArrangeFailure[] {
  const failures: ArrangeFailure[] = [];
  if (!spec.question?.trim()) {
    failures.push(fail("missing-question", "Name the human question this arrangement answers."));
  }
  if (!spec.workRemoved?.trim()) {
    failures.push(
      fail("missing-work", "Name the mental work this arrangement removes. Looks clearer is not enough."),
    );
  }
  if (!spec.evidence) {
    failures.push(fail("missing-evidence", "Set evidence to observation, derived, interpretation, or proposal."));
  }
  return failures;
}

export function requireProvenance(specimens: Specimen[], evidence: EvidenceKind): ArrangeFailure[] {
  if (evidence !== "observation") return [];
  return specimens
    .filter((specimen) => !specimen.provenance?.trim())
    .map((specimen) =>
      fail(
        "missing-provenance",
        `Observation "${specimen.id}" needs capture conditions (viewport, time, source).`,
      ),
    );
}

export function throwIf(failures: ArrangeFailure[]): void {
  if (failures.length > 0) throw new ArrangeError(failures);
}

export function isSrcView(view: Specimen["view"]): view is SrcView {
  return typeof view === "object" && view !== null && "src" in view && !isMediaElement(view);
}

export function paintSpecimen(specimen: Specimen, width: number, height: number): MediaElement {
  if (isSrcView(specimen.view)) {
    return Image({
      id: specimen.id,
      src: specimen.view.src,
      fit: specimen.view.fit ?? "contain",
      width,
      height,
    });
  }
  return Frame({ id: specimen.id, width, height, overflow: "hidden" }, specimen.view);
}

export function label(id: string, text: string, size = 14) {
  return Text(
    { id, variant: "label", size, color: MUTED, letterSpacing: 1.2, weight: 600 },
    text,
  );
}

export function title(text: string, size = 28) {
  return Text({ id: "arrangement-title", variant: "title", size, color: INK, weight: 700 }, text);
}

export function chip(id: string, text: string, size = 12) {
  return Frame(
    { id, ...(size === 12 ? { height: 28 } : {}), pad: { x: 10, y: 6 }, radius: 4, fill: "rgba(28,30,34,0.06)" },
    Text({ id: `chip-label-${id}`, variant: "label", size, color: INK, weight: 600, letterSpacing: 0.8 }, text),
  );
}
