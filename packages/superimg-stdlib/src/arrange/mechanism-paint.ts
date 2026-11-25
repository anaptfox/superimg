//! Ink for `mechanism-strip.ts`: node cards, per-claim connector styling, and
//! the key that makes the styling readable.
//!
//! The claim ladder is the point. A connector's weight falls as its evidence
//! weakens, so a proposal can never borrow the authority of an observation,
//! and the key spells out what each stroke is promising.

import { Frame, Fill, Stack, Text } from "../tree/primitives.js";
import { Vector, vector } from "../tree/vector.js";
import type { MediaElement } from "../tree/node-types.js";
import { wrapText } from "../svg/measure.js";
import { EVIDENCE_LABEL, HAIR, INK, MUTED, label as microLabel } from "./base.js";
import {
  CARD_PAD,
  CARD_ROW_GAP,
  GLYPH_SAFE,
  type CardType,
  type ConnectorGeometry,
  type NodeBox,
} from "./mechanism-geometry.js";
import type { EvidenceKind, MechanismEdge, MechanismNode } from "./types.js";

export interface ClaimStyle {
  stroke: string;
  width: number;
  dash?: string;
  /** Filled head for what happened; open chevron for what someone concluded. */
  filled: boolean;
}

/** Certainty reads as solidity and weight — never the other way round. */
export const CLAIM_STYLE: Record<EvidenceKind, ClaimStyle> = {
  observation: { stroke: INK, width: 2.8, filled: true },
  derived: { stroke: INK, width: 1.8, filled: true },
  interpretation: { stroke: MUTED, width: 1.8, dash: "9 6", filled: false },
  proposal: { stroke: MUTED, width: 1.6, dash: "2 6", filled: false },
};

const CLAIM_GLOSS: Record<EvidenceKind, string> = {
  observation: "Watched happen — captured directly at the source.",
  derived: "Computed from a declared source, not watched happen.",
  interpretation: "A reading of the evidence. It can be wrong.",
  proposal: "Not established. Put here so it can be tested.",
};

const ORDER: readonly EvidenceKind[] = ["observation", "derived", "interpretation", "proposal"];

/** A node card: padding, declared ordinal, label, optional note. Nothing stretched. */
export function nodeCard(node: MechanismNode, box: NodeBox, type: CardType): MediaElement {
  return Frame(
    { id: `node-${node.id}`, x: box.x, y: box.y, width: box.width, height: box.height, radius: 10 },
    Fill({ color: "#FFFFFF", style: { border: `1.5px solid ${INK}` } }),
    Frame(
      { width: "fill", height: "fill", pad: CARD_PAD },
      Stack(
        { gap: CARD_ROW_GAP },
        Text(
          { id: `node-${node.id}-ordinal`, variant: "label", size: type.ordinal, color: MUTED, weight: 600, letterSpacing: 1.4 },
          box.ordinal,
        ),
        Text(
          {
            id: `node-${node.id}-label`, variant: "title",
            size: type.label,
            color: INK,
            weight: 700,
            ...(type.labelWrap ? { maxWidth: type.content } : {}),
          },
          node.label,
        ),
        node.note && type.note > 0
          ? Text(
              {
                id: `node-${node.id}-note`, variant: "caption",
                size: type.note,
                color: MUTED,
                ...(type.noteWrap ? { maxWidth: type.content } : {}),
              },
              node.note,
            )
          : null,
      ),
    ),
  );
}

/** The stroked part of an edge — the only place claim styling lives. */
export function connectorInk(
  edge: MechanismEdge,
  geometry: ConnectorGeometry,
  id: string,
): MediaElement {
  const style = CLAIM_STYLE[edge.claim];
  return vector.group(
    { id },
    vector.path({
      id: `${id}-line`,
      d: geometry.line,
      fill: "none",
      stroke: style.stroke,
      strokeWidth: style.width,
      ...(style.dash ? { strokeDasharray: style.dash } : {}),
      strokeLinecap: "round",
    }),
    vector.path({
      id: `${id}-arrow`,
      d: style.filled ? geometry.arrow : geometry.chevron,
      fill: style.filled ? style.stroke : "none",
      stroke: style.stroke,
      strokeWidth: style.filled ? 0 : style.width,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}

/** How far a label block may hang above the strip band before it looks loose. */
const OVERHANG = 26;
/** Tracking on the per-edge claim word; counted when the word is sized to fit. */
export const CLAIM_TRACKING = 0.6;
/** Below this a one-line label would be unreadable, so the label wraps instead. */
const ONE_LINE_FLOOR = 12;

function blockHeight(text: string, size: number, width: number): number {
  return wrapText(text, width, { fontSize: size, lineHeight: 1.2 }).totalHeight;
}

/**
 * The words on an edge, as real Text in the gap column between two cards —
 * never SVG text drifting across a border in a fallback serif. The claim is
 * named per edge only when the mechanism mixes claims; when every hand-off
 * rests on the same evidence, the chip row and the key already said it.
 */
/** Largest size at which the longest word still sits inside the slot. */
export function fitsOneLine(text: string, width: number, letterSpacing = 0): number {
  const chars = Math.max(1, ...text.split(/\s+/).map((word) => word.length));
  return Math.floor((width - (chars - 1) * letterSpacing) / (chars * GLYPH_SAFE));
}

/** Largest size at which the whole phrase stays on one line. */
function fitsWhole(text: string, width: number): number {
  return Math.floor(width / (Math.max(1, text.trim().length) * GLYPH_SAFE));
}

export function connectorLabel(
  edge: MechanismEdge,
  geometry: ConnectorGeometry,
  id: string,
  claimSize: number,
): MediaElement | null {
  if (!edge.label?.trim()) return null;
  const width = geometry.label.width;
  // The block may hang a little above the band — there is paper up there, and
  // shrinking the type to fit the card's top half would be worse.
  const room = geometry.label.bottom + OVERHANG;
  const cap = Math.max(12, Math.min(20, Math.round(width * 0.24)));
  // Prefer one line. Wrapping pins the box to a heuristic width, and a real
  // glyph run that lands just over it breaks where nothing should break.
  const whole = fitsWhole(edge.label, width);
  const wrap = whole < ONE_LINE_FLOOR;
  let size = wrap
    ? Math.min(cap, Math.max(11, fitsOneLine(edge.label, width)))
    : Math.min(cap, whole);
  const tag = claimSize > 0 ? 3 + Math.round(claimSize * 1.2) : 0;
  const total = () =>
    (wrap ? blockHeight(edge.label!, size, width) : Math.round(size * 1.2)) + tag;
  while (size > 11 && total() > room) size -= 1;
  const height = Math.round(total());
  return Frame(
    {
      id,
      x: geometry.label.x,
      y: Math.max(-OVERHANG, Math.round(geometry.label.bottom - height)),
      width,
      height,
    },
    Stack(
      // Bottom-aligned: if the browser needs one line fewer than the heuristic
      // predicted, the words still sit the same distance above the connector.
      { gap: 3, width: "fill", height: "fill", justify: "end" },
      Text(
        {
          id: `${id}-text`, size,
          color: INK,
          align: "center",
          lineHeight: 1.2,
          ...(wrap ? { maxWidth: width } : {}),
        },
        edge.label,
      ),
      claimSize > 0
        ? Text(
            {
              id: `${id}-claim`, variant: "label",
              size: claimSize,
              color: MUTED,
              weight: 600,
              letterSpacing: CLAIM_TRACKING,
              align: "center",
            },
            EVIDENCE_LABEL[edge.claim],
          )
        : null,
    ),
  );
}

/** The predict mark: a stub that admits it leads somewhere without saying where. */
export function predictMark(geometry: ConnectorGeometry, id: string): MediaElement {
  const size = 20;
  return Frame(
    {
      id,
      x: geometry.label.x,
      y: Math.max(0, Math.round(geometry.label.bottom - size * 1.2)),
      width: geometry.label.width,
      height: Math.round(size * 1.2),
    },
    Text({ id: `${id}-question`, size, color: INK, weight: 700, align: "center" }, "?"),
  );
}

function sample(kind: EvidenceKind): MediaElement {
  const style = CLAIM_STYLE[kind];
  return Vector(
    { width: 76, height: 22, viewBox: { x: 0, y: 0, width: 76, height: 22 } },
    vector.path({
      d: "M2,11 L58,11",
      fill: "none",
      stroke: style.stroke,
      strokeWidth: style.width,
      ...(style.dash ? { strokeDasharray: style.dash } : {}),
      strokeLinecap: "round",
    }),
    vector.path({
      d: style.filled ? "M70,11 L60,5 L60,17 Z" : "M60,5 L70,11 L60,17",
      fill: style.filled ? style.stroke : "none",
      stroke: style.stroke,
      strokeWidth: style.filled ? 0 : style.width,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    }),
  );
}

function keyRow(id: string, art: MediaElement, name: string, gloss: string): MediaElement {
  return Stack(
    { id, direction: "row", gap: 14, align: "center", width: "fill", height: 22 },
    Frame({ width: 76, height: 22 }, art),
    Frame(
      { width: 132, height: 22 },
      Text({ id: `${id}-name`, size: 15, color: INK, weight: 700 }, name),
    ),
    Text({ id: `${id}-gloss`, size: 14, color: MUTED }, gloss),
  );
}

/**
 * Reading key for the claims actually present. Without it the stroke ladder is
 * a private code, and a dashed line is just a dashed line.
 */
export function evidenceKey(
  claims: ReadonlySet<EvidenceKind>,
  width: number,
  height: number,
  predicting: boolean,
): MediaElement {
  const rows = ORDER.filter((kind) => claims.has(kind)).map((kind) =>
    keyRow(`key-${kind}`, sample(kind), EVIDENCE_LABEL[kind], CLAIM_GLOSS[kind]),
  );
  if (predicting) {
    rows.push(
      keyRow(
        "key-predict",
        Vector(
          { width: 76, height: 22, viewBox: { x: 0, y: 0, width: 76, height: 22 } },
          vector.path({ d: "M2,11 L26,11", fill: "none", stroke: INK, strokeWidth: 1.8, strokeLinecap: "round" }),
          vector.path({ d: "M36,11 L26,5 L26,17 Z", fill: INK }),
        ),
        "Unanswered",
        "The stub is the question. Predict the hand-off, then reveal.",
      ),
    );
  }
  return Frame(
    { id: "evidence-key", width, height, radius: 8 },
    Fill({ color: "rgba(28,30,34,0.05)", style: { border: `1px solid ${HAIR}` } }),
    Frame(
      { width: "fill", height: "fill", pad: { x: 20, y: 16 } },
      Stack({ gap: 12, width: "fill" }, microLabel("key-title", "Reading the arrows", 12), ...rows),
    ),
  );
}
