import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MediaExportPlan } from "@superimg/core/export";
import { createMediaIR } from "@superimg/types";
import { confinedPath, publishExportBundle } from "./atomic-export-bundle.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture(): Promise<{ root: string; finalPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "superimg-export-"));
  temporaryDirectories.push(root);
  return { root, finalPath: join(root, "episodes.export") };
}

function plan(): MediaExportPlan<{ id: string; secret: string }> {
  const data = { id: "intro", secret: "server-only" };
  return {
    schemaVersion: 0,
    sourceId: "episodes",
    requestDigest: "a".repeat(64),
    coordinates: [{ sourceId: "episodes", entryId: "intro", variantId: "default", editionId: "default" }],
    renditions: [{
      coordinates: {
        sourceId: "episodes",
        entryId: "intro",
        variantId: "default",
        editionId: "default",
        renditionId: "youtube",
      },
      data,
      entryDataDigest: "b".repeat(64),
      dataDigest: "b".repeat(64),
      canvas: { width: 1920, height: 1080 },
      format: "mp4",
      relativePath: "intro/youtube.mp4",
      target: { kind: "catalog", id: "youtube" },
    }],
  };
}

function media() {
  return createMediaIR({
    sourceId: "episodes",
    entryId: "intro",
    variantId: "default",
    editionId: "default",
    width: 1920,
    height: 1080,
    override: {
      extensions: {
        "superimg.test": { schemaVersion: 0, payload: { label: "compiler-owned" } },
      },
    },
  });
}

describe("atomic export bundle publication", () => {
  it("writes the URL-free manifest last and atomically replaces the previous bundle", async () => {
    const { finalPath } = await fixture();
    await mkdir(finalPath, { recursive: true });
    await writeFile(join(finalPath, "last-known-good.txt"), "old");

    const receipt = await publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [media()],
      render: async (stagingRoot) => {
        await mkdir(join(stagingRoot, "media", "intro"), { recursive: true });
        expect(await readdir(stagingRoot)).not.toContain("export.json");
        await writeFile(join(stagingRoot, "media", "intro", "youtube.mp4"), "video");
      },
    });

    expect(receipt.path).toBe(finalPath);
    await expect(readFile(join(finalPath, "last-known-good.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    const manifestText = await readFile(join(finalPath, "export.json"), "utf8");
    expect(manifestText).not.toContain("server-only");
    const manifest = JSON.parse(manifestText);
    expect(manifest).toMatchObject({
      schemaVersion: 0,
      kind: "media-export",
      entries: [{ id: "intro", dataDigest: "b".repeat(64) }],
      media: [{
        schemaVersion: 0,
        path: "ir/intro/default/default.media.json",
        mimeType: "application/vnd.superimg.media-ir+json",
        hashes: media().hashes,
        extensions: media().extensions,
      }],
      renditions: [{ path: "media/intro/youtube.mp4", bytes: 5, mimeType: "video/mp4" }],
    });
    expect(manifest.media[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.media[0].bytes).toBeGreaterThan(0);

    const mediaText = await readFile(join(finalPath, manifest.media[0].path), "utf8");
    expect(manifest.media[0].sha256).toBe(createHash("sha256").update(mediaText).digest("hex"));
    expect(mediaText).not.toContain("server-only");
    expect(JSON.parse(mediaText)).toMatchObject({
      kind: "@foxworth/superimg/media-ir",
      schemaVersion: 0,
      identity: manifest.media[0].coordinates,
      scenes: expect.any(Array),
      hashes: manifest.media[0].hashes,
      extensions: manifest.media[0].extensions,
    });
    expect(manifest.media[0].path).not.toMatch(/^[A-Za-z][A-Za-z\d+.-]*:/);
  });

  it("discards failed staging and preserves the last-known-good bundle", async () => {
    const { root, finalPath } = await fixture();
    await mkdir(finalPath, { recursive: true });
    await writeFile(join(finalPath, "marker.txt"), "good");

    await expect(publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [media()],
      render: async (stagingRoot) => {
        await writeFile(join(stagingRoot, "partial.tmp"), "partial");
        throw new Error("encoder failed");
      },
    })).rejects.toThrow("encoder failed");

    expect(await readFile(join(finalPath, "marker.txt"), "utf8")).toBe("good");
    expect((await readdir(root)).filter((name) => name.includes(".staging-") || name.includes(".backup-"))).toEqual([]);
  });

  it("fails publication when a planned rendition is missing", async () => {
    const { finalPath } = await fixture();
    await expect(publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [media()],
      render: async () => {},
    })).rejects.toThrow(/youtube\.mp4/);
  });

  it("fails closed when MediaIR does not cover the planned coordinates exactly", async () => {
    const { finalPath } = await fixture();
    await expect(publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [createMediaIR({ sourceId: "episodes", entryId: "other" })],
      render: async (stagingRoot) => {
        await mkdir(join(stagingRoot, "media", "intro"), { recursive: true });
        await writeFile(join(stagingRoot, "media", "intro", "youtube.mp4"), "video");
      },
    })).rejects.toThrow(/Unexpected MediaIR coordinate/);
  });

  it("rejects a renderer-created symlink in the MediaIR artifact path", async () => {
    const { root, finalPath } = await fixture();
    const outside = join(root, "outside");
    await mkdir(outside);
    await expect(publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [media()],
      render: async (stagingRoot) => {
        await mkdir(join(stagingRoot, "media", "intro"), { recursive: true });
        await writeFile(join(stagingRoot, "media", "intro", "youtube.mp4"), "video");
        await symlink(outside, join(stagingRoot, "ir"));
      },
    })).rejects.toThrow(/symlink/);
    await expect(readFile(join(outside, "intro", "default", "default.media.json"), "utf8"))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects absolute and escaping rendition paths", async () => {
    const { root } = await fixture();
    expect(() => confinedPath(root, "../outside.mp4")).toThrow(/escapes/);
    expect(() => confinedPath(root, "/outside.mp4")).toThrow(/Invalid/);
  });

  it("rejects a renderer-created symlink as a rendition file", async () => {
    const { root, finalPath } = await fixture();
    const outside = join(root, "outside.mp4");
    await writeFile(outside, "leaked");
    await expect(publishExportBundle({
      finalPath,
      plan: plan(),
      destinationRegistryDigest: "c".repeat(64),
      producerVersion: "0.1.0",
      media: [media()],
      render: async (stagingRoot) => {
        await mkdir(join(stagingRoot, "media", "intro"), { recursive: true });
        await symlink(outside, join(stagingRoot, "media", "intro", "youtube.mp4"));
      },
    })).rejects.toThrow(/symlink/);
  });
});
