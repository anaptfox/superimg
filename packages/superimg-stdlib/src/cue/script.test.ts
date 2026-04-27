import { describe, it, expect } from 'vitest';
import { script } from './script';

describe('script', () => {
  describe('get / trigger', () => {
    it('returns TimelineEvent for event', () => {
      const s = script([{ id: 'a', time: 1, duration: 2 }], 2);
      const e = s.get('a');

      expect(e.id).toBe('a');
      expect(e.progress).toBe(0.5);
      expect(e.active).toBe(true);
      expect(e.start).toBe(1);
      expect(e.end).toBe(3);
      expect(e.duration).toBe(2);
    });

    it('returns progress 0 before event', () => {
      const s = script([{ id: 'a', time: 2, duration: 1 }], 1);
      const e = s.get('a');

      expect(e.progress).toBe(0);
      expect(e.active).toBe(false);
    });

    it('returns progress 1 after event', () => {
      const s = script([{ id: 'a', time: 1, duration: 1 }], 3);
      const e = s.get('a');

      expect(e.progress).toBe(1);
      expect(e.active).toBe(false);
    });

    it('throws for unknown event', () => {
      const s = script([], 0);
      expect(() => s.get('x')).toThrow('Script event "x" not found');
    });
  });

  describe('duration auto-calculation', () => {
    it('uses explicit duration when provided', () => {
      const s = script([{ id: 'a', time: 0, duration: 2 }], 0);
      expect(s.get('a').duration).toBe(2);
    });

    it('auto-calculates duration until next event (capped at 0.5)', () => {
      const s = script(
        [
          { id: 'a', time: 0 },
          { id: 'b', time: 1 },
        ],
        0
      );
      expect(s.get('a').duration).toBe(0.5); // capped at DEFAULT_DURATION
    });

    it('auto-calculates duration until next event (when gap < 0.5)', () => {
      const s = script(
        [
          { id: 'a', time: 0 },
          { id: 'b', time: 0.3 },
        ],
        0
      );
      expect(s.get('a').duration).toBe(0.3); // gap is less than 0.5
    });

    it('uses default duration for last event', () => {
      const s = script([{ id: 'a', time: 0 }], 0);
      expect(s.get('a').duration).toBe(0.5); // DEFAULT_DURATION
    });
  });

  describe('current', () => {
    it('returns active event', () => {
      const s = script(
        [
          { id: 'a', time: 0, duration: 1 },
          { id: 'b', time: 2, duration: 1 },
        ],
        2.5
      );

      expect(s.current()?.id).toBe('b');
    });

    it('returns null when no event is active', () => {
      const s = script(
        [
          { id: 'a', time: 0, duration: 1 },
          { id: 'b', time: 3, duration: 1 },
        ],
        2 // gap between events
      );

      expect(s.current()).toBeNull();
    });

    it('returns null before first event', () => {
      const s = script([{ id: 'a', time: 2, duration: 1 }], 1);
      expect(s.current()).toBeNull();
    });

    it('returns null for empty script', () => {
      const s = script([], 0);
      expect(s.current()).toBeNull();
    });
  });

  describe('all', () => {
    it('returns all events as TimelineEvents', () => {
      const s = script(
        [
          { id: 'a', time: 0, duration: 1 },
          { id: 'b', time: 2, duration: 1 },
        ],
        0
      );

      const all = s.all();
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe('a');
      expect(all[1].id).toBe('b');
    });

    it('returns events sorted by time', () => {
      const s = script(
        [
          { id: 'b', time: 2 },
          { id: 'a', time: 0 },
          { id: 'c', time: 1 },
        ],
        0
      );

      const all = s.all();
      expect(all[0].id).toBe('a');
      expect(all[1].id).toBe('c');
      expect(all[2].id).toBe('b');
    });

    it('returns empty array for empty script', () => {
      const s = script([], 0);
      expect(s.all()).toEqual([]);
    });
  });

  describe('zero duration events', () => {
    it('handles zero duration event at time', () => {
      const s = script([{ id: 'a', time: 2, duration: 0 }], 2);
      const e = s.get('a');

      expect(e.progress).toBe(1);
      expect(e.active).toBe(false);
    });

    it('handles zero duration event before time', () => {
      const s = script([{ id: 'a', time: 2, duration: 0 }], 1);
      const e = s.get('a');

      expect(e.progress).toBe(0);
      expect(e.active).toBe(false);
    });
  });
});
