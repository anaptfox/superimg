import type { ArrangeRequest } from '@foxworth/superimg/stdlib/arrange';
import { schedule, type Job } from './model.ts';

export type View = 'timeline' | 'mechanism' | 'compare';
export const SIZE = { width: 1100, height: 620 };
export const DURATION = 6;
const intervals = (jobs: Job[]) => jobs.map(({ id, start, end }) => ({ id, start, end }));

export function makeRequest(view: View, buildMinutes: number): ArrangeRequest {
  const s = schedule(buildMinutes);
  const base = {
    size: SIZE,
    evidence: 'derived' as const,
    source: `ILLUSTRATIVE MODEL · builds ${buildMinutes} min · tests 2 min · edits finish at 2 / 5 / 8 min`,
  };
  if (view === 'mechanism') {
    return {
      pattern: 'mechanism-strip',
      spec: {
        ...base,
        question: 'Which handoff makes the old work matter?',
        workRemoved: 'Separating a computed dependency from an unverified explanation and a proposed scheduling change',
        nodes: [
          { id: 'revision', label: 'Every edit', note: 'a new revision' },
          { id: 'build', label: 'Build queue', note: 'one worker' },
          { id: 'test', label: 'Old tests', note: 'still queued' },
          { id: 'batch', label: 'Batch once', note: 'after last edit' },
        ],
        edges: [
          { from: 'revision', to: 'build', label: 'enqueue', claim: 'derived' },
          { from: 'build', to: 'test', label: 'stale work', claim: 'interpretation' },
          { from: 'test', to: 'batch', label: 'change policy', claim: 'proposal' },
        ],
        layout: { kind: 'pipeline', order: ['revision', 'build', 'test', 'batch'] },
        motion: { phase: 'predict', revealIds: ['build->test', 'test->batch'] },
      },
    };
  }
  const context = [
    // A labeled reference window keeps both the scale and the answer hidden
    // across phases and parameter changes. It is not an agent work interval.
    { id: 'window', label: 'View window', intervals: [{ id: 'window-24', start: 0, end: 24 }] },
    { id: 'edits', label: 'A / edit', intervals: intervals(s.edits) },
    { id: 'builds', label: 'B / build', intervals: intervals(s.builds) },
    { id: 'tests', label: 'C / test r1–2', intervals: intervals(s.tests.slice(0, 2)) },
    { id: 'final', label: 'C / final test', intervals: intervals(s.tests.slice(2)) },
  ];
  return {
    pattern: 'aligned-intervals',
    spec: {
      ...base,
      question: view === 'compare' ? 'What if we build only after the last edit?' : 'When can the final result be ready?',
      workRemoved: 'Computing dependency waits and comparing schedules on the same clock',
      timeRef: { unit: 'min', origin: 0, originLabel: 'one shared clock' },
      tracks: view === 'compare' ? [
        ...context,
        { id: 'batch-build', label: 'Batch / build', intervals: intervals([s.batchBuild]) },
        { id: 'batch-test', label: 'Batch / test', intervals: intervals([s.batchTest]) },
      ] : context,
      motion: {
        phase: 'predict', predict: 'tick',
        revealIds: view === 'compare' ? ['batch-build', 'batch-test'] : ['final'],
      },
    },
  };
}
