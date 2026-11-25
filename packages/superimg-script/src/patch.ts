//! Non-destructive surgical fence-attribute patching for `*.script.md` editors.
//!
//! Preserves CRLF, indentation, unrelated code fences, storyboards, and trailing
//! newlines so timeline drags produce minimal, byte-clean diffs.

import { CODE_OPEN, SCRIPT_CLOSE, SCRIPT_OPEN, codeClose, formatSeconds } from "./grammar.js";

export interface PatchAttrResult {
  readonly text: string;
  readonly changed: boolean;
}

const VALID_ATTR_KEY = /^[^\s=`]+$/;
const VALID_ATTR_VALUE = /^[^\s`]+$/;

interface FenceHeader {
  readonly kind: string;
  readonly id: string;
  readonly line: string;
  readonly index: number;
}

function scanScriptHeaders(source: string): FenceHeader[] {
  const headers: FenceHeader[] = [];
  let pos = 0;
  let foreignClose: RegExp | null = null;
  let inScript = false;

  while (pos < source.length) {
    let eol = source.indexOf("\n", pos);
    if (eol === -1) eol = source.length;
    const lineEnd = eol > pos && source[eol - 1] === "\r" ? eol - 1 : eol;
    const line = source.slice(pos, lineEnd);

    if (foreignClose) {
      if (foreignClose.test(line)) foreignClose = null;
    } else if (inScript) {
      if (SCRIPT_CLOSE.test(line)) inScript = false;
    } else {
      const open = SCRIPT_OPEN.exec(line);
      if (open) {
        const kind = open[1]!;
        inScript = true;
        if (kind !== "storyboard") {
          const idMatch = /[ \t]id=([^\s`]+)/.exec(open[2] ?? "");
          if (idMatch?.[1]) {
            headers.push({ kind, id: idMatch[1], line, index: pos });
          }
        }
      } else {
        const code = CODE_OPEN.exec(line);
        if (code) foreignClose = codeClose(code[1]!);
      }
    }

    pos = eol + 1;
  }
  return headers;
}

function formatAttrValue(attr: string, value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Attribute "${attr}" requires a finite number.`);
    }
    if (attr === "hold" && value <= 0) {
      throw new RangeError(`Attribute "hold" must be a positive number of seconds.`);
    }
    if ((attr === "still" || attr === "in") && value < 0) {
      throw new RangeError(`Attribute "${attr}" must be a non-negative number of seconds.`);
    }
    return formatSeconds(value);
  }
  const trimmed = value.trim();
  if (!VALID_ATTR_VALUE.test(trimmed)) {
    throw new TypeError(`Invalid value ${JSON.stringify(value)} for attribute "${attr}".`);
  }
  return trimmed;
}

/**
 * Surgically update, insert, or remove a `key=value` attribute on the opening
 * fence line of the uniquely identified block `blockId`, leaving all other bytes
 * in `source` (CRLF, whitespace, unrelated fences, trailing newline) untouched.
 *
 * Pass `null` as `value` to remove the attribute.
 */
export function patchScriptAttr(
  source: string,
  blockId: string,
  attr: string,
  value: string | number | null,
): PatchAttrResult {
  if (!VALID_ATTR_KEY.test(attr) || attr === "id") {
    throw new TypeError(`Cannot patch attribute ${JSON.stringify(attr)}.`);
  }
  const matches = scanScriptHeaders(source).filter((h) => h.id === blockId);
  if (matches.length === 0) {
    throw new Error(`No script block found with id "${blockId}".`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple script blocks share id "${blockId}".`);
  }
  const header = matches[0]!;
  const escaped = attr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenPattern = new RegExp(`([ \\t]+)(${escaped}=[^\\s\`]*)`, "g");
  const existing = [...header.line.matchAll(tokenPattern)];
  if (existing.length > 1) {
    throw new Error(`Block "${blockId}" has duplicate "${attr}" attributes on its fence line.`);
  }

  let nextLine: string;
  if (value === null) {
    if (existing.length === 0) return { text: source, changed: false };
    const hit = existing[0]!;
    nextLine = header.line.slice(0, hit.index!) + header.line.slice(hit.index! + hit[0].length);
  } else {
    const formatted = formatAttrValue(attr, value);
    const token = `${attr}=${formatted}`;
    if (existing.length === 1) {
      const hit = existing[0]!;
      const start = hit.index! + hit[1]!.length;
      nextLine = header.line.slice(0, start) + token + header.line.slice(start + hit[2]!.length);
    } else {
      nextLine = header.line.replace(/[ \t]*$/, (trailing) => ` ${token}${trailing}`);
    }
  }

  if (nextLine === header.line) return { text: source, changed: false };
  const text = source.slice(0, header.index) + nextLine + source.slice(header.index + header.line.length);
  return { text, changed: true };
}
