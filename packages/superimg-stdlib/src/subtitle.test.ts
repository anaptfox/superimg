import { describe, it, expect } from "vitest";
import {
  parseTime,
  formatTime,
  parseSRT,
  parseVTT,
  generateSRT,
  generateVTT,
  getCueAtTime,
  getCuesAtTime,
  getCueProgress,
  type Cue,
} from "./subtitle";

describe("parseTime", () => {
  it("parses SRT format with comma", () => {
    expect(parseTime("00:00:01,000")).toBe(1000);
    expect(parseTime("00:01:30,500")).toBe(90500);
    expect(parseTime("01:30:45,123")).toBe(5445123);
  });

  it("parses VTT format with period", () => {
    expect(parseTime("00:00:01.000")).toBe(1000);
    expect(parseTime("00:01:30.500")).toBe(90500);
    expect(parseTime("01:30:45.123")).toBe(5445123);
  });

  it("parses short formats (MM:SS.mmm)", () => {
    expect(parseTime("01:30.500")).toBe(90500);
    expect(parseTime("00:05.000")).toBe(5000);
  });

  it("parses very short formats (SS.mmm)", () => {
    expect(parseTime("30.500")).toBe(30500);
    expect(parseTime("5.000")).toBe(5000);
  });

  it("handles whitespace", () => {
    expect(parseTime("  00:00:01,000  ")).toBe(1000);
  });
});

describe("formatTime", () => {
  it("formats to SRT format with comma", () => {
    expect(formatTime(1000, "srt")).toBe("00:00:01,000");
    expect(formatTime(90500, "srt")).toBe("00:01:30,500");
    expect(formatTime(5445123, "srt")).toBe("01:30:45,123");
  });

  it("formats to VTT format with period", () => {
    expect(formatTime(1000, "vtt")).toBe("00:00:01.000");
    expect(formatTime(90500, "vtt")).toBe("00:01:30.500");
    expect(formatTime(5445123, "vtt")).toBe("01:30:45.123");
  });

  it("round-trips correctly", () => {
    const times = [0, 1000, 90500, 5445123, 3600000];
    for (const ms of times) {
      expect(parseTime(formatTime(ms, "srt"))).toBe(ms);
      expect(parseTime(formatTime(ms, "vtt"))).toBe(ms);
    }
  });
});

describe("parseSRT", () => {
  it("parses single cue", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello, world!`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0]).toEqual({
      index: 1,
      start: 1000,
      end: 4000,
      text: "Hello, world!",
    });
  });

  it("parses multiple cues", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello, world!

2
00:00:05,500 --> 00:00:08,000
This is a subtitle.`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0].index).toBe(1);
    expect(cues[0].text).toBe("Hello, world!");
    expect(cues[1].index).toBe(2);
    expect(cues[1].text).toBe("This is a subtitle.");
  });

  it("parses multiline text", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Line one
Line two
Line three`;

    const cues = parseSRT(srt);
    expect(cues[0].text).toBe("Line one\nLine two\nLine three");
  });

  it("handles CRLF line endings", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:04,000\r\nHello!";
    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello!");
  });

  it("handles extra blank lines between cues", () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
First



2
00:00:05,000 --> 00:00:08,000
Second`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(2);
  });

  it("skips malformed cues in non-strict mode", () => {
    const srt = `1
invalid timestamp
Hello

2
00:00:05,000 --> 00:00:08,000
Valid`;

    const cues = parseSRT(srt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Valid");
  });

  it("throws on malformed cues in strict mode", () => {
    const srt = `1
invalid timestamp
Hello`;

    expect(() => parseSRT(srt, { strict: true })).toThrow(
      "Invalid timestamp line"
    );
  });
});

describe("parseVTT", () => {
  it("parses basic VTT", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello, world!

00:00:05.500 --> 00:00:08.000
This is a subtitle.`;

    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(2);
    expect(cues[0].start).toBe(1000);
    expect(cues[0].end).toBe(4000);
    expect(cues[0].text).toBe("Hello, world!");
  });

  it("parses VTT with cue settings", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000 align:center position:50%
Hello, world!`;

    const cues = parseVTT(vtt);
    expect(cues[0].settings).toBe("align:center position:50%");
  });

  it("parses VTT with cue identifiers", () => {
    const vtt = `WEBVTT

intro
00:00:01.000 --> 00:00:04.000
Hello, world!`;

    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello, world!");
  });

  it("skips NOTE blocks", () => {
    const vtt = `WEBVTT

NOTE This is a comment

00:00:01.000 --> 00:00:04.000
Hello!`;

    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hello!");
  });

  it("parses VTT with header metadata", () => {
    const vtt = `WEBVTT - Title

00:00:01.000 --> 00:00:04.000
Hello!`;

    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
  });

  it("throws on missing WEBVTT header in strict mode", () => {
    const vtt = `00:00:01.000 --> 00:00:04.000
Hello!`;

    expect(() => parseVTT(vtt, { strict: true })).toThrow(
      "VTT file must start with WEBVTT"
    );
  });

  it("parses without WEBVTT header in non-strict mode", () => {
    const vtt = `00:00:01.000 --> 00:00:04.000
Hello!`;

    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
  });
});

describe("generateSRT", () => {
  it("generates valid SRT", () => {
    const cues: Cue[] = [
      { index: 1, start: 1000, end: 4000, text: "Hello, world!" },
      { index: 2, start: 5500, end: 8000, text: "This is a subtitle." },
    ];

    const srt = generateSRT(cues);
    expect(srt).toContain("1\n00:00:01,000 --> 00:00:04,000\nHello, world!");
    expect(srt).toContain(
      "2\n00:00:05,500 --> 00:00:08,000\nThis is a subtitle."
    );
  });

  it("auto-generates indices if missing", () => {
    const cues: Cue[] = [
      { start: 1000, end: 4000, text: "First" },
      { start: 5000, end: 8000, text: "Second" },
    ];

    const srt = generateSRT(cues);
    expect(srt).toContain("1\n00:00:01,000");
    expect(srt).toContain("2\n00:00:05,000");
  });

  it("round-trips with parseSRT", () => {
    const original: Cue[] = [
      { index: 1, start: 1000, end: 4000, text: "Hello!" },
      { index: 2, start: 5000, end: 8000, text: "Line one\nLine two" },
    ];

    const srt = generateSRT(original);
    const parsed = parseSRT(srt);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].start).toBe(original[0].start);
    expect(parsed[0].end).toBe(original[0].end);
    expect(parsed[0].text).toBe(original[0].text);
    expect(parsed[1].text).toBe(original[1].text);
  });
});

describe("generateVTT", () => {
  it("generates valid VTT", () => {
    const cues: Cue[] = [
      { start: 1000, end: 4000, text: "Hello, world!" },
    ];

    const vtt = generateVTT(cues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000 --> 00:00:04.000");
    expect(vtt).toContain("Hello, world!");
  });

  it("includes cue settings", () => {
    const cues: Cue[] = [
      { start: 1000, end: 4000, text: "Hello!", settings: "align:center" },
    ];

    const vtt = generateVTT(cues);
    expect(vtt).toContain("00:00:01.000 --> 00:00:04.000 align:center");
  });

  it("includes optional header", () => {
    const cues: Cue[] = [{ start: 1000, end: 4000, text: "Hello!" }];

    const vtt = generateVTT(cues, "Kind: captions\nLanguage: en");
    expect(vtt).toContain("WEBVTT\nKind: captions\nLanguage: en");
  });

  it("round-trips with parseVTT", () => {
    const original: Cue[] = [
      { start: 1000, end: 4000, text: "Hello!" },
      { start: 5000, end: 8000, text: "Multi\nline" },
    ];

    const vtt = generateVTT(original);
    const parsed = parseVTT(vtt);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].start).toBe(original[0].start);
    expect(parsed[0].text).toBe(original[0].text);
    expect(parsed[1].text).toBe(original[1].text);
  });
});

describe("getCueAtTime", () => {
  const cues: Cue[] = [
    { start: 1000, end: 4000, text: "First" },
    { start: 5000, end: 8000, text: "Second" },
    { start: 10000, end: 15000, text: "Third" },
  ];

  it("returns null before first cue", () => {
    expect(getCueAtTime(cues, 0)).toBeNull();
    expect(getCueAtTime(cues, 500)).toBeNull();
  });

  it("returns cue at exact start time", () => {
    const cue = getCueAtTime(cues, 1000);
    expect(cue?.text).toBe("First");
  });

  it("returns cue during its duration", () => {
    const cue = getCueAtTime(cues, 2500);
    expect(cue?.text).toBe("First");
  });

  it("returns null at exact end time (exclusive)", () => {
    expect(getCueAtTime(cues, 4000)).toBeNull();
  });

  it("returns null between cues", () => {
    expect(getCueAtTime(cues, 4500)).toBeNull();
    expect(getCueAtTime(cues, 9000)).toBeNull();
  });

  it("returns correct cue for each segment", () => {
    expect(getCueAtTime(cues, 5500)?.text).toBe("Second");
    expect(getCueAtTime(cues, 12000)?.text).toBe("Third");
  });

  it("returns null after last cue", () => {
    expect(getCueAtTime(cues, 15000)).toBeNull();
    expect(getCueAtTime(cues, 20000)).toBeNull();
  });

  it("handles empty cue array", () => {
    expect(getCueAtTime([], 1000)).toBeNull();
  });
});

describe("getCuesAtTime", () => {
  it("returns multiple overlapping cues", () => {
    const cues: Cue[] = [
      { start: 1000, end: 5000, text: "First" },
      { start: 3000, end: 7000, text: "Second" },
      { start: 10000, end: 15000, text: "Third" },
    ];

    // At 4000ms, both first and second are active
    const active = getCuesAtTime(cues, 4000);
    expect(active).toHaveLength(2);
    expect(active.map((c) => c.text)).toContain("First");
    expect(active.map((c) => c.text)).toContain("Second");
  });

  it("returns single cue when no overlap", () => {
    const cues: Cue[] = [
      { start: 1000, end: 3000, text: "First" },
      { start: 5000, end: 7000, text: "Second" },
    ];

    const active = getCuesAtTime(cues, 2000);
    expect(active).toHaveLength(1);
    expect(active[0].text).toBe("First");
  });

  it("returns empty array when no active cues", () => {
    const cues: Cue[] = [
      { start: 1000, end: 3000, text: "First" },
      { start: 5000, end: 7000, text: "Second" },
    ];

    expect(getCuesAtTime(cues, 4000)).toHaveLength(0);
  });
});

describe("getCueProgress", () => {
  const cue: Cue = { start: 1000, end: 5000, text: "Test" };

  it("returns 0 before cue starts", () => {
    expect(getCueProgress(cue, 0)).toBe(0);
    expect(getCueProgress(cue, 500)).toBe(0);
  });

  it("returns 0 at exact start", () => {
    expect(getCueProgress(cue, 1000)).toBe(0);
  });

  it("returns progress during cue", () => {
    expect(getCueProgress(cue, 2000)).toBe(0.25);
    expect(getCueProgress(cue, 3000)).toBe(0.5);
    expect(getCueProgress(cue, 4000)).toBe(0.75);
  });

  it("returns 0 at exact end (exclusive)", () => {
    expect(getCueProgress(cue, 5000)).toBe(0);
  });

  it("returns 0 after cue ends", () => {
    expect(getCueProgress(cue, 6000)).toBe(0);
  });

  it("handles zero-duration cue", () => {
    const zeroCue: Cue = { start: 1000, end: 1000, text: "Zero" };
    expect(getCueProgress(zeroCue, 1000)).toBe(0);
  });
});
