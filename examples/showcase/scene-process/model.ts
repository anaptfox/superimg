/** Presentation inputs supplied by a host or an explicitly sampled film clock. */
export interface ProcessData {
  progress: number;
  stamped: boolean;
}

export const INITIAL_PROCESS: ProcessData = { progress: 0.66, stamped: true };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };

/** No stateful advance: seeks and frozen host publications sample the same pose. */
export function sampleProcess(data: ProcessData) {
  if (!Number.isFinite(data.progress)) throw new Error("Process progress must be finite");
  const progress = clamp(data.progress);
  const down = smooth((progress - 0.34) / 0.12);
  const up = smooth((progress - 0.52) / 0.14);
  const travelIn = smooth((progress - 0.16) / 0.18);
  const travelOut = smooth((progress - 0.7) / 0.15);
  return {
    progress,
    workpieceX: 110 + 210 * travelIn + 210 * travelOut,
    toolY: 150 + 66 * (down - up),
    stamped: data.stamped,
    caption: progress < 0.34 ? "Material enters" : progress < 0.7 ? "Tool follows its socket" : "One part, changed appearance",
  };
}

/** The authored demonstration supplies the accepted result explicitly. */
export function filmData(seconds: number): ProcessData {
  const progress = clamp(seconds / 5);
  return { progress, stamped: progress >= 0.5 };
}
