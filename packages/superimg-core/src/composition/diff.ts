import type { CompositionLeafSchedule, CompositionSchedule } from "@superimg/types";

export interface ScheduleRangeChange {
  readonly path: string;
  readonly before?: Readonly<Pick<CompositionLeafSchedule, "startFrame" | "endFrame" | "totalFrames">>;
  readonly after?: Readonly<Pick<CompositionLeafSchedule, "startFrame" | "endFrame" | "totalFrames">>;
}

export interface CompositionScheduleDiff {
  /** Changed, added, or removed occurrences covered by caller-supplied changed paths. */
  readonly changed: readonly ScheduleRangeChange[];
  /** Unchanged occurrence identities whose scheduled range moved or resized. */
  readonly shifted: readonly ScheduleRangeChange[];
  readonly totalFramesChanged: boolean;
  /** Schedule comparison does not establish that rerendered output is cache-safe. */
  readonly cacheSafe: false;
}

const range = (leaf: CompositionLeafSchedule) => Object.freeze({
  startFrame: leaf.startFrame,
  endFrame: leaf.endFrame,
  totalFrames: leaf.totalFrames,
});

function sameRange(a: CompositionLeafSchedule | undefined, b: CompositionLeafSchedule | undefined): boolean {
  return a?.startFrame === b?.startFrame && a?.endFrame === b?.endFrame && a?.totalFrames === b?.totalFrames;
}

/** Compare retained schedules conservatively; changed paths are supplied by the caller. */
export function diffCompositionSchedules(
  before: CompositionSchedule,
  after: CompositionSchedule,
  changedPaths: readonly string[],
): CompositionScheduleDiff {
  const changedSet = new Set(changedPaths);
  const beforeByPath = new Map(before.leaves.map((leaf) => [leaf.path, leaf]));
  const afterByPath = new Map(after.leaves.map((leaf) => [leaf.path, leaf]));
  const paths = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].sort();
  const changed: ScheduleRangeChange[] = [];
  const shifted: ScheduleRangeChange[] = [];

  for (const path of paths) {
    const oldLeaf = beforeByPath.get(path);
    const newLeaf = afterByPath.get(path);
    const isChanged = [...changedSet].some((changedPath) => path === changedPath || path.startsWith(`${changedPath}/`));
    if (isChanged) {
      changed.push(Object.freeze({ path, ...(oldLeaf ? { before: range(oldLeaf) } : {}), ...(newLeaf ? { after: range(newLeaf) } : {}) }));
    } else if (!sameRange(oldLeaf, newLeaf)) {
      shifted.push(Object.freeze({ path, ...(oldLeaf ? { before: range(oldLeaf) } : {}), ...(newLeaf ? { after: range(newLeaf) } : {}) }));
    }
  }

  return Object.freeze({
    changed: Object.freeze(changed),
    shifted: Object.freeze(shifted),
    totalFramesChanged: before.totalFrames !== after.totalFrames,
    cacheSafe: false as const,
  });
}
