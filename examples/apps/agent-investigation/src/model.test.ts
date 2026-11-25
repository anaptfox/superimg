import { describe, expect, it } from 'vitest';
import { arrange } from '@foxworth/superimg/stdlib/arrange';
import { schedule } from './model.ts';
import { makeRequest, type View } from './requests.ts';
import { makeMedia } from './investigation.media.ts';

describe('illustrative agent investigation', () => {
  it('distinguishes worker time saved from a faster final result', () => {
    expect(schedule(1)).toMatchObject({ finish: 11, batchFinish: 11, workerMinutesSaved: 6 });
    expect(schedule(4)).toMatchObject({ finish: 16, batchFinish: 14, workerMinutesSaved: 12 });
    expect(schedule(6)).toMatchObject({ finish: 22, batchFinish: 16, workerMinutesSaved: 16 });
  });

  it('respects release times and serial workers throughout the supported range', () => {
    for (let minutes = 1; minutes <= 6; minutes++) {
      const s = schedule(minutes);
      s.builds.forEach((job, i) => {
        expect(job.start).toBeGreaterThanOrEqual(s.edits[i].end);
        if (i) expect(job.start).toBeGreaterThanOrEqual(s.builds[i - 1].end);
        expect(s.tests[i].start).toBeGreaterThanOrEqual(job.end);
        if (i) expect(s.tests[i].start).toBeGreaterThanOrEqual(s.tests[i - 1].end);
      });
      expect(s.batchFinish).toBeLessThanOrEqual(s.finish);
    }
  });

  it('admits every generated request and all three phases through SuperImg', () => {
    for (const view of ['timeline', 'mechanism', 'compare'] as View[]) {
      for (let minutes = 1; minutes <= 6; minutes++) {
        const parsed = arrange.parseRequest(JSON.parse(JSON.stringify(makeRequest(view, minutes))));
        expect(arrange.checkRequest(parsed)).toEqual([]);
        for (const phase of ['hold', 'predict', 'reveal'] as const) {
          expect(() => arrange.renderRequest(parsed, phase)).not.toThrow();
        }
      }
    }
  });

  it('refuses an undeclared edge endpoint before creating a media value', () => {
    const broken = makeRequest('mechanism', 4);
    if (broken.pattern !== 'mechanism-strip') throw new Error('Wrong fixture');
    broken.spec.edges[1].to = 'undeclared-agent';
    expect(() => makeMedia(broken)).toThrow('missing-correspondence');
  });
});
