import { describe, expect, it } from "vitest";
import { parseScript, scriptBlocks } from "@foxworth/superimg-script";
import { cueTable } from "./script.js";

const SCRIPT = [
  "```shot id=lookout hold=2",
  "The lighthouse goes dark.",
  "```",
  "",
  "```speech id=ask at=0.3..1.5",
  "who: mira",
  "",
  "Did the light go out?",
  "```",
  "",
  "```card id=closing at=0.3..1.9",
  "attribution: A Light | in the Fog",
  "sign: Keeper",
  "source: Harbor log, 1921",
  "",
  "Keep a little light.",
  "```",
  "",
  "```card id=plain at=2..3",
  "Fin.",
  "```",
].join("\n");

describe("script cues --md", () => {
  it("prints a card's attribution, sign and source with its words", () => {
    const blocks = scriptBlocks(parseScript(SCRIPT)!);
    const cues = ["lookout", "ask", "closing", "plain"].map((blockId, i) => ({ blockId, startSeconds: i, endSeconds: i + 1 }));
    expect(cueTable(cues, blocks)).toEqual([
      "| Cue | Start | End | Picture | Speech or card |",
      "| --- | ---: | ---: | --- | --- |",
      "| lookout | 0.00s | 1.00s | The lighthouse goes dark. |  |",
      "| ask | 1.00s | 2.00s |  | mira: Did the light go out? |",
      "| closing | 2.00s | 3.00s |  | Keep a little light.<br>Attribution: A Light &#124; in the Fog<br>Sign: Keeper<br>Source: Harbor log, 1921 |",
      "| plain | 3.00s | 4.00s |  | Fin. |",
    ]);
  });
});
