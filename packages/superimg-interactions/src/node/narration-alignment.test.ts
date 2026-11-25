import { expect, it } from "vitest";
import { transcriptFromCharacterAlignment } from "./narration-alignment.js";

it("groups provider characters without inventing word times", () => {
  expect(
    transcriptFromCharacterAlignment({
      characters: ["H", "i", " ", "猫"],
      character_start_times_seconds: [0, 0.1, 0.2, 0.3],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4],
    }, 1),
  )
    .toEqual([{ text: "Hi", start: 0, end: 0.2 }, {
      text: "猫",
      start: 0.3,
      end: 0.4,
    }]);
});
it("rejects malformed and out-of-audio alignment", () => {
  expect(() =>
    transcriptFromCharacterAlignment({
      characters: ["a"],
      character_start_times_seconds: [],
      character_end_times_seconds: [],
    }, 1)
  ).toThrow();
  expect(() =>
    transcriptFromCharacterAlignment({
      characters: ["a"],
      character_start_times_seconds: [0],
      character_end_times_seconds: [2],
    }, 1)
  ).toThrow();
});
