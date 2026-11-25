import { describe, expect, it } from 'vitest';
import { AFTER, BEFORE, BEATS, CHANGE, DRIVERS, FIXED_MINUTES, costs } from './model.ts';

describe('Braess example', () => {
  it('computes the two equilibria and both unilateral detours', () => {
    expect(BEFORE).toEqual({ first: 20, last: 20, upper: 65, lower: 65, shortcut: 40 });
    expect(AFTER).toEqual({ first: 40, last: 40, upper: 85, lower: 85, shortcut: 80 });
    expect(CHANGE).toBe(15);
  });
  it('makes the shortcut strictly preferable throughout the feasible flow grid', () => {
    for (let upper = 0; upper <= DRIVERS; upper += 100) {
      for (let lower = 0; lower <= DRIVERS - upper; lower += 100) {
        const c = costs(upper, lower, DRIVERS - upper - lower);
        expect(c.first).toBeLessThan(FIXED_MINUTES);
        expect(c.last).toBeLessThan(FIXED_MINUTES);
        expect(c.shortcut).toBeLessThan(c.upper);
        expect(c.shortcut).toBeLessThan(c.lower);
      }
    }
  });
  it('has continuous, non-overlapping narration slots covering seventy seconds', () => {
    expect(BEATS[0].start).toBe(0);
    BEATS.forEach((beat, i) => { expect(beat.end).toBeGreaterThan(beat.start); if (i) expect(beat.start).toBe(BEATS[i - 1].end); });
    expect(BEATS.at(-1)!.end).toBe(70);
  });
});
