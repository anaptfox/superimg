import type { TranscriptWord } from "@superimg/types";

/** Caption tokens retain provider character boundaries; no duration-based estimates. */
export function transcriptFromCharacterAlignment(
  value: unknown,
  durationSeconds: number,
): TranscriptWord[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid character alignment");
  }
  const alignment = value as Record<string, unknown>;
  const characters = alignment.characters;
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  if (
    !Array.isArray(characters) || !Array.isArray(starts) ||
    !Array.isArray(ends) || characters.length !== starts.length ||
    starts.length !== ends.length
  ) {
    throw new TypeError("Character alignment arrays must have equal lengths");
  }
  const words: TranscriptWord[] = [];
  let current: TranscriptWord | undefined;
  let lastEnd = 0;
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    const start = starts[index];
    const end = ends[index];
    if (
      typeof character !== "string" || character.length === 0 ||
      typeof start !== "number" || typeof end !== "number" ||
      !Number.isFinite(start) || !Number.isFinite(end) || start < lastEnd ||
      end < start || end > durationSeconds
    ) {
      throw new TypeError(`Invalid character alignment at index ${index}`);
    }
    lastEnd = end;
    if (/^\s+$/u.test(character)) {
      if (current) words.push(current);
      current = undefined;
    } else {
      if (/\s/u.test(character)) {
        throw new TypeError(
          "A character alignment entry cannot mix whitespace and text",
        );
      }
      if (current) {
        current.text += character;
        current.end = end;
      } else current = { text: character, start, end };
    }
  }
  if (current) words.push(current);
  return words;
}
