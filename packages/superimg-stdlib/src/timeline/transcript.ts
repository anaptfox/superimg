import type { TranscriptWord, TranscriptSync, WordEvent } from './types';

/**
 * Create a transcript sync for word-level timing.
 *
 * @param words - Array of words with timing
 * @param time - Current time in seconds
 * @returns A TranscriptSync instance for querying word progress
 *
 * @example
 * ```ts
 * const t = transcript(words, time);
 *
 * // Get current word
 * const word = t.current();
 * if (word) {
 *   const highlight = std.tween(0, 1, word.progress, "easeOutCubic");
 * }
 *
 * // Render with highlighting
 * const caption = t.map((w, i) => {
 *   const isCurrent = t.current()?.id === w.id;
 *   return `<span class="${isCurrent ? 'active' : ''}">${w.text}</span>`;
 * }).join(' ');
 * ```
 */
export function transcript(
  words: TranscriptWord[],
  time: number
): TranscriptSync {
  // Sort by start time
  const sorted = [...words].sort((a, b) => a.start - b.start);

  function buildEvent(word: TranscriptWord, index: number): WordEvent {
    const { text, start, end } = word;
    const duration = end - start;

    let progress: number;
    if (duration === 0) {
      progress = time >= start ? 1 : 0;
    } else if (time <= start) {
      progress = 0;
    } else if (time >= end) {
      progress = 1;
    } else {
      progress = (time - start) / duration;
    }

    return {
      id: `word-${index}`,
      text,
      progress,
      active: progress > 0 && progress < 1,
      start,
      end,
      duration,
    };
  }

  return {
    at(index: number): WordEvent {
      if (index < 0 || index >= sorted.length) {
        throw new Error(
          `Word index ${index} out of bounds (0-${sorted.length - 1})`
        );
      }
      return buildEvent(sorted[index], index);
    },

    current(): WordEvent | null {
      for (let i = 0; i < sorted.length; i++) {
        const event = buildEvent(sorted[i], i);
        if (event.active) return event;
      }
      return null;
    },

    all(): WordEvent[] {
      return sorted.map((w, i) => buildEvent(w, i));
    },

    range(start: number, end: number): WordEvent[] {
      return sorted
        .map((w, i) => buildEvent(w, i))
        .filter((e) => e.end > start && e.start < end);
    },

    find(text: string): WordEvent | null {
      const lower = text.toLowerCase();
      const index = sorted.findIndex((w) => w.text.toLowerCase() === lower);
      return index >= 0 ? buildEvent(sorted[index], index) : null;
    },

    map<T>(fn: (event: WordEvent, index: number) => T): T[] {
      return sorted.map((w, i) => fn(buildEvent(w, i), i));
    },

    count(): number {
      return sorted.length;
    },

    duration(): number {
      if (sorted.length === 0) return 0;
      return sorted[sorted.length - 1].end - sorted[0].start;
    },

    charProgress(): number {
      const word = this.current();
      if (!word) return 0;
      return word.progress * word.text.length;
    },

    between(fromIndex: number, toIndex: number): WordEvent {
      if (fromIndex < 0 || fromIndex >= sorted.length) {
        throw new Error(`fromIndex ${fromIndex} out of bounds (0-${sorted.length - 1})`);
      }
      if (toIndex < 0 || toIndex >= sorted.length) {
        throw new Error(`toIndex ${toIndex} out of bounds (0-${sorted.length - 1})`);
      }

      const fromWord = sorted[fromIndex];
      const toWord = sorted[toIndex];
      const start = fromWord.start;
      const end = toWord.end;
      const duration = end - start;

      let progress: number;
      if (duration === 0) {
        progress = time >= start ? 1 : 0;
      } else if (time <= start) {
        progress = 0;
      } else if (time >= end) {
        progress = 1;
      } else {
        progress = (time - start) / duration;
      }

      // Combine text from all words in range
      const text = sorted
        .slice(fromIndex, toIndex + 1)
        .map((w) => w.text)
        .join(' ');

      return {
        id: `words-${fromIndex}-${toIndex}`,
        text,
        progress,
        active: progress > 0 && progress < 1,
        start,
        end,
        duration,
      };
    },
  };
}
