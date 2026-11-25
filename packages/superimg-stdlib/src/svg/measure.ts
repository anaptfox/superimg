import type { FontMetrics } from "./font-metrics.js";

export interface MeasureOptions {
  fontSize: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: string;
  letterSpacing?: number;
  lineHeight?: number;
  measurer?: TextMeasurer;
  /** Word widths for one layout pass. Keyed by font signature and word. */
  wordWidths?: Map<string, number>;
}

export interface LineBox {
  text: string;
  width: number;
  height: number;
}

export interface TextMetrics {
  width: number;
  height: number;
  ascender: number;
  descender: number;
  lines: LineBox[];
}

export interface MetricFontFace {
  family: string;
  weight: number;
  style: "normal" | "italic";
  metrics: FontMetrics;
}

export interface TextMeasureRequest {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: string;
  letterSpacing?: number;
}

export interface TextMeasurement {
  width: number;
  ascent: number;
  descent: number;
  exact: boolean;
}

export interface TextMeasurer {
  measure(text: string, request: TextMeasureRequest): TextMeasurement;
}

interface IndexedFace extends MetricFontFace {
  familyKey: string;
}

/** Approximate metrics (~0.55em avg glyph width). Works browser-free in resvg. */
function heuristicWidth(text: string, fontSize: number, letterSpacing = 0): number {
  return text.length * fontSize * 0.55 + Math.max(0, text.length - 1) * letterSpacing;
}

function heuristicMeasurement(text: string, fontSize: number, letterSpacing = 0): TextMeasurement {
  const chars = Array.from(text);
  return {
    width: chars.length * fontSize * 0.55 + Math.max(0, chars.length - 1) * letterSpacing,
    ascent: fontSize * 0.8,
    descent: fontSize * 0.2,
    exact: false,
  };
}

export function createTextMeasurer(faces: readonly MetricFontFace[]): TextMeasurer {
  const indexed: IndexedFace[] = faces.map((face) => ({
    ...face,
    familyKey: face.family.trim().toLowerCase(),
    style: face.style === "italic" ? "italic" : "normal",
  }));

  return {
    measure(text, request) {
      const face = matchFace(indexed, request.fontFamily, request.fontWeight ?? 400, request.fontStyle);
      if (!face) return heuristicMeasurement(text, request.fontSize, request.letterSpacing ?? 0);
      return measureWithFace(text, face.metrics, request.fontSize, request.letterSpacing ?? 0);
    },
  };
}

function measureWithFace(
  text: string,
  metrics: FontMetrics,
  fontSize: number,
  letterSpacing: number,
): TextMeasurement {
  const chars = Array.from(text);
  let units = 0;
  let previous: number | undefined;
  for (const char of chars) {
    const codePoint = char.codePointAt(0)!;
    if (previous !== undefined) units += metrics.kerning(previous, codePoint);
    units += metrics.advance(codePoint);
    previous = codePoint;
  }
  const scale = fontSize / metrics.unitsPerEm;
  return {
    width: units * scale + Math.max(0, chars.length - 1) * letterSpacing,
    ascent: metrics.ascent * scale,
    descent: metrics.descent * scale,
    exact: true,
  };
}

function matchFace(
  faces: readonly IndexedFace[],
  fontFamily: string,
  weight: number,
  fontStyle: string | undefined,
): IndexedFace | undefined {
  const style = fontStyle === "italic" || fontStyle === "oblique" ? "italic" : "normal";
  for (const family of fontFamilyList(fontFamily)) {
    const familyFaces = faces.filter((face) => face.familyKey === family);
    if (familyFaces.length === 0) continue;
    const styled = familyFaces.filter((face) => face.style === style);
    const pool = styled.length > 0 ? styled : familyFaces.filter((face) => face.style === "normal");
    const chosen = nearestWeight(pool.length > 0 ? pool : familyFaces, weight);
    if (chosen) return chosen;
  }
  return undefined;
}

/** CSS font-family list: commas split families, quotes are not part of the name. */
export function fontFamilyList(value: string): string[] {
  const families: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const char of value) {
    if (quote) {
      if (char === quote) quote = undefined;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ",") {
      const name = current.trim().toLowerCase();
      if (name) families.push(name);
      current = "";
      continue;
    }
    current += char;
  }
  const name = current.trim().toLowerCase();
  if (name) families.push(name);
  return families;
}

function nearestWeight(faces: readonly IndexedFace[], weight: number): IndexedFace | undefined {
  const exact = faces.find((face) => face.weight === weight);
  if (exact) return exact;
  const heavier = faces.filter((face) => face.weight > weight).sort((a, b) => a.weight - b.weight);
  const lighter = faces.filter((face) => face.weight < weight).sort((a, b) => b.weight - a.weight);
  if (weight >= 500) return heavier[0] ?? lighter[0];
  return lighter[0] ?? heavier[0];
}

function widthOf(text: string, opts: MeasureOptions): number {
  const key = `${opts.fontFamily ?? ""}\0${opts.fontSize}\0${opts.fontWeight ?? ""}\0${opts.fontStyle ?? ""}\0${opts.letterSpacing ?? 0}\0${text}`;
  const cached = opts.wordWidths?.get(key);
  if (cached !== undefined) return cached;
  const width = opts.measurer
    ? opts.measurer.measure(text, {
      fontFamily: opts.fontFamily ?? "",
      fontSize: opts.fontSize,
      ...(opts.fontWeight !== undefined ? { fontWeight: opts.fontWeight } : {}),
      ...(opts.fontStyle !== undefined ? { fontStyle: opts.fontStyle } : {}),
      ...(opts.letterSpacing !== undefined ? { letterSpacing: opts.letterSpacing } : {}),
    }).width
    : heuristicWidth(text, opts.fontSize, opts.letterSpacing ?? 0);
  opts.wordWidths?.set(key, width);
  return width;
}

export function measureText(text: string, opts: MeasureOptions): TextMetrics {
  const { fontSize, letterSpacing = 0, lineHeight = 1.2 } = opts;
  const measured = opts.measurer
    ? opts.measurer.measure(text, {
      fontFamily: opts.fontFamily ?? "",
      fontSize,
      ...(opts.fontWeight !== undefined ? { fontWeight: opts.fontWeight } : {}),
      ...(opts.fontStyle !== undefined ? { fontStyle: opts.fontStyle } : {}),
      letterSpacing,
    })
    : undefined;
  const width = measured?.width ?? heuristicWidth(text, fontSize, letterSpacing);
  const ascender = measured?.ascent ?? fontSize * 0.8;
  const descender = measured?.descent ?? fontSize * 0.2;
  return {
    width,
    height: fontSize * lineHeight,
    ascender,
    descender,
    lines: [{ text, width, height: fontSize * lineHeight }],
  };
}

export function wrapText(text: string, maxWidth: number, opts: MeasureOptions): { lines: LineBox[]; totalHeight: number } {
  // NBSP and narrow NBSP bind adjacent tokens (for example, 5 fl oz).
  // Other whitespace retains the existing collapsing and wrapping behavior.
  const words = text.split(/[^\S\u00a0\u202f]+/u).filter((word) => word.length > 0);
  const lineHeight = (opts.lineHeight ?? 1.2) * opts.fontSize;
  const lines: LineBox[] = [];
  const space = widthOf(" ", opts);
  const gap = space + (opts.letterSpacing ?? 0) * 2;
  let current: string[] = [];
  let currentWidth = 0;

  const push = (): void => {
    if (current.length === 0) return;
    lines.push({ text: current.join(" "), width: currentWidth, height: lineHeight });
    current = [];
    currentWidth = 0;
  };

  for (const word of words) {
    const wordWidth = widthOf(word, opts);
    if (current.length === 0) {
      current.push(word);
      currentWidth = wordWidth;
      continue;
    }
    const next = currentWidth + gap + wordWidth;
    if (next > maxWidth) {
      push();
      current.push(word);
      currentWidth = wordWidth;
    } else {
      current.push(word);
      currentWidth = next;
    }
  }
  push();
  if (lines.length === 0) lines.push({ text: "", width: 0, height: lineHeight });

  return { lines, totalHeight: lines.length * lineHeight };
}

export function fitText(
  text: string,
  box: { width: number; height: number },
  opts: Omit<MeasureOptions, "fontSize"> & { minSize?: number; maxSize?: number },
): { fontSize: number; lines: LineBox[] } {
  const maxSize = opts.maxSize ?? 120;
  const minSize = opts.minSize ?? 8;
  let lo = minSize;
  let hi = maxSize;
  let best = { fontSize: minSize, lines: [] as LineBox[] };

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { lines, totalHeight } = wrapText(text, box.width, { ...opts, fontSize: mid });
    const maxLineW = Math.max(...lines.map((l) => l.width), 0);
    if (maxLineW <= box.width && totalHeight <= box.height) {
      best = { fontSize: mid, lines };
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
