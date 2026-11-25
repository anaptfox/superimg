import {
  FIELD_LINE,
  SCRIPT_FIELD_KEY_PATTERN,
  SCRIPT_ID_PATTERN,
  formatBeatAnchor,
  formatSeconds,
} from "./grammar.js";
import type { ScriptAt, ScriptBlock, ScriptDocument } from "./types.js";

const RESERVED_ATTRS = new Set(["id", "hold", "still", "in", "at"]);
const oneLine = (value: string) => value.replace(/\s*\n\s*/g, " ").trim();

function formatAt(at: ScriptAt): string {
  const start = at.startAnchor ? formatBeatAnchor(at.startAnchor) : formatSeconds(at.start);
  if (at.endAnchor) return `${start}..${formatBeatAnchor(at.endAnchor)}`;
  return at.end === undefined ? start : `${start}..${formatSeconds(at.end)}`;
}

function header(block: ScriptBlock): string[] {
  const named: [string, string | undefined][] =
    block.kind === "speech"
      ? [
          ["who", block.who],
          ["pace", block.pace],
        ]
      : block.kind === "card"
        ? [
            ["attribution", block.attribution],
            ["sign", block.sign],
            ["source", block.source],
          ]
        : [];
  const reserved = new Set(named.map(([key]) => key));
  const open = Object.entries(block.fields ?? {}).filter(
    ([key]) => SCRIPT_FIELD_KEY_PATTERN.test(key) && !reserved.has(key),
  );
  return [...named, ...open]
    .map(([key, value]) => [key, oneLine(value ?? "")] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
}

function body(block: ScriptBlock): string[] {
  const fields = header(block);
  if (block.kind === "shot") {
    const lines = block.text.trim() ? block.text.trim().split("\n").map((line) => line.replace(/[ \t]+$/, "")) : [];
    if (lines.length === 0) return fields;
    const needsBlank =
      fields.length > 0 || lines.every((line) => FIELD_LINE.test(line));
    return needsBlank ? [...fields, "", ...lines] : lines;
  }
  const lines = block.lines.map((line) => line.replace(/[ \t]+$/, ""));
  while (lines.length && lines[0] === "") lines.shift();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  if (lines.length === 0) return fields;
  // Without a header, a blank line is needed when the lines would otherwise be read as one.
  const needsBlank =
    fields.length > 0 || lines.includes("") || lines.every((line) => FIELD_LINE.test(line));
  return needsBlank ? [...fields, "", ...lines] : lines;
}

function fence(kind: string, info: string, lines: string[]): string {
  return ["```" + kind + info, ...lines, "```"].join("\n");
}

function printBlock(block: ScriptBlock): string {
  let info = "";
  if (block.id && SCRIPT_ID_PATTERN.test(block.id)) info += ` id=${block.id}`;
  if (block.kind === "shot") {
    if (block.hold !== undefined && Number.isFinite(block.hold) && block.hold > 0) {
      info += ` hold=${formatSeconds(block.hold)}`;
    }
    if (block.still !== undefined && Number.isFinite(block.still) && block.still >= 0) {
      info += ` still=${formatSeconds(block.still)}`;
    }
    if (block.in !== undefined && Number.isFinite(block.in) && block.in >= 0) {
      info += ` in=${formatSeconds(block.in)}`;
    }
  } else if (
    block.at !== undefined &&
    (block.at.startAnchor !== undefined || (Number.isFinite(block.at.start) && block.at.start >= 0)) &&
    (block.at.endAnchor !== undefined ||
      block.at.end === undefined ||
      (Number.isFinite(block.at.end) && (block.at.startAnchor !== undefined || block.at.end > block.at.start)))
  ) {
    info += ` at=${formatAt(block.at)}`;
  }
  for (const [key, value] of Object.entries(block.attrs ?? {})) {
    if (!RESERVED_ATTRS.has(key) && /^[^\s=`]+$/.test(key) && /^[^\s`]*$/.test(value)) {
      info += ` ${key}=${value}`;
    }
  }
  const parts = [fence(block.kind, info, body(block))];
  const drawing = block.storyboard?.replace(/\s+$/, "");
  if (drawing?.trim()) parts.push(fence("storyboard", "", drawing.split("\n")));
  return parts.join("\n\n");
}

/**
 * Print a script in canonical form. Printing a parsed canonical file returns
 * the same bytes. A file written by hand may be normalized once; printing the
 * result again changes nothing.
 */
export function printScript(doc: ScriptDocument): string {
  const parts: string[] = [];
  for (const item of doc.items) {
    if (item.kind === "markdown") {
      const text = item.text.replace(/\r\n?/g, "\n").replace(/^(?:[ \t]*\n)+|\s+$/g, "");
      if (text) parts.push(text);
    } else parts.push(printBlock(item));
  }
  return parts.join("\n\n") + "\n";
}
