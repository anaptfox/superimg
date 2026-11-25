import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { writeReviewPacket } from "./review-advanced.js";

it("captures a bounded public review with evidence identity and no visual approval", async () => {
  const outDir = await mkdtemp(join(tmpdir(), "superimg-public-review-"));
  try {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNw6fj/HwAFqgLL0eHDtAAAAABJRU5ErkJggg==", "base64");
    const packet = await writeReviewPacket({
      report: { template: "example.media.ts", config: { width: 32, height: 32, fps: 25, duration: 0.04, totalFrames: 1 }, coordinates: { editionId: "default", variantId: "default" }, samples: [{ at: "0", frame: 0, activePhase: null }], runtime: { schemaVersion: 0, programDigest: "value", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] } },
      mediaBundleHash: "source", captureSelectionDigest: "selection", outDir, data: {}, clips: false,
      renderPng: async () => png,
    });
    const evidence = packet.beats[0]!.evidence[0]!;
    expect(evidence.sha256).toBe(createHash("sha256").update(await readFile(evidence.path)).digest("hex"));
    expect(packet.visual.status).toBe("unreviewed");
    expect(packet.sourceIdentity).toMatchObject({ mediaBundleHash: "source", valueDigest: "value" });
  } finally { await rm(outDir, { recursive: true, force: true }); }
});
