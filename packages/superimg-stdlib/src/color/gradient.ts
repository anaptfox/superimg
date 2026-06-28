import { colord } from "colord";

export interface GradientStop {
  offset: number | string;
  color: string;
}

export interface LinearGradientOpts {
  /** Degrees, 0 = top-to-bottom in CSS convention when used as background */
  angle?: number;
  /** CSS position pair e.g. "top left" */
  from?: string;
  to?: string;
}

export interface RadialGradientOpts {
  cx?: string;
  cy?: string;
  r?: string;
}

function formatStop(stop: GradientStop): string {
  const offset =
    typeof stop.offset === "number"
      ? `${Math.round(stop.offset * 1000) / 10}%`
      : stop.offset;
  const c = colord(stop.color);
  return `${c.toRgbString()} ${offset}`;
}

/** CSS `linear-gradient(...)` background value. */
export function linearGradient(stops: GradientStop[], opts: LinearGradientOpts = {}): string {
  const angle = opts.angle ?? 180;
  const parts = stops.map(formatStop).join(", ");
  return `linear-gradient(${angle}deg, ${parts})`;
}

/** CSS `radial-gradient(...)` background value. */
export function radialGradient(stops: GradientStop[], opts: RadialGradientOpts = {}): string {
  const cx = opts.cx ?? "50%";
  const cy = opts.cy ?? "50%";
  const r = opts.r ?? "70%";
  const parts = stops.map(formatStop).join(", ");
  return `radial-gradient(circle at ${cx} ${cy}, ${parts})`;
}

/** Interpolate between two stop lists for animated gradient morphs. */
export function animateGradientStops(
  stopsA: GradientStop[],
  stopsB: GradientStop[],
  progress: number,
): GradientStop[] {
  const n = Math.max(stopsA.length, stopsB.length);
  const result: GradientStop[] = [];
  for (let i = 0; i < n; i++) {
    const a = stopsA[Math.min(i, stopsA.length - 1)]!;
    const b = stopsB[Math.min(i, stopsB.length - 1)]!;
    const offA = typeof a.offset === "number" ? a.offset : parseFloat(a.offset) / 100;
    const offB = typeof b.offset === "number" ? b.offset : parseFloat(b.offset) / 100;
    const offset = offA + (offB - offA) * progress;
    const ca = colord(a.color);
    const cb = colord(b.color);
    result.push({
      offset,
      color: ca.mix(cb, progress).toHex(),
    });
  }
  return result;
}