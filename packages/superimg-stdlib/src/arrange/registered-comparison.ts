import { Frame, Stack } from "../tree/primitives.js";
import type { MediaElement } from "../tree/node-types.js";
import {
  DEFAULT_SIZE,
  checkBase,
  chip,
  fail,
  label,
  paintSpecimen,
  requireProvenance,
  throwIf,
} from "./base.js";
import { arrangementShell } from "./chrome.js";
import type { ArrangeFailure, ComparisonFrame, RegisteredComparisonSpec } from "./types.js";

function frameHoldsSomething(frame: ComparisonFrame): boolean {
  return Boolean(
    frame.viewport ||
      frame.units ||
      frame.crop ||
      frame.timeWindow ||
      frame.scale === "shared",
  );
}

export function checkRegisteredComparison(spec: RegisteredComparisonSpec): ArrangeFailure[] {
  const failures = [
    ...checkBase(spec),
    ...requireProvenance(spec.states ?? [], spec.evidence),
  ];
  if (!spec.states || spec.states.length < 2) {
    failures.push(fail("missing-correspondence", "A registered comparison needs at least two states."));
  }
  if (!spec.correspondence?.length) {
    failures.push(
      fail(
        "missing-correspondence",
        "Name the identities that stay constant so the visible difference means what you claim.",
      ),
    );
  }
  if (!spec.frame || !frameHoldsSomething(spec.frame)) {
    failures.push(
      fail(
        "unaligned-frame",
        "Hold a reference system steady: viewport, units, crop, time window, or an explicit shared scale.",
      ),
    );
  }
  if (spec.frame?.scale === "independent") {
    const declared = spec.mismatches?.some((item) => /scale/i.test(item));
    if (!declared) {
      failures.push(
        fail(
          "unaligned-frame",
          "Independent scale makes differences unreadable unless listed in mismatches.",
        ),
      );
    }
  }
  const ids = new Set((spec.states ?? []).map((state) => state.id));
  if (ids.size !== (spec.states?.length ?? 0)) {
    failures.push(fail("missing-correspondence", "State ids must be unique so panels stay addressable."));
  }
  return failures;
}

function frameChips(spec: RegisteredComparisonSpec): MediaElement[] {
  const chips: MediaElement[] = [];
  const { frame } = spec;
  if (frame.viewport) {
    chips.push(chip("viewport", `${frame.viewport.width}×${frame.viewport.height}`));
  }
  if (frame.units) chips.push(chip("units", frame.units));
  if (frame.crop) chips.push(chip("crop", frame.crop));
  if (frame.timeWindow) chips.push(chip("window", frame.timeWindow));
  if (frame.scale === "shared") chips.push(chip("scale", "shared scale"));
  for (const [index, mismatch] of (spec.mismatches ?? []).entries()) {
    chips.push(chip(`mismatch-${index}`, `mismatch: ${mismatch}`));
  }
  return chips;
}

export function registeredComparison(spec: RegisteredComparisonSpec): MediaElement {
  throwIf(checkRegisteredComparison(spec));
  const size = spec.size ?? DEFAULT_SIZE;
  const stacked = spec.layout === "stacked";
  const gap = 16;
  const count = spec.states.length;
  const innerW = size.width - 96;
  const panelW = stacked ? innerW : Math.floor((innerW - gap * (count - 1)) / count);
  const panelH = stacked
    ? Math.floor((size.height - 280) / count)
    : Math.round(size.height * 0.52);

  const panels = spec.states.map((state) =>
    Stack(
      { gap: 8, width: panelW },
      label(`label-${state.id}`, state.label),
      Frame(
        { width: panelW, height: panelH, overflow: "hidden", radius: 6 },
        paintSpecimen(state, panelW, panelH),
      ),
    ),
  );

  const body = Stack(
    {
      direction: stacked ? "column" : "row",
      gap,
      align: "start",
    },
    ...panels,
  );

  return arrangementShell(spec, frameChips(spec), body);
}
