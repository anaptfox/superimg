import { describe, expect, it } from "vitest";
import { validateSelection } from "./media.js";

describe("conversion plan selections", () => {
  const inspection = { schemaVersion: 0 as const, kind: "@foxworth/superimg/media-inspection" as const, mimeType: "video/mp4", byteLength: 1, sha256: "x", durationSeconds: 2, tracks: [{ id: "v", kind: "video" as const, durationSeconds: 2 }, { id: "a", kind: "audio" as const, durationSeconds: 2 }] };
  it("accepts independently named multi-input track selections", () => {
    const sources = new Map([["one", inspection], ["two", inspection]]);
    expect(() => validateSelection({ sourceId: "one", trackId: "v", trim: { endSeconds: 1 } }, "video", sources)).not.toThrow();
    expect(() => validateSelection({ sourceId: "two", trackId: "a", trim: { startSeconds: 0.5, endSeconds: 1.5 } }, "audio", sources)).not.toThrow();
  });
  it("rejects unknown tracks and invalid trims", () => {
    const sources = new Map([["one", inspection]]);
    expect(() => validateSelection({ sourceId: "one", trackId: "missing" }, "video", sources)).toThrow(/Unknown/);
    expect(() => validateSelection({ sourceId: "one", trackId: "v", trim: { endSeconds: 3 } }, "video", sources)).toThrow(/trim/);
  });
});
