import { describe, it, expect } from 'vitest';
import {
  truncate,
  pluralize,
  formatNumber,
  formatCurrency,
  escapeHtml,
  slugify,
  pad,
  type,
  typeDuration,
  cursor,
} from './text';

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 5)).toBe('He...');
  });

  it('returns original if shorter than limit', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  it('uses custom suffix', () => {
    expect(truncate('Hello World', 5, '…')).toBe('Hell…');
  });
});

describe('pluralize', () => {
  it('returns singular for 1', () => {
    expect(pluralize(1, 'item')).toBe('item');
  });

  it('returns plural for 0', () => {
    expect(pluralize(0, 'item')).toBe('items');
  });

  it('returns plural for multiple', () => {
    expect(pluralize(5, 'item')).toBe('items');
  });

  it('uses custom plural', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children');
  });
});

describe('formatNumber', () => {
  it('formats numbers with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('handles decimals', () => {
    const formatted = formatNumber(1234.56);
    expect(formatted).toContain('1,234');
  });
});

describe('formatCurrency', () => {
  it('formats as USD by default', () => {
    const formatted = formatCurrency(1234.56);
    expect(formatted).toContain('1,234');
    expect(formatted).toContain('$');
  });

  it('formats as EUR', () => {
    const formatted = formatCurrency(1234.56, 'EUR');
    expect(formatted).toContain('1,234');
  });
});

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
    expect(escapeHtml("'apostrophe'")).toBe('&#039;apostrophe&#039;');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('leaves safe characters unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('trims hyphens from ends', () => {
    expect(slugify('-Hello World-')).toBe('hello-world');
  });

  it('handles multiple spaces', () => {
    expect(slugify('Hello    World')).toBe('hello-world');
  });
});

describe('pad', () => {
  it('pads right by default', () => {
    expect(pad('hi', 5)).toBe('hi   ');
  });

  it('pads left', () => {
    expect(pad('hi', 5, ' ', 'left')).toBe('   hi');
  });

  it('pads both sides', () => {
    const result = pad('hi', 7, ' ', 'both');
    expect(result.length).toBe(7);
    expect(result).toContain('hi');
  });

  it('uses custom padding character', () => {
    expect(pad('hi', 5, '0')).toBe('hi000');
  });

  it('returns original if already long enough', () => {
    expect(pad('hello', 3)).toBe('hello');
  });
});

// ---------------------------------------------------------------------------
// Typing primitives
// ---------------------------------------------------------------------------

describe('type', () => {
  describe('char granularity (default)', () => {
    it('returns empty at progress 0', () => {
      const result = type('Hello', 0);
      expect(result.visible).toBe('');
      expect(result.typing).toBe(false);
      expect(result.done).toBe(false);
      expect(result.index).toBe(0);
      expect(result.total).toBe(5);
    });

    it('returns full text at progress 1', () => {
      const result = type('Hello', 1);
      expect(result.visible).toBe('Hello');
      expect(result.typing).toBe(false);
      expect(result.done).toBe(true);
    });

    it('reveals characters progressively', () => {
      const result = type('Hello', 0.5);
      expect(result.visible).toBe('He');
      expect(result.typing).toBe(true);
      expect(result.done).toBe(false);
      expect(result.index).toBe(2);
    });

    it('clamps progress above 1', () => {
      const result = type('Hi', 1.5);
      expect(result.visible).toBe('Hi');
      expect(result.done).toBe(true);
    });

    it('clamps progress below 0', () => {
      const result = type('Hi', -0.5);
      expect(result.visible).toBe('');
      expect(result.done).toBe(false);
    });

    it('handles empty string', () => {
      const result = type('', 0.5);
      expect(result.visible).toBe('');
      expect(result.total).toBe(0);
    });
  });

  describe('cursorVisible', () => {
    it('is true (solid) while typing', () => {
      const result = type('Hello', 0.5);
      expect(result.cursorVisible).toBe(true);
      expect(result.typing).toBe(true);
    });

    it('blinks when done (depends on time)', () => {
      // cursor(0, 3) => floor(0) % 2 === 0 => true
      const r1 = type('Hi', 1, { time: 0 });
      expect(r1.cursorVisible).toBe(true);
      // cursor(0.34, 3) => floor(1.02) % 2 === 1 => false
      const r2 = type('Hi', 1, { time: 0.34 });
      expect(r2.cursorVisible).toBe(false);
    });

    it('blinks at progress 0 (not started)', () => {
      const r1 = type('Hi', 0, { time: 0 });
      expect(r1.cursorVisible).toBe(true);
      const r2 = type('Hi', 0, { time: 0.34 });
      expect(r2.cursorVisible).toBe(false);
    });
  });

  describe('variance', () => {
    it('variance 0 produces same results as default', () => {
      const text = 'Hello\nWorld';
      const r1 = type(text, 0.5);
      const r2 = type(text, 0.5, { variance: 0 });
      expect(r1.visible).toBe(r2.visible);
      expect(r1.index).toBe(r2.index);
    });

    it('variance causes newlines to be reached later', () => {
      const text = 'ab\ncd';
      // Without variance: progress 0.5 => index 2 => visible 'ab'
      const uniform = type(text, 0.5);
      // With variance: newline at index 2 has extra weight,
      // so at the same progress fewer chars are revealed
      const varied = type(text, 0.5, { variance: 1 });
      expect(varied.index).toBeLessThanOrEqual(uniform.index);
    });

    it('completes at progress 1 regardless of variance', () => {
      const text = 'Hello{World}';
      const result = type(text, 1, { variance: 1 });
      expect(result.visible).toBe(text);
      expect(result.done).toBe(true);
    });

    it('empty at progress 0 regardless of variance', () => {
      const result = type('Hello', 0, { variance: 1 });
      expect(result.visible).toBe('');
    });

    it('handles empty string with variance', () => {
      const result = type('', 0.5, { variance: 1 });
      expect(result.visible).toBe('');
      expect(result.total).toBe(0);
    });

    it('handles single char with variance', () => {
      const result = type('x', 1, { variance: 1 });
      expect(result.visible).toBe('x');
    });
  });

  describe('word granularity', () => {
    it('reveals word by word', () => {
      const text = 'Hello World Foo';
      // 3 words, progress 0.5 => floor(1.5) = 1 word visible
      const result = type(text, 0.5, { by: 'word' });
      expect(result.visible).toBe('Hello');
      expect(result.total).toBe(3);
      expect(result.index).toBe(1);
    });

    it('returns full text at progress 1', () => {
      const result = type('Hello World', 1, { by: 'word' });
      expect(result.visible).toBe('Hello World');
      expect(result.done).toBe(true);
    });

    it('returns empty at progress 0', () => {
      const result = type('Hello World', 0, { by: 'word' });
      expect(result.visible).toBe('');
    });

    it('shows two of three words at 2/3 progress', () => {
      // 3 words, progress ~0.7 => floor(2.1) = 2 words
      const result = type('one two three', 0.7, { by: 'word' });
      expect(result.visible).toBe('one two');
    });
  });

  describe('line granularity', () => {
    const code = 'line1\nline2\nline3';

    it('reveals line by line', () => {
      // 3 lines, progress 0.5 => floor(1.5) = 1 line
      const result = type(code, 0.5, { by: 'line' });
      expect(result.visible).toBe('line1');
      expect(result.total).toBe(3);
    });

    it('returns full text at progress 1', () => {
      const result = type(code, 1, { by: 'line' });
      expect(result.visible).toBe(code);
    });

    it('returns empty at progress 0', () => {
      const result = type(code, 0, { by: 'line' });
      expect(result.visible).toBe('');
    });

    it('shows two of three lines at 2/3 progress', () => {
      const result = type(code, 0.7, { by: 'line' });
      expect(result.visible).toBe('line1\nline2');
    });
  });
});

describe('typeDuration', () => {
  it('uses default char speed (30 chars/sec)', () => {
    // 30 chars at 30 chars/sec = 1 second
    const text = 'a'.repeat(30);
    expect(typeDuration(text)).toBe(1);
  });

  it('uses default word speed (5 words/sec)', () => {
    // 5 words at 5 words/sec = 1 second
    expect(typeDuration('one two three four five', { by: 'word' })).toBe(1);
  });

  it('uses default line speed (2 lines/sec)', () => {
    // 4 lines at 2 lines/sec = 2 seconds
    expect(typeDuration('a\nb\nc\nd', { by: 'line' })).toBe(2);
  });

  it('accepts custom speed', () => {
    // 10 chars at 10 chars/sec = 1 second
    const text = 'a'.repeat(10);
    expect(typeDuration(text, { speed: 10 })).toBe(1);
  });

  it('returns 0 for speed <= 0', () => {
    expect(typeDuration('hello', { speed: 0 })).toBe(0);
    expect(typeDuration('hello', { speed: -1 })).toBe(0);
  });

  it('handles empty string', () => {
    expect(typeDuration('')).toBe(0);
  });
});

describe('cursor', () => {
  it('returns true at time 0', () => {
    expect(cursor(0)).toBe(true);
  });

  it('blinks at default rate', () => {
    // rate=3: toggles every 1/3 second
    // time=0 => floor(0)=0 => even => true
    expect(cursor(0)).toBe(true);
    // time=0.17 => floor(0.51)=0 => even => true
    expect(cursor(0.17)).toBe(true);
    // time=0.34 => floor(1.02)=1 => odd => false
    expect(cursor(0.34)).toBe(false);
    // time=0.67 => floor(2.01)=2 => even => true
    expect(cursor(0.67)).toBe(true);
  });

  it('accepts custom rate', () => {
    // rate=1: toggles every second
    expect(cursor(0, 1)).toBe(true);
    expect(cursor(0.5, 1)).toBe(true);
    expect(cursor(1.0, 1)).toBe(false);
    expect(cursor(2.0, 1)).toBe(true);
  });
});

