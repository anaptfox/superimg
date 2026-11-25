// Collection data stays on the server. The media projection only sees the
// selected entry's scoped `uses` patches.
import type { Entry } from "./entry.js";

const entries: Entry[] = [
  { id: "short", uses: { first: { label: "SHORT / FIRST", frames: 25 }, second: { label: "SHORT / SECOND", frames: 50 } } },
  { id: "long", uses: { first: { label: "LONG / FIRST", frames: 50 }, second: { label: "LONG / SECOND", frames: 75 } } },
];

export function loadEntries(): Entry[] {
  return entries;
}
