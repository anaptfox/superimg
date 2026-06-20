export interface TimedWord {
  text: string;
  start: number;
  end: number;
  sentenceIndex: number;
}

export interface KaraokeData {
  title: string;
  source: string;
  words: TimedWord[];
  duration: number;
  wpm: number;
}

export function buildKaraokeData(input: {
  title: string;
  source: string;
  text: string;
  maxWords: number;
  wpm: number;
}): KaraokeData {
  const words = tokenize(input.text).slice(0, input.maxWords);
  const secondsPerWord = 60 / input.wpm;
  const timed: TimedWord[] = [];
  let cursor = 1.2;
  let sentenceIndex = 0;

  for (const word of words) {
    const punctuationPause = /[.!?]$/.test(word) ? 0.72 : /[,;:]$/.test(word) ? 0.28 : 0.04;
    const lengthWeight = Math.min(1.65, Math.max(0.95, word.replace(/[^A-Za-z0-9]/g, "").length / 5.5));
    const duration = Math.max(0.34, secondsPerWord * lengthWeight);
    timed.push({
      text: word,
      start: cursor,
      end: cursor + duration,
      sentenceIndex,
    });
    cursor += duration + punctuationPause;
    if (/[.!?]$/.test(word)) sentenceIndex++;
  }

  return {
    title: input.title,
    source: input.source,
    words: timed,
    duration: Math.max(6, cursor + 1.6),
    wpm: input.wpm,
  };
}

function tokenize(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}
