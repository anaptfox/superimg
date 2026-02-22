/**
 * Text manipulation utilities for SuperImg templates
 *
 * Provides functions for text formatting, truncation, and formatting.
 */

/**
 * Truncate a string to a maximum length
 * @param str - String to truncate
 * @param len - Maximum length
 * @param suffix - Suffix to append (default: "...")
 * @returns Truncated string
 */
export function truncate(str: string, len: number, suffix = "..."): string {
  if (str.length <= len) {
    return str;
  }
  return str.substring(0, len - suffix.length) + suffix;
}

/**
 * Pluralize a word based on count
 * @param n - Count
 * @param singular - Singular form
 * @param plural - Plural form (optional, defaults to singular + 's')
 * @returns Pluralized word
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) {
    return singular;
  }
  return plural || singular + "s";
}

/**
 * Format a number with locale-specific formatting
 * @param num - Number to format
 * @param locale - Locale string (e.g., "en-US", "de-DE")
 * @returns Formatted number string
 */
export function formatNumber(num: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format a number as currency
 * @param num - Number to format
 * @param currency - Currency code (e.g., "USD", "EUR")
 * @param locale - Locale string (e.g., "en-US", "de-DE")
 * @returns Formatted currency string
 */
export function formatCurrency(
  num: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(num);
}

/**
 * Escape HTML special characters
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Convert a string to a URL-friendly slug
 * @param str - String to slugify
 * @returns Slug string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type PadSide = "left" | "right" | "both";

/**
 * Pad a string to a specific length
 * @param str - String to pad
 * @param len - Target length
 * @param char - Padding character (default: " ")
 * @param side - Side to pad ("left", "right", or "both", default: "right")
 * @returns Padded string
 */
export function pad(
  str: string,
  len: number,
  char = " ",
  side: PadSide = "right"
): string {
  const strLen = str.length;
  if (strLen >= len) {
    return str;
  }

  const padding = char.repeat(len - strLen);

  switch (side) {
    case "left":
      return padding + str;
    case "both": {
      const leftPad = Math.floor((len - strLen) / 2);
      const rightPad = len - strLen - leftPad;
      return char.repeat(leftPad) + str + char.repeat(rightPad);
    }
    case "right":
    default:
      return str + padding;
  }
}

/**
 * Wrap text into lines based on maximum characters per line
 * @param text - Text to wrap
 * @param maxCharsPerLine - Maximum characters per line
 * @returns Array of wrapped lines
 */
export function wrap(text: string, maxCharsPerLine: number): string[] {
  if (maxCharsPerLine <= 0) {
    return [text];
  }

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;
    
    if (testLine.length > maxCharsPerLine) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is longer than maxCharsPerLine, add it anyway
        lines.push(word);
        currentLine = "";
      }
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}
