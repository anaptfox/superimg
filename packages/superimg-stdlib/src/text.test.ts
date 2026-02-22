import { describe, it, expect } from 'vitest';
import {
  truncate,
  pluralize,
  formatNumber,
  formatCurrency,
  escapeHtml,
  slugify,
  pad,
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
