import { describe, expect, it } from "vitest";
import { analyzeMediaSource, MediaSourceAnalysisError } from "./analyze-media-source.js";

describe("source parser dependency contract", () => {
  it("projects typed collection media at UTF-16 offsets without leaking provider comments", () => {
    const source = `// 🪐 authored scene
import { collection, image, Html } from "@foxworth/superimg";
import { loadCards } from "./cards.server"; // 🔒 PROVIDER_ONLY_MARKER
export default collection({
  entries: loadCards,
  media: image<{ id: string }>({
    render() { return Html({ width: "fill", height: "fill", html: "<h1>🪐</h1>" }); },
  }),
});`;
    const descriptor = analyzeMediaSource(source, "/project/planet.media.ts");
    expect(descriptor.kind).toBe("collection");
    if (descriptor.kind !== "collection") throw new Error("Expected collection projection");

    expect(source.slice(descriptor.entries.range.start, descriptor.entries.range.end)).toBe("loadCards");
    expect(descriptor.mediaRange.start).toBe(source.indexOf("image<{ id: string }>"));
    const mediaSource = source.slice(descriptor.mediaRange.start, descriptor.mediaRange.end);
    expect(descriptor.mediaProjection.code).toContain(mediaSource);
    expect(descriptor.mediaProjection.code.indexOf("<h1>🪐</h1>")).toBe(source.indexOf("<h1>🪐</h1>"));
    for (const marker of ["loadCards", "./cards.server", "PROVIDER_ONLY_MARKER"]) {
      expect(descriptor.mediaProjection.code).not.toContain(marker);
      expect(descriptor.mediaProjection.map.sourcesContent.join("\n")).not.toContain(marker);
    }
  });

  it("reports a duplicate binding after emoji using editor-compatible source offsets", () => {
    const source = '"🪐"; const duplicate = 1; const duplicate = 2; export default {};';
    let failure: unknown;
    try {
      analyzeMediaSource(source, "/project/duplicate.media.ts");
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(MediaSourceAnalysisError);
    if (!(failure instanceof MediaSourceAnalysisError)) throw new Error("Expected source diagnostic");
    expect(failure.code).toBe("MEDIA_SOURCE_PARSE_ERROR");
    expect(failure.range).toBeDefined();
    if (!failure.range) throw new Error("Expected source range");
    expect(source.slice(failure.range.start, failure.range.end)).toBe("duplicate");
  });

  it("removes a source-map comment after emoji without leaving broken syntax", () => {
    const source = '// 🪐 authored scene\nexport default {};\n//# sourceMappingURL=data:application/json;base64,e30=';
    const descriptor = analyzeMediaSource(source, "/project/ordinary.media.ts");
    expect(descriptor.kind).toBe("media");
    expect(descriptor.mediaProjection.code.slice(0, source.indexOf("//#"))).toBe(source.slice(0, source.indexOf("//#")));
    expect(descriptor.mediaProjection.code.slice(source.indexOf("//#"))).toMatch(/^\s*$/);
    expect(descriptor.mediaProjection.code.length).toBe(source.length);
  });
});
