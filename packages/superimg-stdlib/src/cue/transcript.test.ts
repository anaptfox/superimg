import { describe, it, expect } from 'vitest';
import { transcript } from './transcript';
import { fromElevenLabs, fromWhisper } from './adapters';
import type { TranscriptWord } from './types';

describe('transcript', () => {
  const words: TranscriptWord[] = [
    { text: 'Hello', start: 0, end: 0.5 },
    { text: 'world', start: 0.5, end: 1.0 },
  ];

  describe('at', () => {
    it('returns word by index', () => {
      const t = transcript(words, 0.25);
      expect(t.at(0).text).toBe('Hello');
      expect(t.at(1).text).toBe('world');
    });

    it('includes TimelineEvent properties', () => {
      const t = transcript(words, 0.25);
      const word = t.at(0);
      expect(word.id).toBe('word-0');
      expect(word.start).toBe(0);
      expect(word.end).toBe(0.5);
      expect(word.duration).toBe(0.5);
      expect(word.progress).toBe(0.5);
      expect(word.active).toBe(true);
    });

    it('throws for negative index', () => {
      const t = transcript(words, 0);
      expect(() => t.at(-1)).toThrow('out of bounds');
    });

    it('throws for index >= length', () => {
      const t = transcript(words, 0);
      expect(() => t.at(2)).toThrow('out of bounds');
    });

    it('throws with helpful message for empty transcript', () => {
      const t = transcript([], 0);
      expect(() => t.at(0)).toThrow('out of bounds (0--1)');
    });
  });

  describe('current', () => {
    it('returns active word', () => {
      const t = transcript(words, 0.25);
      const current = t.current();
      expect(current?.text).toBe('Hello');
      expect(current?.progress).toBe(0.5);
      expect(current?.active).toBe(true);
    });

    it('returns second word when time is in second word', () => {
      const t = transcript(words, 0.75);
      expect(t.current()?.text).toBe('world');
    });

    it('returns null before first word', () => {
      const wordsWithGap: TranscriptWord[] = [
        { text: 'Hello', start: 0.5, end: 1.0 },
      ];
      const t = transcript(wordsWithGap, 0.25);
      expect(t.current()).toBeNull();
    });

    it('returns null after last word', () => {
      const t = transcript(words, 1.5);
      expect(t.current()).toBeNull();
    });

    it('returns null when between words (gap)', () => {
      const gappedWords: TranscriptWord[] = [
        { text: 'a', start: 0, end: 0.3 },
        { text: 'b', start: 0.5, end: 0.8 },
      ];
      const t = transcript(gappedWords, 0.4);
      expect(t.current()).toBeNull();
    });

    it('returns null for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.current()).toBeNull();
    });
  });

  describe('all', () => {
    it('returns all words as WordEvents', () => {
      const t = transcript(words, 0);
      const all = t.all();
      expect(all).toHaveLength(2);
      expect(all[0].text).toBe('Hello');
      expect(all[1].text).toBe('world');
    });

    it('returns words sorted by start time', () => {
      const unsorted: TranscriptWord[] = [
        { text: 'b', start: 0.5, end: 1.0 },
        { text: 'a', start: 0, end: 0.5 },
      ];
      const t = transcript(unsorted, 0);
      const all = t.all();
      expect(all[0].text).toBe('a');
      expect(all[1].text).toBe('b');
    });

    it('returns empty array for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.all()).toEqual([]);
    });
  });

  describe('range', () => {
    it('returns words overlapping time range', () => {
      const t = transcript(words, 0);
      const inRange = t.range(0.3, 0.7);
      expect(inRange).toHaveLength(2);
      expect(inRange[0].text).toBe('Hello');
      expect(inRange[1].text).toBe('world');
    });

    it('returns only words that overlap', () => {
      const t = transcript(words, 0);
      const inRange = t.range(0.6, 0.9);
      expect(inRange).toHaveLength(1);
      expect(inRange[0].text).toBe('world');
    });

    it('returns empty for range with no words', () => {
      const t = transcript(words, 0);
      const inRange = t.range(5, 10);
      expect(inRange).toHaveLength(0);
    });

    it('handles exact boundary conditions', () => {
      const t = transcript(words, 0);
      // Word ends at 0.5, so range starting at 0.5 should not include it
      const inRange = t.range(0.5, 1.0);
      expect(inRange).toHaveLength(1);
      expect(inRange[0].text).toBe('world');
    });
  });

  describe('find', () => {
    it('finds word case-insensitively', () => {
      const t = transcript(words, 0);
      expect(t.find('HELLO')?.text).toBe('Hello');
      expect(t.find('hello')?.text).toBe('Hello');
      expect(t.find('Hello')?.text).toBe('Hello');
    });

    it('returns first match for duplicate words', () => {
      const duplicates: TranscriptWord[] = [
        { text: 'the', start: 0, end: 0.2 },
        { text: 'the', start: 0.5, end: 0.7 },
      ];
      const t = transcript(duplicates, 0);
      expect(t.find('the')?.id).toBe('word-0');
    });

    it('returns null for not found', () => {
      const t = transcript(words, 0);
      expect(t.find('missing')).toBeNull();
    });

    it('returns null for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.find('anything')).toBeNull();
    });
  });

  describe('map', () => {
    it('maps over all words', () => {
      const t = transcript(words, 0.25);
      const texts = t.map((w) => w.text);
      expect(texts).toEqual(['Hello', 'world']);
    });

    it('provides index to callback', () => {
      const t = transcript(words, 0);
      const indices = t.map((_, i) => i);
      expect(indices).toEqual([0, 1]);
    });

    it('returns empty array for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.map((w) => w.text)).toEqual([]);
    });
  });

  describe('count', () => {
    it('returns word count', () => {
      const t = transcript(words, 0);
      expect(t.count()).toBe(2);
    });

    it('returns 0 for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.count()).toBe(0);
    });
  });

  describe('duration', () => {
    it('returns total duration from first to last word', () => {
      const t = transcript(words, 0);
      expect(t.duration()).toBe(1.0);
    });

    it('handles gaps between words', () => {
      const gapped: TranscriptWord[] = [
        { text: 'a', start: 0, end: 0.3 },
        { text: 'b', start: 0.5, end: 1.0 },
      ];
      const t = transcript(gapped, 0);
      expect(t.duration()).toBe(1.0); // 0 to 1.0
    });

    it('returns 0 for empty transcript', () => {
      const t = transcript([], 0);
      expect(t.duration()).toBe(0);
    });

    it('handles single word', () => {
      const single: TranscriptWord[] = [{ text: 'only', start: 1, end: 2 }];
      const t = transcript(single, 0);
      expect(t.duration()).toBe(1);
    });
  });

  describe('zero duration words', () => {
    it('handles zero duration word at time', () => {
      const instant: TranscriptWord[] = [{ text: 'click', start: 1, end: 1 }];
      const t = transcript(instant, 1);
      const word = t.at(0);
      expect(word.progress).toBe(1);
      expect(word.active).toBe(false);
    });

    it('handles zero duration word before time', () => {
      const instant: TranscriptWord[] = [{ text: 'click', start: 1, end: 1 }];
      const t = transcript(instant, 0.5);
      const word = t.at(0);
      expect(word.progress).toBe(0);
      expect(word.active).toBe(false);
    });
  });

  describe('charProgress', () => {
    it('returns 0 when no word is active', () => {
      const t = transcript([{ text: 'Hi', start: 1, end: 2 }], 0);
      expect(t.charProgress()).toBe(0);
    });

    it('returns character progress for active word', () => {
      // "Hello" (5 chars) at 50% progress = 2.5 characters
      const t = transcript([{ text: 'Hello', start: 0, end: 1 }], 0.5);
      expect(t.charProgress()).toBe(2.5);
    });

    it('returns proportional progress at 70%', () => {
      // "Hello" (5 chars) at 70% progress = 3.5 characters
      const t = transcript([{ text: 'Hello', start: 0, end: 1 }], 0.7);
      expect(t.charProgress()).toBeCloseTo(3.5, 1);
    });

    it('returns near full length at end', () => {
      const t = transcript([{ text: 'Hi', start: 0, end: 1 }], 0.99);
      expect(t.charProgress()).toBeCloseTo(1.98, 1);
    });

    it('returns 0 after word ends', () => {
      const t = transcript([{ text: 'Hello', start: 0, end: 0.5 }], 1.0);
      expect(t.charProgress()).toBe(0);
    });

    it('works with multi-word transcript', () => {
      const words: TranscriptWord[] = [
        { text: 'Hello', start: 0, end: 0.5 },
        { text: 'world', start: 0.5, end: 1.0 },
      ];
      // At 0.75, we're 50% through "world" (5 chars) = 2.5
      const t = transcript(words, 0.75);
      expect(t.charProgress()).toBe(2.5);
    });
  });

  describe('between', () => {
    const threeWords: TranscriptWord[] = [
      { text: 'Hello', start: 0, end: 0.5 },
      { text: 'beautiful', start: 0.5, end: 1.0 },
      { text: 'world', start: 1.0, end: 1.5 },
    ];

    it('returns WordEvent spanning multiple words', () => {
      const t = transcript(threeWords, 0.75);
      const span = t.between(0, 2);

      expect(span.start).toBe(0);
      expect(span.end).toBe(1.5);
      expect(span.duration).toBe(1.5);
      expect(span.progress).toBe(0.5);
      expect(span.text).toBe('Hello beautiful world');
      expect(span.active).toBe(true);
    });

    it('calculates progress correctly at different times', () => {
      // Before span starts
      const t1 = transcript(threeWords, -0.5);
      expect(t1.between(0, 2).progress).toBe(0);

      // At start
      const t2 = transcript(threeWords, 0);
      expect(t2.between(0, 2).progress).toBe(0);

      // At end
      const t3 = transcript(threeWords, 1.5);
      expect(t3.between(0, 2).progress).toBe(1);

      // After end
      const t4 = transcript(threeWords, 2.0);
      expect(t4.between(0, 2).progress).toBe(1);
    });

    it('works for single word (same index)', () => {
      const t = transcript(threeWords, 0.25);
      const span = t.between(0, 0);
      expect(span.text).toBe('Hello');
      expect(span.start).toBe(0);
      expect(span.end).toBe(0.5);
      expect(span.progress).toBe(0.5);
    });

    it('works for two adjacent words', () => {
      const t = transcript(threeWords, 0.5);
      const span = t.between(1, 2);
      expect(span.text).toBe('beautiful world');
      expect(span.start).toBe(0.5);
      expect(span.end).toBe(1.5);
    });

    it('generates correct id', () => {
      const t = transcript(threeWords, 0);
      expect(t.between(0, 2).id).toBe('words-0-2');
      expect(t.between(1, 1).id).toBe('words-1-1');
    });

    it('throws for negative fromIndex', () => {
      const t = transcript(threeWords, 0);
      expect(() => t.between(-1, 0)).toThrow('fromIndex -1 out of bounds');
    });

    it('throws for fromIndex >= length', () => {
      const t = transcript(threeWords, 0);
      expect(() => t.between(5, 5)).toThrow('fromIndex 5 out of bounds');
    });

    it('throws for negative toIndex', () => {
      const t = transcript(threeWords, 0);
      expect(() => t.between(0, -1)).toThrow('toIndex -1 out of bounds');
    });

    it('throws for toIndex >= length', () => {
      const t = transcript(threeWords, 0);
      expect(() => t.between(0, 10)).toThrow('toIndex 10 out of bounds');
    });

    it('handles zero duration span', () => {
      const instant: TranscriptWord[] = [{ text: 'click', start: 1, end: 1 }];
      const t1 = transcript(instant, 0.5);
      expect(t1.between(0, 0).progress).toBe(0);

      const t2 = transcript(instant, 1);
      expect(t2.between(0, 0).progress).toBe(1);
    });
  });
});

describe('adapters', () => {
  describe('fromElevenLabs', () => {
    it('converts ElevenLabs format to TranscriptWord', () => {
      const input = [
        { text: 'Hello', start: 0, end: 0.5, type: 'word' },
        { text: 'world', start: 0.5, end: 1.0, type: 'word' },
      ];
      const result = fromElevenLabs(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: 'Hello', start: 0, end: 0.5 });
      expect(result[1]).toEqual({ text: 'world', start: 0.5, end: 1.0 });
    });

    it('filters out spacing type', () => {
      const input = [
        { text: 'Hello', start: 0, end: 0.5, type: 'word' },
        { text: ' ', start: 0.5, end: 0.5, type: 'spacing' },
        { text: 'world', start: 0.5, end: 1.0, type: 'word' },
      ];
      const result = fromElevenLabs(input);
      expect(result).toHaveLength(2);
    });

    it('filters out audio_event type', () => {
      const input = [
        { text: '[music]', start: 0, end: 2, type: 'audio_event' },
        { text: 'Hello', start: 2, end: 2.5, type: 'word' },
      ];
      const result = fromElevenLabs(input);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Hello');
    });

    it('includes words with no type field', () => {
      const input = [
        { text: 'Hello', start: 0, end: 0.5 },
        { text: 'world', start: 0.5, end: 1.0 },
      ];
      const result = fromElevenLabs(input);
      expect(result).toHaveLength(2);
    });

    it('handles empty input', () => {
      const result = fromElevenLabs([]);
      expect(result).toEqual([]);
    });
  });

  describe('fromWhisper', () => {
    it('converts Whisper format to TranscriptWord', () => {
      const input = [
        { word: 'Hello', start: 0, end: 0.5 },
        { word: 'world', start: 0.5, end: 1.0 },
      ];
      const result = fromWhisper(input);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ text: 'Hello', start: 0, end: 0.5 });
      expect(result[1]).toEqual({ text: 'world', start: 0.5, end: 1.0 });
    });

    it('maps word to text', () => {
      const input = [{ word: 'test', start: 0, end: 1 }];
      const result = fromWhisper(input);
      expect(result[0].text).toBe('test');
      expect('word' in result[0]).toBe(false);
    });

    it('handles empty input', () => {
      const result = fromWhisper([]);
      expect(result).toEqual([]);
    });
  });
});
