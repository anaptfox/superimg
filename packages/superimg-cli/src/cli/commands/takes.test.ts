import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordFeedback, recordTake } from "../takes/store.js";
import { takesDiffCommand, takesFeedbackCommand, takesFromCommand, takesListCommand, takesRestoreCommand, takesShowCommand } from "./takes.js";

const roots: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "superimg-takes-cmd-"));
  roots.push(dir);
  return dir;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function captureStdout(): { text: () => string } {
  let out = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out += String(chunk);
    return true;
  });
  return { text: () => out };
}

describe("takes commands", () => {
  it("prints good and bad in takes --json", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "program");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("program") }],
      duration: 54,
    });
    recordFeedback({ mediaDir: dir, id: take.id, good: ["landing"], bad: ["late title"] });
    const stdout = captureStdout();
    await takesListCommand(media, { json: true });
    const parsed = JSON.parse(stdout.text()) as { ok: boolean; takes: { good: string[]; bad: string[]; id: string }[] };
    expect(parsed.ok).toBe(true);
    expect(parsed.takes[0]?.id).toBe(take.id);
    expect(parsed.takes[0]?.good).toEqual(["landing"]);
    expect(parsed.takes[0]?.bad).toEqual(["late title"]);
  });

  it("appends feedback that a later same-content record keeps", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "program");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("program") }],
    });
    const stdout = captureStdout();
    await takesFeedbackCommand(take.id.slice(0, 8), { media: dir, good: ["crowd"], bad: ["type small"], json: true });
    const parsed = JSON.parse(stdout.text()) as { take: { good: string[]; bad: string[] } };
    expect(parsed.take.good).toEqual(["crowd"]);
    expect(parsed.take.bad).toEqual(["type small"]);
    const again = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("program") }],
    });
    expect(again.good).toEqual(["crowd"]);
    expect(again.bad).toEqual(["type small"]);
  });

  it("restores after saving the current file and show does not write", async () => {
    const dir = tempDir();
    const media = join(dir, "film.media.ts");
    writeFileSync(media, "version one");
    const take = recordTake({
      mediaDir: dir,
      mediaFile: media,
      sources: [{ path: media, bytes: text("version one") }],
    });
    recordFeedback({ mediaDir: dir, id: take.id, good: ["kept"] });
    writeFileSync(media, "version two");
    writeFileSync(join(dir, "extra.ts"), "keep");
    await takesRestoreCommand(take.id, { media: dir, listFiles: async () => [media] });
    expect(readFileSync(media, "utf8")).toBe("version one");
    expect(readFileSync(join(dir, "extra.ts"), "utf8")).toBe("keep");
    writeFileSync(media, "version two");
    const chunks: string[] = [];
    await takesShowCommand(take.id, "film.media.ts", {
      media: dir,
      write: (chunk) => { chunks.push(Buffer.from(chunk).toString()); },
    });
    expect(chunks.join("")).toBe("version one");
    expect(readFileSync(media, "utf8")).toBe("version two");
  });

  it("finds feedback from a rendition file by sha256", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "package.json"), "{}");
    const videos = join(dir, "videos");
    const media = join(videos, "film.media.ts");
    const movie = join(dir, "out.mp4");
    writeFileSync(movie, "rendered-bytes");
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update("rendered-bytes").digest("hex");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(videos);
    const take = recordTake({
      mediaDir: videos,
      mediaFile: media,
      sources: [{ path: media, bytes: text("program") }],
      renditions: [{ sha256, path: movie, mimeType: "video/mp4" }],
    });
    recordFeedback({ mediaDir: videos, id: take.id, good: ["read this"], bad: ["not this"] });
    const stdout = captureStdout();
    await takesFromCommand(movie, { json: true });
    const parsed = JSON.parse(stdout.text()) as { takes: { id: string; good: string[]; bad: string[] }[] };
    expect(parsed.takes.map((item) => item.id)).toEqual([take.id]);
    expect(parsed.takes[0]?.good).toEqual(["read this"]);
    expect(parsed.takes[0]?.bad).toEqual(["not this"]);
  });

  it("refuses scratch media", async () => {
    const dir = tempDir();
    const media = join(dir, "scratch", "probe.media.ts");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(dir, "scratch"));
    writeFileSync(media, "probe");
    await expect(takesListCommand(media)).rejects.toThrow(/scratch/);
  });

  it("captures film({ score }) via describe and restores modified or deleted score files", async () => {
    // Inside the package so `@foxworth/superimg/film` resolves when the media compiles.
    const dir = mkdtempSync(join(process.cwd(), ".takes-score-"));
    roots.push(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "score-take-test", version: "1.0.0" }));
    const media = join(dir, "film.media.ts");
    const score = join(dir, "score.wav");
    const v1Score = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x11, 0x22, 0x33, 0x44]);
    const v2Score = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x99, 0x88, 0x77, 0x66]);
    writeFileSync(score, v1Score);
    writeFileSync(join(dir, "story.script.md"), [
      "# Score Take",
      "",
      "```shot id=open hold=2.0",
      "Mira opens the scene.",
      "```",
      "",
    ].join("\n"));
    writeFileSync(media, [
      `import { film, cast, r } from "@foxworth/superimg/film";`,
      `import script from "./story.script.md";`,
      `const mira = cast("mira", { draw: () => [r(0, 0, 12, 12, "#e2e8f0")] });`,
      `export default film({`,
      `  stage: { width: 320, height: 180 },`,
      `  size: { width: 320, height: 180 },`,
      `  fps: 30,`,
      `  background: "#101820",`,
      `  cast: [mira],`,
      `  bubble: () => "",`,
      `  script,`,
      `  score: "./score.wav",`,
      `  shots: [{`,
      `    open: ({ t }: { t: number }) => [mira(t, { x: 160, y: 90 })],`,
      `  }],`,
      `});`,
    ].join("\n"));

    const { listMediaTakeFiles, rememberExportTake } = await import("../takes/capture.js");
    const { readTakeFile } = await import("../takes/store.js");

    {
      const listed = (await listMediaTakeFiles(media)).map((file) => resolve(dir, file));
      expect(listed).toContain(score);
      expect(listed).toContain(join(dir, "story.script.md"));

      const take = await rememberExportTake({
        templatePath: media,
        description: { duration: 2 },
        manifest: { renditions: [] },
        publicationPath: dir,
        readPoster: async () => undefined,
      });
      expect(take?.record.files.map((file) => file.path)).toEqual([
        "film.media.ts",
        "score.wav",
        "story.script.md",
      ]);

      // Mutate score.wav on disk and restore the recorded take without passing a custom listFiles.
      writeFileSync(score, v2Score);
      const restoreOut = captureStdout();
      await takesRestoreCommand(take!.id, { media: dir, json: true });
      const restored = JSON.parse(restoreOut.text()) as {
        saved: { id: string } | null;
        wrote: string[];
      };
      expect(restored.wrote).toContain("score.wav");
      expect(new Uint8Array(readFileSync(score))).toEqual(v1Score);
      expect(restored.saved).not.toBeNull();
      expect(readTakeFile(dir, restored.saved!.id, "score.wav").bytes).toEqual(v2Score);

      // Restoring again while matching reports already restored (saved: null).
      const secondOut = captureStdout();
      await takesRestoreCommand(take!.id, { media: dir, json: true });
      const second = JSON.parse(secondOut.text()) as { saved: { id: string } | null; wrote: string[] };
      expect(second.saved).toBeNull();
      expect(second.wrote).toEqual([]);

      // Deleting score.wav and restoring brings it back.
      rmSync(score);
      await takesRestoreCommand(take!.id, { media: dir, json: true });
      expect(new Uint8Array(readFileSync(score))).toEqual(v1Score);
    }
  });

  it("diffs two takes across script cues and changed files via takesDiffCommand", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "package.json"), "{}");
    const media = join(dir, "film.media.ts");
    const script = join(dir, "story.script.md");
    const scriptV1 = "```shot id=open hold=2\nStart.\n```\n";
    const scriptV2 = "```shot id=open hold=3.5\nStart.\n```\n\n```shot id=end hold=1\nFinish.\n```\n";
    const t1 = recordTake({
      mediaDir: dir,
      mediaFile: media,
      duration: 2,
      sources: [
        { path: media, bytes: text("v1") },
        { path: script, bytes: text(scriptV1) },
      ],
    });
    const t2 = recordTake({
      mediaDir: dir,
      mediaFile: media,
      duration: 4.5,
      sources: [
        { path: media, bytes: text("v1") },
        { path: script, bytes: text(scriptV2) },
      ],
    });

    const out = captureStdout();
    await takesDiffCommand(t1.id, t2.id, { media: dir, json: true });
    const parsed = JSON.parse(out.text()) as {
      diff: { durationDeltaSeconds: number; cues: Array<{ id: string; change: string; deltaSeconds?: number }> };
    };
    expect(parsed.diff.durationDeltaSeconds).toBe(2.5);
    expect(parsed.diff.cues).toEqual([
      expect.objectContaining({ id: "open", change: "changed", deltaSeconds: 1.5 }),
      expect.objectContaining({ id: "end", change: "added" }),
    ]);
  });
});
