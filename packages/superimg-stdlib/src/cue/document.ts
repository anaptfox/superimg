import { generateSRT, generateVTT, parseSRT, parseVTT, type Cue } from "../subtitle.js";
import type { TranscriptWord } from "./types.js";

/** Times are seconds in the selected source's clock, with half-open ranges. */
export type SecondsRange = Readonly<{ startSeconds: number; endSeconds: number }>;
export type TranscriptSource = Readonly<{ mediaSha256: string; trackId: string; durationSeconds: number }>;
export type TranscriptSpan = Readonly<{
  id: string;
  text: string;
  /** Retained recognition evidence; corrections never rewrite this. */
  recognizedText?: string;
  timing?: SecondsRange;
  granularity: "word" | "segment" | "unknown";
  alignment: "recognized" | "corrected" | "unavailable";
  speaker?: string;
  language?: string;
  settings?: string;
}>;
export type Transcript = Readonly<{
  schemaVersion: 1;
  source: TranscriptSource;
  revision: string;
  timeUnit: "seconds";
  spans: readonly TranscriptSpan[];
  provenance?: Readonly<{ provider: string; model?: string; evidence?: string }>;
}>;
export type TranscriptEdit =
  | Readonly<{ kind: "text"; id: string; text: string }>
  | Readonly<{ kind: "timing"; id: string; timing: SecondsRange | null }>
  | Readonly<{ kind: "split"; id: string; parts: readonly { id: string; text: string; timing?: SecondsRange }[] }>
  | Readonly<{ kind: "merge"; ids: readonly string[]; id: string; text: string; timing?: SecondsRange }>;
export type TranscriptIdMapping = Readonly<{ from: readonly string[]; to: readonly string[] }>;
export type CaptionCue = Readonly<{ id: string; text: string; startSeconds: number; endSeconds: number; sourceIds: readonly string[]; settings?: string; clipped?: boolean }>;
export type KeptRangeMap = Readonly<{ source: TranscriptSource; ranges: readonly SecondsRange[]; durationSeconds: number }>;
export type MappedTranscriptSpan = Readonly<{ id: string; sourceId: string; text: string; sourceRange: SecondsRange; outputRange: SecondsRange; clipped: boolean; granularity: TranscriptSpan["granularity"]; alignment: TranscriptSpan["alignment"] }>;

function nonempty(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} must be a nonempty string`);
}
function range(value: SecondsRange, duration: number): void {
  if (!value || !Number.isFinite(value.startSeconds) || !Number.isFinite(value.endSeconds) || value.startSeconds < 0 || value.endSeconds <= value.startSeconds || value.endSeconds > duration) throw new TypeError("Invalid seconds range");
}
function sourceValid(source: TranscriptSource): void {
  if (!source || typeof source !== "object") throw new TypeError("Invalid transcript source");
  nonempty(source.mediaSha256, "mediaSha256"); nonempty(source.trackId, "trackId");
  if (!Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0) throw new TypeError("Invalid source duration");
}
function sameSource(a: TranscriptSource, b: TranscriptSource): boolean {
  return a.mediaSha256 === b.mediaSha256 && a.trackId === b.trackId && a.durationSeconds === b.durationSeconds;
}
export function validateTranscript(doc: Transcript): void {
  if (!doc || doc.schemaVersion !== 1 || doc.timeUnit !== "seconds" || !Array.isArray(doc.spans)) throw new TypeError("Invalid transcript");
  sourceValid(doc.source); nonempty(doc.revision, "revision");
  if (doc.provenance) { nonempty(doc.provenance.provider, "provider"); if (doc.provenance.model !== undefined) nonempty(doc.provenance.model, "model"); if (doc.provenance.evidence !== undefined) nonempty(doc.provenance.evidence, "evidence"); }
  const ids = new Set<string>();
  for (const span of doc.spans) {
    if (!span || typeof span !== "object" || Array.isArray(span)) throw new TypeError("Invalid transcript span");
    nonempty(span.id, "span id"); nonempty(span.text, "span text");
    if (ids.has(span.id)) throw new TypeError("Duplicate transcript id"); ids.add(span.id);
    if (!["word", "segment", "unknown"].includes(span.granularity) || !["recognized", "corrected", "unavailable"].includes(span.alignment)) throw new TypeError("Invalid transcript alignment");
    if (span.timing !== undefined) range(span.timing, doc.source.durationSeconds);
    if (!span.timing && span.alignment !== "unavailable") throw new TypeError("Untimed span cannot claim alignment");
    for (const value of [span.recognizedText, span.speaker, span.language, span.settings]) if (value !== undefined && typeof value !== "string") throw new TypeError("Invalid transcript metadata");
  }
}
function copySpan(span: TranscriptSpan): TranscriptSpan { return { ...span, ...(span.timing ? { timing: { ...span.timing } } : {}) }; }
/** Checks the supplied revision only; persistence compare-and-swap belongs to the host. */
export function correctTranscript(doc: Transcript, edits: readonly TranscriptEdit[], options: { expectedRevision: string; revision: string }): { transcript: Transcript; mapping: readonly TranscriptIdMapping[] } {
  validateTranscript(doc); nonempty(options.revision, "revision");
  if (doc.revision !== options.expectedRevision) throw new Error("TRANSCRIPT_STALE");
  if (options.revision === doc.revision) throw new TypeError("New revision must differ");
  if (!Array.isArray(edits)) throw new TypeError("Transcript edits must be an array");
  const spans = doc.spans.map(copySpan); const mapping: TranscriptIdMapping[] = [];
  for (const edit of edits as readonly TranscriptEdit[]) {
    if (!edit || typeof edit !== "object" || !["text", "timing", "split", "merge"].includes(edit.kind)) throw new TypeError("Unknown transcript edit kind");
    if (edit.kind === "merge" && !Array.isArray(edit.ids)) throw new TypeError("Merge requires ids");
    if (edit.kind === "split" && !Array.isArray(edit.parts)) throw new TypeError("Split requires parts");
    const id = edit.kind === "merge" ? edit.ids[0] : edit.id;
    const index = spans.findIndex((s) => s.id === id);
    if (index < 0) throw new TypeError("Unknown transcript id");
    const current = spans[index]!;
    if (edit.kind === "text") { nonempty(edit.text, "text"); spans[index] = { ...current, text: edit.text, ...(current.recognizedText === undefined && current.alignment === "recognized" ? { recognizedText: current.text } : {}), alignment: current.timing ? "corrected" : "unavailable" }; mapping.push({ from: [id!], to: [id!] }); }
    else if (edit.kind === "timing") { if (edit.timing !== null) range(edit.timing, doc.source.durationSeconds); const { timing: _timing, ...rest } = current; spans[index] = { ...rest, ...(current.recognizedText === undefined && current.alignment === "recognized" ? { recognizedText: current.text } : {}), ...(edit.timing ? { timing: { ...edit.timing } } : {}), alignment: edit.timing ? "corrected" : "unavailable" }; mapping.push({ from: [id!], to: [id!] }); }
    else if (edit.kind === "split") {
      if (edit.parts.length < 2) throw new TypeError("Split requires at least two parts");
      const existingIds = new Set(spans.map(s => s.id));
      for (const part of edit.parts) { if (!part || typeof part !== "object") throw new TypeError("Invalid split part"); nonempty(part.id, "split id"); if (existingIds.has(part.id)) throw new TypeError("Duplicate transcript id"); existingIds.add(part.id); }
      const parts: TranscriptSpan[] = edit.parts.map((part: { id: string; text: string; timing?: SecondsRange }) => ({ id: part.id, text: part.text, ...((current.recognizedText !== undefined || current.alignment === "recognized") ? { recognizedText: current.recognizedText ?? current.text } : {}), granularity: current.granularity, ...(part.timing ? { timing: { ...part.timing } } : {}), alignment: part.timing ? "corrected" : "unavailable", ...(current.speaker ? { speaker: current.speaker } : {}), ...(current.language ? { language: current.language } : {}) }));
      spans.splice(index, 1, ...parts); mapping.push({ from: [id!], to: parts.map((p) => p.id) });
    } else {
      if (edit.ids.length < 2 || new Set(edit.ids).size !== edit.ids.length || edit.ids.some((item: string, i: number) => spans[index + i]?.id !== item)) throw new TypeError("Merge requires adjacent unique ids");
      nonempty(edit.id, "merge id"); if (spans.some(s => s.id === edit.id)) throw new TypeError("Duplicate transcript id");
      const evidence = spans.slice(index, index + edit.ids.length).map(s => s.recognizedText ?? (s.alignment === "recognized" ? s.text : undefined));
      const merged: TranscriptSpan = { id: edit.id, text: edit.text, ...(evidence.every(value => value !== undefined) ? { recognizedText: evidence.join(" ") } : {}), granularity: "segment", ...(edit.timing ? { timing: { ...edit.timing } } : {}), alignment: edit.timing ? "corrected" : "unavailable" };
      spans.splice(index, edit.ids.length, merged); mapping.push({ from: [...edit.ids], to: [edit.id] });
    }
  }
  const result: Transcript = { ...doc, source: { ...doc.source }, ...(doc.provenance ? { provenance: { ...doc.provenance } } : {}), revision: options.revision, spans };
  validateTranscript(result); return { transcript: result, mapping };
}
export function projectWords(doc: Transcript): { words: TranscriptWord[]; unmappedIds: string[] } {
  validateTranscript(doc); const words: TranscriptWord[] = []; const unmappedIds: string[] = [];
  for (const s of doc.spans) { if (s.timing && s.granularity === "word") words.push({ text: s.text, start: s.timing.startSeconds, end: s.timing.endSeconds }); else unmappedIds.push(s.id); }
  return { words, unmappedIds };
}
/** One cue per timed span: deterministic and does not fabricate word-level timing. */
export function projectCaptions(doc: Transcript, options?: { maxCharsPerLine: number; maxLines: number; maxGapSeconds?: number }): { cues: CaptionCue[]; unmappedIds: string[] } {
  validateTranscript(doc); const cues: CaptionCue[] = []; const unmappedIds: string[] = [];
  for (const s of doc.spans) { if (!s.timing) { unmappedIds.push(s.id); continue; } cues.push({ id: s.id, text: s.text, ...s.timing, sourceIds: [s.id], ...(s.settings ? { settings: s.settings } : {}) }); }
  if (!options) return { cues, unmappedIds };
  const { maxCharsPerLine: width, maxLines: lines, maxGapSeconds = 0.5 } = options;
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(lines) || lines < 1 || !Number.isFinite(maxGapSeconds) || maxGapSeconds < 0) throw new TypeError("Invalid caption grouping options");
  const grouped: CaptionCue[] = [];
  const breakLines = (text: string): string | null => {
    const words = text.trim().split(/\s+/u); const output: string[] = [];
    for (const word of words) {
      if ([...word].length > width) return null;
      const last = output.at(-1);
      if (last !== undefined && [...last, " ", ...word].length <= width) output[output.length - 1] = `${last} ${word}`;
      else output.push(word);
    }
    return output.length <= lines ? output.join("\n") : null;
  };
  const byId = new Map(doc.spans.map(span => [span.id, span]));
  const indices = new Map(doc.spans.map((span, index) => [span.id, index]));
  for (const cue of cues) {
    const prior = grouped.at(-1); const previousSpan = prior && byId.get(prior.sourceIds[prior.sourceIds.length - 1]!); const nextSpan = byId.get(cue.sourceIds[0]!);
    const sameSpeaker = previousSpan?.speaker === nextSpan?.speaker && previousSpan?.language === nextSpan?.language;
    const adjacent = previousSpan !== undefined && nextSpan !== undefined && indices.get(nextSpan.id) === indices.get(previousSpan.id)! + 1;
    const text = prior && adjacent && sameSpeaker && !prior.settings && !cue.settings && cue.startSeconds >= prior.endSeconds && cue.startSeconds - prior.endSeconds <= maxGapSeconds ? breakLines(`${prior.text.replace(/\n/g, " ")} ${cue.text}`) : null;
    if (prior && text !== null) grouped[grouped.length - 1] = { id: `group:${JSON.stringify([...prior.sourceIds, ...cue.sourceIds])}`, text, startSeconds: prior.startSeconds, endSeconds: cue.endSeconds, sourceIds: [...prior.sourceIds, ...cue.sourceIds] };
    else grouped.push({ ...cue, text: breakLines(cue.text) ?? cue.text, sourceIds: [...cue.sourceIds] });
  }
  return { cues: grouped, unmappedIds };
}
function checkSubtitleFormat(format: string): void { if (format !== "srt" && format !== "vtt") throw new TypeError("Unsupported subtitle format"); }
export function importSubtitles(input: string, format: "srt" | "vtt", source: TranscriptSource, revision: string): { transcript: Transcript; losses: string[] } {
  checkSubtitleFormat(format);
  const parsed = format === "srt" ? parseSRT(input, { strict: true }) : parseVTT(input, { strict: true });
  const transcript: Transcript = { schemaVersion: 1, source: { ...source }, revision, timeUnit: "seconds", spans: parsed.map((cue, i) => ({ id: `cue-${i + 1}`, text: cue.text, timing: { startSeconds: cue.start / 1000, endSeconds: cue.end / 1000 }, granularity: "segment", alignment: "recognized", ...(cue.settings ? { settings: cue.settings } : {}) })) };
  validateTranscript(transcript); return { transcript, losses: ["subtitle identifiers, comments and document metadata may be discarded", "word timing is unavailable"] };
}
export function exportSubtitles(doc: Transcript, format: "srt" | "vtt"): { text: string; losses: string[]; unmappedIds: string[] } {
  checkSubtitleFormat(format);
  const projection = projectCaptions(doc);
  const cues: Cue[] = projection.cues.map((cue) => ({ start: Math.round(cue.startSeconds * 1000), end: Math.round(cue.endSeconds * 1000), text: cue.text, ...(format === "vtt" && cue.settings ? { settings: cue.settings } : {}) }));
  if (cues.some(c => c.end <= c.start)) throw new TypeError("Subtitle range collapses at millisecond precision");
  const losses = ["source identity, revision, recognition evidence, alignment, speaker and language are not preserved", "timestamps are rounded to milliseconds"];
  if (format === "srt" && projection.cues.some(c => c.settings)) losses.push("VTT cue settings are not preserved");
  return { text: format === "srt" ? generateSRT(cues) : generateVTT(cues), losses, unmappedIds: projection.unmappedIds };
}
export function createKeptRangeMap(source: TranscriptSource, ranges: readonly SecondsRange[]): KeptRangeMap {
  sourceValid(source); let end = 0; let durationSeconds = 0;
  const copy = ranges.map((item, i) => { range(item, source.durationSeconds); if (i && item.startSeconds < end) throw new TypeError("Kept ranges must be ordered and disjoint"); end = item.endSeconds; durationSeconds += item.endSeconds - item.startSeconds; return { ...item }; });
  return { source: { ...source }, ranges: copy, durationSeconds };
}
export function mapTranscript(doc: Transcript, map: KeptRangeMap): { spans: MappedTranscriptSpan[]; unmappedIds: string[]; removedIds: string[] } {
  validateTranscript(doc); const checked = createKeptRangeMap(map.source, map.ranges); if (!sameSource(doc.source, checked.source)) throw new Error("TRANSCRIPT_SOURCE_MISMATCH");
  const spans: MappedTranscriptSpan[] = []; const unmappedIds: string[] = []; const removedIds: string[] = [];
  for (const s of doc.spans) {
    if (!s.timing) { unmappedIds.push(s.id); continue; }
    let offset = 0; let pieces = 0;
    for (const [i, keep] of checked.ranges.entries()) {
      const start = Math.max(s.timing.startSeconds, keep.startSeconds), end = Math.min(s.timing.endSeconds, keep.endSeconds);
      if (start < end) { pieces++; spans.push({ id: `${s.id}@${i}`, sourceId: s.id, text: s.text, sourceRange: { startSeconds: start, endSeconds: end }, outputRange: { startSeconds: offset + start - keep.startSeconds, endSeconds: offset + end - keep.startSeconds }, clipped: start !== s.timing.startSeconds || end !== s.timing.endSeconds, granularity: s.granularity, alignment: s.alignment }); }
      offset += keep.endSeconds - keep.startSeconds;
    }
    if (!pieces) removedIds.push(s.id);
  }
  return { spans, unmappedIds, removedIds };
}
/** Caption pieces preserve source identity and identify clipping for review. */
export function projectMappedCaptions(doc: Transcript, map: KeptRangeMap): { cues: CaptionCue[]; unmappedIds: string[]; removedIds: string[] } {
  const mapped = mapTranscript(doc, map);
  return { cues: mapped.spans.map(span => ({ id: span.id, text: span.text, ...span.outputRange, sourceIds: [span.sourceId], clipped: span.clipped })), unmappedIds: mapped.unmappedIds, removedIds: mapped.removedIds };
}
export function suggestFillerCuts(doc: Transcript, fillers: readonly string[]): { ranges: SecondsRange[]; unmappedIds: string[] } {
  validateTranscript(doc); const terms = new Set(fillers.map(x => x.trim().toLocaleLowerCase("und"))); const ranges: SecondsRange[] = []; const unmappedIds: string[] = [];
  for (const s of doc.spans) if (terms.has(s.text.trim().toLocaleLowerCase("und"))) { if (s.timing && s.granularity === "word") ranges.push({ ...s.timing }); else unmappedIds.push(s.id); }
  return { ranges, unmappedIds };
}
