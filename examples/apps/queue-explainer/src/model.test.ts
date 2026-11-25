import { describe, expect, it } from 'vitest';
import { INITIAL, sampleQueue, explainQueue } from './model.ts';
import { applyDirection, direction, parseDirection, RequestGate } from './commands.ts';

describe('FIFO queue', () => {
  it('starts empty and conserves every arrived job', () => {
    expect(sampleQueue(0, INITIAL).arrived).toBe(0);
    for (const workers of [1, 2, 4, 6]) for (const arrivalRate of [.5, 2, 3, 6]) {
      for (let seconds = 0; seconds <= 24; seconds += .25) {
        const q = sampleQueue(seconds, { ...INITIAL, workers, arrivalRate });
        expect(q.arrived).toBe(q.completed + q.busy + q.waiting);
        expect(q.busy).toBeLessThanOrEqual(workers);
        for (const job of q.jobs) expect(job.start).toBeGreaterThanOrEqual(job.arrival);
      }
    }
  });
  it('finishes work at the exact service boundary and assigns FIFO', () => {
    const data = { ...INITIAL, workers: 1, arrivalRate: 2 };
    expect(sampleQueue(2.5, data)).toMatchObject({ arrived: 5, completed: 1, busy: 1, waiting: 3 });
    expect(sampleQueue(2.5, data).jobs[1]).toMatchObject({ id: 2, start: 2.5, end: 4.5 });
  });
  it('exposes the difference made by half as many workers', () => {
    expect(sampleQueue(12, INITIAL).waiting).toBe(0);
    expect(sampleQueue(12, { ...INITIAL, workers: 2 }).waiting).toBe(12);
    expect(explainQueue(12, { ...INITIAL, workers: 2 })).toContain('exceed capacity by 1.0');
  });
  it('does not depend on playback history', () => {
    const before = sampleQueue(12, INITIAL);
    sampleQueue(24, { ...INITIAL, workers: 1 });
    expect(sampleQueue(12, INITIAL)).toEqual(before);
  });
});
describe('bounded directions', () => {
  it('rejects malformed, out-of-range, and unrelated mutations', () => {
    for (const value of [null, {}, direction('configure', { workers: 7 }), direction('configure', { workers: 1.5 }), direction('configure', { arrivalRate: NaN }), direction('pause', { workers: 2 }), direction('configure'), direction('highlight'), { ...direction('pause'), code: 'evil()' }]) {
      expect(() => parseDirection(value)).toThrow();
    }
  });
  it('direct controls and AI use exactly the same state transition', () => {
    const command = direction('configure', { workers: 2 });
    expect(applyDirection(INITIAL, parseDirection(JSON.parse(JSON.stringify(command))))).toEqual(applyDirection(INITIAL, command));
    expect(INITIAL.workers).toBe(4);
  });
  it('invalidates a reply when a newer user action happens', () => {
    const gate = new RequestGate();
    const first = gate.begin();
    gate.invalidate();
    expect(first.signal.aborted).toBe(true);
    expect(gate.accepts(first.revision)).toBe(false);
    const next = gate.begin();
    expect(gate.accepts(next.revision)).toBe(true);
  });
});
