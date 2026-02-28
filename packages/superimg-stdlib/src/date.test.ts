import { describe, it, expect } from 'vitest';
import {
  formatDate,
  relativeTime,
  parseISO,
  toISO,
  diffDays,
  diffSeconds,
} from './date';

describe('formatDate', () => {
  it('formats date with legacy tokens (YYYY, DD)', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
    expect(formatDate(date, 'HH:mm:ss')).toBe('10:30:00');
  });

  it('formats date with date-fns native tokens', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date, 'yyyy-MM-dd')).toBe('2024-01-15');
    expect(formatDate(date, 'yyyy-MM-dd HH:mm:ss')).toBe('2024-01-15 10:30:00');
  });

  it('uses UTC components (timezone-independent)', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2024-01-15 10:30:00');
  });

  it('handles Date objects', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2024-01-15');
  });

  it('handles ISO strings', () => {
    expect(formatDate('2024-01-15T10:30:00Z', 'YYYY-MM-DD')).toBe('2024-01-15');
  });

  it('handles timestamps', () => {
    const timestamp = new Date('2024-01-15').getTime();
    expect(formatDate(timestamp, 'YYYY-MM-DD')).toBe('2024-01-15');
  });
});

describe('relativeTime', () => {
  it('returns relative time string', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const result = relativeTime(oneHourAgo);
    expect(result).toContain('hour');
  });

  it('handles future dates', () => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const result = relativeTime(oneHourLater);
    expect(result).toContain('hour');
  });
});

describe('parseISO', () => {
  it('parses ISO date strings', () => {
    const date = parseISO('2024-01-15T10:30:00Z');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January is 0
    expect(date.getDate()).toBe(15);
  });
});

describe('toISO', () => {
  it('converts date to ISO string', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const iso = toISO(date);
    expect(iso).toContain('2024-01-15');
    expect(iso).toContain('T');
  });

  it('handles Date objects', () => {
    const date = new Date();
    const iso = toISO(date);
    expect(iso).toBe(date.toISOString());
  });
});

describe('diffDays', () => {
  it('calculates difference in days', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-11');
    expect(diffDays(d1, d2)).toBe(10);
  });

  it('returns absolute value', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-11');
    expect(diffDays(d2, d1)).toBe(10);
  });

  it('handles same day', () => {
    const d1 = new Date('2024-01-01');
    expect(diffDays(d1, d1)).toBe(0);
  });
});

describe('diffSeconds', () => {
  it('calculates difference in seconds', () => {
    const d1 = new Date('2024-01-01T00:00:00Z');
    const d2 = new Date('2024-01-01T00:00:10Z');
    expect(diffSeconds(d1, d2)).toBe(10);
  });

  it('returns absolute value', () => {
    const d1 = new Date('2024-01-01T00:00:00Z');
    const d2 = new Date('2024-01-01T00:00:10Z');
    expect(diffSeconds(d2, d1)).toBe(10);
  });

  it('handles same time', () => {
    const d1 = new Date('2024-01-01T00:00:00Z');
    expect(diffSeconds(d1, d1)).toBe(0);
  });
});
