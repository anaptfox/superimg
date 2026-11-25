import { describe, expect, it } from "vitest";
import { correctTranscript, createKeptRangeMap, exportSubtitles, importSubtitles, mapTranscript, projectCaptions, projectMappedCaptions, projectWords, suggestFillerCuts, validateTranscript, type Transcript } from "./document.js";
const source = { mediaSha256: "abc", trackId: "audio", durationSeconds: 10 };
const transcript: Transcript = { schemaVersion: 1, source, revision: "r1", timeUnit: "seconds", provenance: { provider: "fixture", model: "one" }, spans: [
  { id: "a", text: "hello", recognizedText: "hallo", timing: { startSeconds: 1, endSeconds: 2.5 }, granularity: "word", alignment: "recognized" },
  { id: "b", text: "um", timing: { startSeconds: 3, endSeconds: 4 }, granularity: "word", alignment: "recognized" },
  { id: "c", text: "猫です", granularity: "segment", alignment: "unavailable" },
] };
describe("transcript data", () => {
  it("checks revisions, retains evidence and copies without mutating supplied data", () => {
    expect(() => correctTranscript(transcript, [], { expectedRevision: "old", revision: "r2" })).toThrow("TRANSCRIPT_STALE");
    const edited = correctTranscript(transcript, [{ kind: "text", id: "a", text: "Hello!" }, { kind: "timing", id: "b", timing: { startSeconds: 3.1, endSeconds: 4 } }], { expectedRevision: "r1", revision: "r2" });
    expect(edited.transcript.spans[0]).toMatchObject({ text: "Hello!", recognizedText: "hallo", alignment: "corrected" });
    expect(transcript.spans[0]!.text).toBe("hello");
    expect(projectWords(edited.transcript)).toMatchObject({ unmappedIds: ["c"] });
  });
  it("maps split and merge identities without inventing timing", () => {
    const split = correctTranscript(transcript, [{ kind: "split", id: "c", parts: [{ id: "c1", text: "猫" }, { id: "c2", text: "です" }] }], { expectedRevision: "r1", revision: "r2" });
    expect(split.mapping).toEqual([{ from: ["c"], to: ["c1", "c2"] }]);
    expect(split.transcript.spans.slice(-2).every(s => s.alignment === "unavailable" && !s.timing)).toBe(true);
    const merge = correctTranscript(split.transcript, [{ kind: "merge", ids: ["c1", "c2"], id: "c3", text: "猫です" }], { expectedRevision: "r2", revision: "r3" });
    expect(merge.mapping[0]).toEqual({ from: ["c1", "c2"], to: ["c3"] });
    expect(merge.transcript.spans.at(-1)).toMatchObject({ granularity: "segment", alignment: "unavailable" });
    expect(() => correctTranscript(transcript, [{ kind: "split", id: "a", parts: [{ id: "b", text: "x" }, { id: "q", text: "y" }] }], { expectedRevision: "r1", revision: "r2" })).toThrow("Duplicate");
  });
  it("rejects invalid spans and never projects coarse times as word times", () => {
    expect(() => validateTranscript({ ...transcript, spans: [{ ...transcript.spans[0]!, timing: { startSeconds: 2, endSeconds: 1 } }] })).toThrow();
    expect(projectCaptions(transcript).unmappedIds).toEqual(["c"]);
    expect(projectWords({ ...transcript, spans: [{ ...transcript.spans[0]!, granularity: "segment" }] })).toEqual({ words: [], unmappedIds: ["a"] });
  });
  it("projects subtitle formats with explicit loss and milliseconds", () => {
    for (const format of ["srt", "vtt"] as const) {
      const out = exportSubtitles(transcript, format); expect(out.unmappedIds).toEqual(["c"]); expect(out.losses.length).toBeGreaterThan(0);
      const imported = importSubtitles(out.text, format, source, "imported");
      expect(imported.transcript.spans[0]).toMatchObject({ text: "hello", timing: { startSeconds: 1, endSeconds: 2.5 }, granularity: "segment" });
      expect(projectWords(imported.transcript).words).toEqual([]);
    }
  });
  it("maps split, removed and untimed spans with a shared half-open clock", () => {
    const map = createKeptRangeMap(source, [{ startSeconds: 0, endSeconds: 1.5 }, { startSeconds: 2, endSeconds: 3 }]);
    const result = mapTranscript(transcript, map);
    expect(result.spans).toEqual([
      expect.objectContaining({ sourceId: "a", sourceRange: { startSeconds: 1, endSeconds: 1.5 }, outputRange: { startSeconds: 1, endSeconds: 1.5 }, clipped: true }),
      expect.objectContaining({ sourceId: "a", sourceRange: { startSeconds: 2, endSeconds: 2.5 }, outputRange: { startSeconds: 1.5, endSeconds: 2 }, clipped: true }),
    ]);
    expect(result.removedIds).toEqual(["b"]); expect(result.unmappedIds).toEqual(["c"]);
    expect(projectMappedCaptions(transcript, map).cues[1]).toMatchObject({ startSeconds: 1.5, endSeconds: 2, sourceIds: ["a"], clipped: true });
    expect(() => createKeptRangeMap(source, [{ startSeconds: 2, endSeconds: 3 }, { startSeconds: 1, endSeconds: 2 }])).toThrow();
    expect(() => mapTranscript(transcript, createKeptRangeMap({ ...source, trackId: "other" }, []))).toThrow("SOURCE_MISMATCH");
    expect(suggestFillerCuts(transcript, ["UM"]).ranges).toEqual([{ startSeconds: 3, endSeconds: 4 }]);
  });
});

it("retains recognized text on correction without presenting it as fresh alignment", () => {
  const input: Transcript = { ...transcript, spans: [{ id: "one", text: "Helo", timing: { startSeconds: 1, endSeconds: 2 }, granularity: "word", alignment: "recognized" }] };
  const result = correctTranscript(input, [{ kind: "text", id: "one", text: "Hello" }], { expectedRevision: "r1", revision: "r2" }).transcript;
  expect(result.spans[0]).toMatchObject({ text: "Hello", recognizedText: "Helo", alignment: "corrected", timing: { startSeconds: 1, endSeconds: 2 } });
  const split = correctTranscript(input, [{ kind: "split", id: "one", parts: [{ id: "one-a", text: "He" }, { id: "one-b", text: "lo" }] }], { expectedRevision: "r1", revision: "r2" }).transcript;
  expect(split.spans).toEqual([expect.objectContaining({ recognizedText: "Helo", alignment: "unavailable" }), expect.objectContaining({ recognizedText: "Helo", alignment: "unavailable" })]);
});
it("groups and wraps timed spans deterministically without splitting a word or bridging a gap", () => {
  const doc: Transcript = { ...transcript, spans: [
    { id: "1", text: "one", granularity: "word", alignment: "recognized", timing: { startSeconds: 0, endSeconds: 0.2 } },
    { id: "2", text: "two", granularity: "word", alignment: "recognized", timing: { startSeconds: 0.2, endSeconds: 0.4 } },
    { id: "3", text: "three", granularity: "word", alignment: "recognized", timing: { startSeconds: 0.4, endSeconds: 0.6 } },
    { id: "4", text: "later", granularity: "word", alignment: "recognized", timing: { startSeconds: 2, endSeconds: 3 } },
  ] };
  const result = projectCaptions(doc, { maxCharsPerLine: 7, maxLines: 2, maxGapSeconds: 0.5 });
  expect(result.cues.map(c => c.text)).toEqual(["one two\nthree", "later"]);
  expect(result.cues[0]).toMatchObject({ sourceIds: ["1", "2", "3"], startSeconds: 0, endSeconds: 0.6 });
  expect(projectCaptions(doc, { maxCharsPerLine: 3, maxLines: 1 }).cues.map(c => c.text)).toEqual(["one", "two", "three", "later"]);
  expect(() => projectCaptions(doc, { maxCharsPerLine: 0, maxLines: 1 })).toThrow();
});
it("rejects unknown commands, formats, malformed spans and colliding edit identities", () => {
  const opts = { expectedRevision: "r1", revision: "r2" };
  expect(() => correctTranscript(transcript, [{ kind: "mystery", id: "a" }] as never, opts)).toThrow("Unknown transcript edit");
  expect(() => correctTranscript(transcript, [{ kind: "timing", id: "a" }] as never, opts)).toThrow("Invalid seconds range");
  expect(() => exportSubtitles(transcript, "other" as never)).toThrow("Unsupported subtitle format");
  expect(() => importSubtitles("", "other" as never, source, "x")).toThrow("Unsupported subtitle format");
  expect(() => validateTranscript({ ...transcript, spans: [null] } as never)).toThrow("Invalid transcript span");
  expect(() => validateTranscript({ ...transcript, spans: [{ ...transcript.spans[0], timing: null }] } as never)).toThrow("Invalid seconds range");
  expect(() => correctTranscript(transcript, [{ kind: "split", id: "a", parts: [{ id: "a", text: "x" }, { id: "z", text: "y" }] }], opts)).toThrow("Duplicate");
  expect(() => correctTranscript(transcript, [{ kind: "merge", ids: ["a", "b"], id: "a", text: "x" }], opts)).toThrow("Duplicate");
});
it("owns returned ranges and transcript values", () => {
  const timing = { startSeconds: 1.1, endSeconds: 1.5 }; const ranges = [{ startSeconds: 0, endSeconds: 2 }];
  const result = correctTranscript(transcript, [{ kind: "timing", id: "a", timing }], { expectedRevision: "r1", revision: "r2" }).transcript;
  const map = createKeptRangeMap(source, ranges); timing.startSeconds = 1.3; ranges[0]!.endSeconds = 1; source.trackId = "changed";
  expect(result.spans[0]!.timing!.startSeconds).toBe(1.1); expect(map.ranges[0]!.endSeconds).toBe(2); expect(result.source.trackId).toBe("audio");
  source.trackId = "audio";
});

it("does not group distinct speakers and does not alias the host timing object", () => {
  const doc: Transcript = { ...transcript, spans: [
    { id: "one", text: "Hi", speaker: "A", timing: { startSeconds: 0, endSeconds: 0.4 }, granularity: "word", alignment: "recognized" },
    { id: "two", text: "there", speaker: "B", timing: { startSeconds: 0.4, endSeconds: 0.8 }, granularity: "word", alignment: "recognized" },
  ] };
  expect(projectCaptions(doc, { maxCharsPerLine: 20, maxLines: 1 }).cues).toHaveLength(2);
});

it("does not group across an untimed span or an overlapping caption", () => {
  const doc: Transcript = { ...transcript, spans: [
    { id: "a", text: "one", timing: { startSeconds: 0, endSeconds: 1 }, granularity: "word", alignment: "recognized" },
    { id: "missing", text: "unknown", granularity: "word", alignment: "unavailable" },
    { id: "b", text: "two", timing: { startSeconds: 1, endSeconds: 2 }, granularity: "word", alignment: "recognized" },
    { id: "c", text: "overlap", timing: { startSeconds: 1.5, endSeconds: 2.5 }, granularity: "word", alignment: "recognized" },
  ] };
  const result = projectCaptions(doc, { maxCharsPerLine: 30, maxLines: 2 });
  expect(result.cues.map(c => c.text)).toEqual(["one", "two", "overlap"]);
  expect(result.unmappedIds).toEqual(["missing"]);
});
