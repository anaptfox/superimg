import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("extracts native frames through the built public media-preparation entry", () => {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (ffmpeg.status !== 0) {
    throw new Error("Frame extraction public regression requires ffmpeg on PATH with libx264 and prores_ks encoders to generate fixtures.");
  }
  const script = fileURLToPath(new URL("../frame-extraction.e2e.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 120_000 });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}, 150_000);
