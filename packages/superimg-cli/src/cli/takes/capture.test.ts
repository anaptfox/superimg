import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { rememberExportTake, renditionsFromManifest } from "./capture.js";
import { recordFeedback, takesRoot } from "./store.js";

const roots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "superimg-capture-"));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("export take capture", () => {
  it("records the injected file list, receipt, and poster, not the rendition bytes", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const helper = join(dir, "helper.ts");
    const inside = join(dir, ".superimg", "exports", "secret.ts");
    const installed = join(dir, "node_modules", "pkg", "index.js");
    mkdirSync(join(dir, ".superimg", "exports"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "pkg"), { recursive: true });
    writeFileSync(media, "program");
    writeFileSync(helper, "helper");
    writeFileSync(inside, "skip");
    writeFileSync(installed, "skip");
    writeFileSync(join(dir, "film.mp4"), "movie-bytes");
    const poster = new TextEncoder().encode("jpeg");
    const renditionSha = "d".repeat(64);
    const remembered = await rememberExportTake({
      templatePath: media,
      description: { programHash: "program-hash", canvas: { width: 1920, height: 1080 }, fps: 30, duration: 54 },
      manifest: {
        runtime: { programDigest: "other-digest" },
        renditions: [{
          sha256: renditionSha,
          path: "media/youtube.mp4",
          mimeType: "video/mp4",
          coordinates: { renditionId: "youtube" },
        }],
      },
      publicationPath: join(dir, "publication"),
      copyTo: join(dir, "film.mp4"),
      listFiles: async () => [media, helper, inside, installed],
      readPoster: async () => poster,
      now: new Date("2026-11-16T12:00:00.000Z"),
    });
    expect(remembered?.record.programHash).toBe("program-hash");
    expect(remembered?.record.files.map((file) => file.path).sort()).toEqual(["film.media.ts", "helper.ts"]);
    expect(remembered?.record.renditions.map((rendition) => rendition.sha256)).toEqual([renditionSha, renditionSha]);
    expect(remembered?.record.renditions[0]?.label).toBe("youtube");
    expect(remembered?.record.poster).toBe("poster.jpg");
    const objects = readdirSync(join(takesRoot(dir), "objects"));
    expect(objects).not.toContain(renditionSha);
    expect(readFileSync(join(remembered!.directory, "poster.jpg"), "utf8")).toBe("jpeg");
  });

  it("keeps feedback across a second capture of the same files", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "program");
    const input = {
      templatePath: media,
      description: { duration: 12 },
      manifest: { renditions: [] },
      publicationPath: dir,
      listFiles: async () => [media],
      readPoster: async () => undefined,
    };
    const first = await rememberExportTake({ ...input, now: new Date("2026-11-16T12:00:00.000Z") });
    recordFeedback({ mediaDir: dir, id: first!.id, good: ["the landing"], bad: ["title late"], note: "v1" });
    const second = await rememberExportTake({
      ...input,
      manifest: { renditions: [{ sha256: "e".repeat(64), path: "media/youtube.mp4", mimeType: "video/mp4" }] },
      now: new Date("2026-11-16T13:00:00.000Z"),
    });
    expect(second?.id).toBe(first?.id);
    expect(second?.record.good).toEqual(["the landing"]);
    expect(second?.record.bad).toEqual(["title late"]);
    expect(second?.record.note).toBe("v1");
    expect(second?.record.createdAt).toBe(first?.record.createdAt);
    expect(second?.record.renditions).toHaveLength(1);
  });

  it("does not record a take for scratch media", async () => {
    const dir = tempDir();
    const media = join(dir, "scratch", "probe.media.ts");
    mkdirSync(join(dir, "scratch"));
    writeFileSync(media, "probe");
    const remembered = await rememberExportTake({
      templatePath: media,
      description: {},
      manifest: {},
      publicationPath: dir,
      listFiles: async () => [media],
      readPoster: async () => { throw new Error("poster should not run"); },
    });
    expect(remembered).toBeUndefined();
    expect(existsSync(join(dir, "scratch", ".superimg"))).toBe(false);
  });

  it("reads rendition paths from a publication manifest", () => {
    const renditions = renditionsFromManifest({
      renditions: [
        { sha256: "a".repeat(64), path: "media/tiktok.mp4", mimeType: "video/mp4", coordinates: { renditionId: "tiktok" } },
        { sha256: "nope" },
      ],
    }, "/pub");
    expect(renditions).toEqual([{
      sha256: "a".repeat(64),
      path: "/pub/media/tiktok.mp4",
      mimeType: "video/mp4",
      label: "tiktok",
    }]);
  });

  it("records declared local audio, asset, and font files inside the project and skips external ones", async () => {
    const project = tempDir();
    const outside = tempDir();
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "demo", version: "1.0.0" }));
    const mediaDir = join(project, "films");
    mkdirSync(join(mediaDir, "assets"), { recursive: true });
    mkdirSync(join(mediaDir, "fonts"), { recursive: true });
    mkdirSync(join(project, "shared"), { recursive: true });

    const media = join(mediaDir, "film.media.ts");
    const score = join(mediaDir, "score.wav");
    const bg = join(mediaDir, "assets", "bg.png");
    const font = join(mediaDir, "fonts", "display.woff2");
    const sharedTheme = join(project, "shared", "theme.wav");
    const external = join(outside, "escape.wav");
    writeFileSync(media, "program");
    writeFileSync(score, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01]));
    writeFileSync(bg, new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(font, new Uint8Array([0x77, 0x4f, 0x46, 0x32]));
    writeFileSync(sharedTheme, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x02]));
    writeFileSync(external, "outside");

    const remembered = await rememberExportTake({
      templatePath: media,
      description: { duration: 8 },
      manifest: { renditions: [] },
      publicationPath: project,
      // What listMediaTakeFiles returns for a film with a score, assets, and fonts.
      listFiles: async () => [
        media,
        "score.wav",
        "assets/bg.png",
        "fonts/display.woff2",
        "../shared/theme.wav",
        external,
      ],
      readPoster: async () => undefined,
    });

    const recordedPaths = remembered!.record.files.map((file) => file.path);
    expect(recordedPaths).toEqual([
      "../shared/theme.wav",
      "assets/bg.png",
      "film.media.ts",
      "fonts/display.woff2",
      "score.wav",
    ]);
    expect(remembered!.record.omitted).toBeUndefined();
    const objects = readdirSync(join(takesRoot(mediaDir), "objects"));
    for (const file of remembered!.record.files) {
      expect(objects).toContain(file.sha256);
    }
  });

  it("stores a score larger than the code limit so restore brings it back", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const score = join(dir, "score.wav");
    writeFileSync(media, "program");
    const { MAX_TAKE_FILE_BYTES, hashFileSync, restoreTake, sourcesFromFiles } = await import("./store.js");
    writeFileSync(score, Buffer.alloc(MAX_TAKE_FILE_BYTES + 1, 7));
    const expectedSha = hashFileSync(score);

    const remembered = await rememberExportTake({
      templatePath: media,
      description: { duration: 10 },
      manifest: { renditions: [] },
      publicationPath: dir,
      listFiles: async () => [media, "score.wav"],
      readPoster: async () => undefined,
    });

    expect(remembered!.record.files.find((file) => file.path === "score.wav")?.sha256).toBe(expectedSha);
    expect(remembered!.record.omitted).toBeUndefined();
    expect(readdirSync(join(takesRoot(dir), "objects"))).toContain(expectedSha);

    writeFileSync(score, Buffer.alloc(16, 1));
    writeFileSync(media, "program two");
    restoreTake({ mediaDir: dir, id: remembered!.id, mediaFile: media, current: sourcesFromFiles(dir, [media, score]) });
    expect(hashFileSync(score)).toBe(expectedSha);
  });

  it("records only the hash of media over the media limit", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const bigScore = join(dir, "big-score.wav");
    writeFileSync(media, "program");
    const { MAX_TAKE_MEDIA_BYTES, hashFileSync } = await import("./store.js");
    writeFileSync(bigScore, Buffer.alloc(1));
    truncateSync(bigScore, MAX_TAKE_MEDIA_BYTES + 1);
    const expectedSha = hashFileSync(bigScore);

    const remembered = await rememberExportTake({
      templatePath: media,
      description: { duration: 10 },
      manifest: { renditions: [] },
      publicationPath: dir,
      listFiles: async () => [media, "big-score.wav"],
      readPoster: async () => undefined,
    });

    expect(remembered!.record.files.find((file) => file.path === "big-score.wav")?.sha256).toBe(expectedSha);
    expect(remembered!.record.omitted).toEqual([
      { path: "big-score.wav", reason: `larger than ${MAX_TAKE_MEDIA_BYTES} bytes` },
    ]);
    expect(readdirSync(join(takesRoot(dir), "objects"))).not.toContain(expectedSha);
  });
});
