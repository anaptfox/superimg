/** SuperImg-owned lockup. One geometry, many paints. Do not move the mark. */

export const CREAM = "#F3E6C8";
export const INK = "#16120E";
export const RUST = "#C45C26";
export const TEAL = "#2A6B62";
export const PINK = "#E23E6B";

export type PaintName =
  | "cream"
  | "noir"
  | "riso"
  | "split"
  | "bit"
  | "neon"
  | "bauhaus"
  | "ink"
  | "smash";

export const TOUR: PaintName[] = [
  "cream",
  "noir",
  "riso",
  "split",
  "bit",
  "neon",
  "bauhaus",
  "ink",
  "smash",
];

export function ringLeft(cx: number, cy: number, r: number): string {
  return `M ${cx},${cy - r} A ${r} ${r} 0 0 0 ${cx},${cy + r}`;
}

export function ringRight(cx: number, cy: number, r: number): string {
  return `M ${cx},${cy - r} A ${r} ${r} 0 0 1 ${cx},${cy + r}`;
}

export function bar(cx: number, cy: number, r: number): string {
  const x = cx + r * 0.15;
  const w = r * 0.92;
  const h = r * 0.22;
  return `M ${x},${cy - h / 2} h ${w} v ${h} h ${-w} z`;
}

export interface MarkGeom {
  cx: number;
  cy: number;
  r: number;
  wordY: number;
  size: number;
}

export function geom(width: number, height: number): MarkGeom {
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height * 0.46;
  const r = size * 0.18;
  return { cx, cy, r, wordY: cy + r + size * 0.08, size };
}

export function word(g: MarkGeom, fill: string, tracking = 0.42): string {
  return `<text x="${g.cx}" y="${g.wordY}" text-anchor="middle" fill="${fill}" font-family="Fraunces, Palatino, Georgia, serif" font-size="${g.size * 0.055}" font-weight="600" letter-spacing="${tracking}em">SUPERIMG</text>`;
}

function hatch(g: MarkGeom, color: string, gap = 10): string {
  const lines = [];
  for (let x = g.cx - g.r * 2; x < g.cx + g.r * 3; x += gap) {
    lines.push(`<line x1="${x}" y1="${g.cy - g.r * 1.6}" x2="${x + g.r * 1.4}" y2="${g.cy + g.r * 1.6}" stroke="${color}" stroke-width="1.2"/>`);
  }
  return `<g opacity="0.35">${lines.join("")}</g>`;
}

export function paintMark(name: PaintName, g: MarkGeom, opts?: { smashShift?: number }): string {
  const left = ringLeft(g.cx, g.cy, g.r);
  const right = ringRight(g.cx, g.cy, g.r);
  const b = bar(g.cx, g.cy, g.r);
  const stroke = `fill="none" stroke-width="${g.r * 0.14}" stroke-linecap="square"`;
  const shift = opts?.smashShift ?? 0;

  switch (name) {
    case "cream":
      return `<rect width="100%" height="100%" fill="${CREAM}"/>
        <path d="${left}" ${stroke} stroke="${INK}"/>
        <path d="${right}" ${stroke} stroke="${INK}"/>
        <path d="${b}" fill="${INK}"/>
        ${word(g, INK)}`;
    case "noir":
      return `<rect width="100%" height="100%" fill="${INK}"/>
        ${hatch(g, CREAM, 9)}
        <path d="${left}" ${stroke} stroke="${CREAM}"/>
        <path d="${right}" ${stroke} stroke="${CREAM}"/>
        <path d="${b}" fill="${CREAM}"/>
        ${word(g, CREAM, 0.5)}`;
    case "riso":
      return `<rect width="100%" height="100%" fill="${CREAM}"/>
        <g transform="translate(-3,2)" opacity="0.7"><path d="${left}" ${stroke} stroke="${PINK}"/><path d="${right}" ${stroke} stroke="${PINK}"/><path d="${b}" fill="${PINK}"/></g>
        <g transform="translate(3,-2)" opacity="0.7"><path d="${left}" ${stroke} stroke="${TEAL}"/><path d="${right}" ${stroke} stroke="${TEAL}"/><path d="${b}" fill="${TEAL}"/></g>
        ${word(g, INK)}`;
    case "split":
      return `<rect width="100%" height="100%" fill="${CREAM}"/>
        <g transform="translate(-2.5,0)" opacity="0.7"><path d="${left}" ${stroke} stroke="#FF2A2A"/><path d="${right}" ${stroke} stroke="#FF2A2A"/><path d="${b}" fill="#FF2A2A"/></g>
        <g transform="translate(2.5,0)" opacity="0.7"><path d="${left}" ${stroke} stroke="#2A6BFF"/><path d="${right}" ${stroke} stroke="#2A6BFF"/><path d="${b}" fill="#2A6BFF"/></g>
        <path d="${left}" ${stroke} stroke="${INK}"/><path d="${right}" ${stroke} stroke="${INK}"/><path d="${b}" fill="${INK}"/>
        ${word(g, INK)}`;
    case "bit":
      return `<rect width="100%" height="100%" fill="#0B1220"/>
        <path d="${left}" ${stroke} stroke="#7CFF6B" stroke-width="${g.r * 0.2}"/>
        <path d="${right}" ${stroke} stroke="#7CFF6B" stroke-width="${g.r * 0.2}"/>
        <path d="${b}" fill="#7CFF6B"/>
        ${word(g, "#7CFF6B", 0.62)}`;
    case "neon":
      return `<rect width="100%" height="100%" fill="#07070C"/>
        <path d="${left}" ${stroke} stroke="${RUST}" style="filter:blur(6px)"/>
        <path d="${right}" ${stroke} stroke="${RUST}" style="filter:blur(6px)"/>
        <path d="${left}" ${stroke} stroke="${CREAM}"/>
        <path d="${right}" ${stroke} stroke="${CREAM}"/>
        <path d="${b}" fill="${CREAM}"/>
        ${word(g, CREAM)}`;
    case "bauhaus":
      return `<rect width="100%" height="100%" fill="${CREAM}"/>
        <circle cx="${g.cx - g.r}" cy="${g.cy}" r="${g.r * 0.55}" fill="${RUST}"/>
        <circle cx="${g.cx + g.r * 0.2}" cy="${g.cy - g.r * 0.7}" r="${g.r * 0.35}" fill="${TEAL}"/>
        <path d="${left}" ${stroke} stroke="${INK}"/>
        <path d="${right}" ${stroke} stroke="${INK}"/>
        <path d="${b}" fill="${INK}"/>
        ${word(g, INK)}`;
    case "ink":
      return `<rect width="100%" height="100%" fill="${CREAM}"/>
        ${hatch(g, INK, 6)}
        <path d="${left}" ${stroke} stroke="${INK}" stroke-width="${g.r * 0.18}"/>
        <path d="${right}" ${stroke} stroke="${INK}" stroke-width="${g.r * 0.18}"/>
        <path d="${b}" fill="${INK}"/>
        ${word(g, INK, 0.28)}`;
    case "smash":
      return `<rect width="100%" height="100%" fill="${INK}"/>
        <g transform="translate(${shift},0)">
          <path d="${left}" ${stroke} stroke="${CREAM}"/>
          <path d="${right}" ${stroke} stroke="${RUST}"/>
          <path d="${b}" fill="${CREAM}"/>
        </g>
        ${word(g, CREAM, 0.7)}`;
  }
}

export function svgFrame(width: number, height: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block">${inner}</svg>`;
}
