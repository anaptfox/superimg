import { describe, it, expect } from 'vitest';
import { markers } from './markers';

describe('markers', () => {
  describe('progress', () => {
    it('calculates progress between markers', () => {
      const m = markers({ a: 0, b: 2 }, 1);
      expect(m.progress('a', 'b')).toBe(0.5);
    });

    it('returns 0 before start marker', () => {
      const m = markers({ a: 2, b: 4 }, 1);
      expect(m.progress('a', 'b')).toBe(0);
    });

    it('returns 1 after end marker', () => {
      const m = markers({ a: 0, b: 2 }, 3);
      expect(m.progress('a', 'b')).toBe(1);
    });

    it('handles zero duration (same marker time)', () => {
      const m = markers({ a: 2, b: 2 }, 2);
      expect(m.progress('a', 'b')).toBe(1);
    });

    it('handles zero duration - before time', () => {
      const m = markers({ a: 2, b: 2 }, 1);
      expect(m.progress('a', 'b')).toBe(0);
    });

    it('clamps progress to 0-1', () => {
      const m = markers({ a: 1, b: 3 }, 5);
      expect(m.progress('a', 'b')).toBe(1);

      const m2 = markers({ a: 1, b: 3 }, 0);
      expect(m2.progress('a', 'b')).toBe(0);
    });

    it('throws for unknown from marker', () => {
      const m = markers({ a: 0 }, 1);
      expect(() => m.progress('x', 'a')).toThrow('Marker "x" not found');
    });

    it('throws for unknown to marker', () => {
      const m = markers({ a: 0 }, 1);
      expect(() => m.progress('a', 'x')).toThrow('Marker "x" not found');
    });
  });

  describe('segment', () => {
    it('returns TimelineEvent spanning markers', () => {
      const m = markers({ a: 1, b: 3 }, 2);
      const seg = m.segment('a', 'b');

      expect(seg.id).toBe('a->b');
      expect(seg.start).toBe(1);
      expect(seg.end).toBe(3);
      expect(seg.duration).toBe(2);
      expect(seg.progress).toBe(0.5);
      expect(seg.active).toBe(true);
    });

    it('segment not active when before start', () => {
      const m = markers({ a: 2, b: 4 }, 1);
      const seg = m.segment('a', 'b');

      expect(seg.progress).toBe(0);
      expect(seg.active).toBe(false);
    });

    it('segment not active when after end', () => {
      const m = markers({ a: 2, b: 4 }, 5);
      const seg = m.segment('a', 'b');

      expect(seg.progress).toBe(1);
      expect(seg.active).toBe(false);
    });

    it('throws for unknown marker', () => {
      const m = markers({ a: 0 }, 1);
      expect(() => m.segment('a', 'x')).toThrow('Marker "x" not found');
    });
  });

  describe('current', () => {
    it('returns TimelineEvent for active segment', () => {
      const m = markers({ intro: 0, main: 2, outro: 5 }, 3);
      const curr = m.current();

      expect(curr?.id).toBe('main->outro');
      expect(curr?.start).toBe(2);
      expect(curr?.end).toBe(5);
      expect(curr?.duration).toBe(3);
      expect(curr?.progress).toBeCloseTo(0.333, 2);
      expect(curr?.active).toBe(true);
    });

    it('returns first segment when at start', () => {
      const m = markers({ intro: 0, main: 2 }, 0);
      const curr = m.current();

      expect(curr?.id).toBe('intro->main');
      expect(curr?.progress).toBe(0);
      expect(curr?.active).toBe(false);
    });

    it('returns last segment with progress 1 when after last', () => {
      const m = markers({ intro: 0, main: 2 }, 5);
      const curr = m.current();

      expect(curr?.id).toBe('intro->main');
      expect(curr?.progress).toBe(1);
      expect(curr?.active).toBe(false);
    });

    it('returns null when before first marker', () => {
      const m = markers({ intro: 2, main: 5 }, 1);
      expect(m.current()).toBeNull();
    });

    it('returns null for empty markers', () => {
      const m = markers({}, 1);
      expect(m.current()).toBeNull();
    });

    it('returns null for single marker', () => {
      const m = markers({ only: 2 }, 3);
      expect(m.current()).toBeNull();
    });
  });

  describe('at', () => {
    it('returns timestamp for marker', () => {
      const m = markers({ intro: 0, main: 2.5, outro: 8 }, 0);

      expect(m.at('intro')).toBe(0);
      expect(m.at('main')).toBe(2.5);
      expect(m.at('outro')).toBe(8);
    });

    it('throws for unknown marker', () => {
      const m = markers({ a: 0 }, 1);
      expect(() => m.at('x')).toThrow('Marker "x" not found');
    });
  });
});
