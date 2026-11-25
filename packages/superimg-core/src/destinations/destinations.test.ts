import { describe, expect, it } from "vitest";
import {
  DestinationCatalogError,
  DestinationTargetError,
  ORGANIC_DESTINATIONS,
  ORGANIC_DESTINATION_IDS,
  ORGANIC_DESTINATION_PLATFORMS,
  createDestinationRegistry,
  getDestination,
  parseCustomDestinationTarget,
  resolveDestinationTarget,
  validateDestinationCatalog,
} from "./index.js";

describe("organic destination catalog", () => {
  it("contains exactly one organic target for every initial platform", () => {
    expect(ORGANIC_DESTINATION_IDS).toEqual([
      "youtube",
      "instagram-square",
      "tiktok",
      "linkedin",
      "facebook",
      "x",
      "pinterest",
      "threads",
      "reddit",
    ]);
    expect(new Set(ORGANIC_DESTINATION_PLATFORMS)).toEqual(new Set([
      "youtube",
      "instagram",
      "tiktok",
      "linkedin",
      "facebook",
      "x",
      "pinterest",
      "threads",
      "reddit",
    ]));
    expect(Object.values(ORGANIC_DESTINATIONS).every((entry) => entry.surface === "organic")).toBe(true);
    expect(JSON.stringify(ORGANIC_DESTINATIONS)).not.toMatch(/\bads?\b/i);
  });

  it("validates the shipped schema-0 catalog and provenance", () => {
    expect(() => validateDestinationCatalog(Object.values(ORGANIC_DESTINATIONS))).not.toThrow();
    for (const entry of Object.values(ORGANIC_DESTINATIONS)) {
      expect(entry.schemaVersion).toBe(0);
      expect(entry.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.provenance.length).toBeGreaterThan(0);
      expect(entry.provenance.every((item) => item.url.startsWith("https://"))).toBe(true);
      expect(entry.recommendedCanvas.value.width).toBeGreaterThan(0);
      expect(entry.recommendedCanvas.value.height).toBeGreaterThan(0);
    }
  });

  it("keeps platform requirements distinct from SuperImg recommendations", () => {
    const instagram = ORGANIC_DESTINATIONS["instagram-square"];
    expect(instagram.supportedMedia[0]).toMatchObject({ authority: "platform", status: "requirement" });
    expect(instagram.recommendedCanvas).toEqual({
      value: { width: 1080, height: 1080 },
      authority: "superimg",
      status: "recommendation",
    });
    expect(ORGANIC_DESTINATIONS.youtube.recommendedCanvas).toMatchObject({
      authority: "platform",
      status: "recommendation",
      provenanceId: "youtube-upload",
    });
  });

  it("is immutable and supports stable lookup", () => {
    expect(getDestination("youtube")).toBe(ORGANIC_DESTINATIONS.youtube);
    expect(getDestination("unknown-target")).toBeUndefined();
    expect(getDestination("toString")).toBeUndefined();
    expect(Object.isFrozen(ORGANIC_DESTINATIONS)).toBe(true);
    expect(Object.isFrozen(ORGANIC_DESTINATIONS.youtube.encoding.video)).toBe(true);
  });

  it("builds validated immutable registries without treating a platform as a target ID", () => {
    const youtube = ORGANIC_DESTINATIONS.youtube;
    const registry = createDestinationRegistry([
      youtube,
      { ...youtube, id: "youtube-portrait", label: "YouTube portrait" },
    ]);
    expect(Object.keys(registry)).toEqual(["youtube", "youtube-portrait"]);
    expect(Object.isFrozen(registry["youtube-portrait"])).toBe(true);
  });

  it("rejects missing provenance and non-organic entries", () => {
    const base = ORGANIC_DESTINATIONS.youtube;
    expect(() => validateDestinationCatalog([{ ...base, provenance: [] }])).toThrow(DestinationCatalogError);
    expect(() => validateDestinationCatalog([{ ...base, surface: "ads" as "organic" }])).toThrow(/only organic/);
    expect(() => validateDestinationCatalog([{
      ...base,
      recommendedCanvas: { ...base.recommendedCanvas, provenanceId: "missing" },
    }])).toThrow(/missing provenance/);
  });
});

describe("custom destination targets", () => {
  it("parses custom dimensions with an optional format", () => {
    expect(parseCustomDestinationTarget("1200x630.png")).toEqual({
      kind: "custom",
      id: "1200x630.png",
      width: 1200,
      height: 630,
      format: "png",
    });
    expect(parseCustomDestinationTarget(" 1080X1920.MP4 ")).toEqual({
      kind: "custom",
      id: "1080x1920.mp4",
      width: 1080,
      height: 1920,
      format: "mp4",
    });
    expect(parseCustomDestinationTarget("1920x1080.mov")).toMatchObject({ format: "mov" });
    expect(parseCustomDestinationTarget("1920x1080.mkv")).toMatchObject({ format: "mkv" });
    expect(parseCustomDestinationTarget("youtube")).toBeNull();
  });

  it("resolves catalog and custom targets through one API", () => {
    expect(resolveDestinationTarget("youtube")).toMatchObject({ kind: "catalog", id: "youtube" });
    expect(resolveDestinationTarget("750x1050")).toEqual({
      kind: "custom",
      id: "750x1050",
      width: 750,
      height: 1050,
    });
  });

  it("fails closed for invalid or unknown targets", () => {
    expect(() => resolveDestinationTarget("1200x630.bmp")).toThrow(DestinationTargetError);
    expect(() => resolveDestinationTarget("0x630.png")).toThrow(/positive safe integers/);
    expect(() => resolveDestinationTarget("unknown-target")).toThrow(/Unknown destination/);
    expect(() => resolveDestinationTarget(" ")).toThrow(/cannot be empty/);
  });
});
