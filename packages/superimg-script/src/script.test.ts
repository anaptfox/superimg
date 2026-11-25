import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  editHash,
  filmEditHash,
  filmScript,
  filmScriptHash,
  parseScript,
  printScript,
  scriptBlocks,
  scriptHash,
} from "./index.js";
import { sha256Hex } from "./sha256.js";

const CANONICAL = `# Barnyard Future

A bubble is at most three lines.

## Campfire

\`\`\`shot id=campfire hold=4.5 still=2.1
Chick hops on the night ledge.
\`\`\`

\`\`\`storyboard
   *
  / \\
 (o o)  hop
\`\`\`

\`\`\`speech id=k3f9 at=0.2..2.2
who: chick
do: hop
world: shooting-star

Goose. Will I
go to Mars?
\`\`\`

Notes between fences stay here.

\`\`\`js
// \`\`\`speech in other code is not a block
const x = 1;
\`\`\`

\`\`\`speech at=2.6
who: goose
pace: beat

Not yet.
\`\`\`

## Mars tag

\`\`\`shot id=flop hold=3
Red dust. Goose is off-screen.
\`\`\`

\`\`\`card id=q7m2 at=0.5..2.5
attribution: Carl Sagan
source: Cosmos ep. 7, 1980

The sky calls
to us.
\`\`\`
`;

describe("parseScript", () => {
  it("returns null for ordinary Markdown", () => {
    expect(parseScript("# Title\n\nJust words.\n\n```js\nlet a;\n```\n")).toBeNull();
    expect(parseScript("```storyboard\n*\n```\n")).toBeNull();
  });

  it("reads shots, speeches, cards, timing attrs, open fields, and storyboards in order", () => {
    const doc = parseScript(CANONICAL)!;
    expect(doc.findings).toEqual([]);
    const blocks = scriptBlocks(doc);
    expect(blocks.map((block) => [block.kind, block.id])).toEqual([
      ["shot", "campfire"],
      ["speech", "k3f9"],
      ["speech", undefined],
      ["shot", "flop"],
      ["card", "q7m2"],
    ]);
    expect(blocks[0]).toMatchObject({
      kind: "shot",
      id: "campfire",
      hold: 4.5,
      still: 2.1,
      text: "Chick hops on the night ledge.",
      storyboard: "   *\n  / \\\n (o o)  hop",
    });
    expect(blocks[1]).toMatchObject({
      kind: "speech",
      id: "k3f9",
      at: { start: 0.2, end: 2.2 },
      who: "chick",
      fields: { do: "hop", world: "shooting-star" },
      lines: ["Goose. Will I", "go to Mars?"],
    });
    expect(blocks[2]).toMatchObject({
      kind: "speech",
      at: { start: 2.6 },
      who: "goose",
      pace: "beat",
      lines: ["Not yet."],
    });
    expect(blocks[3]).toMatchObject({
      kind: "shot",
      id: "flop",
      hold: 3,
      text: "Red dust. Goose is off-screen.",
    });
    expect(blocks[4]).toMatchObject({
      kind: "card",
      id: "q7m2",
      at: { start: 0.5, end: 2.5 },
      attribution: "Carl Sagan",
      lines: ["The sky calls", "to us."],
    });
    expect(doc.items.map((item) => item.kind)).toEqual([
      "markdown",
      "shot",
      "speech",
      "markdown",
      "speech",
      "markdown",
      "shot",
      "card",
    ]);
  });

  it("keeps Markdown and foreign code fences in place", () => {
    const doc = parseScript(CANONICAL)!;
    const notes = doc.items[3];
    expect(notes).toMatchObject({ kind: "markdown" });
    expect(notes.kind === "markdown" && notes.text).toContain("// ```speech in other code is not a block");
  });

  it("treats picture as ordinary Markdown and requires IDs on shots", () => {
    expect(parseScript("```picture id=old\nRed dust.\n```\n")).toBeNull();

    // Old prose `shot` fence after a speech is now a shot block missing `id=`, not an attachment.
    const shotNoId = parseScript("```speech id=a\nwho: chick\n\nHi.\n```\n\n```shot\nChick hops.\n```\n")!;
    expect(scriptBlocks(shotNoId)).toHaveLength(2);
    expect(shotNoId.findings).toEqual([
      expect.objectContaining({ code: "MISSING_ID", line: 7, blockIndex: 1 }),
    ]);
  });

  it("validates fence-line timing attributes and preserves unknown attrs", () => {
    const valid = parseScript(
      [
        "```shot id=a hold=2.4 still=0 take=2",
        "Opening.",
        "```",
        "```shot id=b hold=2.4 still=2.4",
        "Closing.",
        "```",
        "```shot id=c still=1.2",
        "Still without hold.",
        "```",
        "```speech at=0 extra=ok",
        "who: chick",
        "",
        "Hi.",
        "```",
        "```card id=end at=0.25..1.75",
        "Fin.",
        "```",
      ].join("\n"),
    )!;
    expect(valid.findings).toEqual([]);
    const blocks = scriptBlocks(valid);
    expect(blocks[0]).toMatchObject({ kind: "shot", hold: 2.4, still: 0, attrs: { take: "2" } });
    expect(blocks[1]).toMatchObject({ kind: "shot", hold: 2.4, still: 2.4 });
    expect(blocks[2]).toMatchObject({ kind: "shot", still: 1.2 });
    expect(blocks[3]).toMatchObject({ kind: "speech", at: { start: 0 }, attrs: { extra: "ok" } });
    expect(blocks[4]).toMatchObject({ kind: "card", at: { start: 0.25, end: 1.75 } });

    const invalid = parseScript(
      [
        "```shot id=s1 hold=0 still=-1",
        "Bad numbers.",
        "```",
        "```shot id=s2 hold=2 still=2.5",
        "Still past hold.",
        "```",
        "```shot id=s3 hold=3s at=0.5",
        "Units and wrong attr.",
        "```",
        "```speech at=2..1 hold=2 still=1",
        "who: chick",
        "",
        "Bad range and shot attrs.",
        "```",
        "```card id=c1 at=1..1",
        "Zero-length range.",
        "```",
        "```shot id=s4 hold=1 hold=2",
        "Duplicate attr.",
        "```",
      ].join("\n"),
    )!;
    expect(invalid.findings.map((f) => [f.code, f.line])).toEqual([
      ["BAD_ATTR", 1],
      ["BAD_ATTR", 1],
      ["BAD_ATTR", 4],
      ["BAD_ATTR", 7],
      ["BAD_ATTR", 7],
      ["BAD_ATTR", 10],
      ["BAD_ATTR", 10],
      ["BAD_ATTR", 10],
      ["BAD_ATTR", 15],
      ["BAD_ATTR", 18],
    ]);
    const invalidBlocks = scriptBlocks(invalid);
    expect(invalidBlocks[0]!.kind === "shot" && invalidBlocks[0]!.hold).toBeUndefined();
    expect(invalidBlocks[0]!.kind === "shot" && invalidBlocks[0]!.still).toBeUndefined();
    expect(invalidBlocks[1]!.kind === "shot" && invalidBlocks[1]!.hold).toBe(2);
    expect(invalidBlocks[1]!.kind === "shot" && invalidBlocks[1]!.still).toBeUndefined();
    expect(invalidBlocks[5]!.kind === "shot" && invalidBlocks[5]!.hold).toBe(2);
  });

  it("reports problems without throwing", () => {
    const doc = parseScript(
      [
        "```storyboard",
        "orphan",
        "```",
        "```speech id=a",
        "pace: say",
        "",
        "Hi",
        "```",
        "```speech id=a",
        "who: goose",
        "",
        "Not yet.",
        "```",
        "```speech id=bad_id!",
        "who: pig",
        "not a field",
        "",
        "Mud?",
        "```",
        "```card",
        "sign: x",
        "```",
        "```shot id=open",
        "open to the end",
      ].join("\n"),
    )!;
    expect(doc.findings.map((finding) => finding.code)).toEqual([
      "ORPHAN_ATTACHMENT",
      "MISSING_SPEAKER",
      "DUPLICATE_ID",
      "DUPLICATE_ID",
      "BAD_ID",
      "BAD_FIELD",
      "MISSING_SPEAKER",
      "EMPTY_BLOCK",
      "UNCLOSED_FENCE",
    ]);
    const blocks = scriptBlocks(doc);
    expect(blocks[0]).toMatchObject({ rawId: "a" });
    expect(blocks[0]!.id).toBeUndefined();
    expect(blocks[1]!.id).toBeUndefined();
  });

  it("rejects a malformed id and reads a broken header as lines", () => {
    const doc = parseScript("```speech id=k3f9 take=2\nwho: pig\nnot a field\n\nMud?\n```\n")!;
    const [block] = scriptBlocks(doc);
    expect(block).toMatchObject({ id: "k3f9", attrs: { take: "2" }, who: "" });
    expect(block!.kind === "speech" && block.lines).toEqual(["who: pig", "not a field", "", "Mud?"]);
    expect(doc.findings.map((finding) => finding.code)).toEqual(["BAD_FIELD", "MISSING_SPEAKER"]);

    const bad = parseScript("```shot id=" + "x".repeat(81) + "\nDust.\n```\n")!;
    expect(scriptBlocks(bad)[0]!.id).toBeUndefined();
    expect(bad.findings.map((f) => f.code)).toEqual(["BAD_ID"]);
  });

  it("defaults speech ids and pace, and flags collisions with default ids", () => {
    const doc = parseScript(
      [
        "## Cold Open!",
        "",
        "```speech",
        "who: chick",
        "",
        "Before any shot.",
        "```",
        "",
        "```shot id=door hold=3",
        "Pig opens the door.",
        "```",
        "",
        "```speech",
        "who: pig",
        "",
        "First line.",
        "```",
        "",
        "```speech id=custom",
        "who: chick",
        "pace: beat",
        "",
        "Explicit id.",
        "```",
        "",
        "```speech",
        "who: pig",
        "",
        "Third speech under door.",
        "```",
      ].join("\n"),
    )!;
    expect(doc.findings).toEqual([]);
    const film = filmScript(doc);
    expect(film.version).toBe(2);
    expect(film.blocks.map((b) => [b.kind, b.id, b.kind === "speech" ? b.pace : null])).toEqual([
      ["speech", "cold-open-1", "say"],
      ["shot", "door", null],
      ["speech", "door-1", "say"],
      ["speech", "custom", "beat"],
      ["speech", "door-3", "say"],
    ]);

    // Default speech id colliding with explicit id
    const collision = parseScript(
      [
        "```shot id=door",
        "Door.",
        "```",
        "```speech",
        "who: pig",
        "",
        "First.",
        "```",
        "```speech id=door-1",
        "who: chick",
        "",
        "Explicit collision.",
        "```",
      ].join("\n"),
    )!;
    expect(collision.findings.map((f) => [f.code, f.line, f.blockIndex])).toEqual([
      ["DUPLICATE_ID", 4, 1],
      ["DUPLICATE_ID", 9, 2],
    ]);
    expect(filmScript(collision).blocks.map((b) => b.id)).toEqual(["door", null, null]);

    // Default speech id colliding with another default speech id under repeated heading
    const defaultCollision = parseScript(
      [
        "## Intro",
        "```speech",
        "who: pig",
        "",
        "One.",
        "```",
        "## Intro",
        "```speech",
        "who: chick",
        "",
        "Two.",
        "```",
      ].join("\n"),
    )!;
    expect(defaultCollision.findings.map((f) => [f.code, f.line])).toEqual([
      ["DUPLICATE_ID", 2],
      ["DUPLICATE_ID", 8],
    ]);
    expect(filmScript(defaultCollision).blocks.map((b) => b.id)).toEqual([null, null]);
  });
});

describe("printScript", () => {
  it("returns the same bytes for a canonical file", () => {
    expect(printScript(parseScript(CANONICAL)!)).toBe(CANONICAL);
  });

  it("normalizes a foreign file once and then holds still", () => {
    const foreign = [
      "",
      "Intro.   ",
      "",
      "",
      "```speech   at=0.5  take=2 ",
      "who:   chick",
      "do:",
      "",
      "",
      "Hi   ",
      "",
      "```",
      "text between",
      "```storyboard",
      "first",
      "```",
      "```storyboard",
      "second  ",
      "",
      "```",
      "```card",
      "",
      "note: this looks like a field",
      "```",
      "```card",
      "one",
      "",
      "two",
      "```",
      "",
    ].join("\r\n");
    const once = printScript(parseScript(foreign)!);
    const twice = printScript(parseScript(once)!);
    expect(twice).toBe(once);
    const blocks = scriptBlocks(parseScript(once)!);
    expect(blocks[0]).toMatchObject({
      who: "chick",
      at: { start: 0.5 },
      attrs: { take: "2" },
      fields: {},
      lines: ["Hi"],
      storyboard: "second",
    });
    expect(blocks[1]).toMatchObject({ kind: "card", lines: ["note: this looks like a field"] });
    expect(blocks[2]).toMatchObject({ kind: "card", lines: ["one", "", "two"] });
  });

  it("prints an edited block and drops an emptied field", () => {
    const doc = parseScript(CANONICAL)!;
    const goose = scriptBlocks(doc)[2]!;
    if (goose.kind !== "speech") throw new Error("expected speech");
    goose.fields.do = "honk";
    goose.fields.react = "";
    goose.lines = ["Not yet.", "Soon."];
    goose.at = { start: 2.8, end: 4.1 };
    const printed = printScript(doc);
    expect(printed).toContain("```speech at=2.8..4.1\nwho: goose\npace: beat\ndo: honk\n\nNot yet.\nSoon.\n```");
    expect(printScript(parseScript(printed)!)).toBe(printed);
  });
});

describe("scriptHash and editHash", () => {
  it("matches a platform SHA-256", () => {
    for (const text of ["", "abc", "é".repeat(200), "x".repeat(55), "x".repeat(56), "x".repeat(64)]) {
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
    }
  });

  it("keeps timing edits out of scriptHash while editHash tracks them", () => {
    const doc = parseScript(CANONICAL)!;
    const baseWords = scriptHash(doc);
    const baseEdit = editHash(doc);
    expect(baseWords).toBe(filmScriptHash(filmScript(doc)));
    expect(baseEdit).toBe(filmEditHash(filmScript(doc)));

    const hashes = (change: (text: string) => string) => {
      const next = parseScript(change(CANONICAL))!;
      return { words: scriptHash(next), edit: editHash(next) };
    };

    // Storyboards and prose between fences affect neither hash.
    expect(hashes((t) => t.replace("(o o)  hop", "(- -)  nap"))).toEqual({ words: baseWords, edit: baseEdit });
    expect(hashes((t) => t.replace("Notes between fences stay here.", "Other notes."))).toEqual({
      words: baseWords,
      edit: baseEdit,
    });
    expect(hashes((t) => t.replace("do: hop\nworld: shooting-star", "world: shooting-star\ndo: hop"))).toEqual({
      words: baseWords,
      edit: baseEdit,
    });
    // Explicit `pace: say` equals the default `"say"` and changes neither hash.
    expect(hashes((t) => t.replace("who: chick\n", "who: chick\npace: say\n"))).toEqual({
      words: baseWords,
      edit: baseEdit,
    });

    // Timing edits (`hold`, `still`, `at`) leave scriptHash unchanged and change editHash.
    const holdEdit = hashes((t) => t.replace("hold=4.5", "hold=5.0"));
    expect(holdEdit.words).toBe(baseWords);
    expect(holdEdit.edit).not.toBe(baseEdit);

    const stillEdit = hashes((t) => t.replace("still=2.1", "still=2.4"));
    expect(stillEdit.words).toBe(baseWords);
    expect(stillEdit.edit).not.toBe(baseEdit);

    const atEdit = hashes((t) => t.replace("at=0.2..2.2", "at=0.4..2.4"));
    expect(atEdit.words).toBe(baseWords);
    expect(atEdit.edit).not.toBe(baseEdit);

    const cardAtEdit = hashes((t) => t.replace("at=0.5..2.5", "at=0.8"));
    expect(cardAtEdit.words).toBe(baseWords);
    expect(cardAtEdit.edit).not.toBe(baseEdit);

    // Words, speaker, pace, heading, shot text, and id changes update both hashes.
    for (const change of [
      (t: string) => t.replace("Not yet.", "Not now."),
      (t: string) => t.replace("pace: beat", "pace: say"),
      (t: string) => t.replace("## Mars tag", "## Mars"),
      (t: string) => t.replace("id=k3f9", "id=k3f8"),
      (t: string) => t.replace("Chick hops on the night ledge.", "Chick leaps."),
    ]) {
      const next = hashes(change);
      expect(next.words).not.toBe(baseWords);
      expect(next.edit).not.toBe(baseEdit);
    }
  });

  it("gives the film the first level-1 heading as its title", () => {
    const fence = (id: string) => ["```shot id=" + id, "A light.", "```"].join("\n");
    const source = ["## Not the title", "", "# A Light in the Fog", "", fence("a"), "", "# Second", "", fence("b")].join("\n");
    const doc = parseScript(source)!;
    expect(filmScript(doc).title).toBe("A Light in the Fog");
    expect(filmScript(parseScript(["```md", "# in code", "```", fence("a")].join("\n"))!).title).toBeNull();
    expect(filmScript(parseScript([fence("a"), "", "## Only a section"].join("\n"))!).title).toBeNull();
    expect(filmScript(parseScript(["#   Spaced title  ##", fence("a")].join("\n"))!).title).toBe("Spaced title");
    // The heading is already each block's section, so the hashes see it there; the title adds nothing of its own.
    const { title: _title, ...view } = filmScript(doc);
    expect(filmScriptHash({ ...view, title: "x" })).toBe(filmScriptHash({ ...view, title: null }));
  });

  it("gives the film sections, timing, defaults, and no storyboards", () => {
    const film = filmScript(parseScript(CANONICAL)!);
    expect(film.version).toBe(2);
    expect(film.blocks.map((block) => block.section)).toEqual([
      "Campfire",
      "Campfire",
      "Campfire",
      "Mars tag",
      "Mars tag",
    ]);
    expect(film.blocks.map((block) => block.id)).toEqual(["campfire", "k3f9", "campfire-2", "flop", "q7m2"]);
    expect(JSON.stringify(film)).not.toContain("(o o)");
  });
});
