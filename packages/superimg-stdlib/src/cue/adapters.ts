import type { TranscriptWord } from './types';

/**
 * ElevenLabs STT word format.
 */
export interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
  type?: string;
}

/**
 * OpenAI Whisper word format.
 */
export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Convert ElevenLabs STT output to TranscriptWord[].
 * Filters out non-word types (spacing, audio_event).
 *
 * @param words - ElevenLabs words array from STT response
 * @returns Normalized TranscriptWord array
 *
 * @example
 * ```ts
 * const response = await elevenLabsSTT(audio);
 * const words = fromElevenLabs(response.words);
 * const t = transcript(words, time);
 * ```
 */
export function fromElevenLabs(words: ElevenLabsWord[]): TranscriptWord[] {
  return words
    .filter((w) => !w.type || w.type === 'word')
    .map((w) => ({ text: w.text, start: w.start, end: w.end }));
}

/**
 * Convert OpenAI Whisper output to TranscriptWord[].
 *
 * @param words - Whisper words array
 * @returns Normalized TranscriptWord array
 *
 * @example
 * ```ts
 * const response = await whisperTranscribe(audio);
 * const words = fromWhisper(response.words);
 * const t = transcript(words, time);
 * ```
 */
export function fromWhisper(words: WhisperWord[]): TranscriptWord[] {
  return words.map((w) => ({ text: w.word, start: w.start, end: w.end }));
}
