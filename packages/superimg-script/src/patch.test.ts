import { describe, expect, it } from "vitest";
import { editHash, filmEditHash, filmScript, parseScript, patchScriptAttr, printScript, scriptBlocks, scriptHash } from "./index.js";

describe("shot header fields", () => {
  it("parses, prints, and hashes optional header fields on shot blocks", () => {
    const raw = [
      "# Fireside",
      "",
      "```shot id=hearth hold=4",
      "mood: warm",
      "camera: close",
      "music: campfire-bed",
      "sfx: crackle",
      "",
      "A lantern glows beside the door.",
      "```",
      "",
    ].join("\n");

    const doc = parseScript(raw)!;
    expect(doc.findings).toEqual([]);
    const [shot] = scriptBlocks(doc);
    expect(shot).toMatchObject({
      kind: "shot",
      id: "hearth",
      hold: 4,
      fields: {
        mood: "warm",
        camera: "close",
        music: "campfire-bed",
        sfx: "crackle",
      },
      text: "A lantern glows beside the door.",
    });

    const printed = printScript(doc);
    expect(printed).toBe(raw);

    const view = filmScript(doc);
    expect(view.blocks[0]).toMatchObject({
      kind: "shot",
      id: "hearth",
      fields: {
        camera: "close",
        mood: "warm",
        music: "campfire-bed",
        sfx: "crackle",
      },
      text: "A lantern glows beside the door.",
    });

    const changed = parseScript(raw.replace("mood: warm", "mood: tense"))!;
    expect(scriptHash(changed)).not.toBe(scriptHash(doc));
  });

  it("keeps multi-paragraph shot descriptions without header fields warning-free", () => {
    const raw = "```shot id=wide hold=3\nFirst paragraph.\n\nSecond paragraph.\n```\n";
    const doc = parseScript(raw)!;
    expect(doc.findings).toEqual([]);
    expect(scriptBlocks(doc)[0]).toMatchObject({
      kind: "shot",
      id: "wide",
      fields: {},
      text: "First paragraph.\n\nSecond paragraph.",
    });
  });
});

describe("patchScriptAttr", () => {
  it("updates, inserts, and removes fence attributes while preserving CRLF and unrelated fences", () => {
    const crlf = [
      "# Story",
      "",
      "```md",
      "```shot id=intro hold=9",
      "Example inside markdown fence stays untouched.",
      "```",
      "",
      "```shot id=intro hold=2.4",
      "Opening beat.",
      "```",
      "",
      "```shot id=outro",
      "Closing beat.",
      "```",
    ].join("\r\n");

    const updated = patchScriptAttr(crlf, "intro", "hold", 3.5);
    expect(updated.changed).toBe(true);
    expect(updated.text).toContain("```shot id=intro hold=3.5\r\nOpening beat.");
    expect(updated.text).toContain("```shot id=intro hold=9\r\nExample inside markdown fence stays untouched.");
    expect(updated.text.endsWith("```")).toBe(true);

    const inserted = patchScriptAttr(updated.text, "outro", "hold", 5);
    expect(inserted.changed).toBe(true);
    expect(inserted.text).toContain("```shot id=outro hold=5\r\nClosing beat.");

    const noop = patchScriptAttr(inserted.text, "outro", "hold", 5);
    expect(noop.changed).toBe(false);
    expect(noop.text).toBe(inserted.text);

    const removed = patchScriptAttr(inserted.text, "intro", "hold", null);
    expect(removed.changed).toBe(true);
    expect(removed.text).toContain("```shot id=intro\r\nOpening beat.");
  });

  it("rejects unknown, duplicate, or invalid attribute patches", () => {
    const src = "```shot id=a hold=2\nOne.\n```\n";
    expect(() => patchScriptAttr(src, "missing", "hold", 3)).toThrow(/No script block/);
    expect(() => patchScriptAttr(src, "a", "id", "b")).toThrow(/Cannot patch/);
    expect(() => patchScriptAttr(src, "a", "hold", 0)).toThrow(/positive/);
    expect(() => patchScriptAttr("```shot id=a hold=1 hold=2\nX\n```\n", "a", "hold", 3)).toThrow(/duplicate/);
  });

  it("parses, prints, and hashes shot in= attribute while rejecting it on speech/card", () => {
    const base = "```shot id=clip hold=3\nA beat.\n```\n";
    const withIn = "```shot id=clip hold=3 in=1.5\nA beat.\n```\n";
    const docBase = parseScript(base)!;
    const docIn = parseScript(withIn)!;
    expect(docIn.findings).toEqual([]);
    expect(scriptBlocks(docIn)[0]).toMatchObject({ kind: "shot", id: "clip", hold: 3, in: 1.5 });
    expect(printScript(docIn)).toBe(withIn);
    expect(filmScript(docIn).blocks[0]).toMatchObject({ kind: "shot", id: "clip", hold: 3, in: 1.5 });
    expect(editHash(docIn)).not.toBe(editHash(docBase));
    expect(filmEditHash(filmScript(docIn))).toBe(editHash(docIn));

    const bad = parseScript("```speech id=s1 in=1\nwho: fox\n\nHi.\n```\n")!;
    expect(bad.findings.some((f) => f.code === "BAD_ATTR")).toBe(true);
  });
});
