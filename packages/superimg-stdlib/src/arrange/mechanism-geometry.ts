//! Pure position/connector math for `mechanism-strip.ts`.
//!
//! No automatic graph layout: `pipelineBoxes`/`layerBoxes` place a node
//! exactly where its declared `order`/`layers` index says, nothing more.
//! Only *sizing* answers the stage — a card is as tall as the words inside
//! it, never as tall as the leftover paper. Connectors are straight or
//! one-bend elbow paths only — never curves — because a mechanism's shape
//! must stay attributable to the author, not to a routing algorithm.

import { wrapText } from "../svg/measure.js";

/** Box a node occupies on the canvas, in the same coordinate space as `Vector`'s viewBox. */
export interface NodeBox {
  id: string;
  /** Declared position, printed on the card so the reading order is visible, not inferred. */
  ordinal: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConnectorGeometry {
  line: string;
  /** Closed triangle — a claim the picture is willing to assert. */
  arrow: string;
  /** Open chevron — the same direction, drawn without the weight of a fact. */
  chevron: string;
  /** Where the edge label block sits: the gap column, clear of both boxes. */
  label: { x: number; width: number; bottom: number };
}

/**
 * Legibility floor. Capacity is "how many fit at the smallest size still
 * worth reading", so the `too-dense` bound does not move when a larger stage
 * lets the cards grow.
 */
export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 72;
export const GAP_Y = 20;

/** Card padding and the leading between the three card rows. */
export const CARD_PAD = 18;
export const CARD_ROW_GAP = 5;
const ORDINAL_SIZE = 12;

/** `measure.ts` line box: 1.2 em. Sizing must agree with it. */
const LINE = 1.2;
/**
 * Sizing headroom. The measured box is the heuristic width, so a real glyph
 * run that lands slightly over it wraps where nothing should wrap. Picking
 * type against a fatter em leaves that slack.
 */
export const GLYPH_SAFE = 0.62;

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Gap between cards. Wide enough to hold an edge label clear of both boxes,
 * narrow enough that a long pipeline still gets readable cards.
 */
export function stripGap(innerWidth: number, count: number): number {
  return clamp(Math.round(innerWidth / (Math.max(1, count) * 3.2)), 48, 120);
}

/** Width one card gets when `count` of them share the row. */
export function cardWidthFor(innerWidth: number, count: number): number {
  const n = Math.max(1, count);
  const gap = stripGap(innerWidth, n);
  return Math.floor((innerWidth - (n - 1) * gap) / n);
}

/**
 * Chrome budget `arrangementShell` spends before the body ever starts:
 * outer pad (Frame `pad: 48` both edges, base.ts `arrangementShell`) + a
 * title row (title() defaults to size 28, ~40px of line box) + gap 20 +
 * the evidence/chip row (chip() is a fixed 28px tall) + gap 20 + an
 * optional source caption (~20px) + gap 20. The source line is budgeted
 * even when a spec omits `source`, so the legible bound never depends on
 * whether one was set.
 */
export const HEADER_CHROME = 148;
const OUTER_PAD = 96;

export function innerWidthFor(width: number): number {
  return width - OUTER_PAD;
}

export function innerHeightFor(height: number): number {
  return height - OUTER_PAD - HEADER_CHROME;
}

/** Nodes a single pipeline row can hold at a legible size. */
export function pipelineCapacity(innerWidth: number): number {
  let capacity = 1;
  for (let n = 1; n <= 16; n += 1) {
    if (cardWidthFor(innerWidth, n) >= NODE_WIDTH) capacity = n;
  }
  return capacity;
}

export interface CardType {
  label: number;
  /** 0 when no node carries a note — the row is then simply absent. */
  note: number;
  ordinal: number;
  /** Width the words wrap at, so paint and measurement agree. */
  content: number;
  /** Wrapping is switched on only for a row that genuinely cannot fit one line. */
  labelWrap: boolean;
  noteWrap: boolean;
  height: number;
}

function longest(values: readonly string[]): number {
  return Math.max(0, ...values.map((value) => value.length));
}

function fitSize(content: number, chars: number, min: number, max: number): number {
  if (chars <= 0) return min;
  return clamp(Math.floor(content / (chars * GLYPH_SAFE)), min, max);
}

/** True when the longest of these still overruns one line at `size`. */
function overruns(values: readonly string[], size: number, content: number): boolean {
  return longest(values) * size * GLYPH_SAFE > content;
}

/** Lines the longest of these strings needs at `size`, capped so a card stays a card. */
function lineCount(values: readonly string[], size: number, content: number): number {
  if (size <= 0 || values.length === 0) return 0;
  const most = Math.max(
    1,
    ...values.map((value) => wrapText(value, content, { fontSize: size, lineHeight: LINE }).lines.length),
  );
  return Math.min(3, most);
}

/**
 * Type scale and card height derived from the words that have to fit.
 * Height follows content: padding + ordinal + label + optional note, at
 * whatever number of lines those words actually take. Nothing is stretched
 * to fill the stage.
 */
export function cardType(
  cardWidth: number,
  labels: readonly string[],
  notes: readonly string[],
): CardType {
  const content = Math.max(40, cardWidth - CARD_PAD * 2);
  const label = fitSize(content, longest(labels), 15, 34);
  const note =
    notes.length > 0
      ? fitSize(content, longest(notes), 11, Math.max(12, Math.round(label * 0.62)))
      : 0;
  const labelWrap = overruns(labels, label, content);
  const noteWrap = note > 0 && overruns(notes, note, content);
  const labelRows = labelWrap ? Math.max(1, lineCount(labels, label, content)) : 1;
  const noteRows = note > 0 ? (noteWrap ? lineCount(notes, note, content) : 1) : 0;
  const rows =
    Math.round(ORDINAL_SIZE * LINE) +
    CARD_ROW_GAP +
    labelRows * Math.round(label * LINE) +
    (noteRows > 0 ? CARD_ROW_GAP + noteRows * Math.round(note * LINE) : 0);
  return {
    label,
    note,
    ordinal: ORDINAL_SIZE,
    content,
    labelWrap,
    noteWrap,
    height: CARD_PAD * 2 + rows,
  };
}

/** Height of the evidence key panel that explains the arrow styles. */
export function keyPanelHeight(rows: number): number {
  const KEY_PAD_Y = 16;
  const KEY_TITLE = 15;
  const KEY_ROW = 22;
  const KEY_ROW_GAP = 8;
  const count = Math.max(1, rows);
  return (
    KEY_PAD_Y * 2 + KEY_TITLE + 12 + count * KEY_ROW + (count - 1) * KEY_ROW_GAP
  );
}

/**
 * Lay out a declared pipeline order in one row. The order still decides
 * position; only card width answers the stage.
 */
export function pipelineBoxes(
  order: readonly string[],
  innerWidth: number,
  cardHeight: number,
): NodeBox[] {
  const n = order.length;
  const gap = stripGap(innerWidth, n);
  const width = cardWidthFor(innerWidth, n);
  const totalW = n * width + Math.max(0, n - 1) * gap;
  const startX = Math.max(0, Math.round((innerWidth - totalW) / 2));
  return order.map((id, index) => ({
    id,
    ordinal: String(index + 1).padStart(2, "0"),
    x: startX + index * (width + gap),
    y: 0,
    width,
    height: cardHeight,
  }));
}

/** Rows in the densest declared layer. */
function densestLayer(layers: readonly (readonly string[])[]): number {
  return Math.max(1, ...layers.map((layer) => layer.length));
}

/** Band height a declared `layers` layout needs at a given card height. */
export function layerBandHeight(
  layers: readonly (readonly string[])[],
  cardHeight: number,
): number {
  const rows = densestLayer(layers);
  return rows * cardHeight + (rows - 1) * GAP_Y;
}

/** Lay out declared layers as columns, each column a vertically centered stack. */
export function layerBoxes(
  layers: readonly (readonly string[])[],
  innerWidth: number,
  cardHeight: number,
): NodeBox[] {
  const columns = layers.length;
  const gap = stripGap(innerWidth, columns);
  const width = cardWidthFor(innerWidth, columns);
  const totalW = columns * width + Math.max(0, columns - 1) * gap;
  const startX = Math.max(0, Math.round((innerWidth - totalW) / 2));
  const band = layerBandHeight(layers, cardHeight);
  const boxes: NodeBox[] = [];
  layers.forEach((layer, column) => {
    const rows = layer.length;
    const totalH = rows * cardHeight + Math.max(0, rows - 1) * GAP_Y;
    const startY = Math.max(0, Math.round((band - totalH) / 2));
    layer.forEach((id, row) => {
      boxes.push({
        id,
        ordinal: `${column + 1}.${row + 1}`,
        x: startX + column * (width + gap),
        y: startY + row * (cardHeight + GAP_Y),
        width,
        height: cardHeight,
      });
    });
  });
  return boxes;
}

const ARROW_SIZE = 10;
/** Kept off the border so a connector never touches the card it points at. */
const STANDOFF = 7;
/** Room between the label block's baseline box and the connector it names. */
const LABEL_CLEARANCE = 12;

function arrowPaths(tipX: number, tipY: number, direction: 1 | -1): Pick<ConnectorGeometry, "arrow" | "chevron"> {
  const backX = tipX - direction * ARROW_SIZE;
  const spread = ARROW_SIZE * 0.6;
  return {
    arrow: `M${tipX},${tipY} L${backX},${tipY - spread} L${backX},${tipY + spread} Z`,
    chevron: `M${backX},${tipY - spread} L${tipX},${tipY} L${backX},${tipY + spread}`,
  };
}

/** The label slot is the gap between the two cards, minus a hair of margin. */
function labelSlot(gapLeft: number, gapRight: number, bottom: number): ConnectorGeometry["label"] {
  return {
    x: Math.round(gapLeft + 8),
    width: Math.max(24, Math.round(gapRight - gapLeft - 16)),
    bottom,
  };
}

/** Where an elbow turns: late in the gap, so its vertical never crosses a label. */
const BEND_SHARE = 0.72;
/** Share of the gap a label may claim, leaving the bend column clear. */
export const LABEL_SHARE = 0.62;

/** Narrowest label slot a layout can produce — what the claim word must fit. */
export function narrowestSlot(innerWidth: number, columns: number, elbows: boolean): number {
  const gap = stripGap(innerWidth, columns);
  return Math.max(24, Math.round((elbows ? gap * LABEL_SHARE : gap) - 16));
}

/**
 * Straight connector when both boxes share a row; otherwise a single-bend
 * elbow (out, across, in). `tickLength` truncates the connector into a short
 * stub near its source — the predict-phase "we know it leads somewhere, not
 * where yet" mark, mirroring aligned-intervals' predict tick.
 */
export function connectorGeometry(
  from: NodeBox,
  to: NodeBox,
  tickLength?: number,
): ConnectorGeometry {
  const forward: 1 | -1 = to.x >= from.x ? 1 : -1;
  const exitX = (forward === 1 ? from.x + from.width : from.x) + forward * STANDOFF;
  const exitY = from.y + from.height / 2;
  const entryX = (forward === 1 ? to.x : to.x + to.width) - forward * STANDOFF;
  const entryY = to.y + to.height / 2;
  // Measured from the card edges, not the stroke ends: the words own the
  // whole gap column, so they can never ride over a border.
  const fromEdge = forward === 1 ? from.x + from.width : from.x;
  const toEdge = forward === 1 ? to.x : to.x + to.width;
  const gapLeft = Math.min(fromEdge, toEdge);
  const gapRight = Math.max(fromEdge, toEdge);

  if (tickLength !== undefined) {
    const tipX = exitX + forward * tickLength;
    return {
      line: `M${exitX},${exitY} L${tipX},${exitY}`,
      ...arrowPaths(tipX, exitY, forward),
      label: labelSlot(
        Math.min(exitX, tipX),
        Math.max(exitX, tipX),
        exitY - LABEL_CLEARANCE,
      ),
    };
  }

  if (exitY === entryY) {
    return {
      line: `M${exitX},${exitY} L${entryX},${entryY}`,
      ...arrowPaths(entryX, entryY, forward),
      label: labelSlot(gapLeft, gapRight, exitY - LABEL_CLEARANCE),
    };
  }

  // Turn late, then park the label above the long outgoing run on the exit
  // side. Every elbow in a gap bends in the same column, so a label can never
  // land on a vertical stroke — its own or a sibling edge's.
  const bendX = Math.round(exitX + (entryX - exitX) * BEND_SHARE);
  const slotLeft = forward === 1 ? gapLeft : gapRight - (gapRight - gapLeft) * LABEL_SHARE;
  const slotRight = forward === 1 ? gapLeft + (gapRight - gapLeft) * LABEL_SHARE : gapRight;
  return {
    line: `M${exitX},${exitY} L${bendX},${exitY} L${bendX},${entryY} L${entryX},${entryY}`,
    ...arrowPaths(entryX, entryY, forward),
    label: labelSlot(slotLeft, slotRight, exitY - LABEL_CLEARANCE),
  };
}
