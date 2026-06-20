type TrackerWindows<K extends string> = Record<K, [number, number]>;
type Tracker<K extends string> = { [key in K]: number };

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function tracker<K extends string>(
  progress: number,
  windows: TrackerWindows<K>
): Tracker<K> {
  const result = {} as Tracker<K>;
  for (const key in windows) {
    const [start, end] = windows[key];
    const span = end - start;
    const raw = span <= 0 ? 1 : (progress - start) / span;
    result[key as K] = easeInOutCubic(clamp(raw, 0, 1));
  }
  return result;
}
