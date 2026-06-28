/**
 * Layout primitives for SuperImg templates.
 *
 * Pure box math — takes coordinates in, returns coordinates out. No HTML, no CSS,
 * no coupling to any renderer. Pair with `std.css({ ... })` at the call site.
 *
 * @example
 * ```ts
 * const frame = { x: 0, y: 0, width, height };
 * const [title, label, window] = std.layout.partitionY(
 *   frame,
 *   [
 *     { height: height * 0.15 },
 *     { height: baseFontSize * 2.5 },
 *     { fill: true },
 *   ],
 *   { gap: baseFontSize * 0.3 },
 * );
 * const body = std.layout.inset(window, { x: width * 0.08, bottom: 60 });
 * ```
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RowSpec {
  /** Fixed height in pixels. */
  height?: number;
  /** Consume all remaining vertical space. At most one row per stack. */
  fill?: true;
}

export interface ColSpec {
  width?: number;
  fill?: true;
}

export type Anchor =
  | "center"
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

export interface GridOptions {
  cols: number;
  rows: number;
  gap?: number;
}

export interface PlaceOptions {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface RepeatOptions {
  axis?: "x" | "y";
  gap?: number;
}

export interface StackOptions {
  /** Pixels between rows. Not applied before the first row or after the last. Default 0. */
  gap?: number;
}

export interface InsetPadding {
  /** Shorthand for `left` + `right`. */
  x?: number;
  /** Shorthand for `top` + `bottom`. */
  y?: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`layout: ${label} must be a finite non-negative number, got ${value}`);
  }
}

/**
 * Vertically partition `area` into rows. Returns one Box per input row, in order.
 *
 * - Each row with a fixed `height` consumes that many pixels from the top.
 * - At most one row may set `fill: true`; it receives the remaining height.
 * - `gap` is inserted between rows (not before the first or after the last).
 * - If fixed rows + gaps exceed `area.height`, throws.
 *
 * Rows do not need to fill the area; unused space is simply left below the last row.
 */
export function partitionY(area: Box, rows: RowSpec[], opts: StackOptions = {}): Box[] {
  const gap = opts.gap ?? 0;
  assertFiniteNonNegative(gap, "options.gap");

  let fillIndex = -1;
  let fixedTotal = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    if (row.fill) {
      if (fillIndex !== -1) {
        throw new Error(`layout.partitionY: at most one row may set fill:true (rows ${fillIndex} and ${i})`);
      }
      fillIndex = i;
    } else {
      const h = row.height ?? 0;
      assertFiniteNonNegative(h, `rows[${i}].height`);
      fixedTotal += h;
    }
  }

  const gapTotal = rows.length > 0 ? gap * (rows.length - 1) : 0;
  const consumedWithoutFill = fixedTotal + gapTotal;

  if (consumedWithoutFill > area.height + 1e-6) {
    throw new Error(
      `layout.partitionY: rows + gaps (${consumedWithoutFill}) exceed area height (${area.height})`,
    );
  }

  const fillHeight = fillIndex === -1 ? 0 : area.height - consumedWithoutFill;

  const result: Box[] = [];
  let y = area.y;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const h = row.fill ? fillHeight : row.height ?? 0;
    result.push({ x: area.x, y, width: area.width, height: h });
    y += h;
    if (i < rows.length - 1) y += gap;
  }
  return result;
}

/**
 * Shrink a box by padding. Convenience alias for the four subtractions you'd
 * otherwise write inline; the value is in naming the concept.
 *
 * `x` / `y` are shorthands for `left`+`right` / `top`+`bottom`. Explicit
 * `top`/`bottom`/`left`/`right` take precedence over `x`/`y` when both are set.
 */
export function inset(area: Box, pad: InsetPadding = {}): Box {
  const top = pad.top ?? pad.y ?? 0;
  const bottom = pad.bottom ?? pad.y ?? 0;
  const left = pad.left ?? pad.x ?? 0;
  const right = pad.right ?? pad.x ?? 0;

  for (const [v, label] of [
    [top, "top"],
    [bottom, "bottom"],
    [left, "left"],
    [right, "right"],
  ] as const) {
    assertFiniteNonNegative(v, label);
  }

  return {
    x: area.x + left,
    y: area.y + top,
    width: Math.max(0, area.width - left - right),
    height: Math.max(0, area.height - top - bottom),
  };
}

/** Horizontally partition `area` into columns (mirror of partitionY). */
export function partitionX(area: Box, cols: ColSpec[], opts: StackOptions = {}): Box[] {
  const gap = opts.gap ?? 0;
  assertFiniteNonNegative(gap, "options.gap");

  let fillIndex = -1;
  let fixedTotal = 0;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!col) continue;
    if (col.fill) {
      if (fillIndex !== -1) {
        throw new Error(`layout.partitionX: at most one col may set fill:true`);
      }
      fillIndex = i;
    } else {
      const w = col.width ?? 0;
      assertFiniteNonNegative(w, `cols[${i}].width`);
      fixedTotal += w;
    }
  }

  const gapTotal = cols.length > 0 ? gap * (cols.length - 1) : 0;
  const consumed = fixedTotal + gapTotal;
  if (consumed > area.width + 1e-6) {
    throw new Error(`layout.partitionX: cols + gaps (${consumed}) exceed area width (${area.width})`);
  }

  const fillWidth = fillIndex === -1 ? 0 : area.width - consumed;
  const result: Box[] = [];
  let x = area.x;
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i];
    if (!col) continue;
    const w = col.fill ? fillWidth : col.width ?? 0;
    result.push({ x, y: area.y, width: w, height: area.height });
    x += w;
    if (i < cols.length - 1) x += gap;
  }
  return result;
}

/** Divide area into a cols×rows grid of equal cells. */
export function grid(area: Box, opts: GridOptions): Box[] {
  const { cols, rows, gap = 0 } = opts;
  assertFiniteNonNegative(gap, "options.gap");
  if (cols < 1 || rows < 1) throw new Error("layout.grid: cols and rows must be >= 1");

  const cellW = (area.width - gap * (cols - 1)) / cols;
  const cellH = (area.height - gap * (rows - 1)) / rows;
  const cells: Box[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        x: area.x + c * (cellW + gap),
        y: area.y + r * (cellH + gap),
        width: cellW,
        height: cellH,
      });
    }
  }
  return cells;
}

/** Address a cell (or span) within a grid produced by `grid()`. */
export function place(gridArea: Box, gridOpts: GridOptions, cell: PlaceOptions): Box {
  const cells = grid(gridArea, gridOpts);
  const { col, row, colSpan = 1, rowSpan = 1 } = cell;
  const idx = row * gridOpts.cols + col;
  const origin = cells[idx];
  if (!origin) throw new Error(`layout.place: invalid col=${col} row=${row}`);

  if (colSpan === 1 && rowSpan === 1) return origin;

  const gap = gridOpts.gap ?? 0;
  const cellW = (gridArea.width - gap * (gridOpts.cols - 1)) / gridOpts.cols;
  const cellH = (gridArea.height - gap * (gridOpts.rows - 1)) / gridOpts.rows;
  return {
    x: origin.x,
    y: origin.y,
    width: cellW * colSpan + gap * (colSpan - 1),
    height: cellH * rowSpan + gap * (rowSpan - 1),
  };
}

/** Tile `tile` count times along an axis within `area`. */
export function repeat(area: Box, tile: Box, count: number, opts: RepeatOptions = {}): Box[] {
  const axis = opts.axis ?? "x";
  const gap = opts.gap ?? 0;
  assertFiniteNonNegative(gap, "options.gap");
  const result: Box[] = [];
  for (let i = 0; i < count; i++) {
    if (axis === "x") {
      result.push({ x: area.x + i * (tile.width + gap), y: area.y, width: tile.width, height: tile.height });
    } else {
      result.push({ x: area.x, y: area.y + i * (tile.height + gap), width: tile.width, height: tile.height });
    }
  }
  return result;
}

/** Equal spacing for N items along an axis inside `track`. */
export function distribute(track: Box, count: number, itemSize: number, axis: "x" | "y" = "x"): Box[] {
  if (count < 1) return [];
  const trackSize = axis === "x" ? track.width : track.height;
  const totalItem = count * itemSize;
  const gap = count > 1 ? (trackSize - totalItem) / (count - 1) : 0;
  const result: Box[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i * (itemSize + gap);
    result.push(
      axis === "x"
        ? { x: track.x + offset, y: track.y, width: itemSize, height: track.height }
        : { x: track.x, y: track.y + offset, width: track.width, height: itemSize },
    );
  }
  return result;
}

/** Position `child` within `parent` at an anchor point. */
export function align(parent: Box, child: Box, anchor: Anchor = "center"): Box {
  let x = parent.x;
  let y = parent.y;
  switch (anchor) {
    case "top-left":
      break;
    case "top":
      x = parent.x + (parent.width - child.width) / 2;
      break;
    case "top-right":
      x = parent.x + parent.width - child.width;
      break;
    case "left":
      y = parent.y + (parent.height - child.height) / 2;
      break;
    case "center":
      x = parent.x + (parent.width - child.width) / 2;
      y = parent.y + (parent.height - child.height) / 2;
      break;
    case "right":
      x = parent.x + parent.width - child.width;
      y = parent.y + (parent.height - child.height) / 2;
      break;
    case "bottom-left":
      y = parent.y + parent.height - child.height;
      break;
    case "bottom":
      x = parent.x + (parent.width - child.width) / 2;
      y = parent.y + parent.height - child.height;
      break;
    case "bottom-right":
      x = parent.x + parent.width - child.width;
      y = parent.y + parent.height - child.height;
      break;
  }
  return { x, y, width: child.width, height: child.height };
}
