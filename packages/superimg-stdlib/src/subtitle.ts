/**
 * Subtitle format utilities for SuperImg templates
 *
 * Supports parsing, generating, and displaying SRT/VTT subtitles.
 *
 * @example
 * import { parseSRT, getCueAtTime, getCueProgress } from 'superimg:subtitle';
 *
 * const cues = parseSRT(srtContent);
 * const cue = getCueAtTime(cues, timeMs);
 * const progress = getCueProgress(cue, timeMs);
 */

// --- Types ---

export interface Cue {
  /** SRT uses 1-based index, VTT optional */
  index?: number;
  /** Start time in milliseconds */
  start: number;
  /** End time in milliseconds */
  end: number;
  /** Subtitle text (may include newlines) */
  text: string;
  /** VTT cue settings (position, align, size) */
  settings?: string;
}

export interface ParseOptions {
  /** Throw on malformed input (default: false) */
  strict?: boolean;
}

// --- Time Utilities ---

/**
 * Parse a timestamp string to milliseconds
 *
 * Supports both SRT format (00:00:01,000) and VTT format (00:00:01.000)
 * Also supports short formats like 00:01.000 or 01.000
 */
export function parseTime(timeStr: string): number {
  // Normalize separators: replace comma with period
  const normalized = timeStr.trim().replace(",", ".");

  // Match patterns: HH:MM:SS.mmm, MM:SS.mmm, or SS.mmm
  const parts = normalized.split(":");
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    seconds = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    seconds = parseFloat(parts[1]);
  } else if (parts.length === 1) {
    seconds = parseFloat(parts[0]);
  }

  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Format milliseconds to a timestamp string
 *
 * @param ms - Time in milliseconds
 * @param format - 'srt' uses comma, 'vtt' uses period
 */
export function formatTime(ms: number, format: "srt" | "vtt"): string {
  const totalSeconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const separator = format === "srt" ? "," : ".";

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  const mmm = milliseconds.toString().padStart(3, "0");

  return `${hh}:${mm}:${ss}${separator}${mmm}`;
}

// --- Parsing ---

/**
 * Parse SRT content into an array of cues
 *
 * SRT format:
 * ```
 * 1
 * 00:00:01,000 --> 00:00:04,000
 * Hello, world!
 *
 * 2
 * 00:00:05,500 --> 00:00:08,000
 * This is a subtitle.
 * ```
 */
export function parseSRT(content: string, options?: ParseOptions): Cue[] {
  const cues: Cue[] = [];
  const strict = options?.strict ?? false;

  // Normalize line endings and split into blocks
  const blocks = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    // First line should be index
    const indexLine = lines[0].trim();
    const index = parseInt(indexLine, 10);

    // Find the timestamp line (usually second line, but be flexible)
    let timestampLineIndex = 1;
    if (isNaN(index)) {
      // No index, first line might be timestamp
      timestampLineIndex = 0;
    }

    const timestampLine = lines[timestampLineIndex];
    const timestampMatch = timestampLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3})/
    );

    if (!timestampMatch) {
      if (strict) {
        throw new Error(`Invalid timestamp line: ${timestampLine}`);
      }
      continue;
    }

    const start = parseTime(timestampMatch[1]);
    const end = parseTime(timestampMatch[2]);
    const text = lines.slice(timestampLineIndex + 1).join("\n").trim();

    cues.push({
      index: isNaN(index) ? undefined : index,
      start,
      end,
      text,
    });
  }

  return cues;
}

/**
 * Parse VTT content into an array of cues
 *
 * VTT format:
 * ```
 * WEBVTT
 *
 * 00:00:01.000 --> 00:00:04.000
 * Hello, world!
 *
 * 00:00:05.500 --> 00:00:08.000 align:center
 * This is a subtitle.
 * ```
 */
export function parseVTT(content: string, options?: ParseOptions): Cue[] {
  const cues: Cue[] = [];
  const strict = options?.strict ?? false;

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  // Check for WEBVTT header
  if (!normalized.startsWith("WEBVTT")) {
    if (strict) {
      throw new Error("VTT file must start with WEBVTT");
    }
  }

  // Remove header and any metadata sections before first timestamp
  const blocks = normalized.split(/\n\n+/);
  let cueIndex = 1;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length === 0) continue;

    // Skip WEBVTT header block and NOTE blocks
    if (lines[0].startsWith("WEBVTT") || lines[0].startsWith("NOTE")) {
      continue;
    }

    // Find timestamp line
    let timestampLineIndex = 0;
    let cueId: string | undefined;

    // Check if first line is a cue identifier (doesn't contain -->)
    if (lines.length > 1 && !lines[0].includes("-->")) {
      cueId = lines[0].trim();
      timestampLineIndex = 1;
    }

    const timestampLine = lines[timestampLineIndex];
    if (!timestampLine) continue;

    // VTT timestamp format with optional settings
    const timestampMatch = timestampLine.match(
      /(\d{1,2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})(?:\s+(.+))?/
    );

    if (!timestampMatch) {
      if (strict) {
        throw new Error(`Invalid timestamp line: ${timestampLine}`);
      }
      continue;
    }

    const start = parseTime(timestampMatch[1]);
    const end = parseTime(timestampMatch[2]);
    const settings = timestampMatch[3]?.trim();
    const text = lines.slice(timestampLineIndex + 1).join("\n").trim();

    cues.push({
      index: cueId ? parseInt(cueId, 10) || cueIndex : cueIndex,
      start,
      end,
      text,
      settings,
    });
    cueIndex++;
  }

  return cues;
}

// --- Generation ---

/**
 * Generate SRT content from cues
 */
export function generateSRT(cues: Cue[]): string {
  return cues
    .map((cue, i) => {
      const index = cue.index ?? i + 1;
      const start = formatTime(cue.start, "srt");
      const end = formatTime(cue.end, "srt");
      return `${index}\n${start} --> ${end}\n${cue.text}`;
    })
    .join("\n\n");
}

/**
 * Generate VTT content from cues
 *
 * @param cues - Array of cues to generate
 * @param header - Optional header content after WEBVTT
 */
export function generateVTT(cues: Cue[], header?: string): string {
  const headerLine = header ? `WEBVTT\n${header}` : "WEBVTT";
  const cueLines = cues
    .map((cue) => {
      const start = formatTime(cue.start, "vtt");
      const end = formatTime(cue.end, "vtt");
      const settings = cue.settings ? ` ${cue.settings}` : "";
      return `${start} --> ${end}${settings}\n${cue.text}`;
    })
    .join("\n\n");

  return `${headerLine}\n\n${cueLines}`;
}

// --- Display ---

/**
 * Get the active cue at a given time
 *
 * Returns the first cue that contains the given time, or null if none.
 */
export function getCueAtTime(cues: Cue[], timeMs: number): Cue | null {
  for (const cue of cues) {
    if (timeMs >= cue.start && timeMs < cue.end) {
      return cue;
    }
  }
  return null;
}

/**
 * Get all active cues at a given time (for overlapping subtitles)
 */
export function getCuesAtTime(cues: Cue[], timeMs: number): Cue[] {
  return cues.filter((cue) => timeMs >= cue.start && timeMs < cue.end);
}

/**
 * Get progress through a cue (0-1)
 *
 * Useful for animating subtitle entrance/exit.
 *
 * @returns Progress from 0 (start) to 1 (end), or 0 if outside cue
 */
export function getCueProgress(cue: Cue, timeMs: number): number {
  if (timeMs < cue.start || timeMs >= cue.end) {
    return 0;
  }
  const duration = cue.end - cue.start;
  if (duration <= 0) return 0;
  return (timeMs - cue.start) / duration;
}
