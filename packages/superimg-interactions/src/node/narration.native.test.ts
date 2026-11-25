import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { video } from "@superimg/types";
import { preparedNarrationAudio } from "@superimg/core";
import { Html } from "@superimg/core/template-runtime";
import {
  createRuntime,
  readByteStream,
  startExport,
} from "@superimg/core/runtime";
import { createNodeRuntimeAdapter, inspectEncodedMedia } from "@superimg/node";
import { createNodeNarrationService } from "./narration.js";
import { materializeNodeMediaAssets } from "./assets.js";

it.skipIf(process.env.SUPERIMG_RUN_NARRATION_SMOKE !== "1")(
  "exports native frozen narration through normal relative audio assets",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "superimg-native-narration-"));
    const runtime = createRuntime(createNodeRuntimeAdapter());
    try {
      const service = createNodeNarrationService({
        cacheDirectory: join(root, "cache"),
      });
      await service.prepare({
        schemaVersion: 1,
        provider: "macos-say",
        voice: "Samantha",
        mode: "natural",
        fps: 10,
        segments: [{
          id: "hook",
          text: "One measured scene.",
          afterSeconds: 0.2,
        }],
      }, join(root, "prepared"));
      const manifest = JSON.parse(
        await readFile(join(root, "prepared", "narration.json"), "utf8"),
      );
      const source = join(root, "smoke.media.ts");
      await writeFile(
        source,
        "// Native acceptance fixture; local draft only\n",
      );
      const media = video({
        duration: `${manifest.plan.durationSeconds}s`,
        fps: 10,
        size: { width: 320, height: 180 },
        audio: preparedNarrationAudio(manifest.plan, "prepared"),
        render: () =>
          Html({
            html:
              '<div style="width:320px;height:180px;background:#123;color:white">Local draft narration</div>',
          }),
      });
      const materialized = await materializeNodeMediaAssets(
        media,
        source,
        root,
      );
      // Proof of portability: no synthesis cache is needed by export.
      await rm(join(root, "cache"), { recursive: true, force: true });
      const bundle = await startExport(runtime, materialized, {
        for: ["320x180.mp4"],
      }).result;
      try {
        const artifact = bundle.artifacts.find((entry) =>
          entry.mimeType === "video/mp4"
        );
        expect(artifact).toBeDefined();
        const bytes = await readByteStream(artifact!.stream());
        const inspected = await inspectEncodedMedia(bytes);
        expect(inspected.tracks.some((track) => track.kind === "audio")).toBe(
          true,
        );
        expect(inspected.tracks.some((track) => track.kind === "video")).toBe(
          true,
        );
        expect(inspected.durationSeconds).toBeCloseTo(
          manifest.plan.durationSeconds,
          0,
        );
        console.info(
          JSON.stringify({
            nativeNarration: {
              audio: manifest.assets[0].metadata,
              encoded: {
                sha256: inspected.sha256,
                durationSeconds: inspected.durationSeconds,
                tracks: inspected.tracks,
              },
            },
          }),
        );
      } finally {
        await bundle.dispose();
      }
    } finally {
      await runtime.dispose();
      await rm(root, { recursive: true, force: true });
    }
  },
  120000,
);
