import {
  CODE_OPEN,
  FIELD_LINE,
  SCRIPT_CLOSE,
  SCRIPT_ID_PATTERN,
  SCRIPT_OPEN,
  codeClose,
  formatSeconds,
  parseBeatAnchor,
  parseSeconds,
  parseShotBeats,
} from "./grammar.js";
import { resolveBlocks } from "./resolve.js";
import type {
  ScriptAt,
  ScriptBlock,
  ScriptBlockBase,
  ScriptDocument,
  ScriptFinding,
  ScriptItem,
} from "./types.js";

const trimBlankEdges = (lines: string[]): string[] => {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.trim() === "") start++;
  while (end > start && lines[end - 1]!.trim() === "") end--;
  return lines.slice(start, end);
};

function parseAttrs(source: string): { attrs: Record<string, string>; duplicates: string[] } {
  const attrs: Record<string, string> = {};
  const duplicates: string[] = [];
  for (const token of source.trim().split(/[ \t]+/)) {
    if (!token) continue;
    const eq = token.indexOf("=");
    const key = token.slice(0, eq);
    if (Object.hasOwn(attrs, key)) duplicates.push(key);
    attrs[key] = token.slice(eq + 1);
  }
  return { attrs, duplicates };
}

interface ParsedAtAttr {
  at: ScriptAt;
  unknownBeats: string[];
}

function parseAtEndpoint(
  raw: string,
  shotBeats: ReadonlyMap<string, number>,
): { seconds: number; anchor?: { beat: string; offset: number }; unknownBeat?: string } | null {
  const anchor = parseBeatAnchor(raw);
  if (anchor) {
    const base = shotBeats.get(anchor.beat);
    if (base === undefined) {
      return { seconds: Math.max(0, anchor.offset), anchor, unknownBeat: anchor.beat };
    }
    const resolved = base + anchor.offset;
    if (resolved < 0) return null;
    return { seconds: resolved, anchor };
  }
  const seconds = parseSeconds(raw);
  if (seconds === null || seconds < 0) return null;
  return { seconds };
}

function parseAtAttr(raw: string, shotBeats: ReadonlyMap<string, number>): ParsedAtAttr | null {
  const parts = raw.split("..");
  if (parts.length === 1) {
    const start = parseAtEndpoint(parts[0]!, shotBeats);
    if (!start) return null;
    return {
      at: {
        start: start.seconds,
        ...(start.anchor ? { startAnchor: start.anchor } : {}),
      },
      unknownBeats: start.unknownBeat ? [start.unknownBeat] : [],
    };
  }
  if (parts.length === 2) {
    const start = parseAtEndpoint(parts[0]!, shotBeats);
    const end = parseAtEndpoint(parts[1]!, shotBeats);
    if (!start || !end) return null;
    const unknownBeats = [
      ...(start.unknownBeat ? [start.unknownBeat] : []),
      ...(end.unknownBeat ? [end.unknownBeat] : []),
    ];
    if (unknownBeats.length === 0 && end.seconds <= start.seconds) return null;
    return {
      at: {
        start: start.seconds,
        end: end.seconds,
        ...(start.anchor ? { startAnchor: start.anchor } : {}),
        ...(end.anchor ? { endAnchor: end.anchor } : {}),
      },
      unknownBeats,
    };
  }
  return null;
}

/**
 * Split a speech or card body into header fields and lines.
 * Fields come before the first blank line. A header with a line that is not
 * `key: value` is not a header: the whole body is kept as lines.
 */
function splitBody(raw: string[]): { fields: [string, string][]; lines: string[]; malformed: boolean } {
  const body = raw.map((line) => line.replace(/[ \t]+$/, ""));
  const blank = body.indexOf("");
  let header: string[] = [];
  let rest = body;
  if (blank >= 0) {
    header = body.slice(0, blank);
    rest = body.slice(blank + 1);
  } else if (body.length > 0 && body.every((line) => FIELD_LINE.test(line))) {
    header = body;
    rest = [];
  }
  const malformed = header.some((line) => !FIELD_LINE.test(line));
  if (malformed) {
    header = [];
    rest = body;
  }
  const fields = header.map((line) => {
    const match = FIELD_LINE.exec(line)!;
    return [match[1]!, match[2]!.trim()] as [string, string];
  });
  return { fields, lines: trimBlankEdges(rest), malformed };
}

/**
 * Parse a `*.script.md` file. Returns null when the text has no `shot`,
 * `speech`, or `card` fence, which means it is
 * ordinary Markdown. Malformed input produces findings and never throws.
 */
export function parseScript(text: string): ScriptDocument | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const items: ScriptItem[] = [];
  const findings: ScriptFinding[] = [];
  const blocks: ScriptBlock[] = [];
  const blockLines: number[] = [];
  let markdown: string[] = [];
  let lastBlock: ScriptBlock | null = null;
  let currentShotBeats: ReadonlyMap<string, number> = new Map();

  const flushMarkdown = () => {
    const kept = trimBlankEdges(markdown);
    markdown = [];
    if (kept.length > 0) items.push({ kind: "markdown", text: kept.join("\n") });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const open = SCRIPT_OPEN.exec(line);
    if (open) {
      const start = i;
      const body: string[] = [];
      i++;
      while (i < lines.length && !SCRIPT_CLOSE.test(lines[i]!)) body.push(lines[i++]!);
      const closed = i < lines.length;
      if (closed) i++;
      const kind = open[1] as "shot" | "speech" | "card" | "storyboard";

      if (kind === "storyboard") {
        if (!lastBlock) {
          markdown.push(...lines.slice(start, i));
          findings.push({
            code: "ORPHAN_ATTACHMENT",
            line: start + 1,
            message: "A storyboard fence needs a shot, speech, or card above it.",
          });
          continue;
        }
        if (!closed) {
          findings.push({ code: "UNCLOSED_FENCE", line: start + 1, message: "The storyboard fence is not closed." });
        }
        const drawing = body.join("\n").replace(/\s+$/, "");
        if (drawing.trim()) lastBlock.storyboard = drawing;
        else delete lastBlock.storyboard;
        continue;
      }

      flushMarkdown();
      const blockIndex = blocks.length;
      const note = (code: ScriptFinding["code"], message: string) =>
        findings.push({ code, line: start + 1, message, blockIndex });
      if (!closed) note("UNCLOSED_FENCE", `The ${kind} fence is not closed.`);

      const base: ScriptBlockBase = { fields: {} };
      const parsedAttrs = parseAttrs(open[2] ?? "");
      for (const key of parsedAttrs.duplicates) {
        note("BAD_ATTR", `The attribute "${key}" appears twice. The last value is kept.`);
      }
      const { id, hold: rawHold, still: rawStill, in: rawIn, at: rawAt, ...attrs } = parsedAttrs.attrs;
      if (id !== undefined) {
        if (SCRIPT_ID_PATTERN.test(id)) base.id = id;
        else {
          base.rawId = id;
          note("BAD_ID", `"${id}" is not a valid block id.`);
        }
      }
      if (Object.keys(attrs).length > 0) base.attrs = attrs;

      let block: ScriptBlock;
      if (kind === "shot") {
        if (id === undefined) note("MISSING_ID", "A shot fence needs an `id=` attribute.");
        let hold: number | undefined;
        if (rawHold !== undefined) {
          const parsed = parseSeconds(rawHold);
          if (parsed === null || parsed <= 0) {
            note("BAD_ATTR", `Invalid hold="${rawHold}". Expected a positive number of seconds.`);
          } else {
            hold = parsed;
          }
        }
        let still: number | undefined;
        if (rawStill !== undefined) {
          const parsed = parseSeconds(rawStill);
          if (parsed === null || parsed < 0) {
            note("BAD_ATTR", `Invalid still="${rawStill}". Expected a non-negative number of seconds.`);
          } else if (hold !== undefined && parsed > hold) {
            note(
              "BAD_ATTR",
              `Invalid still="${rawStill}". \`still\` must be <= \`hold\` (${formatSeconds(hold)}).`,
            );
          } else {
            still = parsed;
          }
        }
        let inPoint: number | undefined;
        if (rawIn !== undefined) {
          const parsed = parseSeconds(rawIn);
          if (parsed === null || parsed < 0) {
            note("BAD_ATTR", `Invalid in="${rawIn}". Expected a non-negative number of seconds.`);
          } else {
            inPoint = parsed;
          }
        }
        if (rawAt !== undefined) note("BAD_ATTR", "`at` is only valid on speech and card fences.");
        // Shot blocks support optional `key: value` header fields before a blank line
        // (e.g. `mood:`, `camera:`, `music:`, `sfx:`). Unlike speech/card, multi-paragraph
        // prose without a `key: value` header is valid and does not emit BAD_FIELD.
        const split = splitBody(body);
        if (!split.malformed && split.fields.length > 0) {
          const seen = new Set<string>();
          for (const [key, value] of split.fields) {
            if (seen.has(key)) note("BAD_FIELD", `The field "${key}" appears twice. The last value is kept.`);
            seen.add(key);
            if (value) base.fields[key] = value;
            else delete base.fields[key];
          }
        }
        const shotText = (!split.malformed && split.fields.length > 0 ? split.lines : body).join("\n").trim();
        if (!shotText && Object.keys(base.fields).length === 0) note("EMPTY_BLOCK", "The shot has no text.");
        block = {
          ...base,
          kind: "shot",
          text: shotText,
          ...(hold !== undefined ? { hold } : {}),
          ...(still !== undefined ? { still } : {}),
          ...(inPoint !== undefined ? { in: inPoint } : {}),
        };
        currentShotBeats = parseShotBeats(base.fields);
      } else {
        let at: ScriptAt | undefined;
        if (rawAt !== undefined) {
          const parsed = parseAtAttr(rawAt, currentShotBeats);
          if (!parsed) {
            note(
              "BAD_ATTR",
              `Invalid at="${rawAt}". Expected \`at=<start>\` or \`at=<start>..<end>\` with start >= 0 and end > start.`,
            );
          } else {
            at = parsed.at;
            for (const beat of parsed.unknownBeats) {
              note("UNKNOWN_BEAT", `Unknown beat anchor "@${beat}" — declare it on the owning shot via \`beats: ${beat}=<seconds>\`.`);
            }
          }
        }
        if (rawHold !== undefined) note("BAD_ATTR", "`hold` is only valid on shot fences.");
        if (rawStill !== undefined) note("BAD_ATTR", "`still` is only valid on shot fences.");
        if (rawIn !== undefined) note("BAD_ATTR", "`in` is only valid on shot fences.");

        const split = splitBody(body);
        if (split.malformed) note("BAD_FIELD", "A header line is not `key: value`, so the whole block was read as lines.");
        const named: Record<string, string> = {};
        const names: readonly string[] = kind === "speech" ? ["who", "pace"] : ["attribution", "sign", "source"];
        const seen = new Set<string>();
        for (const [key, value] of split.fields) {
          if (seen.has(key)) note("BAD_FIELD", `The field "${key}" appears twice. The last value is kept.`);
          seen.add(key);
          if (names.includes(key)) {
            if (value) named[key] = value;
            else delete named[key];
          } else if (value) base.fields[key] = value;
          else delete base.fields[key];
        }
        if (!split.lines.some((item) => item.trim())) note("EMPTY_BLOCK", `The ${kind} has no lines.`);
        if (kind === "speech") {
          if (!named.who) note("MISSING_SPEAKER", "The speech has no `who`.");
          block = {
            ...base,
            kind: "speech",
            who: named.who ?? "",
            ...(named.pace ? { pace: named.pace } : {}),
            lines: split.lines,
            ...(at !== undefined ? { at } : {}),
          };
        } else {
          block = {
            ...base,
            kind: "card",
            ...(named.attribution ? { attribution: named.attribution } : {}),
            ...(named.sign ? { sign: named.sign } : {}),
            ...(named.source ? { source: named.source } : {}),
            lines: split.lines,
            ...(at !== undefined ? { at } : {}),
          };
        }
      }
      items.push(block);
      blocks.push(block);
      blockLines.push(start + 1);
      lastBlock = block;
      continue;
    }

    const code = CODE_OPEN.exec(line);
    if (code) {
      const close = codeClose(code[1]!);
      markdown.push(line);
      i++;
      while (i < lines.length) {
        const inner = lines[i++]!;
        markdown.push(inner);
        if (close.test(inner)) break;
      }
      continue;
    }

    markdown.push(line);
    i++;
  }
  flushMarkdown();

  if (blocks.length === 0) return null;

  // Pass 1: an explicit id that appears twice addresses neither block.
  const counts = new Map<string, number>();
  for (const block of blocks) if (block.id) counts.set(block.id, (counts.get(block.id) ?? 0) + 1);
  blocks.forEach((block, blockIndex) => {
    if (!block.id || (counts.get(block.id) ?? 0) < 2) return;
    findings.push({
      code: "DUPLICATE_ID",
      line: blockLines[blockIndex]!,
      message: `The id "${block.id}" is used by more than one block.`,
      blockIndex,
    });
    block.rawId = block.id;
    delete block.id;
  });

  // Pass 2: catch collisions involving defaulted speech ids (`<shotId>-<n>` / `<section-slug>-<n>`).
  const { collisions } = resolveBlocks(items);
  for (const [blockIndex, collidedId] of collisions) {
    const block = blocks[blockIndex]!;
    findings.push({
      code: "DUPLICATE_ID",
      line: blockLines[blockIndex]!,
      message: `The id "${collidedId}" is used by more than one block.`,
      blockIndex,
    });
    block.rawId = collidedId;
    delete block.id;
  }

  findings.sort((a, b) => a.line - b.line);
  return { items, findings };
}

/** The blocks of a script, in file order. */
export function scriptBlocks(doc: ScriptDocument): ScriptBlock[] {
  return doc.items.filter((item): item is ScriptBlock => item.kind !== "markdown");
}
