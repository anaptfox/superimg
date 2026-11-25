/** Illustrative scheduling model, not a measured agent trace. */
export interface Job { id: string; start: number; end: number; revision: number }
export interface Schedule {
  edits: Job[];
  builds: Job[];
  tests: Job[];
  batchBuild: Job;
  batchTest: Job;
  finish: number;
  batchFinish: number;
  workerMinutesSaved: number;
}

export function schedule(buildMinutes: number): Schedule {
  if (!Number.isInteger(buildMinutes) || buildMinutes < 1 || buildMinutes > 6) {
    throw new RangeError('Build duration must be an integer from 1 to 6 minutes.');
  }
  const edits = [
    { id: 'edit-r1', revision: 1, start: 0, end: 2 },
    { id: 'edit-r2', revision: 2, start: 2, end: 5 },
    { id: 'edit-r3', revision: 3, start: 5, end: 8 },
  ];
  let builderFree = 0;
  const builds = edits.map(edit => {
    const start = Math.max(edit.end, builderFree);
    builderFree = start + buildMinutes;
    return { id: `build-r${edit.revision}`, revision: edit.revision, start, end: builderFree };
  });
  let testerFree = 0;
  const tests = builds.map(build => {
    const start = Math.max(build.end, testerFree);
    testerFree = start + 2;
    return { id: `test-r${build.revision}`, revision: build.revision, start, end: testerFree };
  });
  const batchBuild = { id: 'batch-build-r3', revision: 3, start: 8, end: 8 + buildMinutes };
  const batchTest = { id: 'batch-test-r3', revision: 3, start: batchBuild.end, end: batchBuild.end + 2 };
  return { edits, builds, tests, batchBuild, batchTest, finish: testerFree, batchFinish: batchTest.end, workerMinutesSaved: 2 * buildMinutes + 4 };
}
