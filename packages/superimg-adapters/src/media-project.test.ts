import { describe, expect, it } from "vitest";
import {
  assertExportBundleReceipt,
  type ExportBundleReceipt,
  type MediaDiscovery,
} from "./media-project.js";

describe("schema-0 media project contracts", () => {
  const digest = "a".repeat(64);
  it("lets a host catalog carry snapshot identities without entry payloads", () => {
    const discovery: MediaDiscovery = {
      schemaVersion: 0,
      kind: "media-discovery",
      sources: [{
        sourceId: "episodes",
        relativePath: "episodes.media.ts",
        kind: "collection",
        media: "video",
        medium: "html",
        animated: true,
        canvas: { width: 1920, height: 1080 },
        variantIds: [],
        editionIds: ["default"],
        entries: [{ id: "introduction", dataDigest: digest }],
      }],
    };

    expect(JSON.stringify(discovery)).not.toContain("entry data");
    expect(discovery.sources[0]?.entries).toEqual([
      { id: "introduction", dataDigest: digest },
    ]);
  });

  it("accepts only the canonical URL-free schema-0 receipt", () => {
    const receipt: ExportBundleReceipt = {
      schemaVersion: 0,
      path: "/project/output/episodes.export",
      manifest: {
        schemaVersion: 0,
        kind: "media-export",
        sourceId: "episodes",
        requestDigest: digest,
        destinationRegistryDigest: digest,
        producer: { name: "superimg", version: "0.1.0" },
        entries: [{ id: "introduction", dataDigest: digest }],
        media: [{
          schemaVersion: 0,
          coordinates: {
            sourceId: "episodes",
            entryId: "introduction",
            variantId: "default",
            editionId: "default",
          },
          path: "ir/introduction/default/default.media.json",
          mimeType: "application/vnd.superimg.media-ir+json",
          bytes: 456,
          sha256: digest,
          hashes: { intentHash: digest, markupHash: digest, programHash: digest },
          extensions: {
            "superimg.test": { schemaVersion: 0, payload: { label: "compiler-owned" } },
          },
        }],
        posters: [],
        renditions: [{
          coordinates: {
            sourceId: "episodes",
            entryId: "introduction",
            variantId: "default",
            editionId: "default",
            renditionId: "youtube",
          },
          path: "media/introduction/youtube.mp4",
          format: "mp4",
          mimeType: "video/mp4",
          width: 1920,
          height: 1080,
          bytes: 123,
          sha256: digest,
          encoder: "mediabunny",
        }],
      },
    };

    expect(() => assertExportBundleReceipt(receipt)).not.toThrow();
    expect(() => assertExportBundleReceipt({
      ...receipt,
      schemaVersion: 1,
    })).toThrow(/schema-0/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: { ...receipt.manifest, publicUrl: "https://cdn.example/export" },
    })).toThrow(/unsupported field/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: { ...receipt.manifest, data: [{ title: "must not leak" }] },
    })).toThrow(/unsupported field/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [{
          ...receipt.manifest.media[0]!,
          extensions: {
            "superimg.test": {
              schemaVersion: 0,
              payload: { preview: "data:image/png;base64,abc" },
            },
          },
        }],
      },
    })).toThrow(/URL-valued strings/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        renditions: [{ ...receipt.manifest.renditions[0]!, path: "../escape.mp4" }],
      },
    })).toThrow(/rendition path/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [{ ...receipt.manifest.media[0]!, path: "https://cdn.example/media.json" }],
      },
    })).toThrow(/Media IR path/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [{ ...receipt.manifest.media[0]!, data: { title: "must not leak" } }],
      },
    })).toThrow(/unsupported field/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [{
          ...receipt.manifest.media[0]!,
          hashes: { ...receipt.manifest.media[0]!.hashes, markupHash: "not-a-hash" },
        }],
      },
    })).toThrow(/markupHash/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [{
          ...receipt.manifest.media[0]!,
          coordinates: { ...receipt.manifest.media[0]!.coordinates, sourceId: "another-source" },
        }],
      },
    })).toThrow(/sourceId/);
    expect(() => assertExportBundleReceipt({
      ...receipt,
      manifest: {
        ...receipt.manifest,
        media: [],
      },
    })).toThrow(/published Media IR coordinate/);
  });
});
