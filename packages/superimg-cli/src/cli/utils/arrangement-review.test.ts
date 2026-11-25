import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
const reviewRuntime = vi.hoisted(() => ({ findings: [] as import("@superimg/types").RuntimeFinding[] }));
vi.mock("@superimg/core/runtime", async (importOriginal) => ({ ...(await importOriginal()),
  inspect: async () => ({ schemaVersion: 0, programDigest: "program", kind: "video", coordinates: [{ editionId: "default", variantId: "default" }], findings: reviewRuntime.findings, assets: [], fonts: [], metadata: { renderedLayout: [{ nodes: [] }] } }) }));
import { assertArrangementReviewCurrent, writeArrangementReview } from "./arrangement-review.js";
import type { ReviewPacket } from "./review-packet.js";

it("rejects changed selection and changed evidence bytes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "superimg-review-identity-"));
  try {
    const path = join(dir, "frame.png");
    const bytes = Buffer.from("captured pixels");
    await writeFile(path, bytes);
    const packet = { captureSelectionDigest: "selection-a", sourceIdentity: { kind: "arrangement", inputDigest: "input", producer: "p", valueDigest: "v" }, technical: { status: "pass" }, coverage: { unverified: [] }, beats: [{ evidence: [{ path, byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }] }], evidence: [] } as unknown as ReviewPacket;
    await expect(assertArrangementReviewCurrent(packet, "selection-a")).resolves.toBeUndefined();
    await expect(assertArrangementReviewCurrent(packet, "selection-b")).rejects.toThrow(/stale/);
    await writeFile(path, "changed pixels");
    await expect(assertArrangementReviewCurrent(packet, "selection-a")).rejects.toThrow(/stale/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("writes the retained PNG through the shared review packet without fake module identity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "superimg-review-packet-"));
  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: "white" } }).composite([{ input: Buffer.from([0, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 1, top: 1 }]).png().toBuffer();
    const selection = { inputDigest: "input", producer: "producer", editionId: "default", renditionId: "20x10.png", width: 20, height: 10, fps: 30, duration: 6, totalFrames: 180, frame: 120, encodedSeconds: 4, requestedSeconds: 4, origin: "explicit" as const, clamped: false };
    const result = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection, retainedPng: png });
    expect(result.packet.sourceIdentity).toEqual({ kind: "arrangement", inputDigest: "input", producer: "producer", valueDigest: "program" });
    expect(result.packet.visual.status).toBe("unreviewed");
    expect(result.packet.beats[0]?.evidence[0]?.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    await expect(assertArrangementReviewCurrent(result.packet, result.captureSelectionDigest)).resolves.toBeUndefined();
    const rebuilt = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection: { ...selection, producer: "unrelated-cli-rebuild" }, retainedPng: png });
    expect(rebuilt.captureSelectionDigest).toBe(result.captureSelectionDigest);
    expect(rebuilt.packet.sourceIdentity).toMatchObject({ producer: "unrelated-cli-rebuild" });
    const changed = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection: { ...selection, frame: 121, encodedSeconds: 121 / 30 }, retainedPng: png });
    await expect(assertArrangementReviewCurrent(result.packet, changed.captureSelectionDigest)).rejects.toThrow(/stale/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("records a blank published PNG as a failed technical finding with evidence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "superimg-review-blank-"));
  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: "white" } }).png().toBuffer();
    const selection = { inputDigest: "input", producer: "producer", editionId: "square", renditionId: "20x10.png", width: 20, height: 10, fps: 30, duration: 6, totalFrames: 180, frame: 120, encodedSeconds: 4, requestedSeconds: 4, origin: "explicit" as const, clamped: false };
    const result = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection, retainedPng: png });
    expect(result.packet.technical.status).toBe("fail");
    expect(result.packet.technical.findings).toContainEqual(expect.objectContaining({ code: "EMPTY_RENDERED_CANVAS", severity: "error" }));
    expect(result.packet.beats[0]?.evidence[0]?.sha256).toBe(createHash("sha256").update(png).digest("hex"));
    await expect(assertArrangementReviewCurrent(result.packet, result.captureSelectionDigest)).rejects.toThrow(/incomplete/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("retains a clamp warning and distinguishes requests that select identical pixels", async () => {
  const dir = await mkdtemp(join(tmpdir(), "superimg-review-clamp-"));
  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: "white" } }).composite([{ input: Buffer.from([0, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 1, top: 1 }]).png().toBuffer();
    const selection = { inputDigest: "input", producer: "producer:hash", editionId: "default", renditionId: "20x10.png", width: 20, height: 10, fps: 30, duration: 6, totalFrames: 180, frame: 179, encodedSeconds: 179 / 30, requestedSeconds: 99, origin: "explicit" as const, clamped: true };
    const late = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection, retainedPng: png });
    const packet = JSON.parse(await readFile(late.path, "utf8"));
    expect(packet.selection).toMatchObject({ requestedSeconds: 99, origin: "explicit", clamped: true, frame: 179 });
    expect(packet.technical.findings).toContainEqual(expect.objectContaining({ code: "STILL_TIME_CLAMPED", severity: "warning", id: "STILL_TIME_CLAMPED:stage:20x10.png" }));
    const exact = await writeArrangementReview({ runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection: { ...selection, requestedSeconds: 179 / 30, clamped: false }, retainedPng: png });
    expect(exact.captureSelectionDigest).not.toBe(late.captureSelectionDigest);
    expect(exact.packet.technical.findings.some(finding => finding.code === "STILL_TIME_CLAMPED")).toBe(false);
    expect(exact.packet.beats[0]?.evidence[0]?.sha256).toBe(late.packet.beats[0]?.evidence[0]?.sha256);
    await expect(assertArrangementReviewCurrent(late.packet, exact.captureSelectionDigest)).rejects.toThrow(/stale/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

it("keeps anonymous node findings distinct and stable when observations reorder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "superimg-review-finding-ids-"));
  try {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 20, height: 10, channels: 4, background: "white" } }).composite([{ input: Buffer.from([0, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 1, top: 1 }]).png().toBuffer();
    const selection = { inputDigest: "input", producer: "producer", editionId: "default", renditionId: "20x10.png", width: 20, height: 10, fps: 30, duration: 6, totalFrames: 180, frame: 120, encodedSeconds: 4, requestedSeconds: 4, origin: "explicit" as const, clamped: false };
    reviewRuntime.findings = ["0.1.2", "0.1.3"].map(nodePath => ({ code: "TEXT_PAINT_UNVERIFIED", severity: "warning", category: "render", message: "Unverified", details: { nodePath } }));
    const input = { runtime: {} as never, media: { config: {} } as never, sourcePath: "test.json", outRoot: dir, selection, retainedPng: png };
    const first = await writeArrangementReview(input);
    const ids = first.packet.technical.findings.map(f => f.id).sort();
    expect(ids).toEqual(["TEXT_PAINT_UNVERIFIED:0.1.2:20x10.png", "TEXT_PAINT_UNVERIFIED:0.1.3:20x10.png"]);
    reviewRuntime.findings.reverse();
    const second = await writeArrangementReview(input);
    expect(second.packet.technical.findings.map(f => f.id).sort()).toEqual(ids);
  } finally { reviewRuntime.findings = []; await rm(dir, { recursive: true, force: true }); }
});
