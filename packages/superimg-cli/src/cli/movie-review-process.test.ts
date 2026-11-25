import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, expect, it } from "vitest";
import { assertMovieReviewCurrent } from "./utils/movie-export-review.js";
import type { ReviewPacket } from "./utils/review-packet.js";

const root = mkdtempSync(join(tmpdir(), "superimg-movie-review-process-"));
const cli = resolve(import.meta.dirname, "../../dist/cli.js");
const source = join(root, "film.media.ts");
writeFileSync(join(root, "package.json"), '{"type":"module"}');
writeFileSync(source, `import {video,Html} from '@foxworth/superimg';
export default video({size:{width:320,height:180},fps:25,duration:'1s',render:ctx=>Html({id:'color',width:320,height:180,html:'<div style="width:320px;height:180px;background:rgb('+Math.round(ctx.timeline.progress*255)+',60,160)"></div>'})});`);
writeFileSync(join(root, "film.review.ts"), `export default {schemaVersion:1,beats:[
{id:'start',label:'First frame',at:'0s',crop:{x:0,y:0,width:32,height:32}},
{id:'middle',label:'Changing color',at:'0.5s',range:['0s','0.8s']},
{id:'end',label:'Clamped endpoint',at:'99s'}],observe: ctx => ({frame:ctx.frame})};`);
afterAll(() => rmSync(root, { recursive: true, force: true }));
function run(name: string, args: string[] = [], sourcePath = source) {
  const output = join(root, name);
  const result = spawnSync(process.execPath, [cli, "export", sourcePath, "--for", "320x180.mp4", "--review", "--json", "--output", output, ...args], { cwd: root, encoding: "utf8", timeout: 120_000 });
  return { ...result, output, value: JSON.parse(result.stdout) };
}
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

it("reviews exact published bytes, with bounded decoded frame/crop/clip provenance and stale-evidence rejection", async () => {
  const exported = run("reviewed");
  expect(exported.status).toBe(0);
  expect(exported.value.review.path).toContain(join(root, ".superimg", "reviews"));
  expect(exported.value).toMatchObject({ schemaVersion: 1, resultSchemaVersion: 0, ok: true, certainty: "completed", publication: { state: "completed" }, review: { state: "completed", visual: "unreviewed" } });
  const packet = JSON.parse(readFileSync(exported.value.review.path, "utf8")) as ReviewPacket;
  const rendition = exported.value.manifest.renditions[0];
  expect(packet.delivery).toMatchObject({ sha256: rendition.sha256, byteLength: rendition.bytes, clock: { fps: 25, totalFrames: 25 }, publication: { manifestDigest: exported.value.manifestDigest } });
  expect(sha(packet.delivery!.path)).toBe(rendition.sha256);
  expect(packet.technical).toMatchObject({ status: "pass", scope: "encoded-delivery" });
  expect(packet.beats.map(beat => beat.resolved.frame)).toEqual([0, 13, 24]);
  expect(packet.beats[1]?.observation).toMatchObject({ frame: 13 });
  expect(packet.delivery!.decodedFrames.find(item => item.frame === 24)).toMatchObject({ timestamp: .96 });
  expect(packet.beats[0]!.evidence.map(item => item.kind)).toEqual(["frame", "crop"]);
  expect(packet.beats[1]!.clip?.sourceFrames).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
  for (const item of [...packet.evidence, ...packet.beats.flatMap(beat => beat.evidence)]) {
    expect(item.decodedFrom?.movieSha256).toBe(rendition.sha256);
    expect(sha(item.path)).toBe(item.sha256);
  }
  await expect(assertMovieReviewCurrent(packet, packet.captureSelectionDigest)).resolves.toBeUndefined();
  await expect(assertMovieReviewCurrent(packet, "different-source-selection")).rejects.toMatchObject({ code: "REVIEW_MOVIE_STALE" });
  const framePath = packet.beats[0]!.evidence[0]!.path;
  const original = readFileSync(framePath); writeFileSync(framePath, "tampered");
  await expect(assertMovieReviewCurrent(packet, packet.captureSelectionDigest)).rejects.toMatchObject({ code: "REVIEW_MOVIE_STALE" });
  writeFileSync(framePath, original);
  writeFileSync(packet.delivery!.path, "tampered movie");
  await expect(assertMovieReviewCurrent(packet, packet.captureSelectionDigest)).rejects.toMatchObject({ code: "REVIEW_MOVIE_STALE" });
}, 120_000);

it("re-exports identical movie bytes and keeps the earlier review capture", async () => {
  const first = run("stable-first");
  expect(first.status).toBe(0);
  const oldPacket = JSON.parse(readFileSync(first.value.review.path, "utf8")) as ReviewPacket;
  const oldMovie = readFileSync(oldPacket.delivery!.path);
  // Ensure the encoder's wall-clock creation time differs between exports.
  await new Promise(resolve => setTimeout(resolve, 1100));
  const second = run("stable-second");
  expect(second.status).toBe(0);
  expect(second.value.review.path).toBe(first.value.review.path);
  expect(second.value.review.selectionPath).toBe(first.value.review.selectionPath);
  expect(JSON.parse(readFileSync(second.value.review.selectionPath, "utf8")).delivery.sha256).toBe(second.value.artifacts.find((item: { kind: string }) => item.kind === "movie").sha256);
  expect(second.value.manifest.renditions[0].sha256).toBe(first.value.manifest.renditions[0].sha256);
  expect(readFileSync(oldPacket.delivery!.path)).toEqual(oldMovie);
  await expect(assertMovieReviewCurrent(oldPacket, oldPacket.captureSelectionDigest)).resolves.toBeUndefined();
  const latest = JSON.parse(readFileSync(second.value.review.path, "utf8")) as ReviewPacket;
  expect(latest.delivery!.path).not.toBe(oldPacket.delivery!.path);
}, 120_000);

it("keeps completed publication and receipt when review writing fails", () => {
  const output = join(root, "blocked");
  const blockedRoot = join(root, "blocked-project"); mkdirSync(blockedRoot);
  writeFileSync(join(blockedRoot, "package.json"), '{"type":"module"}');
  writeFileSync(join(blockedRoot, ".superimg"), "block review directory");
  const blockedSource = join(blockedRoot, "film.media.ts");
  writeFileSync(blockedSource, readFileSync(source));
  const exported = run("blocked", [], blockedSource);
  expect(exported.status).toBe(1);
  expect(exported.value).toMatchObject({ schemaVersion: 1, ok: false, certainty: "completed", publication: { state: "completed" }, review: { state: "failed" }, error: { code: expect.any(String) }, manifestDigest: expect.any(String) });
  expect(existsSync(join(output, "export.json"))).toBe(true);
  const rendition = exported.value.manifest.renditions[0];
  expect(sha(join(output, rendition.path))).toBe(rendition.sha256);
}, 120_000);

it("rejects unsupported review selections before publishing", () => {
  const rejected = run("unsupported", ["--for", "640x360.mp4"]);
  expect(rejected.status).toBe(1);
  expect(rejected.value.error.code).toBe("UNSUPPORTED_SELECTION");
  expect(existsSync(rejected.output)).toBe(false);
  const overLimit = spawnSync(process.execPath, [cli, "export", source, "--for", "7680x4320.mp4", "--review", "--json", "--output", join(root, "over-limit")], { cwd: root, encoding: "utf8" });
  expect(overLimit.status).toBe(1);
  expect(JSON.parse(overLimit.stdout).error.code).toBe("REVIEW_DECODE_LIMIT");
  expect(existsSync(join(root, "over-limit"))).toBe(false);
});
