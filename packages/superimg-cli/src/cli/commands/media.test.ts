import { describe, expect, it } from "vitest";
import { isYoutubeInput } from "./media.js";

describe("media CLI helpers", () => {
  it("recognizes YouTube as an external embed source, not an import source", () => {
    expect(isYoutubeInput("https://www.youtube.com/watch?v=abcdefghijk")).toBe(true);
    expect(isYoutubeInput("https://youtu.be/abcdefghijk")).toBe(true);
    expect(isYoutubeInput("/tmp/clip.mp4")).toBe(false);
  });
});
