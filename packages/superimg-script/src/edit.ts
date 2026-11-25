import { CODE_OPEN, SCRIPT_CLOSE, SCRIPT_OPEN, codeClose, formatSeconds, parseSeconds } from "./grammar.js";
import { scriptBlocks } from "./parse.js";
//! First-class surgical editing, shot slicing, and reading-pace / bubble diagnostics for `*.script.md`.

import { editHash, scriptHash } from "./film.js";
import { parseScript } from "./parse.js";
import { printScript } from "./print.js";
import { resolveBlocks } from "./resolve.js";
import type {
  ScriptAt,
  ScriptBlock,
  ScriptCheckOptions,
  ScriptDocument,
  ScriptFinding,
  ScriptItem,
} from "./types.js";

export interface BlockEditPatch {
  /** Replace shot description text (shot blocks only). */
  text?: string;
  /** Replace spoken or card lines (speech/card blocks only). */
  lines?: readonly string[];
  /** Replace speaker name (speech blocks only). */
  who?: string;
  /** Replace or clear reading pace (speech blocks only). */
  pace?: string | null;
  /** Replace or clear shot duration in seconds (shot blocks only). */
  hold?: number | null;
  /** Replace or clear shot still offset in seconds (shot blocks only). */
  still?: number | null;
  /** Replace or clear source in-point in seconds (shot blocks only). */
  in?: number | null;
  /** Replace or clear shot-local timing (speech/card blocks only). */
  at?: ScriptAt | null;
  /** Replace or clear card attribution (card blocks only). */
  attribution?: string | null;
  /** Replace or clear card sign (card blocks only). */
  sign?: string | null;
  /** Replace or clear card source (card blocks only). */
  source?: string | null;
  /** Merge header fields; pass `null` for a key to delete that field. */
  fields?: Readonly<Record<string, string | null>>;
  /** Replace or clear attached storyboard text. */
  storyboard?: string | null;
}

export interface InsertBlockOptions {
  /** Insert immediately before the block with this resolved id. */
  before?: string;
  /** Insert immediately after the block with this resolved id. */
  after?: string;
  /** Fallback placement when neither `before` nor `after` is supplied (default `"end"`). */
  position?: "start" | "end";
}

export interface SliceShotsOptions {
  /** Keep shots in `"document"` order (default) or the `"requested"` id order. */
  order?: "document" | "requested";
  /** Include leading document Markdown (e.g. `# Title`) before the first shot (default `true`). */
  includeTitle?: boolean;
}

export interface EditScriptResult {
  readonly text: string;
  readonly changed: boolean;
  readonly scriptHash: string;
  readonly editHash: string;
}

function parseOrThrow(source: string): ScriptDocument {
  const doc = parseScript(source);
  if (!doc) {
    throw new Error("Input text contains no shot, speech, or card blocks.");
  }
  return doc;
}

function findBlockItemIndex(doc: ScriptDocument, blockId: string): number {
  const { meta } = resolveBlocks(doc.items);
  let blockIndex = 0;
  let found = -1;
  for (let i = 0; i < doc.items.length; i++) {
    const item = doc.items[i]!;
    if (item.kind === "markdown") continue;
    const resolved = meta[blockIndex++]!;
    if (item.id === blockId || resolved.id === blockId) {
      if (found !== -1) {
        throw new Error(`Multiple script blocks match id "${blockId}".`);
      }
      found = i;
    }
  }
  return found;
}

function buildResult(source: string, doc: ScriptDocument): EditScriptResult {
  const text = printScript(doc);
  const reparsed = parseScript(text) ?? doc;
  return {
    text,
    changed: text !== source,
    scriptHash: scriptHash(reparsed),
    editHash: editHash(reparsed),
  };
}

/**
 * Surgically edit one script block by its explicit or resolved id, returning
 * canonical Markdown plus updated `scriptHash` and `editHash`.
 */
export function editBlock(
  source: string,
  blockId: string,
  patch: BlockEditPatch,
): EditScriptResult {
  const doc = parseOrThrow(source);
  const itemIndex = findBlockItemIndex(doc, blockId);
  if (itemIndex === -1) {
    throw new Error(`No script block found with id "${blockId}".`);
  }
  const current = doc.items[itemIndex] as ScriptBlock;
  const nextFields: Record<string, string> = { ...current.fields };
  if (patch.fields) {
    for (const [key, value] of Object.entries(patch.fields)) {
      if (value === null || value === "") delete nextFields[key];
      else nextFields[key] = value;
    }
  }

  let updated: ScriptBlock;
  if (current.kind === "shot") {
    const next = { ...current, fields: nextFields };
    if (patch.text !== undefined) next.text = patch.text;
    if (patch.hold === null) delete next.hold;
    else if (patch.hold !== undefined) next.hold = patch.hold;
    if (patch.still === null) delete next.still;
    else if (patch.still !== undefined) next.still = patch.still;
    if (patch.in === null) delete next.in;
    else if (patch.in !== undefined) next.in = patch.in;
    updated = next;
  } else if (current.kind === "speech") {
    const next = { ...current, fields: nextFields };
    if (patch.who !== undefined) next.who = patch.who;
    if (patch.lines !== undefined) next.lines = [...patch.lines];
    if (patch.pace === null) delete next.pace;
    else if (patch.pace !== undefined) next.pace = patch.pace;
    if (patch.at === null) delete next.at;
    else if (patch.at !== undefined) next.at = { ...patch.at };
    updated = next;
  } else {
    const next = { ...current, fields: nextFields };
    if (patch.lines !== undefined) next.lines = [...patch.lines];
    if (patch.attribution === null) delete next.attribution;
    else if (patch.attribution !== undefined) next.attribution = patch.attribution;
    if (patch.sign === null) delete next.sign;
    else if (patch.sign !== undefined) next.sign = patch.sign;
    if (patch.source === null) delete next.source;
    else if (patch.source !== undefined) next.source = patch.source;
    if (patch.at === null) delete next.at;
    else if (patch.at !== undefined) next.at = { ...patch.at };
    updated = next;
  }

  if (patch.storyboard === null) delete updated.storyboard;
  else if (patch.storyboard !== undefined) updated.storyboard = patch.storyboard;

  const nextItems = [...doc.items];
  nextItems[itemIndex] = updated;
  return buildResult(source, { ...doc, items: nextItems });
}

/**
 * Insert a new shot, speech, or card block into a script document and return
 * canonical Markdown plus updated `scriptHash` and `editHash`.
 */
export function insertBlock(
  source: string,
  block: ScriptBlock,
  options: InsertBlockOptions = {},
): EditScriptResult {
  const doc = parseOrThrow(source);
  const nextItems = [...doc.items];
  if (options.before !== undefined) {
    const index = findBlockItemIndex(doc, options.before);
    if (index === -1) throw new Error(`No script block found with id "${options.before}".`);
    nextItems.splice(index, 0, block);
  } else if (options.after !== undefined) {
    const index = findBlockItemIndex(doc, options.after);
    if (index === -1) throw new Error(`No script block found with id "${options.after}".`);
    nextItems.splice(index + 1, 0, block);
  } else if (options.position === "start") {
    const firstBlock = nextItems.findIndex((item) => item.kind !== "markdown");
    nextItems.splice(firstBlock === -1 ? 0 : firstBlock, 0, block);
  } else {
    nextItems.push(block);
  }
  return buildResult(source, { ...doc, items: nextItems });
}

/**
 * Remove one script block by its explicit or resolved id.
 */
export function removeBlock(source: string, blockId: string): EditScriptResult {
  const doc = parseOrThrow(source);
  const itemIndex = findBlockItemIndex(doc, blockId);
  if (itemIndex === -1) {
    throw new Error(`No script block found with id "${blockId}".`);
  }
  const nextItems = [...doc.items];
  nextItems.splice(itemIndex, 1);
  return buildResult(source, { ...doc, items: nextItems });
}

/**
 * Extract a valid sub-script containing only the requested shots and their
 * owned speech/card blocks, preserving title Markdown and storyboards.
 */
export function sliceShots(
  source: string,
  shotIds: readonly string[],
  options: SliceShotsOptions = {},
): string {
  const doc = parseOrThrow(source);
  const order = options.order ?? "document";
  const includeTitle = options.includeTitle ?? true;
  const wanted = new Set(shotIds);

  const preamble: ScriptItem[] = [];
  const groups: Array<{ shotId: string | null; items: ScriptItem[] }> = [];
  let seenFirstShot = false;
  let pendingMarkdown: ScriptItem[] = [];

  for (const item of doc.items) {
    if (!seenFirstShot) {
      if (item.kind === "shot") {
        seenFirstShot = true;
        groups.push({ shotId: item.id ?? null, items: [item] });
      } else if (item.kind === "markdown") {
        preamble.push(item);
      }
      continue;
    }

    if (item.kind === "markdown") {
      pendingMarkdown.push(item);
      continue;
    }

    if (item.kind === "shot") {
      groups.push({ shotId: item.id ?? null, items: [...pendingMarkdown, item] });
      pendingMarkdown = [];
      continue;
    }

    // Speech or card belongs to the most recent shot.
    const current = groups.at(-1);
    if (current) {
      if (pendingMarkdown.length > 0) {
        current.items.push(...pendingMarkdown);
        pendingMarkdown = [];
      }
      current.items.push(item);
    }
  }

  let selected: Array<{ shotId: string | null; items: ScriptItem[] }>;
  if (order === "requested") {
    const byId = new Map<string, { shotId: string | null; items: ScriptItem[] }>();
    for (const group of groups) {
      if (group.shotId) byId.set(group.shotId, group);
    }
    selected = [];
    for (const id of shotIds) {
      const hit = byId.get(id);
      if (hit) selected.push(hit);
    }
  } else {
    selected = groups.filter((group) => group.shotId !== null && wanted.has(group.shotId));
  }

  const nextItems: ScriptItem[] = [
    ...(includeTitle ? preamble : []),
    ...selected.flatMap((group) => group.items),
  ];
  return printScript({ items: nextItems, findings: [] });
}

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

/**
 * Run parse-time script diagnostics including optional bubble line/char limits,
 * reading pace (`maxCps`), and ASCII-only text validation.
 */
export function checkScript(
  input: string | ScriptDocument,
  options: ScriptCheckOptions = {},
): ScriptFinding[] {
  const doc = typeof input === "string" ? parseScript(input) : input;
  if (!doc) return [];
  const findings: ScriptFinding[] = [...doc.findings];
  const { meta } = resolveBlocks(doc.items);
  let blockIndex = 0;
  let currentHold: number | undefined;

  for (const item of doc.items) {
    if (item.kind === "markdown") continue;
    const idx = blockIndex++;
    const blockId = meta[idx]?.id ?? item.id ?? `block-${idx}`;

    if (item.kind === "shot") {
      currentHold = item.hold;
      continue;
    }

    if (options.asciiOnly) {
      const badLine = item.lines.find((line) => !PRINTABLE_ASCII.test(line));
      if (badLine !== undefined) {
        findings.push({
          code: "NON_ASCII_TEXT",
          line: 0,
          blockIndex: idx,
          message: `Block "${blockId}" contains non-ASCII characters: ${JSON.stringify(badLine)}.`,
        });
      }
    }

    if (item.kind === "speech") {
      if (options.maxLines !== undefined && item.lines.length > options.maxLines) {
        findings.push({
          code: "BUBBLE_TOO_LONG",
          line: 0,
          blockIndex: idx,
          message: `Speech "${blockId}" has ${item.lines.length} lines (limit ${options.maxLines}).`,
        });
      }
      if (options.maxChars !== undefined) {
        const longest = item.lines.reduce((max, line) => Math.max(max, line.length), 0);
        if (longest > options.maxChars) {
          findings.push({
            code: "BUBBLE_TOO_LONG",
            line: 0,
            blockIndex: idx,
            message: `Speech "${blockId}" has a ${longest}-character line (limit ${options.maxChars}).`,
          });
        }
      }
      if (options.maxCps !== undefined && options.maxCps > 0) {
        const chars = item.lines.join(" ").trim().length;
        const windowSeconds =
          item.at?.end !== undefined
            ? item.at.end - item.at.start
            : currentHold !== undefined && item.at !== undefined
              ? currentHold - item.at.start
              : undefined;
        if (windowSeconds !== undefined && windowSeconds > 0 && chars / windowSeconds > options.maxCps) {
          const cps = (chars / windowSeconds).toFixed(1);
          findings.push({
            code: "PACE_TOO_FAST",
            line: 0,
            blockIndex: idx,
            message: `Speech "${blockId}" reads at ${cps} chars/sec (limit ${options.maxCps} cps).`,
          });
        }
      }
    }
  }

  return findings;
}

/** Change one addressed shot's hold without reprinting or normalizing the document. */
export function setShotHold(text: string, options: { id: string; seconds: number }): { text: string } {
  const formatted = formatSeconds(options.seconds);
  if (!Number.isFinite(options.seconds) || options.seconds <= 0 || parseSeconds(formatted) !== options.seconds) {
    throw new RangeError("hold must be a positive representable number of seconds");
  }
  const doc = parseScript(text);
  const blocks = doc ? scriptBlocks(doc) : [];
  const blockIndex = blocks.findIndex((block) => block.kind === "shot" && block.id === options.id);
  if (blockIndex < 0) throw new Error(`No uniquely addressed shot: ${options.id}`);
  const block = blocks[blockIndex]!;
  if (block.kind !== "shot") throw new Error(`Not a shot: ${options.id}`);
  if (block.still !== undefined && block.still > options.seconds) throw new RangeError("hold cannot be shorter than still");

  // Mirror parseScript's fence traversal, including opaque ordinary code fences.
  const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)].filter((m) => m[0].length > 0);
  let index = 0;
  let count = 0;
  while (index < lines.length) {
    const match = lines[index]!;
    const line = match[0].replace(/(?:\r\n|\r|\n)$/, "");
    const open = SCRIPT_OPEN.exec(line);
    if (open) {
      if (open[1] !== "storyboard") {
        if (count++ === blockIndex) {
          const holds = [...line.matchAll(/(?:^|[ \t])hold=([^\s`]*)/g)];
          if (holds.length > 1) throw new Error("Cannot edit duplicate hold attributes");
          const stills = [...line.matchAll(/(?:^|[ \t])still=([^\s`]*)/g)];
          if (stills.length > 1 || (stills.length === 1 && parseSeconds(stills[0]![1]!) === null)) {
            throw new Error("Cannot edit a shot with invalid still attributes");
          }
          if (stills.length === 1 && parseSeconds(stills[0]![1]!)! > options.seconds) throw new RangeError("hold cannot be shorter than still");
          const hold = holds[0];
          const newLine = hold
            ? line.slice(0, hold.index! + hold[0].indexOf("hold=") + 5) + formatted + line.slice(hold.index! + hold[0].length)
            : line.replace(/[ \t]*$/, (trailing) => ` hold=${formatted}${trailing}`);
          return { text: text.slice(0, match.index!) + newLine + text.slice(match.index! + line.length) };
        }
      }
      index++;
      while (index < lines.length && !SCRIPT_CLOSE.test(lines[index]![0].replace(/(?:\r\n|\r|\n)$/, ""))) index++;
      if (index < lines.length) index++;
      continue;
    }
    const code = CODE_OPEN.exec(line);
    if (code) {
      const close = codeClose(code[1]!);
      index++;
      while (index < lines.length) {
        const inner = lines[index++]![0].replace(/(?:\r\n|\r|\n)$/, "");
        if (close.test(inner)) break;
      }
    } else index++;
  }
  throw new Error(`Cannot locate shot: ${options.id}`);
}
