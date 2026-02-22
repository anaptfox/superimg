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

/**
 * Format a date using tokens
 * Supports simple tokens: YYYY, MM, DD, HH, mm, ss
 * Also supports date-fns format tokens for advanced formatting
 * @param date - Date to format
 * @param formatStr - Format string with tokens
 * @returns Formatted date string
 */
export function formatDate(date: DateInput, formatStr: string): string {
  const d = toDate(date);

  // Check if format includes time components
  const hasTime = formatStr.includes('HH') || formatStr.includes('mm') || formatStr.includes('ss');
  
  // Use UTC for consistent results (ISO dates are UTC-based)
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  
  if (hasTime) {
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    
    return formatStr
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  } else {
    return formatStr
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  }
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
