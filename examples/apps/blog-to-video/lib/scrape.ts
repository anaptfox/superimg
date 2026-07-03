import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadArticle } from "./article";
import { buildKaraokeData, type KaraokeData } from "./timing";

const MIN_WORDS = 20;
const FIXTURE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "sample.txt");

export interface ScrapeOptions {
  url?: string;
  useFixture?: boolean;
  wpm?: number;
  maxWords?: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function scrapeToKaraokeData(options: ScrapeOptions): Promise<KaraokeData> {
  const wpm = clamp(options.wpm ?? 128, 90, 180);
  const maxWords = clamp(options.maxWords ?? 140, 40, 420);

  const article = options.useFixture
    ? await loadArticle({ textPath: FIXTURE_PATH })
    : await loadArticle({ url: options.url });

  const data = buildKaraokeData({
    title: article.title,
    source: article.source,
    text: article.text,
    maxWords,
    wpm,
  });

  if (data.words.length < MIN_WORDS) {
    throw new Error("Not enough readable words found. Try a different URL or lower --max-words.");
  }

  return data;
}

export function validateUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL. Use a full http:// or https:// link.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }

  return parsed.toString();
}