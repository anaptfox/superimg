import { selectBoundaryFrames } from "../packages/superimg-core/dist/ir.js";

export interface ExampleFrameSample {
  readonly name: string;
  readonly progress?: number;
  readonly frame?: number;
}

export interface ExampleCompositionSchedule {
  readonly totalFrames: number;
  readonly leaves: readonly Readonly<{
    path: string;
    startFrame: number;
    endFrame: number;
  }>[];
}

export const GENERIC_FRAME_SAMPLES = [
  { name: "first", progress: 0 },
  { name: "entrance", progress: 0.1 },
  { name: "early", progress: 0.25 },
  { name: "middle", progress: 0.5 },
  { name: "late", progress: 0.75 },
  { name: "exit", progress: 0.9 },
  { name: "last", progress: 1 },
] as const satisfies readonly ExampleFrameSample[];

function progressFrame(progress: number, totalFrames: number): number {
  if (totalFrames <= 1) return 0;
  return Math.min(totalFrames - 1, Math.max(0, Math.round(progress * (totalFrames - 1))));
}

/** Add exact schedule boundaries while retaining the catalog's generic samples. */
export function exampleFrameSamples(
  schedule?: ExampleCompositionSchedule,
): ExampleFrameSample[] {
  const samples: ExampleFrameSample[] = [...GENERIC_FRAME_SAMPLES];
  if (!schedule || !Number.isSafeInteger(schedule.totalFrames) || schedule.totalFrames < 1) {
    return samples;
  }

  const coveredFrames = new Set(
    GENERIC_FRAME_SAMPLES.map((sample) => progressFrame(sample.progress, schedule.totalFrames)),
  );
  const scheduled = new Map<number, string[]>();
  for (const leaf of schedule.leaves) {
    const boundaries = [
      { name: "before", frame: leaf.startFrame - 1 },
      { name: "entry", frame: leaf.startFrame },
      { name: "exit", frame: leaf.endFrame - 1 },
      { name: "after", frame: leaf.endFrame },
    ];
    for (const frame of selectBoundaryFrames([leaf], schedule.totalFrames)) {
      if (coveredFrames.has(frame)) continue;
      const names = scheduled.get(frame) ?? [];
      for (const boundary of boundaries) {
        if (boundary.frame === frame) names.push(`${leaf.path}:${boundary.name}`);
      }
      scheduled.set(frame, names);
    }
  }

  for (const [frame, names] of [...scheduled.entries()].sort(([a], [b]) => a - b)) {
    samples.push({ name: names.join("/"), frame });
  }
  return samples;
}
