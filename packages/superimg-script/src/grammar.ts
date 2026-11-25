//! The line grammar shared by the parser and the printer.

/** A block id: letters, digits, and hyphens, 1 to 80 characters. */
export const SCRIPT_ID_PATTERN = /^[A-Za-z0-9-]{1,80}$/;

/** A field key: lowercase, starts with a letter, hyphens allowed. */
export const SCRIPT_FIELD_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

/** `key: value` in a block header. */
export const FIELD_LINE = /^([a-z][a-z0-9-]*):[ \t]*(.*)$/;

/** A script fence line, with optional `key=value` tokens after the kind. */
export const SCRIPT_OPEN =
  /^```(shot|speech|card|storyboard)((?:[ \t]+[^\s=`]+=[^\s`]*)*)[ \t]*$/;

export const SCRIPT_CLOSE = /^```[ \t]*$/;

/** Any other fenced code block. It stays inside Markdown untouched. */
export const CODE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

export function codeClose(marker: string): RegExp {
  const char = marker[0] === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${char}{${marker.length},}[ \\t]*$`);
}

/** Non-negative decimal seconds (`0`, `2`, `3.2`, `.5`). No signs, units, or exponents. */
const SECONDS_PATTERN = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export function parseSeconds(raw: string): number | null {
  if (!SECONDS_PATTERN.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function formatSeconds(value: number): string {
  const text = String(value);
  return /[eE]/.test(text) ? value.toFixed(10).replace(/\.?0+$/, "") : text;
}

const BEAT_ANCHOR_PATTERN = /^@([A-Za-z][A-Za-z0-9_-]*)(?:([+-])(\d+(?:\.\d+)?|\.\d+))?$/;

export function parseBeatAnchor(raw: string): { beat: string; offset: number } | null {
  const match = BEAT_ANCHOR_PATTERN.exec(raw);
  if (!match) return null;
  const beat = match[1]!;
  if (!match[2] || !match[3]) return { beat, offset: 0 };
  const magnitude = Number(match[3]);
  if (!Number.isFinite(magnitude)) return null;
  return { beat, offset: match[2] === "-" ? -magnitude : magnitude };
}

export function formatBeatAnchor(anchor: { beat: string; offset: number }): string {
  if (anchor.offset === 0) return `@${anchor.beat}`;
  const sign = anchor.offset > 0 ? "+" : "-";
  return `@${anchor.beat}${sign}${formatSeconds(Math.abs(anchor.offset))}`;
}

/**
 * Parse named shot beats from a shot's `beats:` or `beat:` header fields.
 * Supports `door-open=1.2, look-up=2.6` and `door-open 1.2s, look-up 2.6`.
 */
export function parseShotBeats(fields: Readonly<Record<string, string>> | undefined): Map<string, number> {
  const beats = new Map<string, number>();
  if (!fields) return beats;
  for (const key of ["beats", "beat"]) {
    const raw = fields[key];
    if (!raw) continue;
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const match = /^([A-Za-z][A-Za-z0-9_-]*)(?:[ \t]*=[ \t]*|[ \t]+)(\d+(?:\.\d+)?|\.\d+)s?$/.exec(trimmed);
      if (!match) continue;
      const seconds = Number(match[2]);
      if (Number.isFinite(seconds) && seconds >= 0) {
        beats.set(match[1]!, seconds);
      }
    }
  }
  return beats;
}
