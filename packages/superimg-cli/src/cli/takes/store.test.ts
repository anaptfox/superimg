import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_TAKE_FILE_BYTES,
  MAX_TAKE_MEDIA_BYTES,
  findTake,
  hashFileSync,
  listTakes,
  packagesFromFiles,
  readTakeFile,
  recordFeedback,
  recordTake,
  restoreTake,
  sourcesFromFiles,
  takeContentId,
  takesForRendition,
  takesRoot,
} from "./store.js";

const roots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "superimg-takes-"));
  roots.push(dir);
  return dir;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("take store", () => {
  it("hashes the file set independent of order", () => {
    const id = takeContentId([
      { path: "b.ts", sha256: "aa" },
      { path: "a.ts", sha256: "bb" },
    ]);
    expect(takeContentId([
      { path: "a.ts", sha256: "bb" },
      { path: "b.ts", sha256: "aa" },
    ])).toBe(id);
    expect(takeContentId([
      { path: "a.ts", sha256: "aa" },
      { path: "b.ts", sha256: "bb" },
    ])).not.toBe(id);
  });

  it("stores source bytes beside the media file and shares blobs", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "version one");
    const first = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("version one") }],
      programHash: "abc",
      canvas: { width: 1920, height: 1080 },
      fps: 30,
      duration: 54,
      renditions: [{ sha256: "1".repeat(64), path: join(dir, "out.mp4"), label: "youtube" }],
      poster: text("poster"),
      now: new Date("2026-11-16T12:00:00.000Z"),
    });
    expect(first.good).toEqual([]);
    expect(first.bad).toEqual([]);
    expect(first.duration).toBe(54);
    expect(readFileSync(join(takesRoot(dir), "objects", first.files[0]!.sha256), "utf8")).toBe("version one");
    expect(readFileSync(join(takesRoot(dir), first.id, "poster.jpg"), "utf8")).toBe("poster");
    const listed = listTakes(dir);
    expect(listed.map((take) => take.id)).toEqual([first.id]);
    expect(listed[0]?.good).toEqual([]);
    expect(listed[0]?.bad).toEqual([]);
  });

  it("keeps good, bad, and note when the same sources are recorded again", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const bytes = text("same");
    const first = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes }],
      renditions: [{ sha256: "a".repeat(64), path: "/tmp/a.mp4" }],
      now: new Date("2026-11-16T12:00:00.000Z"),
    });
    recordFeedback({
      mediaDir: dir,
      id: first.id.slice(0, 8),
      good: ["  the landing holds  ", "the landing holds", ""],
      bad: ["title enters late"],
      note: "fox morphs",
      now: new Date("2026-11-16T12:05:00.000Z"),
    });
    recordFeedback({
      mediaDir: dir,
      id: first.id,
      good: ["the landing holds", "crowd stays"],
      bad: ["   "],
    });
    const again = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes }],
      renditions: [{ sha256: "b".repeat(64), path: "/tmp/b.mp4" }, { sha256: "a".repeat(64), path: "/tmp/a.mp4" }],
      now: new Date("2026-11-16T13:00:00.000Z"),
    });
    expect(again.id).toBe(first.id);
    expect(again.createdAt).toBe("2026-11-16T12:00:00.000Z");
    expect(again.updatedAt).toBe("2026-11-16T13:00:00.000Z");
    expect(again.good).toEqual(["the landing holds", "crowd stays"]);
    expect(again.bad).toEqual(["title enters late"]);
    expect(again.note).toBe("fox morphs");
    expect(again.renditions.map((rendition) => rendition.sha256)).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(listTakes(dir)).toHaveLength(1);
  });

  it("replaces a feedback list only when asked, and an empty good does not wipe", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("v") }],
    });
    recordFeedback({ mediaDir: dir, id: take.id, good: ["landing"], bad: ["late"] });
    const kept = recordFeedback({ mediaDir: dir, id: take.id, good: ["  "] });
    expect(kept.good).toEqual(["landing"]);
    expect(kept.bad).toEqual(["late"]);
    const replaced = recordFeedback({ mediaDir: dir, id: take.id, good: [""], replace: true });
    expect(replaced.good).toEqual([]);
    expect(replaced.bad).toEqual(["late"]);
    const cleared = recordFeedback({ mediaDir: dir, id: take.id, note: "   " });
    expect(cleared.note).toBeUndefined();
    expect(JSON.parse(readFileSync(join(takesRoot(dir), take.id, "take.json"), "utf8")).note).toBeUndefined();
  });

  it("saves the current sources before writing the old ones back, and leaves extra files", () => {
    const root = tempDir();
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "series", version: "1.0.0" }));
    const dir = join(root, "videos");
    mkdirSync(dir);
    const media = join(dir, "film.media.ts");
    const shared = join(root, "shared.ts");
    writeFileSync(media, "version one");
    const sibling = join(dir, "sibling.ts");
    writeFileSync(sibling, "sib one");
    const first = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [
        { path: media, bytes: text("version one") },
        { path: sibling, bytes: text("sib one") },
        { path: shared, bytes: text("outside") },
      ],
    });
    recordFeedback({ mediaDir: dir, id: first.id, good: ["pier line"], bad: ["crowd thin"] });
    writeFileSync(shared, "outside now");
    writeFileSync(media, "version two");
    writeFileSync(sibling, "sib two");
    writeFileSync(join(dir, "extra.ts"), "keep");
    const outcome = restoreTake({
      mediaDir: dir,
      id: first.id.slice(0, 12),
      mediaFile: media,
      current: sourcesFromFiles(dir, [media, sibling, shared]),
    });
    expect(readFileSync(media, "utf8")).toBe("version one");
    expect(readFileSync(sibling, "utf8")).toBe("sib one");
    expect(readFileSync(shared, "utf8")).toBe("outside");
    expect(readFileSync(join(dir, "extra.ts"), "utf8")).toBe("keep");
    expect(outcome.saved?.id).not.toBe(first.id);
    expect(outcome.saved?.files).toHaveLength(3);
    expect(outcome.wrote).toEqual(["../shared.ts", "film.media.ts", "sibling.ts"]);
    expect(findTake(dir, first.id).good).toEqual(["pier line"]);
    expect(findTake(dir, first.id).bad).toEqual(["crowd thin"]);
  });

  it("does not write when the current sources are already that take", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "same");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("same") }],
      now: new Date("2026-11-16T12:00:00.000Z"),
    });
    const outcome = restoreTake({
      mediaDir: dir,
      id: take.id,
      mediaFile: media,
      current: [{ path: media, bytes: text("same") }],
      now: new Date("2026-11-16T15:00:00.000Z"),
    });
    expect(outcome.saved).toBeNull();
    expect(outcome.wrote).toEqual([]);
    expect(findTake(dir, take.id).updatedAt).toBe("2026-11-16T12:00:00.000Z");
    expect(readFileSync(media, "utf8")).toBe("same");
  });

  it("saves the current take and leaves the working file when stored bytes are missing", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "version one");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("version one") }],
    });
    unlinkSync(join(takesRoot(dir), "objects", take.files[0]!.sha256));
    writeFileSync(media, "version two");
    expect(() => restoreTake({
      mediaDir: dir,
      id: take.id,
      mediaFile: media,
      current: [{ path: media, bytes: text("version two") }],
    })).toThrow(/missing stored bytes/);
    expect(readFileSync(media, "utf8")).toBe("version two");
    expect(listTakes(dir).some((item) => item.files[0]?.sha256 === hashFileSync(media))).toBe(true);
  });

  it("does not restore when the current snapshot is rejected", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "version one");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("version one") }],
    });
    writeFileSync(media, "version two");
    expect(() => restoreTake({
      mediaDir: dir,
      id: take.id,
      mediaFile: media,
      current: [{ path: "bad\0name", bytes: text("nope") }],
    })).toThrow(/NUL/);
    expect(readFileSync(media, "utf8")).toBe("version two");
    expect(listTakes(dir)).toHaveLength(1);
  });

  it("prints a stored file without writing the working tree", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "working");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("stored") }],
    });
    const before = statSync(media).mtimeMs;
    const shown = readTakeFile(dir, take.id, "film.media.ts");
    expect(new TextDecoder().decode(shown.bytes)).toBe("stored");
    expect(readFileSync(media, "utf8")).toBe("working");
    expect(statSync(media).mtimeMs).toBe(before);
  });

  it("records a large file in the id and omits its bytes", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const huge = join(dir, "clip.mp4");
    writeFileSync(media, "program");
    writeFileSync(huge, Buffer.alloc(1));
    truncateSync(huge, MAX_TAKE_MEDIA_BYTES + 1);
    const sources = sourcesFromFiles(dir, [media, huge]);
    const take = recordTake({ mediaDir: dir, mediaFile: media, sources });
    expect(take.files.map((file) => file.path).sort()).toEqual(["clip.mp4", "film.media.ts"]);
    expect(take.omitted).toEqual([{ path: "clip.mp4", reason: `larger than ${MAX_TAKE_MEDIA_BYTES} bytes` }]);
    expect(statSync(join(takesRoot(dir), "objects")).isDirectory()).toBe(true);
    const outcome = restoreTake({
      mediaDir: dir,
      id: take.id,
      mediaFile: media,
      current: [{ path: media, bytes: text("changed") }, sources[1]!],
    });
    expect(outcome.omitted).toEqual(["clip.mp4"]);
    expect(readFileSync(media, "utf8")).toBe("program");
    expect(statSync(huge).size).toBe(MAX_TAKE_MEDIA_BYTES + 1);
  });

  it("keeps code to the small limit and media to the large one", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    const code = join(dir, "generated.ts");
    writeFileSync(media, "program");
    writeFileSync(code, Buffer.alloc(MAX_TAKE_FILE_BYTES + 1, 32));
    const take = recordTake({ mediaDir: dir, mediaFile: media, sources: sourcesFromFiles(dir, [media, code]) });
    expect(take.omitted).toEqual([{ path: "generated.ts", reason: `larger than ${MAX_TAKE_FILE_BYTES} bytes` }]);
  });

  it("rejects a path inside the take store", () => {
    const dir = tempDir();
    expect(() => recordTake({
      mediaDir: dir,
      mediaFile: join(dir, "film.media.ts"),
      sources: [{ path: join(dir, ".superimg", "takes", "evil.txt"), bytes: text("no") }],
    })).toThrow(/\.superimg/);
    expect(listTakes(dir)).toEqual([]);
  });

  it("finds a take from a rendition hash and rejects an ambiguous prefix", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "package.json"), "{}");
    const videos = join(dir, "videos");
    mkdirSync(videos);
    const media = join(videos, "film.media.ts");
    const sha = "c".repeat(64);
    recordTake({
      mediaDir: videos,
      mediaFile: media,
      sources: [{ path: media, bytes: text("film") }],
      renditions: [{ sha256: sha, path: join(dir, "out.mp4"), mimeType: "video/mp4", label: "youtube" }],
    });
    writeFileSync(join(dir, "out.mp4"), "not-the-hash");
    expect(takesForRendition(dir, sha).map((hit) => hit.record.mediaFile)).toEqual(["film.media.ts"]);
    const installed = join(dir, "node_modules", "pkg");
    mkdirSync(join(installed, ".superimg", "takes", "f".repeat(64)), { recursive: true });
    writeFileSync(join(installed, ".superimg", "takes", "f".repeat(64), "take.json"), JSON.stringify({
      schemaVersion: 1,
      id: "f".repeat(64),
      createdAt: "2026-11-16T00:00:00.000Z",
      updatedAt: "2026-11-16T00:00:00.000Z",
      mediaFile: "ignored.media.ts",
      good: [],
      bad: [],
      files: [],
      renditions: [{ sha256: sha }],
    }));
    expect(takesForRendition(dir, sha).map((hit) => hit.record.mediaFile)).toEqual(["film.media.ts"]);

    const left = "abcd" + "0".repeat(60);
    const right = "abce" + "0".repeat(60);
    for (const id of [left, right]) {
      const takeDir = join(takesRoot(videos), id);
      mkdirSync(takeDir, { recursive: true });
      writeFileSync(join(takeDir, "take.json"), JSON.stringify({
        schemaVersion: 1,
        id,
        createdAt: "2026-11-16T00:00:00.000Z",
        updatedAt: "2026-11-16T00:00:00.000Z",
        mediaFile: "other.media.ts",
        good: ["kept"],
        bad: ["late title"],
        files: [],
        renditions: [],
      }));
    }
    expect(findTake(videos, "abcd").good).toEqual(["kept"]);
    expect(() => findTake(videos, "abc")).toThrow(/more than one take/);
  });

  it("records another package as a version and never restores outside the project", () => {
    const workspace = tempDir();
    // A film project that imports a linked library living beside it.
    const project = join(workspace, "series");
    const library = join(workspace, "library");
    const films = join(project, "films", "pig-map");
    mkdirSync(films, { recursive: true });
    mkdirSync(join(library, "dist"), { recursive: true });
    writeFileSync(join(project, "package.json"), JSON.stringify({ name: "series", version: "1.0.0" }));
    writeFileSync(join(library, "package.json"), JSON.stringify({ name: "@demo/library", version: "2.3.4" }));
    const media = join(films, "pig-map.media.ts");
    const cast = join(project, "cast.ts");
    const chunk = join(library, "dist", "chunk.js");
    writeFileSync(media, "film one");
    writeFileSync(cast, "cast one");
    writeFileSync(chunk, "library build one");

    const listed = [media, cast, chunk];
    expect(sourcesFromFiles(films, listed).map((source) => source.path)).toEqual([media, cast]);
    expect(packagesFromFiles(films, listed)).toEqual({ "@demo/library": "2.3.4" });

    const first = recordTake({
      mediaDir: films,
      mediaFile: media,
      sources: sourcesFromFiles(films, listed),
      packages: packagesFromFiles(films, listed),
      label: "cut 1",
    });
    expect(first.schemaVersion).toBe(1);
    expect(first.files.map((file) => file.path)).toEqual(["../../cast.ts", "pig-map.media.ts"]);
    expect(first.packages).toEqual({ "@demo/library": "2.3.4" });
    expect(findTake(films, "Cut 1").id).toBe(first.id);
    expect(() => recordTake({ mediaDir: films, mediaFile: media, sources: [{ path: chunk, bytes: text("x") }] }))
      .toThrow(/outside the project/);

    // A stored record may be tampered with. Restoring it must not touch library files.
    const old = JSON.parse(readFileSync(join(takesRoot(films), first.id, "take.json"), "utf8"));
    old.files.push({ path: "../../../library/dist/chunk.js", sha256: first.files[0]!.sha256 });
    writeFileSync(join(takesRoot(films), first.id, "take.json"), JSON.stringify(old));
    writeFileSync(media, "film two");
    writeFileSync(chunk, "library build two");
    const outcome = restoreTake({ mediaDir: films, id: first.id, mediaFile: media, current: sourcesFromFiles(films, listed) });
    expect(readFileSync(media, "utf8")).toBe("film one");
    expect(readFileSync(chunk, "utf8")).toBe("library build two");
    expect(outcome.wrote).toEqual(["../../cast.ts", "pig-map.media.ts"]);
    expect(outcome.skipped.map((item) => item.path)).toEqual(["../../../library/dist/chunk.js"]);
  });

  it("refuses unsupported take schemas and a blob that no longer matches", () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "one");
    const take = recordTake({ mediaDir: dir, mediaFile: media, sources: sourcesFromFiles(dir, [media]) });
    writeFileSync(media, "two");
    writeFileSync(join(takesRoot(dir), "objects", take.files[0]!.sha256), "tampered");
    expect(() => restoreTake({ mediaDir: dir, id: take.id, mediaFile: media, current: sourcesFromFiles(dir, [media]) }))
      .toThrow(/no longer match/);
    expect(readFileSync(media, "utf8")).toBe("two");

    const file = join(takesRoot(dir), take.id, "take.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    for (const schemaVersion of [0, 99]) {
      writeFileSync(file, JSON.stringify({ ...record, schemaVersion }));
      expect(() => listTakes(dir)).toThrow(new RegExp(`Unsupported take schema ${schemaVersion}; expected 1`));
    }
  });
});
