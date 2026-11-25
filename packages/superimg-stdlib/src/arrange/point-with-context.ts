import { Frame, Fill, Stack } from "../tree/primitives.js";
import type { MediaElement } from "../tree/node-types.js";
import {
  DEFAULT_SIZE,
  INK,
  checkBase,
  chip,
  fail,
  label,
  paintSpecimen,
  requireProvenance,
  throwIf,
} from "./base.js";
import { arrangementShell } from "./chrome.js";
import type { ArrangeFailure, PointWithContextSpec, Region } from "./types.js";

function validRegion(region: Region | undefined): region is Region {
  if (!region) return false;
  const values = [region.x, region.y, region.width, region.height];
  if (!values.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    return false;
  }
  return region.x + region.width <= 1.0001 && region.y + region.height <= 1.0001;
}

export function checkPointWithContext(spec: PointWithContextSpec): ArrangeFailure[] {
  const failures = [
    ...checkBase(spec),
    ...requireProvenance([spec.context, spec.focus], spec.evidence),
  ];
  if (!spec.context?.id || !spec.focus?.id) {
    failures.push(fail("missing-correspondence", "Context and focus each need a stable id."));
  }
  if (spec.correspondence === "highlight" || spec.correspondence === "inset") {
    if (!validRegion(spec.focus.region)) {
      failures.push(
        fail(
          "focus-not-locatable",
          "Inset and highlight need a region in the context (0–1 fractions) so the detail stays locatable.",
        ),
      );
    }
  }
  if (spec.correspondence === "panels" && spec.context.id === spec.focus.id) {
    failures.push(fail("missing-correspondence", "Panels still need distinct context and focus ids."));
  }
  return failures;
}

export function pointWithContext(spec: PointWithContextSpec): MediaElement {
  throwIf(checkPointWithContext(spec));
  const size = spec.size ?? DEFAULT_SIZE;
  const inner = size.width - 96;
  const contextH = Math.round(size.height * 0.52);
  const focusH = Math.round(size.height * 0.22);
  const region = spec.focus.region;

  const marker = region
    ? Frame(
        {
          id: "origin-marker",
          x: Math.round(region.x * inner),
          y: Math.round(region.y * contextH),
          width: Math.max(8, Math.round(region.width * inner)),
          height: Math.max(8, Math.round(region.height * contextH)),
          radius: 2,
        },
        Fill({ color: "rgba(28,30,34,0.12)", style: { border: `2px solid ${INK}` } }),
      )
    : null;

  const contextFrame = Frame(
    { id: "context-frame", width: inner, height: contextH, overflow: "hidden", radius: 6 },
    paintSpecimen(spec.context, inner, contextH),
    marker,
  );

  const focusFrame = Frame(
    { id: "focus-frame", width: inner, height: focusH, overflow: "hidden", radius: 6 },
    paintSpecimen(spec.focus, inner, focusH),
  );

  const body =
    spec.correspondence === "highlight"
      ? Stack({ gap: 12 }, label("context-label", spec.context.label), contextFrame)
      : Stack(
          { gap: 16 },
          label("context-label", spec.context.label),
          contextFrame,
          label("focus-label", `${spec.focus.label}  ·  origin ${spec.context.id}`),
          focusFrame,
        );

  return arrangementShell(
    spec,
    [chip("corr", spec.correspondence), chip("origin", spec.context.id)],
    body,
  );
}
