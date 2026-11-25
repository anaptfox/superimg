import { readFile } from "node:fs/promises";

import type { Speaker } from "./speaker";

export async function loadSpeakers(): Promise<readonly Speaker[]> {
  const source = await readFile(new URL("../speakers.json", import.meta.url), "utf8");
  const entries: unknown = JSON.parse(source);
  if (!Array.isArray(entries)) throw new Error("speakers.json must contain an array of speakers");
  const fields = ["slug", "podcastName", "episodeNumber", "episodeTitle", "speakerName", "speakerTitle", "speakerPhoto", "brandColor", "accentColor"] as const;
  const seen = new Set<string>();
  return entries.map((entry: unknown, index): Speaker => {
    if (entry === null || typeof entry !== "object" ||
      !fields.every(key => key in entry && typeof Reflect.get(entry, key) === "string")) {
      throw new Error(`Speaker ${index + 1} must supply each speaker field as a string`);
    }
    // All fields have been checked at the JSON boundary.
    const speaker = entry as Speaker;
    if (!speaker.slug.trim() || seen.has(speaker.slug)) throw new Error(`Speaker ${index + 1} needs a unique, nonempty slug`);
    if (!speaker.speakerName.trim()) throw new Error(`Speaker ${speaker.slug} needs a name`);
    seen.add(speaker.slug);
    return speaker;
  });
}
