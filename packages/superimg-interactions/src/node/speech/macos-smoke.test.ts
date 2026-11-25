import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSpeechHost } from "./host.js";
import { createMacOSSayProvider } from "./native.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    ),
  );
});

describe.skipIf(process.platform !== "darwin")(
  "macOS say local-draft smoke",
  () => {
    it("creates a measured cached PCM WAV without network access", async () => {
      const directory = await mkdtemp(join(tmpdir(), "superimg-speech-smoke-"));
      directories.push(directory);
      const host = createSpeechHost({
        cacheDirectory: directory,
        provider: createMacOSSayProvider(),
      });
      const artifact = await host.synthesize({
        text: "Local draft narration.",
        voice: "Samantha",
      });
      expect(artifact.metadata.sampleRate).toBe(48_000);
      expect(artifact.metadata.durationSeconds).toBeGreaterThan(0);
      expect(artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    }, 30_000);
  },
);
