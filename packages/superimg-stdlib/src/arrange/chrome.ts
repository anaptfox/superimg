import { Frame, Fill, Stack, Text } from "../tree/primitives.js";
import type { MediaChild, MediaElement } from "../tree/node-types.js";
import {
  DEFAULT_SIZE,
  EVIDENCE_LABEL,
  MUTED,
  PAPER,
  chip,
  title,
} from "./base.js";
import type { ArrangeBase } from "./types.js";

export function arrangementShell(
  spec: ArrangeBase,
  chips: MediaElement[],
  body: MediaChild,
  options: { titleSize?: number; chipSize?: number; sourceSize?: number } = {},
): MediaElement {
  const size = spec.size ?? DEFAULT_SIZE;
  const evidence = chip("evidence", EVIDENCE_LABEL[spec.evidence], options.chipSize);
  const source = spec.source
    ? Text({ id: "source", variant: "caption", size: options.sourceSize ?? 13, color: MUTED }, spec.source)
    : null;

  return Frame(
    { id: "arrangement", width: size.width, height: size.height },
    Fill({ color: PAPER }),
    Stack(
      { width: "fill", height: "fill", pad: 48, gap: 20 },
      title(spec.question, options.titleSize),
      Stack({ direction: "row", gap: 8, ...(options.chipSize === undefined ? { height: 28, align: "center" as const } : {}) }, evidence, ...chips),
      body,
      source,
    ),
  );
}
