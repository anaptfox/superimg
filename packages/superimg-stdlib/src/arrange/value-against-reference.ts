import { Frame, Fill, Stack, Text } from "../tree/primitives.js";
import type { MediaElement } from "../tree/node-types.js";
import {
  DEFAULT_SIZE,
  HAIR,
  INK,
  MUTED,
  checkBase,
  chip,
  fail,
  label,
  throwIf,
} from "./base.js";
import { arrangementShell } from "./chrome.js";
import type { ArrangeFailure, ReferenceItem, ValueAgainstReferenceSpec } from "./types.js";

function numeric(value: string | number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function checkValueAgainstReference(spec: ValueAgainstReferenceSpec): ArrangeFailure[] {
  const failures = [...checkBase(spec)];
  if (!spec.items?.length) {
    failures.push(fail("missing-correspondence", "Value against reference needs at least one item."));
    return failures;
  }
  const units = spec.frame?.units;
  const scale = spec.frame?.scale ?? "per-item";
  for (const item of spec.items) {
    if (!item.id || !item.label) {
      failures.push(fail("missing-correspondence", "Each item needs a stable id and label."));
    }
    if (item.reference !== undefined && !Number.isFinite(item.reference)) {
      failures.push(fail("unaligned-frame", `Item ${item.id} reference must be a finite number.`));
    }
  }
  if (scale === "shared") {
    const itemUnits = new Set(spec.items.map((item) => item.unit ?? units ?? ""));
    if (itemUnits.size > 1) {
      failures.push(
        fail(
          "unaligned-frame",
          "Shared scale needs one unit. Mixed units require scale: \"per-item\".",
        ),
      );
    }
    if (![...itemUnits][0] && !units) {
      failures.push(fail("unaligned-frame", "Shared scale needs explicit units."));
    }
  }
  return failures;
}

export function valueAgainstReference(spec: ValueAgainstReferenceSpec): MediaElement {
  throwIf(checkValueAgainstReference(spec));
  const size = spec.size ?? DEFAULT_SIZE;
  const inner = size.width - 96;
  const labelW = 180;
  const valueW = 120;
  const plotW = inner - labelW - valueW - 24;
  const rowH = 36;
  const unit = spec.frame.units;

  const rows = spec.items.map((item) => {
    const amount = numeric(item.value);
    const cap = Math.max(amount ?? 0, item.reference ?? 0, 1);
    const barW = amount === undefined ? 0 : Math.max(4, Math.round((amount / cap) * plotW));
    const refX = item.reference === undefined
      ? null
      : Math.round((item.reference / cap) * plotW);
    const shown = item.unit ?? unit ?? "";
    return Stack(
      { direction: "row", gap: 12, align: "center", width: inner, height: rowH },
      Frame({ width: labelW, height: rowH }, label(`item-${item.id}`, item.label)),
      Frame(
        { width: valueW, height: rowH },
        Text(
          { id: `value-${item.id}`, variant: "body", size: 16, color: INK, weight: 600 },
          shown ? `${item.value} ${shown}` : String(item.value),
        ),
      ),
      Frame(
        { width: plotW, height: rowH, radius: 4 },
        Fill({ color: "rgba(28,30,34,0.04)" }),
        amount === undefined
          ? null
          : Frame(
              { id: `bar-${item.id}`, x: 0, y: 10, width: barW, height: 16, radius: 3 },
              Fill({ color: INK }),
            ),
        refX === null
          ? null
          : Fill({
              id: `ref-${item.id}`,
              x: Math.max(0, refX - 1),
              y: 6,
              width: 2,
              height: 24,
              color: MUTED,
            }),
        Fill({ y: rowH / 2, height: 1, width: plotW, color: HAIR }),
      ),
    );
  });

  const chips = [
    ...(unit ? [chip("units", unit)] : []),
    chip("scale", spec.frame.scale === "shared" ? "shared scale" : "per-item scale"),
  ];

  return arrangementShell(spec, chips, Stack({ gap: 10 }, ...rows));
}
