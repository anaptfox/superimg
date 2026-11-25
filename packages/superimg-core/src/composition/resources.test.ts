import { describe, expect, it } from "vitest";
import { resolveCompositionSource } from "./resources.js";

describe("resolveCompositionSource", () => {
  it("requires a caller supplied source base for relative sources", () => {
    expect(() => resolveCompositionSource("./voice.mp3", undefined, "chapter", "voice", "audio")).toThrow(/explicit sourceBase/);
  });

  it("resolves relative sources against the occurrence base, independent of cwd", () => {
    expect(resolveCompositionSource("./img/logo.png", "https://cdn.example.test/work/chapter/", "chapter", "logo", "asset"))
      .toBe("https://cdn.example.test/work/chapter/img/logo.png");
    expect(resolveCompositionSource("../fonts/inter.woff2", "file:///workspace/media/chapter/", "chapter", "Inter", "font"))
      .toBe("file:///workspace/media/fonts/inter.woff2");
  });

  it("rejects malformed or unsupported source bases", () => {
    expect(() => resolveCompositionSource("a.png", "relative/base", "chapter", "a", "asset")).toThrow(/absolute HTTP\(S\) or file URL/);
    expect(() => resolveCompositionSource("a.png", "javascript:alert(1)", "chapter", "a", "asset")).toThrow(/absolute HTTP\(S\) or file URL/);
  });

  it("preserves already portable and absolute sources", () => {
    expect(resolveCompositionSource("https://example.test/a", undefined, "chapter", "a", "asset")).toBe("https://example.test/a");
    expect(resolveCompositionSource("data:audio/wav;base64,AA==", undefined, "chapter", "a", "audio")).toBe("data:audio/wav;base64,AA==");
    expect(resolveCompositionSource("/assets/a.png", undefined, "chapter", "a", "asset")).toBe("/assets/a.png");
  });
});
