import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { ReviewPlan } from "@foxworth/superimg";
import type { InspectReport } from "../commands/inspect.js";
import { boundReviewSamples, evaluateReviewAssertions, loadReviewPlan, observeReviewBeat, resolveReviewClip, reviewOutputDirectory, reviewSelectionDigest, validateReviewCoordinates, validateReviewPlan, writeReviewPacket } from "./review-packet.js";
import { analyzeTechnicalFrame } from "@superimg/core/validation";
import { parseAtList } from "./inspect-at.js";

const temporary: string[] = [];
function directory(): string {
  const path = mkdtempSync(join(tmpdir(), "superimg-review-test-"));
  temporary.push(path);
  return path;
}
afterEach(() => temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })));

const config = { width: 1280, height: 720, fps: 30, duration: 24, totalFrames: 720 };
const plan: ReviewPlan = { schemaVersion: 1, beats: [{ id: "lift", label: "Keep architecture visible", at: "17.7s", range: ["17s", "19s"] }] };

describe("review plans", () => {
  it("cancels during decoded clip writing without publishing a completed packet", async () => {
    const root = directory(), controller = new AbortController();
    const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#336699" } }).png().toBuffer();
    const report: InspectReport = { schemaVersion: 0, template: "/film.media.ts", evaluationMode: "runtime", config: { width: 32, height: 32, fps: 25, duration: 1, totalFrames: 25 }, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" }, runtime: { schemaVersion: 0, programDigest: "value", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] } };
    await expect(writeReviewPacket({ report, mediaBundleHash: "source", captureSelectionDigest: "selection", outDir: root, data: {}, clips: true, signal: controller.signal,
      companion: { path: "/film.review.ts", bundleHash: "plan", plan: { schemaVersion: 1, beats: [{ id: "moving", label: "Moving", at: "0s", range: ["0s", "0.8s"] }] } },
      renderPng: async frame => { if (frame === 2) controller.abort(new Error("cancelled during clip")); return png; },
    })).rejects.toThrow("cancelled during clip");
    expect(() => readFileSync(join(root, "report.json"))).toThrow();
  });

  it("delivery evidence ignores an existing source PNG and uses only verified decoded frames", async () => {
    const root = directory();
    const source = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#ff0000" } }).png().toBuffer();
    const decoded = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#0000ff" } }).png().toBuffer();
    const pngPath = join(root, "source.png"); writeFileSync(pngPath, source);
    const report: InspectReport = {
      schemaVersion: 0, template: "/film.media.ts", evaluationMode: "runtime", config: { width: 32, height: 32, fps: 25, duration: .04, totalFrames: 1 }, phases: null,
      coordinates: { variantId: "default", editionId: "default" },
      samples: [{ at: "0s", frame: 0, seconds: 0, progress: 1, activePhase: null, phaseLocal: null, htmlBytes: 0, text: [], colors: [], eqKeys: [], waitLabels: [], cameraScale: null, pngPath }],
      runtime: { schemaVersion: 0, programDigest: "value", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    const packet = await writeReviewPacket({ report, mediaBundleHash: "source", captureSelectionDigest: "selection", outDir: join(root, "review"), data: {}, clips: false,
      delivery: { kind: "encoded-movie", path: "/film.mp4", mimeType: "video/mp4", sha256: "a".repeat(64), byteLength: 100,
        publication: { targetId: "local", publicationId: "film", manifestDigest: "b".repeat(64) }, decoder: "mediabunny-node", clock: { fps: 25, totalFrames: 1 }, decodedFrames: [{ frame: 0, timestamp: 0, duration: .04 }] },
      renderPng: async () => decoded,
    });
    expect(packet.beats[0]!.evidence[0]!.sha256).toBe(createHash("sha256").update(decoded).digest("hex"));
    expect(packet.beats[0]!.evidence[0]!.sha256).not.toBe(createHash("sha256").update(source).digest("hex"));
    expect(packet.technical.scope).toBe("encoded-delivery");
  });

  it("bounds generic samples deterministically with endpoints and paired handoffs across the story", () => {
    const frames = Array.from({ length: 64 }, (_, index) => index * 2);
    const boundaries = Array.from({ length: 31 }, (_, index) => (index + 1) * 4);
    const candidates = [...frames, ...boundaries.flatMap((frame) => [frame - 1, frame]), 127];
    const selected = boundReviewSamples(candidates, (frame) => frame, boundaries);
    expect(selected).toHaveLength(24);
    expect(selected[0]).toBe(0);
    expect(selected.at(-1)).toBe(127);
    expect(selected.filter((frame) => boundaries.includes(frame) && selected.includes(frame - 1)).length).toBeGreaterThanOrEqual(10);
    expect(selected).toEqual(boundReviewSamples([...candidates].reverse(), (frame) => frame, [...boundaries].reverse()));
    expect(boundReviewSamples([0, 1, 1, 2], (frame) => frame)).toEqual([0, 1, 2]);
  });

  it("rejects duplicate beats, non-finite values, inverted crops and invalid checks before captures", () => {
    expect(() => validateReviewPlan({ ...plan, beats: [plan.beats[0], plan.beats[0]] })).toThrow(/Duplicate/);
    expect(() => validateReviewPlan({ ...plan, beats: [{ ...plan.beats[0], crop: { x: 0, y: NaN, width: 100, height: 100 } }] })).toThrow(/finite/);
    expect(() => validateReviewPlan({ ...plan, checks: [{ id: "f", label: "finite", metric: "camera.x", min: Infinity }] })).toThrow(/finite/);
    expect(() => validateReviewPlan({ ...plan, checks: [{ id: "f", label: "finite", metric: "__proto__.x", min: 0 }] })).toThrow(/safe metric/);
    expect(() => validateReviewCoordinates({ ...plan, beats: [{ ...plan.beats[0]!, range: ["19s", "17s"] }] }, config)).toThrow(/advance/);
    expect(() => validateReviewCoordinates({ ...plan, beats: [{ ...plan.beats[0]!, crop: { x: 1200, y: 0, width: 200, height: 100 } }] }, config)).toThrow(/exceeds/);
    expect(() => validateReviewPlan({ ...plan, beats: [{ ...plan.beats[0], crop: { x: 0, y: 0, width: .1, height: 100 } }] })).toThrow(/integer/);
  });

  it("bounds review clips and retains source frame coordinates instead of restarting motion", () => {
    expect(resolveReviewClip(["17s", "19s"], config)).toMatchObject({ startFrame: 510, endFrameExclusive: 570, fps: 15, durationSeconds: 2 });
    const frames = resolveReviewClip(["17s", "19s"], config).sourceFrames;
    expect(frames[0]).toBe(510);
    expect(frames.at(-1)).toBe(568);
    expect(() => resolveReviewClip(["17s", "21s"], config)).toThrow(/bounded/);
    expect(() => validateReviewCoordinates({ schemaVersion: 1, beats: [0, 1, 2].map((i) => ({ id: `beat-${i}`, label: "Long range", at: "1s", range: ["1s", "4s"] })) }, config)).toThrow(/total/);
    const clip25 = resolveReviewClip(["0s", "3s"], { ...config, fps: 25, totalFrames: 600 });
    expect(clip25.sourceFrames).toHaveLength(38);
    expect(clip25.durationSeconds).toBe(3);
    expect(clip25.sourceFrames.length / clip25.fps).toBe(3);
  });

  it("identifies imported observation helpers, not just companion file bytes", async () => {
    const path = directory();
    const media = join(path, "city.media.ts");
    const companion = join(path, "city.review.ts");
    const helper = join(path, "probe.ts");
    writeFileSync(companion, `import { count } from './probe'; export default { schemaVersion:1, beats:[{id:'lift',label:'Lift',at:'17.7s'}], observe:()=>({count}) };`);
    writeFileSync(helper, "export const count = 500;");
    const before = await loadReviewPlan(media);
    writeFileSync(helper, "export const count = 0;");
    const after = await loadReviewPlan(media);
    expect(after?.bundleHash).not.toEqual(before?.bundleHash);
    expect(before?.plan.observe?.({ frame: 531, seconds: 17.7, timelineSeconds: 17.7246, progress: 531 / 719, ...config, data: {} }).count).toBe(500);
    expect(after?.plan.observe?.({ frame: 531, seconds: 17.7, timelineSeconds: 17.7246, progress: 531 / 719, ...config, data: {} }).count).toBe(0);
  });
});

describe("procedural observations", () => {
  it("distinguishes missing/invalid metrics from a failing authored claim", () => {
    const checks = [{ id: "buildings", label: "Buildings remain visible", beat: "lift", metric: "grains.visibleBuilding", min: 100 }];
    expect(evaluateReviewAssertions(checks, "lift", { grains: { visibleBuilding: 0 } })[0]?.status).toBe("fail");
    expect(evaluateReviewAssertions(checks, "lift", { grains: { visibleBuilding: 700 } })[0]?.status).toBe("pass");
    expect(evaluateReviewAssertions(checks, "lift", {})[0]?.status).toBe("unverified");
    expect(evaluateReviewAssertions(checks, "overview", {}) ).toEqual([]);
  });

  it("rejects NaN probes and asynchronous observations without turning them into a pass", () => {
    const context = { frame: 531, seconds: 17.7, timelineSeconds: 17.7246, progress: 531 / 719, ...config, data: {} };
    expect(observeReviewBeat({ ...plan, observe: () => ({ value: NaN }) }, context).observationError).toMatch(/finite JSON/);
    expect(observeReviewBeat({ ...plan, observe: () => ({ value: undefined }) as never }, context).observationError).toMatch(/finite JSON/);
    expect(observeReviewBeat({ ...plan, observe: () => Promise.resolve({ value: 1 }) as never }, context).observationError).toMatch(/finite JSON/);
  });
});

describe("review packet evidence", () => {
  it("carries the exact technical scope into the packet without claiming visual approval", async () => {
    const coverage = analyzeTechnicalFrame({ frame: 0, progress: 0, html: "<div></div>", nodes: [], width: config.width, height: config.height }).coverage;
    const report: InspectReport = { schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" }, runtime: { schemaVersion: 0, programDigest: "digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [], coverage } };
    const image = await sharp({ create: { width: config.width, height: config.height, channels: 4, background: "#000000" } }).png().toBuffer();
    const packet = await writeReviewPacket({ report, mediaBundleHash: "media", captureSelectionDigest: "selection", companion: { path: "/city.review.ts", bundleHash: "companion", plan: { schemaVersion: 1, beats: [{ id: "frame", label: "Frame", at: "0f" }] } }, outDir: directory(), data: {}, clips: false, renderPng: async () => image });
    expect(packet.technical.coverage).toEqual(coverage);
    expect(packet.visual.status).toBe("unreviewed");
    expect(packet.technical.coverage?.checks.every(check => check.scope === "frame")).toBe(true);
  });

  it("rejects oversized authored companions before capture rather than silently dropping their beats", async () => {
    let captures = 0;
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    await expect(writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: { schemaVersion: 1, beats: Array.from({ length: 25 }, (_, index) => ({ id: `beat-${index}`, label: "Authored beat", at: `${index}f` })) } }, outDir: directory(), data: {}, clips: false, renderPng: async () => { captures++; return new Uint8Array(); } })).rejects.toThrow(/1–24 beats/);
    expect(captures).toBe(0);
  });

  it("maps adjacent crop edges consistently at fractional capture scale", async () => {
    const image = await sharp({ create: { width: 1920, height: 1080, channels: 4, background: "#00ff00" } }).png().toBuffer();
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    const packet = await writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: { schemaVersion: 1, beats: [
      { id: "left", label: "Left detail", at: "0", crop: { x: 701, y: 421, width: 101, height: 81 } },
      { id: "right", label: "Right detail", at: "0", crop: { x: 802, y: 421, width: 101, height: 81 } },
    ] } }, outDir: directory(), data: {}, clips: false, renderPng: async () => image });
    const left = packet.beats[0]!.evidence.find((entry) => entry.kind === "crop")!.crop!.pixels;
    const right = packet.beats[1]!.evidence.find((entry) => entry.kind === "crop")!.crop!.pixels;
    expect(left).toEqual({ left: 1052, top: 632, width: 151, height: 121 });
    expect(left.left + left.width).toBe(right.left);
    expect(packet.technical.status).toBe("pass");
  });

  it("reports an incompatible capture aspect ratio as failed evidence instead of inventing a crop", async () => {
    const image = await sharp({ create: { width: 1280, height: 500, channels: 4, background: "#00ff00" } }).png().toBuffer();
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    const packet = await writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: { schemaVersion: 1, beats: [{ id: "focal", label: "Focal detail", at: "0", crop: { x: 100, y: 100, width: 100, height: 80 } }] } }, outDir: directory(), data: {}, clips: false, renderPng: async () => image });
    expect(packet.technical.status).toBe("fail");
    expect(packet.technical.findings).toContainEqual(expect.objectContaining({ code: "REVIEW_CAPTURE_FAILED", message: expect.stringContaining("aspect ratio does not match") }));
    expect(packet.beats[0]!.evidence.map((entry) => entry.kind)).toEqual(["frame"]);
  });

  it.each([1, 2])("crops the same authored focal region at captured DPR %i and reports pixel coordinates", async (dpr) => {
    const authored = { x: 700, y: 420, width: 100, height: 80 };
    const image = await sharp({ create: { width: config.width * dpr, height: config.height * dpr, channels: 4, background: "#ff0000" } })
      .composite([{ input: await sharp({ create: { width: authored.width * dpr, height: authored.height * dpr, channels: 4, background: "#00ff00" } }).png().toBuffer(), left: authored.x * dpr, top: authored.y * dpr }]).png().toBuffer();
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    const packet = await writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: { schemaVersion: 1, beats: [{ id: "focal", label: "Focal region", at: "0", crop: authored }] } }, outDir: directory(), data: {}, clips: false, renderPng: async () => image });
    const crop = packet.beats[0]!.evidence.find((entry) => entry.kind === "crop")!;
    expect(packet.technical.status).toBe("pass");
    expect(crop.crop).toEqual({ authored, pixels: { left: 700 * dpr, top: 420 * dpr, width: 100 * dpr, height: 80 * dpr }, capture: { width: 1280 * dpr, height: 720 * dpr } });
    const pixels = await sharp(crop.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(pixels.info).toMatchObject({ width: 100 * dpr, height: 80 * dpr });
    for (let index = 0; index < pixels.data.length; index += 4) expect([...pixels.data.subarray(index, index + 4)]).toEqual([0, 255, 0, 255]);
    expect(crop.sha256).toBe(createHash("sha256").update(readFileSync(crop.path)).digest("hex"));
  });

  it("rejects out-of-bounds authored crops before capture rather than clipping their intention", async () => {
    let captures = 0;
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [] },
    };
    await expect(writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: { schemaVersion: 1, beats: [{ id: "bad", label: "Outside frame", at: "0", crop: { x: 1200, y: 400, width: 100, height: 80 } }] } }, outDir: directory(), data: {}, clips: false, renderPng: async () => { captures++; return new Uint8Array(); } })).rejects.toThrow(/exceeds the authored frame/);
    expect(captures).toBe(0);
  });

  it("writes compact hashed full frames and crops, preserves exact timeline, and leaves craft unreviewed", async () => {
    const outDir = directory();
    const image = await sharp({ create: { width: 1280, height: 720, channels: 4, background: "#946027" } }).png().toBuffer();
    let observationSceneSeconds: number | undefined;
    let roundedProgress: number | undefined;
    const authored: ReviewPlan = {
      ...plan,
      beats: [{ ...plan.beats[0]!, crop: { x: 100, y: 100, width: 200, height: 150 } }, { id: "progress", label: "Progress rounds to an exact frame", at: "0.75" }],
      observe: (ctx) => { if (ctx.frame === 531) observationSceneSeconds = ctx.timelineSeconds; else roundedProgress = ctx.progress; return { grains: { visibleBuilding: 0 } }; },
      checks: [{ id: "mass", label: "The lift preserves the city", beat: "lift", metric: "grains.visibleBuilding", min: 100 }],
    };
    const report: InspectReport = {
      schemaVersion: 0, template: "/city.media.ts", evaluationMode: "ir", config, phases: null, samples: [], coordinates: { variantId: "default", editionId: "default" },
      runtime: { schemaVersion: 0, programDigest: "value-digest", kind: "video", coordinates: [], findings: [], assets: [], fonts: [], metadata: { semanticIR: { nodes: Array.from({ length: 1000 }, () => ({ rawGeometry: "not in the packet" })) } } },
    };
    const packet = await writeReviewPacket({ report, mediaBundleHash: "media-bundle", captureSelectionDigest: "selection-digest", capabilities: { temporal: "canonical", motion: "none", visual: "tree", portability: "self-contained", determinism: "unverified", issues: [] }, companion: { path: "/city.review.ts", bundleHash: "review-bundle", plan: authored }, outDir, data: {}, clips: false, renderPng: async () => image });
    expect(packet.sourceIdentity).toEqual({ mediaBundleHash: "media-bundle", valueDigest: "value-digest", reviewBundleHash: "review-bundle" });
    expect(packet.authored.status).toBe("fail");
    expect(packet.technical.status).toBe("pass");
    expect(packet.visual.status).toBe("unreviewed");
    expect(packet.coverage.capabilities).toMatchObject({ motion: "none", determinism: "unverified", visual: "tree" });
    expect(packet.coverage.unverified.some((line) => line.includes("IR determinism is unverified"))).toBe(true);
    expect(packet.coverage.unverified.some((line) => line.includes("raw procedural motion may still be visible"))).toBe(true);
    expect(packet.beats[0]?.resolved).toMatchObject({ frame: 531, seconds: 17.7, timelineSeconds: 531 / 719 * 24 });
    expect(observationSceneSeconds).toBeCloseTo(531 / 719 * 24, 10);
    expect(roundedProgress).toBe(539 / 719);
    expect(packet.beats[1]?.resolved.progress).toBe(539 / 719);
    expect(packet.beats[0]?.requestedAt).toBe("17.7s");
    expect(packet.coverage.unverified).toContain("Authored ranges have no motion evidence; add --review-clips");
    expect(packet.beats[0]?.evidence.map((entry) => entry.kind)).toEqual(["frame", "crop"]);
    const full = packet.beats[0]!.evidence[0]!;
    expect(full.sha256).toBe(createHash("sha256").update(image).digest("hex"));
    expect(packet.evidence[0]?.kind).toBe("contact-sheet");
    const serialized = readFileSync(packet.reportPath, "utf8");
    expect(serialized).not.toContain("rawGeometry");
    expect(serialized.length).toBeLessThan(10_000);
  });

  it("places changed media or review graphs in separate evidence directories", () => {
    const before = reviewOutputDirectory("/city.media.ts", "media-a", "review-a", "selection-a");
    expect(reviewOutputDirectory("/city.media.ts", "media-b", "review-a", "selection-a")).not.toBe(before);
    expect(reviewOutputDirectory("/city.media.ts", "media-a", "review-b", "selection-a")).not.toBe(before);
    const selection = { config, coordinates: { variantId: "default", editionId: "default" }, data: { city: "one" }, samples: parseAtList("17.7s"), clips: false, renderedLayout: false, resources: { assets: [], fonts: [] } };
    const digest = reviewSelectionDigest(selection);
    const differentData = reviewSelectionDigest({ ...selection, data: { city: "two" } });
    const differentEdition = reviewSelectionDigest({ ...selection, coordinates: { ...selection.coordinates, editionId: "square" } });
    const differentAt = reviewSelectionDigest({ ...selection, samples: parseAtList("18s") });
    expect(new Set([digest, differentData, differentEdition, differentAt]).size).toBe(4);
    for (const changed of [differentData, differentEdition, differentAt]) expect(reviewOutputDirectory("/city.media.ts", "media-a", "review-a", changed)).not.toBe(reviewOutputDirectory("/city.media.ts", "media-a", "review-a", digest));
    expect(reviewSelectionDigest({ ...selection, data: { b: 2, a: 1 } })).toBe(reviewSelectionDigest({ ...selection, data: { a: 1, b: 2 } }));
  });
});
