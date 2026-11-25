import { describe, expect, it } from "vitest";
import { Fill, Frame } from "@superimg/stdlib/tree";
import { video, type MediaRuntimeCapabilities } from "@superimg/types";
import { analyzeExportMediaValue, analyzeMediaValue } from "./semantic.js";

const capabilities: MediaRuntimeCapabilities = Object.freeze({
  schemaVersion: 0,
  check: true,
  inspect: true,
  documents: Object.freeze(["html", "svg"] as const),
  rasters: Object.freeze(["png"] as const),
  animated: Object.freeze(["mp4"] as const),
  collections: Object.freeze({ static: true, providers: false }),
  assets: Object.freeze({ url: true, bytes: true }),
  fonts: Object.freeze({ logical: true, frozenBytes: true }),
});

describe("runtime cueFindings enforcement", () => {
  const mediaWithMissingGlyph = video({
    size: { width: 1080, height: 1920 },
    fps: 30,
    duration: "2s",
    resolve: () => ({
      cues: [{ id: "line-1", start: 0.2, end: 1.5 }],
      cueFindings: [
        { id: "line-1", code: "MISSING_GLYPH", message: "Missing glyph for emoji." },
        { id: "line-1", code: "PROP_NOTE", message: "Advisory note.", severity: "warning" },
      ],
    }),
    render: () => Frame({ width: "fill", height: "fill" }, Fill({ color: "#111827" })),
  });

  it("promotes resolve().cueFindings into analyzeMediaValue findings", async () => {
    const analysis = await analyzeMediaValue(mediaWithMissingGlyph, {}, capabilities, { sample: false });
    expect(analysis.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "error",
        category: "authoring",
        code: "MISSING_GLYPH",
        details: { blockId: "line-1", nodeId: "line-1" },
      }),
      expect.objectContaining({
        severity: "warning",
        category: "authoring",
        code: "PROP_NOTE",
        details: { blockId: "line-1", nodeId: "line-1" },
      }),
    ]));
  });

  it("promotes resolve().cueFindings into analyzeExportMediaValue so export enforces MISSING_GLYPH", async () => {
    const analysis = await analyzeExportMediaValue(
      mediaWithMissingGlyph,
      { for: ["1080x1920.mp4"] },
      capabilities,
      null,
    );
    expect(analysis.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: "error",
        code: "MISSING_GLYPH",
        details: { blockId: "line-1", nodeId: "line-1" },
      }),
    ]));
  });
});
