import { describe, expect, it } from "vitest";
import type {
  CompiledMediaRendition,
  MediaCoordinates,
  RenditionPlan,
} from "../coordinates.js";

const coordinates = {
  sourceId: "episodes",
  entryId: "introduction",
  variantId: "dark",
  editionId: "square",
} satisfies MediaCoordinates;

const plan = {
  schemaVersion: 0,
  sourceId: "episodes",
  entryIds: ["introduction"],
  variantIds: ["dark"],
  editionIds: ["square"],
  renditions: [{ id: "youtube", format: "mp4", width: 1920, height: 1080 }],
} satisfies RenditionPlan;

const rendition: CompiledMediaRendition = {
  coordinates: { ...coordinates, renditionId: "youtube" },
  relativePath: "media/introduction/youtube.mp4",
  mimeType: "video/mp4",
  width: 1920,
  height: 1080,
  byteLength: 42,
  sha256: "a".repeat(64),
  format: "mp4",
  encoder: "ffmpeg@7",
};

describe("schema-0 media coordinates", () => {
  it("keeps entry, variant, edition, and rendition identity separate", () => {
    expect(plan.schemaVersion).toBe(0);
    expect(rendition.coordinates).toEqual({ ...coordinates, renditionId: "youtube" });
  });
});
