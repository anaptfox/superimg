/**
 * Layout primitives for SuperImg templates.
 *
 * Pure box math — takes coordinates in, returns coordinates out. No HTML, no CSS,
 * no coupling to any renderer. Pair with `std.css({ ... })` at the call site.
 *
 * @example
 * ```ts
 * const frame = { x: 0, y: 0, width, height };
 * const [title, label, window] = std.layout.stack(
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
export function stack(area: Box, rows: RowSpec[], opts: StackOptions = {}): Box[] {
  const gap = opts.gap ?? 0;
  assertFiniteNonNegative(gap, "options.gap");

  let fillIndex = -1;
  let fixedTotal = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.fill) {
      if (fillIndex !== -1) {
        throw new Error(`layout.stack: at most one row may set fill:true (rows ${fillIndex} and ${i})`);
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
      `layout.stack: rows + gaps (${consumedWithoutFill}) exceed area height (${area.height})`,
    );
  }

  const fillHeight = fillIndex === -1 ? 0 : area.height - consumedWithoutFill;

  const result: Box[] = [];
  let y = area.y;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
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
