import { describe, expect, it } from "vitest";
import {
  checkScript,
  editBlock,
  filmScript,
  insertBlock,
  parseScript,
  printScript,
  removeBlock,
  sliceShots,
} from "./index.js";

const SAMPLE = `# Window Seat

\`\`\`shot id=opening hold=4 still=1.5
beats: door-open=1.2, sit-down=2.8

A warm train car pulls out of the station.
\`\`\`

\`\`\`speech id=line-1 at=@door-open+0.2..@sit-down
who: maya

Is this seat taken?
\`\`\`

\`\`\`shot id=window hold=3
Rain streaks down the glass.
\`\`\`

\`\`\`speech id=line-2
who: leo

Not anymore.
\`\`\`
`;

describe("superimg-script beat anchors, surgical edits, slicing, and checks", () => {
  it("parses, round-trips, and resolves @beat anchors against owning shot beats", () => {
    const doc = parseScript(SAMPLE)!;
    expect(doc.findings).toEqual([]);

    const printed = printScript(doc);
    expect(printed).toContain("at=@door-open+0.2..@sit-down");

    const view = filmScript(doc);
    const speech = view.blocks.find((b) => b.id === "line-1");
    expect(speech?.kind).toBe("speech");
    if (speech?.kind === "speech") {
      expect(speech.at?.start).toBeCloseTo(1.4, 6);
      expect(speech.at?.end).toBeCloseTo(2.8, 6);
    }

    // Retiming the beat automatically shifts the anchored line!
    const retimed = editBlock(SAMPLE, "opening", {
      fields: { beats: "door-open=1.8, sit-down=3.4" },
    });
    const retimedView = filmScript(parseScript(retimed.text)!);
    const retimedSpeech = retimedView.blocks.find((b) => b.id === "line-1");
    if (retimedSpeech?.kind === "speech") {
      expect(retimedSpeech.at?.start).toBeCloseTo(2.0, 6);
      expect(retimedSpeech.at?.end).toBeCloseTo(3.4, 6);
    }
  });

  it("reports UNKNOWN_BEAT when a speech block references an undeclared beat", () => {
    const bad = `\`\`\`shot id=s1 hold=3
A quiet room.
\`\`\`

\`\`\`speech id=l1 at=@missing+0.5
who: maya

Hello?
\`\`\`
`;
    const doc = parseScript(bad)!;
    expect(doc.findings.some((f) => f.code === "UNKNOWN_BEAT")).toBe(true);
  });

  it("supports editBlock, insertBlock, removeBlock, and preserves scriptHash on timing-only edits", () => {
    const before = parseScript(SAMPLE)!;
    const timingEdit = editBlock(SAMPLE, "opening", { hold: 5.5 });
    expect(timingEdit.changed).toBe(true);
    expect(timingEdit.scriptHash).toBe(editBlock(SAMPLE, "opening", {}).scriptHash);
    expect(timingEdit.editHash).not.toBe(editBlock(SAMPLE, "opening", {}).editHash);

    const inserted = insertBlock(
      SAMPLE,
      { kind: "shot", id: "middle", hold: 2, fields: {}, text: "A passing tunnel." },
      { after: "line-1" },
    );
    const ids = filmScript(parseScript(inserted.text)!).blocks
      .filter((b) => b.kind === "shot")
      .map((b) => b.id);
    expect(ids).toEqual(["opening", "middle", "window"]);

    const removed = removeBlock(inserted.text, "middle");
    const idsAfterRemove = filmScript(parseScript(removed.text)!).blocks
      .filter((b) => b.kind === "shot")
      .map((b) => b.id);
    expect(idsAfterRemove).toEqual(["opening", "window"]);
    expect(before.items.length).toBeGreaterThan(0);
  });

  it("slices shots cleanly in document or requested order while keeping title and owned dialogue", () => {
    const onlyWindow = sliceShots(SAMPLE, ["window"]);
    expect(onlyWindow).toContain("# Window Seat");
    expect(onlyWindow).toContain("id=window");
    expect(onlyWindow).toContain("id=line-2");
    expect(onlyWindow).not.toContain("id=opening");
    expect(onlyWindow).not.toContain("id=line-1");

    const reversed = sliceShots(SAMPLE, ["window", "opening"], { order: "requested" });
    expect(reversed.indexOf("id=window")).toBeLessThan(reversed.indexOf("id=opening"));
  });

  it("checks bubble line/char limits, reading pace (maxCps), and ASCII-only text", () => {
    const dense = `\`\`\`shot id=s1 hold=2
Desk.
\`\`\`

\`\`\`speech id=fast at=0..0.5
who: maya

This line is way too long for half a second — café!
Second line
Third line
\`\`\`
`;
    const findings = checkScript(dense, {
      maxLines: 2,
      maxChars: 30,
      maxCps: 20,
      asciiOnly: true,
    });
    const codes = findings.map((f) => f.code);
    expect(codes).toContain("BUBBLE_TOO_LONG");
    expect(codes).toContain("PACE_TOO_FAST");
    expect(codes).toContain("NON_ASCII_TEXT");
  });
});
