import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { video } from "@superimg/types";
import { NodeVideoEncoder } from "@superimg/node/internal";
import * as decoder from "@superimg/node/runtime";
import { assertMovieReviewCurrent, prepareMovieExportReview } from "./movie-export-review.js";

vi.mock("@superimg/node/runtime", async importActual => {
  const actual = await importActual<typeof import("@superimg/node/runtime")>();
  return { ...actual, decodeNodeMovieFrames: vi.fn(actual.decodeNodeMovieFrames) };
});
const roots: string[] = [];
afterEach(async () => { vi.clearAllMocks(); await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
const description = { sourceKind: "media" as const, animated: true, variantIds: [], editionIds: ["default"] };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "superimg-delivery-review-")); roots.push(root);
  const encoder = new NodeVideoEncoder();
  const sharp = (await import("sharp")).default;
  let bytes: Uint8Array;
  try {
    await encoder.init({ width: 32, height: 32, fps: 25, durationSeconds: .08, encoding: { format: "mp4" } });
    const png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#336699" } }).png().toBuffer();
    await encoder.addFrame(png, 0); await encoder.addFrame(png, .04); bytes = await encoder.finalize();
  } finally { await encoder.dispose(); }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const path = join(root, "published"); await mkdir(join(path, "media"), { recursive: true });
  await writeFile(join(path, "media/film.mp4"), bytes);
  const rendition = { path: "media/film.mp4", mimeType: "video/mp4", sha256, bytes: bytes.byteLength, coordinates: { variantId: "default", editionId: "default", renditionId: "32x32.mp4" } };
  const receipt = { schemaVersion: 0 as const, targetId: "local", publicationId: "film", manifestDigest: "b".repeat(64), manifest: { renditions: [rendition], runtime: { programDigest: "exported-value", assets: [], fonts: [] } } };
  return { root, path, receipt };
}

it("uses retained source/companion identity and decoded pixels without invoking media render", async () => {
  const f = await fixture();
  const source = join(f.root, "film.media.ts");
  const companion = join(f.root, "film.review.ts");
  await writeFile(companion, `export default {schemaVersion:1,beats:[{id:'first',label:'Original plan',at:'0s'}]}`);
  const review = await prepareMovieExportReview(source, description, { for: ["32x32.mp4"] });
  const render = vi.fn(() => { throw new Error("Source must not rerender during delivery review"); });
  review.retainSource({ value: video({ size: { width: 32, height: 32 }, fps: 25, duration: "2f", render }), bundle: { code: "retained original bundle" } });
  await writeFile(source, "source changed after export loaded it");
  await writeFile(companion, `export default {schemaVersion:1,beats:[{id:'new',label:'Changed plan',at:'0s'}]}`);
  const result = await review.write(f.receipt, f.path);
  expect(render).not.toHaveBeenCalled();
  expect(result.packet.beats[0]!.id).toBe("first");
  expect(result.packet.sourceIdentity).toMatchObject({ mediaBundleHash: createHash("sha256").update("retained original bundle").digest("hex"), valueDigest: "exported-value" });
  expect(result.packet.delivery?.sha256).toBe(f.receipt.manifest.renditions[0]!.sha256);
  expect(result.packet.reportPath).toMatch(/review\.json$/);
  await writeFile(join(f.path, "media/film.mp4"), "a newer publication");
  await expect(assertMovieReviewCurrent(result.packet, result.packet.captureSelectionDigest)).resolves.toBeUndefined();
});

it("reports a decoder-unavailable failure without altering the published movie", async () => {
  const f = await fixture();
  const original = await readFile(join(f.path, "media/film.mp4"));
  const review = await prepareMovieExportReview(join(f.root, "film.media.ts"), description, { for: ["32x32.mp4"] });
  review.retainSource({ value: video({ fps: 25, duration: "2f", render: () => null as never }), bundle: { code: "original" } });
  vi.mocked(decoder.decodeNodeMovieFrames).mockImplementationOnce(async function* () {
    throw Object.assign(new Error("Unavailable native decoder"), { code: "REVIEW_DECODER_UNAVAILABLE" });
  });
  await expect(review.write(f.receipt, f.path)).rejects.toMatchObject({ code: "REVIEW_DECODER_UNAVAILABLE" });
  expect(await readFile(join(f.path, "media/film.mp4"))).toEqual(original);
});

it("rechecks loaded alternatives and knowable limits before export can start", async () => {
  const f = await fixture();
  const review = await prepareMovieExportReview(join(f.root, "film.media.ts"), description, { for: ["32x32.mp4"] });
  expect(() => review.retainSource({ value: video({ fps: 25, duration: "2f", variants: { newVariant: {} }, render: () => null as never }), bundle: { code: "changed source" } })).toThrow(/explicitly selected/);
  const large = await prepareMovieExportReview(join(f.root, "film.media.ts"), description, { for: ["7680x4320.mp4"] });
  expect(() => large.retainSource({ value: video({ fps: 25, duration: "2f", render: () => null as never }), bundle: { code: "source" } })).toThrow(/limits/);
});

it("removes an unpublished capture when cancellation follows capture creation", async () => {
  const f = await fixture();
  const { prepareMovieExportReview: prepare } = await import("@foxworth/superimg-node/review/advanced");
  const controller = new AbortController();
  const capture = join(f.root, "capture");
  const review = await prepare(join(f.root, "film.media.ts"), description, { for: ["32x32.mp4"] }, {
    createReviewCapture: async () => {
      await mkdir(capture);
      controller.abort();
      return { directory: capture, indexPath: join(f.root, "review.json") };
    },
  });
  review.retainSource({ value: video({ fps: 25, duration: "2f", render: () => null as never }), bundle: { code: "original" } });
  await expect(review.write(f.receipt, f.path, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  await expect(readFile(capture)).rejects.toMatchObject({ code: "ENOENT" });
});

it("retains capture when publication outcome is uncertain", async () => {
  const f = await fixture();
  const { prepareMovieExportReview: prepare } = await import("@foxworth/superimg-node/review/advanced");
  const capture = join(f.root, "capture-uncertain");
  const review = await prepare(join(f.root, "film.media.ts"), description, { for: ["32x32.mp4"] }, {
    createReviewCapture: async () => { await mkdir(capture); return { directory: capture, indexPath: join(f.root, "review.json") }; },
    publishProjectReview: async () => { throw new Error("publication outcome unknown"); },
  });
  review.retainSource({ value: video({ fps: 25, duration: "2f", render: () => null as never }), bundle: { code: "original" } });
  await expect(review.write(f.receipt, f.path)).rejects.toThrow("publication outcome unknown");
  expect((await readFile(join(capture, "review.json"))).byteLength).toBeGreaterThan(0);
});

it("captures an encoded delivery directly through the Node review operation", async () => {
  const f = await fixture();
  const { captureDeliveryReview } = await import("@foxworth/superimg-node/review");
  const value = video({ fps: 25, duration: "2f", render: () => null as never });
  const loaded = { value, source: { templatePath: join(f.root, "film.media.ts") }, bundle: { code: "direct source" } };
  const result = await captureDeliveryReview({ loaded: loaded as never, destination: "32x32.mp4", receipt: f.receipt, publicationPath: f.path });
  expect(result.packet.delivery?.sha256).toBe(f.receipt.manifest.renditions[0]!.sha256);
  expect(result.packet.visual.status).toBe("unreviewed");
  expect(result.packet.coverage.fullFrameCaptures).toBeGreaterThan(0);
});
