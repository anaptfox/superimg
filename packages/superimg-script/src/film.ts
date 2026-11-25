import { parseShotBeats } from "./grammar.js";
import { firstTitle, resolveBlocks } from "./resolve.js";
import { sha256Hex } from "./sha256.js";
import type { FilmBlock, FilmScript, ScriptAt, ScriptDocument } from "./types.js";

function sorted(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(fields).sort()) out[key] = fields[key]!;
  return out;
}

function resolveAt(at: ScriptAt, shotBeats: ReadonlyMap<string, number>): ScriptAt {
  const start = at.startAnchor
    ? Math.max(0, (shotBeats.get(at.startAnchor.beat) ?? 0) + at.startAnchor.offset)
    : at.start;
  if (at.endAnchor) {
    const end = Math.max(0, (shotBeats.get(at.endAnchor.beat) ?? 0) + at.endAnchor.offset);
    return end > start ? { start, end } : { start };
  }
  return at.end === undefined ? { start } : { start, end: at.end };
}

/**
 * The view of a script a film is allowed to read. Storyboards and Markdown prose
 * between fences are left out, speech `pace` defaults to `"say"`, and speech
 * blocks without `id=` receive `<shotId>-<n>` (or `<section-slug>-<n>`).
 * `title` is the document's first level-1 heading (null without one); it is the
 * film's default title. It adds nothing to either hash: the heading already
 * reaches them as each block's `section`.
 */
export function filmScript(doc: ScriptDocument): FilmScript {
  const { meta } = resolveBlocks(doc.items);
  const blocks: FilmBlock[] = [];
  let blockIndex = 0;
  let currentShotBeats: ReadonlyMap<string, number> = new Map();

  for (const item of doc.items) {
    if (item.kind === "markdown") continue;
    const resolved = meta[blockIndex++]!;
    const base = { id: resolved.id, section: resolved.section, fields: sorted(item.fields) };
    if (item.kind === "shot") {
      currentShotBeats = parseShotBeats(item.fields);
      blocks.push({
        ...base,
        kind: "shot",
        text: item.text,
        ...(item.hold !== undefined ? { hold: item.hold } : {}),
        ...(item.still !== undefined ? { still: item.still } : {}),
        ...(item.in !== undefined ? { in: item.in } : {}),
      });
    } else if (item.kind === "speech") {
      blocks.push({
        ...base,
        kind: "speech",
        who: item.who,
        pace: item.pace ?? "say",
        lines: [...item.lines],
        ...(item.at !== undefined ? { at: resolveAt(item.at, currentShotBeats) } : {}),
      });
    } else {
      blocks.push({
        ...base,
        kind: "card",
        attribution: item.attribution ?? null,
        sign: item.sign ?? null,
        source: item.source ?? null,
        lines: [...item.lines],
        ...(item.at !== undefined ? { at: resolveAt(item.at, currentShotBeats) } : {}),
      });
    }
  }
  return { version: 2, title: firstTitle(doc.items), blocks };
}

function canonicalBlockWords(block: FilmBlock) {
  const base = {
    fields: sorted(block.fields),
    id: block.id,
    kind: block.kind,
    section: block.section,
  };
  if (block.kind === "shot") return { ...base, text: block.text };
  if (block.kind === "speech") return { ...base, lines: block.lines, pace: block.pace, who: block.who };
  return {
    ...base,
    attribution: block.attribution,
    lines: block.lines,
    sign: block.sign,
    source: block.source,
  };
}

function canonicalBlockEdit(block: FilmBlock) {
  const words = canonicalBlockWords(block);
  if (block.kind === "shot") {
    return {
      ...words,
      hold: block.hold ?? null,
      still: block.still ?? null,
      ...(block.in !== undefined ? { in: block.in } : {}),
    };
  }
  return {
    ...words,
    at: block.at ? { end: block.at.end ?? null, start: block.at.start } : null,
  };
}

function canonicalWords(script: FilmScript): string {
  return JSON.stringify({
    version: script.version,
    blocks: script.blocks.map(canonicalBlockWords),
  });
}

function canonicalEdit(script: FilmScript): string {
  return JSON.stringify({
    version: script.version,
    blocks: script.blocks.map(canonicalBlockEdit),
  });
}

/**
 * SHA-256 of a film's words view (sections, ids, speakers, pace, fields, lines,
 * and shot text — excluding timing attributes `hold`, `still`, `at`).
 */
export function filmScriptHash(script: FilmScript): string {
  return sha256Hex(canonicalWords(script));
}

/**
 * SHA-256 of what a film says (the body, not the timing).
 * Editing `hold`, `still`, `at`, a storyboard, or Markdown prose between fences
 * does not change this hash.
 */
export function scriptHash(doc: ScriptDocument): string {
  return filmScriptHash(filmScript(doc));
}

/**
 * SHA-256 of a film's full edit view (words plus timing attributes `hold`,
 * `still`, and `at`).
 */
export function filmEditHash(script: FilmScript): string {
  return sha256Hex(canonicalEdit(script));
}

/**
 * SHA-256 of both the words and the fence-line edit (`hold`, `still`, `at`).
 * Editing a storyboard or Markdown prose between fences still does not change it.
 */
export function editHash(doc: ScriptDocument): string {
  return filmEditHash(filmScript(doc));
}
