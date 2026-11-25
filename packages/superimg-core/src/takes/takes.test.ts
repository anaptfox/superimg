import { describe, expect, it } from "vitest";
import { diffTakes, formatTakeDiff, takeFromExportBundle } from "./index.js";

describe("@superimg/core/takes", () => {
  it("diffs two takes across files, duration, and script cues", () => {
    const fromScript = [
      "```shot id=open hold=2",
      "Wide view.",
      "```",
      "",
      "```speech id=line1",
      "who: fox",
      "",
      "Hello world.",
      "```",
    ].join("\n");

    const toScript = [
      "```shot id=open hold=3.5",
      "Wide view.",
      "```",
      "",
      "```speech id=line1",
      "who: fox",
      "",
      "Hello fireside!",
      "```",
      "",
      "```shot id=close hold=1.5",
      "Fade out.",
      "```",
    ].join("\n");

    const diff = diffTakes(
      {
        id: "take-1",
        duration: 4.0,
        programHash: "aaa",
        files: [
          { path: "story.script.md", sha256: "111" },
          { path: "film.media.ts", sha256: "222" },
        ],
      },
      {
        id: "take-2",
        duration: 7.0,
        programHash: "bbb",
        files: [
          { path: "story.script.md", sha256: "333" },
          { path: "film.media.ts", sha256: "222" },
          { path: "score.wav", sha256: "444" },
        ],
      },
      { fromScript, toScript },
    );

    expect(diff.durationDeltaSeconds).toBe(3);
    expect(diff.programChanged).toBe(true);
    expect(diff.scriptChanged).toBe(true);
    expect(diff.files).toEqual([
      { path: "score.wav", change: "added", afterSha256: "444" },
      { path: "story.script.md", change: "changed", beforeSha256: "111", afterSha256: "333" },
    ]);
    expect(diff.cues).toEqual([
      expect.objectContaining({ id: "open", kind: "shot", change: "changed", deltaSeconds: 1.5 }),
      expect.objectContaining({ id: "line1", kind: "speech", change: "changed", textChanged: true }),
      expect.objectContaining({ id: "close", kind: "shot", change: "added" }),
    ]);

    const formatted = formatTakeDiff(diff);
    expect(formatted).toContain("diff take-1 -> take-2");
    expect(formatted).toContain("+3s");
    expect(formatted).toContain("~ open [shot] (+1.5s)");
    expect(formatted).toContain("+ close [shot]");
  });

  it("constructs a portable TakeRecordV2 from an ExportBundle without filesystem access", () => {
    const coordinates = { variantId: "default", editionId: "default", renditionId: "youtube" };
    const take = takeFromExportBundle(
      {
        manifest: {
          kind: "@foxworth/superimg/export-bundle",
          schemaVersion: 0,
          programDigest: "deadbeef",
          coordinates: [{ variantId: "default", editionId: "default" }],
          assets: [],
          fonts: [],
          artifacts: [{
            path: "youtube.mp4",
            mimeType: "video/mp4",
            sha256: "abc123",
            byteLength: 1024,
            coordinates,
          }],
        },
      },
      {
        id: "take-cloud-1",
        tenantId: "tenant-a",
        storyId: "story-42",
        mediaFile: "story.media.ts",
        duration: 12.5,
        fps: 30,
        canvas: { width: 1920, height: 1080 },
        now: new Date("2026-11-23T00:00:00.000Z"),
      },
    );

    expect(take).toMatchObject({
      schemaVersion: 2,
      id: "take-cloud-1",
      tenantId: "tenant-a",
      storyId: "story-42",
      programHash: "deadbeef",
      canvas: { width: 1920, height: 1080 },
      duration: 12.5,
      fps: 30,
      renditions: [{ sha256: "abc123", path: "youtube.mp4", mimeType: "video/mp4", label: "youtube", coordinates }],
    });
  });
});
