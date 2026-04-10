//! Data loader for changelog video
//! Reads CHANGELOG.md from project root and parses it into structured data

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = markdown.split("\n");

  let current: ChangelogEntry | null = null;

  for (const line of lines) {
    // Match "## 0.0.12 — 2026-04-08" or "## 0.0.12 - 2026-04-08"
    const heading = line.match(/^##\s+(\S+)\s+[—-]\s+(\S+)/);
    if (heading) {
      if (current) entries.push(current);
      current = { version: heading[1], date: heading[2], items: [] };
      continue;
    }

    // Match "- Some change description"
    const item = line.match(/^-\s+(.+)/);
    if (item && current) {
      current.items.push(item[1]);
    }
  }

  if (current) entries.push(current);
  return entries;
}

export default function () {
  // Resolve CHANGELOG.md relative to project root (two levels up from videos/changelog/)
  const changelogPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../CHANGELOG.md"
  );
  const raw = readFileSync(changelogPath, "utf-8");
  const entries = parseChangelog(raw);

  return {
    title: "What's New",
    entries,
  };
}
