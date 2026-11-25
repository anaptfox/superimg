import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createWavPcm, validateWavPcm } from "./speech/wav.js";
import { reviewPreparedNarration, verifyNarrationExport, writeNarrationReview } from "./narration-review.js";
import { hashJson } from "./provider.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("prepared narration review", () => {
  it("verifies WAV bytes and reports normalized peak, RMS, and clipping", async () => {
    const directory = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0, 0xff, 0x7f]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    const hash = digest(wav);
    await writeFixture(directory, wav, hash);

    const report = await reviewPreparedNarration(directory);
    expect(report.manifest.recipeHashValid).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.manifest.sha256).toBe(digest(await readFile(join(directory, "narration.json"))));
    expect(report.audio[0]).toMatchObject({
      id: "voice",
      sha256: hash,
      metadata: { sampleRate: 8_000, channels: 1, bitsPerSample: 16, sampleFrames: 2 },
      peak: 0.999969482421875,
      clippingSamples: 1,
      clipping: true,
    });
    expect(report.metrics.lufs).toBeNull();
  });

  it("reports byte and declared metadata mismatches without accepting them", async () => {
    const directory = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0, 1, 0]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    await writeFixture(directory, wav, "0".repeat(64), { sampleRate: 16_000 });

    const report = await reviewPreparedNarration(directory);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["AUDIO_HASH_MISMATCH", "AUDIO_METADATA_MISMATCH"]));
  });

  it("matches producer recipe hashes using canonical sorted JSON", async () => {
    const directory = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    await writeFile(join(directory, "voice.wav"), wav);
    const recipe = { schemaVersion: 1, provider: "macos-say", voice: "Samantha", mode: "natural", fps: 30, segments: [{ id: "voice", text: "hello" }] };
    const plan = (await readManifestPlan(directory));
    await writeFile(join(directory, "narration.json"), JSON.stringify({ schemaVersion: 1, kind: "prepared-narration", recipeHash: hashJson(recipe), recipe, plan, assets: [asset("voice.wav", "voice", digest(wav))] }));
    const report = await reviewPreparedNarration(directory);
    expect(report.manifest.recipeHashMatches).toBe(true);
  });

  it("rejects escaping and symlinked asset paths", async () => {
    const directory = await temporaryDirectory();
    const outside = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    await writeFile(join(outside, "voice.wav"), wav);
    await symlink(join(outside, "voice.wav"), join(directory, "linked.wav"));
    await writeManifest(directory, [asset("../outside.wav", "voice")]);
    const escaped = await reviewPreparedNarration(directory);
    expect(escaped.findings[0]!.code).toBe("AUDIO_REVIEW_FAILED");

    await writeManifest(directory, [asset("linked.wav", "voice")]);
    const linked = await reviewPreparedNarration(directory);
    expect(linked.findings[0]!.message).toContain("non-symlink");
  });

  it("writes review JSON and an offline navigable HTML viewer atomically", async () => {
    const directory = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    await writeFixture(directory, wav, digest(wav), { segmentId: "voice<&" });
    const report = await writeNarrationReview(directory);
    const html = await readFile(join(directory, "review.html"), "utf8");
    expect(JSON.parse(await readFile(join(directory, "review.json"), "utf8"))).toEqual(report);
    expect(html).toContain("Download WAV");
    expect(html).toContain("voice&lt;&amp;");
    expect(html).toContain("audio controls");
    expect(html).not.toContain("http://");
  });

  it("inspects an explicitly supplied encoded artifact and reports track limits", async () => {
    const directory = await temporaryDirectory();
    const wav = createWavPcm(new Uint8Array([0, 0]), { sampleRate: 8_000, channels: 1, bitsPerSample: 16 });
    await writeFixture(directory, wav, digest(wav));
    const report = await verifyNarrationExport(directory, join(directory, "voice.wav"));
    expect(report.encoded.sha256).toBe(digest(wav));
    expect(report.encoded.inspection.tracks.some((track) => track.kind === "audio")).toBe(true);
    expect(report.encoded.findings.map((finding) => finding.code)).toContain("ENCODED_VIDEO_TRACK_MISSING");
    expect(report.findings.map((finding) => finding.code)).toContain("ENCODED_VIDEO_TRACK_MISSING");
    expect(report.encoded.audioLevels).toBeNull();

    const written = await writeNarrationReview(directory, { encodedPath: join(directory, "voice.wav") });
    expect(written.encoded.path).toBe(`encoded-${digest(wav)}.wav`);
    expect(Uint8Array.from(await readFile(join(directory, written.encoded.path)))).toEqual(wav);
    const html = await readFile(join(directory, "review.html"), "utf8");
    expect(html).toContain("encoded export");
    expect(html).toContain("data-time=\"0\"");
    expect(html).toContain("Download encoded export");
    expect(html).toContain("ENCODED_VIDEO_TRACK_MISSING");
  });
});

async function temporaryDirectory(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "superimg-narration-review-"));
  roots.push(root);
  return root;
}

async function writeFixture(directory: string, wav: Uint8Array, hash: string, options: { sampleRate?: number; segmentId?: string } = {}): Promise<void> {
  await writeFile(join(directory, "voice.wav"), wav);
  const metadata = validateWavPcm(wav);
  await writeManifest(directory, [{ ...asset("voice.wav", options.segmentId ?? "voice", hash, options.sampleRate ?? metadata.sampleRate), metadata: { sampleRate: options.sampleRate ?? metadata.sampleRate, channels: metadata.channels, bitsPerSample: 16, sampleFrames: metadata.sampleFrames, durationSeconds: options.sampleRate === undefined ? metadata.durationSeconds : metadata.sampleFrames / (options.sampleRate * metadata.channels * metadata.bitsPerSample / 8) } }]);
}

async function writeManifest(directory: string, assets: Array<ReturnType<typeof asset>>): Promise<void> {
  const plan = await readManifestPlan(directory, assets);
  await writeFile(join(directory, "narration.json"), JSON.stringify({ schemaVersion: 1, kind: "prepared-narration", recipeHash: "a".repeat(64), plan, assets }, null, 2));
}

async function readManifestPlan(directory: string, assets: Array<ReturnType<typeof asset>> = [asset("voice.wav", "voice")]) {
  void directory;
  return {
    schemaVersion: 1,
    kind: "narration-plan",
    mode: "natural",
    fps: 30,
    totalFrames: 30,
    durationSeconds: 1,
    segments: [{ id: assets[0]?.id ?? "voice", startFrame: 0, endFrame: 30, startSeconds: 0, endSeconds: 1, speechStartSeconds: 0, speechDurationSeconds: 1, paddingSeconds: 0 }],
    phases: {},
    audio: { clips: assets.map((entry) => ({ id: entry.id, src: entry.src, role: "voice" as const })) },
    findings: [],
  };
}

function asset(src: string, id: string, hash = "b".repeat(64), sampleRate = 8_000) {
  return { id, src, sha256: hash, metadata: { sampleRate, channels: 1, bitsPerSample: 16 as const, sampleFrames: 1, durationSeconds: 1 / sampleRate }, provenance: { provider: "test" } };
}

function digest(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
