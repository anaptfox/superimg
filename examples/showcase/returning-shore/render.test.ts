import { describe, expect, it } from 'vitest';
import { INITIAL_SHORE, sampleShore } from './model';
import { renderShore } from './render';

describe('pigment paint remains seekable with cached home facets', () => {
  it('reproduces identical typed paint after shuffled time, fidelity and size changes', () => {
    const film = { ...INITIAL_SHORE, live: false };
    const snapshot = sampleShore(film, { seconds: 10.5 });
    const view = { width: 1280, height: 720, teaching: false };
    const expected = JSON.stringify(renderShore(snapshot, view));
    for (const time of [24, 5, 15.5, 1.4, 8.5]) {
      renderShore(sampleShore({ ...film, fidelity: 'reduced' }, { seconds: time }), { ...view, width: 3840, height: 2160 });
      expect(JSON.stringify(renderShore(snapshot, view))).toBe(expected);
    }
  });
});
