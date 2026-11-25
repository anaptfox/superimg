import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { BufferTarget, Mp4OutputFormat, Output, Quality, VideoSample, VideoSampleSource } from "mediabunny";
import { registerMediabunnyServer } from "@mediabunny/server";

registerMediabunnyServer();

describe("built CLI media workflows", () => {
  const dirs: string[] = [];
  afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });

  it("probes and converts a named plan without fabricating output metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-cli-e2e-")); dirs.push(dir);
    const input = join(dir, "input.mp4"); await writeFile(input, await tinyMp4());
    const probe = await cli(["media", "probe", input, "--json"]);
    expect(JSON.parse(probe.stdout).tracks.some((track: { kind: string }) => track.kind === "video")).toBe(true);
    const plan = join(dir, "convert.json"); const output = join(dir, "converted.mkv");
    await writeFile(plan, JSON.stringify({ sources: [{ id: "clip", path: "input.mp4" }], video: { sourceId: "clip", trackId: JSON.parse(probe.stdout).tracks.find((track: { kind: string }) => track.kind === "video").id, trim: { endSeconds: 1 } }, audio: [], format: "mkv" }));
    await cli(["media", "convert", "--plan", plan, "--output", output, "--json"]);
    expect((await readFile(output)).byteLength).toBeGreaterThan(0);
    const converted = JSON.parse((await cli(["media", "probe", output, "--json"])).stdout);
    expect(converted.mimeType.split(";", 1)[0]).toBe("video/x-matroska");
    expect(converted.durationSeconds).toBeCloseTo(1, 1);
    expect(converted.tracks.some((track: { kind: string }) => track.kind === "video")).toBe(true);
    await expect(cli(["media", "convert", "--plan", join(dir, "missing.json")])).rejects.toThrow();
  });

  it("rejects a legacy MP4 ID that would silently select a different audio track", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-cli-tracks-"));
    dirs.push(dir);
    const input = join(dir, "input.mp4");
    // The old demuxer saw audio IDs 3 then 2. The new demuxer sees 2 then 3.
    await promisify(execFile)("ffmpeg", [
      "-loglevel", "error", "-f", "lavfi", "-i", "color=s=16x16:r=2",
      "-f", "lavfi", "-i", "sine=frequency=400:sample_rate=16000",
      "-f", "lavfi", "-i", "sine=frequency=900:sample_rate=8000",
      "-map", "0:v", "-map", "1:a", "-map", "2:a", "-t", "1",
      "-c:v", "libx264", "-c:a", "aac",
      "-streamid", "0:10", "-streamid", "1:3", "-streamid", "2:2",
      "-use_stream_ids_as_track_ids", "1", input,
    ]);
    const probe = JSON.parse((await cli(["media", "probe", input, "--json"])).stdout);
    expect(probe.tracks).toMatchObject([
      { id: "video:1" },
      { id: "audio:1", sampleRate: 16000 },
      { id: "audio:2", sampleRate: 8000 },
    ]);

    const planPath = join(dir, "convert.json");
    const plan = {
      sources: [{ id: "clip", path: "input.mp4" }],
      video: { sourceId: "clip", trackId: "video:1" },
      audio: [{ id: "voice", sourceId: "clip", trackId: "2" }],
      format: "mp4",
      copy: { mode: "required" },
    };
    await writeFile(planPath, JSON.stringify(plan));
    await expect(cli(["media", "convert", "--plan", planPath])).rejects.toThrow(/legacy media track ID .*select a current track ID/i);
    expect((await readdir(dir)).sort()).toEqual(["convert.json", "input.mp4"]);

    plan.audio[0]!.trackId = "audio:2";
    await writeFile(planPath, JSON.stringify(plan));
    await cli(["media", "convert", "--plan", planPath]);
    const converted = JSON.parse((await cli(["media", "probe", join(dir, "convert.mp4"), "--json"])).stdout);
    expect(converted.tracks).toMatchObject([{ kind: "video" }, { kind: "audio", sampleRate: 8000 }]);
  }, 30_000);

  it("exports authored media through Boundary with quality into an atomic bundle", async () => {
    const dir = await mkdtemp(join(await realpath(tmpdir()), "superimg-cli-export-")); dirs.push(dir);
    const receipt = JSON.parse((await cli(["export", "src/__fixtures__/studio.media.ts", "--for", "64x64.webm", "--quality", "low", "--video-codec", "vp9", "-o", dir, "--json"])).stdout);
    expect(receipt).toBeTypeOf("object");
    const files = await readdir(dir, { recursive: true });
    const video = files.find((file) => file.endsWith(".webm"));
    expect(video).toBeDefined();
    const inspected = JSON.parse((await cli(["media", "probe", join(dir, video!), "--json"])).stdout);
    expect(inspected.mimeType.split(";", 1)[0]).toBe("video/webm");
    expect(inspected.durationSeconds).toBeCloseTo(4, 1);
    expect(inspected.tracks[0].codec).toBe("vp9");
    expect(files.some((file) => file.endsWith(".tmp"))).toBe(false);
  }, 30_000);

  it("records the executing CLI version in receipts instead of the host package version", async () => {
    const dir = await mkdtemp(join(await realpath(tmpdir()), "superimg-cli-receipt-version-")); dirs.push(dir);
    const cliPackage = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as { version: string };
    const result = await cli([
      "export",
      "src/__fixtures__/svg-text-no-font.media.ts",
      "--for", "200x80.svg",
      "-o", dir,
      "--json",
    ], { npm_package_version: "host-package-99.99.99" });
    const receipt = JSON.parse(result.stdout) as {
      manifest: { producer: { name: string; version: string } };
    };

    expect(receipt.manifest.producer).toEqual({ name: "superimg", version: cliPackage.version });
    expect(receipt.manifest.producer.version).not.toBe("host-package-99.99.99");
  }, 30_000);
});

async function tinyMp4() { const target = new BufferTarget(); const output = new Output({ format: new Mp4OutputFormat(), target }); const video = new VideoSampleSource({ codec: "avc", quality: new Quality("low") }); output.addVideoTrack(video); await output.start(); const frame = new VideoSample(new Uint8Array(16 * 16 * 4), { format: "RGBA", codedWidth: 16, codedHeight: 16, timestamp: 0, duration: 1 }); await video.add(frame); frame.close(); await output.finalize(); return new Uint8Array(target.buffer!); }
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
function cli(args: string[], env: Record<string, string | undefined> = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/cli.js", ...args], { cwd: packageRoot, env: { ...process.env, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => stdout += chunk); child.stderr.on("data", (chunk) => stderr += chunk);
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `CLI exited ${code}`)));
  });
}
