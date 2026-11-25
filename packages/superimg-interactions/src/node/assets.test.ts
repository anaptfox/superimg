import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  MEDIA_ELEMENT,
  type AudioValue,
  type DeterministicMediaDefinition,
  type FontInput,
  type MediaElement,
} from "@superimg/types";
import { createRuntime, inspect } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node";
import { listNodeMediaLocalAssets, materializeNodeMediaAssets } from "./assets.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Node media asset materialization", () => {
  it("freezes source-relative font bytes without using the invoking cwd", async () => {
    const root = await temporaryDirectory("superimg-font-owner-");
    const source = join(root, "media", "card.media.ts");
    await mkdir(join(root, "media"));
    await mkdir(join(root, "fonts"));
    await writeFile(source, "export default {}\n");
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await writeFile(join(root, "fonts", "owned.ttf"), bytes);
    const portable = { family: "Portable", src: bytes };
    const google = { kind: "google" as const, spec: "Inter:wght@400" };
    const media = await materializeNodeMediaAssets(testMedia({ fonts: [
      { family: "Owned", src: "../fonts/owned.ttf" }, portable, google,
    ] }), source, root);
    expect(media.config?.fonts).toEqual([
      { family: "Owned", src: bytes }, portable, google,
    ]);
    expect(media.config?.fonts?.[1]).toBe(portable);
    expect(media.config?.fonts?.[2]).toBe(google);
  });

  it("rejects a font file outside the owning project", async () => {
    const root = await temporaryDirectory("superimg-font-owner-");
    const outside = await temporaryDirectory("superimg-font-outside-");
    const source = join(root, "card.media.ts");
    const font = join(outside, "outside.ttf");
    await writeFile(source, "export default {}\n");
    await writeFile(font, new Uint8Array([1, 2, 3]));
    await expect(materializeNodeMediaAssets(testMedia({ fonts: [
      { family: "Outside", src: font },
    ] }), source, root)).rejects.toThrow("must stay inside the project root");
  });

  it("freezes co-located assets to bytes and retains their content hash", async () => {
    const projectRoot = await temporaryDirectory("superimg-assets-project-");
    const sourcePath = join(projectRoot, "card.media.ts");
    const bytes = new TextEncoder().encode("<svg>logo</svg>");
    await writeFile(sourcePath, "export default {}\n");
    await mkdir(join(projectRoot, "assets"));
    await writeFile(join(projectRoot, "assets/logo.svg"), bytes);
    const media = await materializeNodeMediaAssets(
      testMedia(),
      sourcePath,
      projectRoot,
    );
    const runtime = createRuntime(createNodeRuntimeAdapter());
    try {
      const report = await inspect(runtime, media);
      expect(report.assets).toMatchObject([{
        name: "logo.svg",
        mimeType: "image/svg+xml",
        byteLength: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }]);
      expect(JSON.stringify(report.assets)).not.toContain(projectRoot);
    } finally {
      await runtime.dispose();
    }
  });

  it("rejects a declared relative asset that escapes the project root", async () => {
    const projectRoot = await temporaryDirectory("superimg-assets-project-");
    const outsideRoot = await temporaryDirectory("superimg-assets-outside-");
    const sourcePath = join(projectRoot, "card.media.ts");
    const outsidePath = join(outsideRoot, "secret.svg");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(outsidePath, "<svg>secret</svg>");
    const media = testMedia({
      assets: { secret: { url: relative(projectRoot, outsidePath) } },
    });

    await expect(
      materializeNodeMediaAssets(media, sourcePath, projectRoot),
    ).rejects.toThrow("must stay inside the project root");
  });

  it("rejects a symlinked co-located assets directory", async () => {
    const projectRoot = await temporaryDirectory("superimg-assets-project-");
    const outsideRoot = await temporaryDirectory("superimg-assets-outside-");
    const sourcePath = join(projectRoot, "card.media.ts");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(join(outsideRoot, "logo.svg"), "<svg>logo</svg>");
    await symlink(outsideRoot, join(projectRoot, "assets"));

    await expect(
      materializeNodeMediaAssets(testMedia(), sourcePath, projectRoot),
    ).rejects.toThrow("regular directory");
  });

  it("materializes relative audio clips in every supported audio value shape", async () => {
    const projectRoot = await temporaryDirectory("superimg-audio-project-");
    const sourcePath = join(projectRoot, "weird name", "café.media.ts");
    const sourceDirectory = resolve(sourcePath, "..");
    const audioPath = join(sourceDirectory, "narration.wav");
    const bytes = new Uint8Array([0, 1, 2, 3]);
    await mkdir(sourceDirectory, { recursive: true });
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(audioPath, bytes);

    const audioValues: AudioValue[] = [
      { id: "single", src: "narration.wav" },
      [{ id: "array", src: "narration.wav" }],
      { clips: [{ id: "timeline", src: "narration.wav" }], mix: { master: 0.5 } },
    ];
    for (const audio of audioValues) {
      const media = await materializeNodeMediaAssets(testMedia({ audio }), sourcePath, projectRoot);
      const clips = "clips" in media.config!.audio!
        ? media.config!.audio!.clips
        : Array.isArray(media.config!.audio) ? media.config!.audio : [media.config!.audio];
      expect(clips[0]!.src).toBe(`data:audio/wav;base64,${Buffer.from(bytes).toString("base64")}`);
    }
  });

  it("reuses one read for duplicate audio references and normalizes file metadata", async () => {
    const projectRoot = await temporaryDirectory("superimg-audio-project-");
    const sourcePath = join(projectRoot, "card.media.ts");
    const audioPath = join(projectRoot, "voice.wav");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(audioPath, "wav");
    const media = await materializeNodeMediaAssets(testMedia({
      audio: {
        clips: [
          { id: "one", src: "voice.wav", source: { kind: "file", src: "./voice.wav" } },
          { id: "two", src: pathToFileURL(audioPath).toString() },
        ],
      },
    }), sourcePath, projectRoot);
    const clips = media.config!.audio!;
    if (!Array.isArray(clips) && "clips" in clips) {
      expect(clips.clips[0]!.src).toBe(clips.clips[1]!.src);
      expect(clips.clips[0]!.source).toEqual({ kind: "file", src: clips.clips[0]!.src });
    } else {
      throw new Error("Expected audio timeline");
    }
  });

  it("preserves data and remote audio references without fetching them", async () => {
    const projectRoot = await temporaryDirectory("superimg-audio-project-");
    const sourcePath = join(projectRoot, "card.media.ts");
    await writeFile(sourcePath, "export default {}\n");
    const data = "data:audio/wav;base64,AAE=";
    const remote = "https://example.test/voice.wav";
    const media = await materializeNodeMediaAssets(testMedia({
      audio: [{ id: "data", src: data }, { id: "remote", src: remote }],
    }), sourcePath, projectRoot);
    expect(media.config!.audio).toEqual([{ id: "data", src: data }, { id: "remote", src: remote }]);
  });

  it("rejects contradictory file source metadata", async () => {
    const projectRoot = await temporaryDirectory("superimg-audio-project-");
    const sourcePath = join(projectRoot, "card.media.ts");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(join(projectRoot, "voice.wav"), "wav");
    await expect(materializeNodeMediaAssets(testMedia({
      audio: {
        id: "voice",
        src: "voice.wav",
        source: { kind: "file", src: "other.wav" },
      },
    }), sourcePath, projectRoot)).rejects.toThrow("contradictory src and source.src");
  });

  it("rejects an audio file that escapes the project root", async () => {
    const projectRoot = await temporaryDirectory("superimg-audio-project-");
    const outsideRoot = await temporaryDirectory("superimg-audio-outside-");
    const sourcePath = join(projectRoot, "card.media.ts");
    const outsidePath = join(outsideRoot, "voice.wav");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(outsidePath, "wav");
    await expect(materializeNodeMediaAssets(testMedia({
      audio: { id: "voice", src: relative(projectRoot, outsidePath) },
    }), sourcePath, projectRoot)).rejects.toThrow("must stay inside the project root");
  });
});

describe("listNodeMediaLocalAssets", () => {
  it("lists local audio, asset, font, and co-located files relative to the media file while skipping remote, inline, missing, and external refs", async () => {
    const projectRoot = await temporaryDirectory("superimg-list-assets-project-");
    const outsideRoot = await temporaryDirectory("superimg-list-assets-outside-");
    const mediaDir = join(projectRoot, "films");
    await mkdir(join(mediaDir, "assets"), { recursive: true });
    await mkdir(join(mediaDir, "fonts"), { recursive: true });
    await mkdir(join(projectRoot, "shared"), { recursive: true });

    const sourcePath = join(mediaDir, "ep1.media.ts");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(join(mediaDir, "score.wav"), "wav-score");
    await writeFile(join(projectRoot, "shared", "voice.mp3"), "mp3-voice");
    await writeFile(join(mediaDir, "poster.png"), "png-poster");
    await writeFile(join(mediaDir, "assets", "badge.svg"), "<svg/>");
    await writeFile(join(mediaDir, "fonts", "display.woff2"), "woff2-bytes");
    const outsideWav = join(outsideRoot, "escape.wav");
    await writeFile(outsideWav, "outside");
    await symlink(join(mediaDir, "score.wav"), join(mediaDir, "link.wav"));

    const files = await listNodeMediaLocalAssets(testMedia({
      assets: {
        poster: { url: "./poster.png" },
        remote: { url: "https://example.test/remote.png" },
        missing: { url: "./does-not-exist.png" },
      },
      audio: {
        clips: [
          { id: "score", src: "./score.wav" },
          { id: "voice", src: "../shared/voice.mp3" },
          { id: "remote", src: "https://example.test/music.mp3" },
          { id: "data", src: "data:audio/wav;base64,AAE=" },
          { id: "outside", src: relative(mediaDir, outsideWav) },
          { id: "symlink", src: "./link.wav" },
        ],
      },
      fonts: [
        { family: "Display", src: "./fonts/display.woff2" },
        { kind: "google", spec: "Inter" },
        { family: "Memory", src: new Uint8Array([1, 2, 3]) },
      ],
    }), sourcePath, projectRoot);

    expect(files).toEqual([
      "../shared/voice.mp3",
      "assets/badge.svg",
      "fonts/display.woff2",
      "poster.png",
      "score.wav",
    ]);
  });

  it("lists a single audio clip such as film({ score })", async () => {
    const projectRoot = await temporaryDirectory("superimg-list-score-");
    const sourcePath = join(projectRoot, "film.media.ts");
    await writeFile(sourcePath, "export default {}\n");
    await writeFile(join(projectRoot, "score.wav"), "wav");

    const files = await listNodeMediaLocalAssets(testMedia({
      audio: { id: "score", src: "./score.wav", role: "sfx", duration: "4s" },
    }), sourcePath, projectRoot);

    expect(files).toEqual(["score.wav"]);
  });
});

async function temporaryDirectory(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function testMedia(
  input: { assets?: Record<string, { url: string }>; audio?: AudioValue; fonts?: readonly FontInput[] } = {},
): DeterministicMediaDefinition<Record<string, never>> {
  return {
    kind: "media",
    media: "image",
    fallbackFormat: "png",
    medium: "html",
    animated: false,
    config: {
      assets: input.assets ?? {},
      ...(input.audio === undefined ? {} : { audio: input.audio }),
      ...(input.fonts === undefined ? {} : { fonts: input.fonts }),
    },
    render: () => ({
      $$typeof: MEDIA_ELEMENT,
      type: "Html",
      props: { html: "" },
      children: [],
    } as MediaElement),
  };
}
