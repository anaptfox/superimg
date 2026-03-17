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

// ---------------------------------------------------------------------------
// Typing primitives
// ---------------------------------------------------------------------------

/** Granularity for text reveal */
export type TypeGranularity = "char" | "word" | "line";

/** Options for type() */
export interface TypeOptions {
  /** Reveal granularity: 'char' (default), 'word', or 'line' */
  by?: TypeGranularity;
}

/** Result of type() */
export interface TypeResult {
  /** The visible portion of text */
  visible: string;
  /** True while typing is in progress (0 < progress < 1) */
  typing: boolean;
  /** True when typing is complete (progress >= 1) */
  done: boolean;
  /** Number of visible units (chars, words, or lines depending on granularity) */
  index: number;
  /** Total number of units */
  total: number;
}

/**
 * Progress-driven text reveal.
 *
 * Takes a string and a progress value (0–1) and returns the visible portion.
 * Compose with `std.code.highlight()` for syntax-highlighted code typing,
 * or with `std.timeline` to sequence multiple typing events.
 *
 * @param text - Full text to reveal
 * @param progress - Progress value, typically 0–1 (clamped internally)
 * @param options - Options for granularity
 * @returns TypeResult with visible text and state
 *
 * @example
 * ```ts
 * // Character-by-character (default)
 * const { visible, typing } = std.text.type("Hello!", progress);
 *
 * // Word-by-word
 * const { visible } = std.text.type("Hello World", progress, { by: 'word' });
 *
 * // Line-by-line (great for code)
 * const { visible } = std.text.type(CODE, progress, { by: 'line' });
 * const highlighted = std.code.highlight(visible, { lang: 'typescript' });
 * ```
 */
export function type(
  text: string,
  progress: number,
  options?: TypeOptions
): TypeResult {
  const clamped = Math.max(0, Math.min(1, progress));
  const by = options?.by ?? "char";

  let total: number;
  let index: number;
  let visible: string;

  switch (by) {
    case "word": {
      // Split preserving whitespace structure
      const words = text.split(/(\s+)/);
      // Count only actual words (non-whitespace tokens)
      const wordTokens: number[] = [];
      for (let i = 0; i < words.length; i++) {
        if (words[i].trim().length > 0) {
          wordTokens.push(i);
        }
      }
      total = wordTokens.length;
      index = Math.floor(clamped * total);
      if (index >= total) {
        visible = text;
      } else if (index <= 0) {
        visible = "";
      } else {
        // Include everything up to and including the last visible word
        const lastWordIdx = wordTokens[index - 1];
        visible = words.slice(0, lastWordIdx + 1).join("");
      }
      break;
    }
    case "line": {
      const lines = text.split("\n");
      total = lines.length;
      index = Math.floor(clamped * total);
      if (index >= total) {
        visible = text;
      } else if (index <= 0) {
        visible = "";
      } else {
        visible = lines.slice(0, index).join("\n");
      }
      break;
    }
    case "char":
    default: {
      total = text.length;
      index = Math.floor(clamped * total);
      visible = text.slice(0, Math.min(index, total));
      break;
    }
  }

  return {
    visible,
    typing: clamped > 0 && clamped < 1,
    done: clamped >= 1,
    index,
    total,
  };
}

/** Options for typeDuration() */
export interface TypeDurationOptions {
  /** Reveal granularity: 'char' (default), 'word', or 'line' */
  by?: TypeGranularity;
  /** Units per second — chars/sec, words/sec, or lines/sec (default: 30 for char, 5 for word, 2 for line) */
  speed?: number;
}

/**
 * Calculate how many seconds a typing animation should take.
 *
 * Use the returned duration to derive progress:
 * ```ts
 * const dur = std.text.typeDuration(text, { speed: 40 });
 * const progress = std.math.clamp(time / dur, 0, 1);
 * const { visible } = std.text.type(text, progress);
 * ```
 *
 * @param text - The text that will be typed
 * @param options - Speed and granularity options
 * @returns Duration in seconds
 */
export function typeDuration(
  text: string,
  options?: TypeDurationOptions
): number {
  const by = options?.by ?? "char";

  const defaultSpeeds: Record<TypeGranularity, number> = {
    char: 30,
    word: 5,
    line: 2,
  };
  const speed = options?.speed ?? defaultSpeeds[by];

  if (speed <= 0) return 0;

  let unitCount: number;
  switch (by) {
    case "word":
      unitCount = text.split(/\s+/).filter((w) => w.length > 0).length;
      break;
    case "line":
      unitCount = text.split("\n").length;
      break;
    case "char":
    default:
      unitCount = text.length;
      break;
  }

  return unitCount / speed;
}

/**
 * Blinking cursor helper.
 *
 * Returns true when cursor should be visible, false when hidden.
 * Toggles at the given rate (blinks per second).
 *
 * @param time - Current time in seconds (e.g., ctx.sceneTimeSeconds)
 * @param rate - Blinks per second (default: 3)
 * @returns Whether the cursor should be visible
 *
 * @example
 * ```ts
 * const show = std.text.cursor(time);
 * return `${visible}${show ? '▋' : ''}`;
 * ```
 */
export function cursor(time: number, rate = 3): boolean {
  return Math.floor(time * rate) % 2 === 0;
}
