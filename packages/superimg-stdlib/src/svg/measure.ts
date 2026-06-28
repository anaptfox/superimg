export interface MeasureOptions {
  fontSize: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
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

/** Approximate metrics (~0.55em avg glyph width). Works browser-free in resvg. */
function heuristicWidth(text: string, fontSize: number, letterSpacing = 0): number {
  return text.length * fontSize * 0.55 + Math.max(0, text.length - 1) * letterSpacing;
}

export function measureText(text: string, opts: MeasureOptions): TextMetrics {
  const { fontSize, letterSpacing = 0, lineHeight = 1.2 } = opts;
  const width = heuristicWidth(text, fontSize, letterSpacing);
  const ascender = fontSize * 0.8;
  const descender = fontSize * 0.2;
  return {
    width,
    height: fontSize * lineHeight,
    ascender,
    descender,
    lines: [{ text, width, height: fontSize * lineHeight }],
  };
}

export function wrapText(text: string, maxWidth: number, opts: MeasureOptions): { lines: LineBox[]; totalHeight: number } {
  const words = text.split(/\s+/);
  const lineHeight = (opts.lineHeight ?? 1.2) * opts.fontSize;
  const lines: LineBox[] = [];
  let current = "";

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    const m = measureText(trial, opts);
    if (m.width > maxWidth && current) {
      const cm = measureText(current, opts);
      lines.push({ text: current, width: cm.width, height: lineHeight });
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) {
    const cm = measureText(current, opts);
    lines.push({ text: current, width: cm.width, height: lineHeight });
  }

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