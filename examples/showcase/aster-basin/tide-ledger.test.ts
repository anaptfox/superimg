import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sampleLedger, ledgerTime, ledgerCaption, renderLedger, LEDGER_CAPTIONS } from "./tide-ledger.media";
import { sampleAtlas, INITIAL_ATLAS } from "./model";
import { projectAtlas } from "./projection";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("Tide Ledger's reused atlas", () => {
  it("samples the original world with conserved IDs and a fixed overhead camera", () => {
    for (const seconds of [0, 3.8, 7.8, 10.7, 13.2, 13.99, 15.9, 17.8, 18]) {
      const ledger = sampleLedger(seconds), atlas = sampleAtlas({ ...INITIAL_ATLAS, live: false, logicalSeconds: ledgerTime(seconds) });
      expect(ledger.particles).toEqual(atlas.particles);
      expect(ledger.particles).toHaveLength(24000);
      expect(ledger.camera).toEqual({ eye: { x: 0, y: 850, z: 0 }, target: { x: 0, y: 0, z: 0 } });
      expect(projectAtlas(ledger, 3840 * .665, 2160 * .78).finite).toBe(true);
    }
  });
  it("retains deterministic shuffled seeking and teaching geometry", () => {
    const times = [1.4, 5.2, 9.5, 12.4, 15.1, 17.7];
    const expected = times.map(t => digest(sampleLedger(t)));
    for (const index of [4, 0, 5, 3, 1, 2, 4]) expect(digest(sampleLedger(times[index]!))).toBe(expected[index]);
    for (const seconds of times) {
      const clean = sampleLedger(seconds), teaching = sampleLedger(seconds, true);
      expect({ ...teaching, caption: "" }).toEqual(clean);
      const geometry = (value: ReturnType<typeof renderLedger>) => JSON.stringify(value).replace(ledgerCaption(seconds), "");
      expect(geometry(renderLedger(clean, 3840, 2160))).toContain("ledger-map");
    }
  });
  it("holds every short teaching caption for its word-count reading floor", () => {
    for (const caption of LEDGER_CAPTIONS) {
      const words = caption.text.trim().split(/\s+/).length;
      const frames = Array.from({ length: 540 }, (_, frame) => ledgerCaption(frame / 539 * 18)).filter(text => text === caption.text).length;
      expect(words).toBeLessThanOrEqual(10);
      expect(frames / 30, caption.text).toBeGreaterThanOrEqual(Math.max(.8, words / 3));
    }
  });
  it("rejects a duplicated grain identity and an oblique camera fixture", () => {
    const sample = sampleLedger(7.8);
    const ids = (snapshot: typeof sample) => new Set(snapshot.particles.map(particle => particle.grain.id)).size;
    const corrupt = { ...sample, particles: [sample.particles[0]!, ...sample.particles.slice(0, -1)] };
    expect(ids(sample)).toBe(24000); expect(ids(corrupt)).toBe(23999);
    const overhead = (snapshot: typeof sample) => snapshot.camera.eye.x === snapshot.camera.target.x && snapshot.camera.eye.z === snapshot.camera.target.z;
    expect(overhead(sample)).toBe(true); expect(overhead({ ...sample, camera: { ...sample.camera, eye: { ...sample.camera.eye, x: 1 } } })).toBe(false);
  });
});
