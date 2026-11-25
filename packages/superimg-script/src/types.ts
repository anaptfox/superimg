//! The script document: what a `*.script.md` file holds.
//!
//! The fence line is the edit (`id`, `hold`, `still`, `at` in shot-local
//! seconds). The body is the words and writer intent. A script never holds
//! film clock times or renderer fields.

/** Symbolic beat anchor relative to a named beat declared on the owning shot. */
export interface ScriptBeatAnchor {
  beat: string;
  offset: number;
}

/** Shot-local timing offset for a speech or card block, in seconds or `@beat[±offset]` anchors. */
export interface ScriptAt {
  start: number;
  end?: number;
  /** Symbolic start anchor (`at=@beat+0.2`), preserved across print/parse round-trips. */
  startAnchor?: ScriptBeatAnchor;
  /** Symbolic end anchor (`at=@beat..@next`), preserved across print/parse round-trips. */
  endAnchor?: ScriptBeatAnchor;
}

/** Fields every block shares. */
export interface ScriptBlockBase {
  /** Address of the block, from the fence line: ```` ```shot id=door ````. */
  id?: string;
  /** The id as written (or collided default), when rejected. Never printed. */
  rawId?: string;
  /** Other `key=value` tokens on the fence line, kept so they survive a print. */
  attrs?: Record<string, string>;
  /** Open notes to the film, in file order (`do`, `react`, `world`, ...). */
  fields: Record<string, string>;
  /** Attached ```` ```storyboard ```` fence body. Opaque to SuperImg. */
  storyboard?: string;
}

/** A shot: a visual moment in the edit, with optional duration and still offset. */
export interface ScriptShot extends ScriptBlockBase {
  kind: "shot";
  text: string;
  hold?: number;
  still?: number;
  /** Source in-point offset in seconds for reused shots (`in=<seconds>`). */
  in?: number;
}

export interface ScriptSpeech extends ScriptBlockBase {
  kind: "speech";
  who: string;
  pace?: string;
  lines: string[];
  at?: ScriptAt;
}

export interface ScriptCard extends ScriptBlockBase {
  kind: "card";
  attribution?: string;
  sign?: string;
  source?: string;
  lines: string[];
  at?: ScriptAt;
}

export type ScriptBlock = ScriptShot | ScriptSpeech | ScriptCard;

/** Markdown between script fences, kept where it was written. */
export interface ScriptMarkdown {
  kind: "markdown";
  text: string;
}

export type ScriptItem = ScriptMarkdown | ScriptBlock;

export type ScriptFindingCode =
  | "DUPLICATE_ID"
  | "BAD_ID"
  | "MISSING_ID"
  | "BAD_ATTR"
  | "BAD_FIELD"
  | "MISSING_SPEAKER"
  | "EMPTY_BLOCK"
  | "ORPHAN_ATTACHMENT"
  | "UNCLOSED_FENCE"
  | "UNKNOWN_BEAT"
  | "BUBBLE_TOO_LONG"
  | "PACE_TOO_FAST"
  | "NON_ASCII_TEXT";

export interface ScriptCheckOptions {
  /** Maximum lines allowed per speech bubble. */
  maxLines?: number;
  /** Maximum characters allowed per line in a speech bubble. */
  maxChars?: number;
  /** Maximum reading speed in characters per second (checked against explicit `at=` windows or shot `hold`). */
  maxCps?: number;
  /** Require printable ASCII characters only in speech/card text. */
  asciiOnly?: boolean;
}

export interface ScriptFinding {
  code: ScriptFindingCode;
  /** 1-based line in the parsed text. */
  line: number;
  message: string;
  /** Index into `scriptBlocks(doc)`, when the finding is about one block. */
  blockIndex?: number;
}

export interface ScriptDocument {
  items: ScriptItem[];
  /** Problems found while parsing. Parsing never throws. */
  findings: ScriptFinding[];
}

// ── What a film sees ──

interface FilmBlockBase {
  /** Null when the block has no usable id. The film can draw it but cannot publish a cue for it. */
  id: string | null;
  /** Text of the nearest heading above the block. */
  section: string | null;
  fields: Record<string, string>;
}

export interface FilmShot extends FilmBlockBase {
  kind: "shot";
  text: string;
  hold?: number;
  still?: number;
  in?: number;
}

export interface FilmSpeech extends FilmBlockBase {
  kind: "speech";
  who: string;
  pace: string;
  lines: string[];
  at?: ScriptAt;
}

export interface FilmCard extends FilmBlockBase {
  kind: "card";
  attribution: string | null;
  sign: string | null;
  source: string | null;
  lines: string[];
  at?: ScriptAt;
}

export type FilmBlock = FilmShot | FilmSpeech | FilmCard;

/**
 * The part of a script a film can read. Storyboards and Markdown prose between
 * fences are left out, so editing them never changes a rendered frame,
 * `scriptHash`, or `editHash`.
 */
export interface FilmScript {
  version: 2;
  /** Text of the first level-1 heading, the film's default title. */
  title: string | null;
  blocks: FilmBlock[];
}
