import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import sharp from "sharp";
import { VideoSampleSink } from "mediabunny";
import { Demuxer } from "node-av";
import { PersistentFrameDecoder } from "./persistent-frame-decoder.js";

let directory: string;
let avc: string;
let legacy: string;
let rotated: string;
const decoders: PersistentFrameDecoder[] = [];
function create(maxSources = 4) {
  const decoder = new PersistentFrameDecoder(maxSources);
  decoders.push(decoder);
  return decoder;
}
async function color(png: Buffer): Promise<string> {
  const { data } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = [data[0]!, data[1]!, data[2]!];
  return ["red", "green", "blue"][channels.indexOf(Math.max(...channels))]!;
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "superimg-native-reader-"));
  avc = join(directory, "vfr.mp4");
  legacy = join(directory, "legacy.mp4");
  rotated = join(directory, "rotated.mp4");
  const inputs = ["red", "lime", "blue"].flatMap((name) => ["-f", "lavfi", "-i", `color=${name}:s=64x48:r=10:d=1`]);
  for (const [path, codec] of [[avc, "libx264"], [legacy, "mpeg4"]]) {
    await execa("ffmpeg", ["-y", ...inputs, "-filter_complex",
      "[0:v][1:v][2:v]concat=n=3:v=1:a=0,settb=1/1000,setpts='if(lt(N,10),N,if(lt(N,20),10+(N-10)*3,40+(N-20)))/(10*TB)'[v]",
      "-map", "[v]", "-fps_mode", "vfr", "-c:v", codec!, "-g", "10", "-bf", "2", path!]);
  }
  await execa("ffmpeg", ["-y", "-display_rotation", "90", "-i", legacy, "-c", "copy", rotated]);
});
afterEach(async () => {
  await Promise.all(decoders.splice(0).map((decoder) => decoder.dispose()));
  vi.restoreAllMocks();
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

describe("persistent native frame reader", () => {
  it("retains one forward sample stream and seeks only for reverse or large jumps", async () => {
    const streams = vi.spyOn(VideoSampleSink.prototype, "samples");
    const decoder = create();
    for (const time of [0, 0.05, 0.11, 0.15, 0.9]) expect(await color(await decoder.extract(avc, time))).toBe("red");
    expect(streams).toHaveBeenCalledTimes(1);
    expect(await color(await decoder.extract(avc, 0.1))).toBe("red");
    expect(await color(await decoder.extract(avc, 4.1))).toBe("blue");
    expect(streams).toHaveBeenCalledTimes(3);
  });

  it.each(["avc", "legacy"])("selects presentation frames across VFR holds, seeks, and EOF (%s)", async (kind) => {
    const decoder = create();
    const path = kind === "avc" ? avc : legacy;
    for (const [time, expected] of [[0, "red"], [0.99, "red"], [1, "green"], [1.29, "green"], [3.99, "green"], [4, "blue"], [10, "blue"], [0.1, "red"]] as const) {
      expect(await color(await decoder.extract(path, time)), `at ${time}s`).toBe(expected);
    }
  });

  it("retains the native legacy demuxer across adjacent requests and honors rotation", async () => {
    const opens = vi.spyOn(Demuxer, "open");
    const decoder = create();
    for (const time of [0, 0.2, 0.3]) await decoder.extract(legacy, time);
    expect(opens).toHaveBeenCalledTimes(1);
    const png = await decoder.extract(rotated, 0);
    expect(await sharp(png).metadata()).toMatchObject({ width: 48, height: 64 });
  });

  it("bounds source sessions, reopens changed versions, and serializes shared native state", async () => {
    const streams = vi.spyOn(VideoSampleSink.prototype, "samples");
    const decoder = create(1);
    const frames = await Promise.all([decoder.extract(avc, 0), decoder.extract(avc, 1), decoder.extract(legacy, 4)]);
    expect(await Promise.all(frames.map(color))).toEqual(["red", "green", "blue"]);
    await decoder.extract(avc, 0, undefined, { sourceVersion: "one" });
    await decoder.extract(avc, 0, undefined, { sourceVersion: "two" });
    expect(streams).toHaveBeenCalledTimes(3);
    await decoder.dispose();
    await expect(decoder.extract(avc, 0)).rejects.toThrow("disposed");
  });

  it("cancels a native request without poisoning an independent queued request", async () => {
    const decoder = create();
    const controller = new AbortController();
    const first = decoder.extract(avc, 0, controller.signal);
    const failed = expect(first).rejects.toMatchObject({ name: "AbortError" });
    const second = decoder.extract(avc, 1);
    controller.abort();
    await failed;
    expect(await color(await second)).toBe("green");
  });
});
