import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createNodeNarrationService, createWavPcm, reviewPreparedNarration, type SpeechProvider } from "./narration.js";

it("prepares and reviews narration directly with an explicit provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "superimg-node-narration-"));
  try {
    let calls = 0;
    const provider: SpeechProvider = {
      id: "piper", version: "test", fingerprint: () => ({ backend: "test", details: {} }),
      voices: async () => [{ id: "voice", name: "Voice" }],
      synthesize: async () => { calls++; return { wav: createWavPcm(new Uint8Array(96000), { sampleRate: 48000, channels: 1, bitsPerSample: 16 }), provenance: { provider: "piper", adapterVersion: "test", backend: { backend: "test", details: {} } } }; },
    };
    const service = createNodeNarrationService({ cacheDirectory: join(root, "cache"), providers: { piper: provider } });
    const output = join(root, "output");
    await service.prepare({ schemaVersion: 1, provider: "piper", voice: "voice", mode: "natural", fps: 30, segments: [{ id: "hook", text: "Hello." }] }, output);
    const manifest = JSON.parse(await readFile(join(output, "narration.json"), "utf8"));
    expect(manifest.kind).toBe("prepared-narration");
    expect(calls).toBe(1);
    const review = await reviewPreparedNarration(output);
    expect(review.findings.filter(finding => finding.severity === "error")).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
