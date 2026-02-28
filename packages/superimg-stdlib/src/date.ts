/**
 * Date and time utilities for SuperImg templates
 *
 * Provides functions for date formatting, parsing, and manipulation.
 * Uses date-fns for robust date operations.
 */

import {
  format as dfFormat,
  formatDistance,
  parseISO as dfParseISO,
  differenceInDays,
  differenceInSeconds,
} from 'date-fns';

export type DateInput = Date | string | number;

/**
 * Convert various date formats to Date object
 * @param date - Date input
 * @returns Date object
 */
function toDate(date: DateInput): Date {
  if (date instanceof Date) {
    return date;
  }
  if (typeof date === 'string') {
    // Try parsing as ISO first, fall back to Date constructor
    try {
      return dfParseISO(date);
    } catch {
      return new Date(date);
    }
  }
  if (typeof date === 'number') {
    return new Date(date);
  }
  throw new Error(`Invalid date format: ${date}`);
}

/** Legacy token aliases (moment-style) → date-fns tokens */
function normalizeFormatTokens(fmt: string): string {
  return fmt
    .replace(/YYYY/g, 'yyyy')
    .replace(/DD/g, 'dd')
    .replace(/HH/g, 'HH')
    .replace(/mm/g, 'mm')
    .replace(/ss/g, 'ss');
}

/**
 * Format a date using date-fns tokens.
 * Legacy aliases supported: YYYY→yyyy, DD→dd. Full date-fns token set available.
 * Uses UTC for consistent results (ISO dates are UTC-based).
 *
 * @param date - Date to format
 * @param formatStr - Format string (date-fns tokens, e.g. yyyy-MM-dd HH:mm:ss)
 * @returns Formatted date string
 */
export function formatDate(date: DateInput, formatStr: string): string {
  const d = toDate(date);
  const normalized = normalizeFormatTokens(formatStr);
  // Format as UTC: shift to "display" UTC so date-fns uses UTC components
  const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60_000);
  return dfFormat(utcDate, normalized);
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param date - Date to format
 * @returns Relative time string
 */
export function relativeTime(date: DateInput): string {
  const d = toDate(date);
  return formatDistance(d, new Date(), { addSuffix: true });
}

/**
 * Parse an ISO date string
 * @param str - ISO date string (e.g., "2024-01-15T10:30:00Z")
 * @returns Date object
 */
export function parseISO(str: string): Date {
  return dfParseISO(str);
}

/**
 * Convert a date to ISO string
 * @param date - Date to convert
 * @returns ISO date string
 */
export function toISO(date: DateInput): string {
  return toDate(date).toISOString();
}

/**
 * Calculate difference in days between two dates
 * @param d1 - First date
 * @param d2 - Second date
 * @returns Difference in days (absolute value)
 */
export function diffDays(d1: DateInput, d2: DateInput): number {
  return Math.abs(differenceInDays(toDate(d1), toDate(d2)));
}

/**
 * Calculate difference in seconds between two dates
 * @param d1 - First date
 * @param d2 - Second date
 * @returns Difference in seconds (absolute value)
 */
export function diffSeconds(d1: DateInput, d2: DateInput): number {
  return Math.abs(differenceInSeconds(toDate(d1), toDate(d2)));
}
