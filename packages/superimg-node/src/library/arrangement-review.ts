//! Adapt a prepared arrangement to the existing review packet writer.
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalizeToJson } from "@superimg/core";
import { inspect, render } from "@superimg/core/runtime";
import type { ExportableMedia, ImageDefinition, VideoDefinition, Runtime } from "@superimg/types";

import { writeReviewPacket, type ReviewPacket } from "./review.js";
import { arrangementSelectionFindings } from "./arrangement-selection.js";
import { inspectArrangementPixels } from "./arrangement-pixels.js";
import { inspectArrangementLayout } from "./arrangement-layout.js";
import { inspectArrangementContrast, unverifiedArrangementContrast } from "./arrangement-contrast.js";
import type { InspectionPaintCapture } from "../runtime/index.js";
import sharp from "sharp";

export interface ArrangementReviewSelection {
  readonly inputDigest: string;
  readonly producer: string;
  readonly editionId: string;
  readonly renditionId: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly duration: number;
  readonly totalFrames: number;
  readonly frame: number;
  readonly encodedSeconds: number;
  readonly requestedSeconds: number;
  readonly origin: "explicit" | "pattern-poster" | "static";
  readonly clamped: boolean;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalizeToJson(value as never)).digest("hex");
}

/** A decision is usable only for the same selection and the same evidence bytes. */
export async function assertArrangementReviewCurrent(packet: ReviewPacket, expectedDigest: string): Promise<void> {
  if (packet.captureSelectionDigest !== expectedDigest || !("kind" in packet.sourceIdentity) || packet.sourceIdentity.kind !== "arrangement") throw new Error("Review evidence is stale");
  const evidence = [...packet.evidence, ...packet.beats.flatMap(beat => beat.evidence)];
  if (!evidence.length || packet.technical.status !== "pass" || packet.coverage.unverified.some(item => item.includes("capture failed"))) throw new Error("Review evidence is incomplete");
  for (const item of evidence) {
    const bytes = await readFile(item.path);
    if (bytes.byteLength !== item.byteLength || createHash("sha256").update(bytes).digest("hex") !== item.sha256) throw new Error("Review evidence is stale");
  }
}

export async function writeArrangementReview(input: {
  runtime: Runtime;
  media: ImageDefinition | VideoDefinition;
  sourcePath: string;
  outRoot: string;
  selection: ArrangementReviewSelection;
  paintCapture?: InspectionPaintCapture;
  signal?: AbortSignal;
  /** When reviewing a published still, capture exactly its retained bytes. */
  retainedPng?: Uint8Array;
}) {
  const { selection, media, runtime } = input;
  input.signal?.throwIfAborted();
  const selectionOptions = { ...(selection.editionId === "default" ? {} : { editionId: selection.editionId }), ...(input.signal ? { signal: input.signal } : {}), at: selection.encodedSeconds };
  const png = input.retainedPng ?? await (await render(runtime, media, { as: "png", ...selectionOptions, size: { width: selection.width, height: selection.height } })).bytes();
  const pngHash = createHash("sha256").update(png).digest("hex");
  // Inspection is explicitly qualified to this exact target canvas and edition.
  const sized = { ...media, config: { ...media.config, width: selection.width, height: selection.height },
    ...(selection.editionId === "default" || !media.editions ? {} : { editions: { ...media.editions, [selection.editionId]: { ...media.editions[selection.editionId], size: { width: selection.width, height: selection.height } } } }) } as ExportableMedia;
  const paint = input.paintCapture;
  if (paint) {
    const image = await sharp(png).metadata();
    const dpr = (image.width ?? 0) / selection.width;
    if (Number.isFinite(dpr) && dpr > 0 && dpr <= 4 && image.height === selection.height * dpr && (image.width ?? 0) * image.height <= 16_777_216) {
      paint.dpr = dpr; paint.enabled = true; delete paint.pair;
    }
  }
  let inspection: Awaited<ReturnType<typeof inspect>>;
  try { inspection = await inspect(runtime, sized, { ...selectionOptions, renderedLayout: true }); }
  finally { if (paint) paint.enabled = false; }
  const pixelFindings = await inspectArrangementPixels(png, selection.frame);
  const layoutFindings = inspectArrangementLayout(inspection.metadata, selection.frame);
  const contrast = paint?.pair ? await inspectArrangementContrast({ published: png, ...paint.pair, metadata: inspection.metadata, width: selection.width, height: selection.height, frame: selection.frame }) : { findings: [], measured: new Set<string>() };
  // Retain both the isolated background and the bounded browser observations
  // used to interpret it. The published frame is already retained by the packet.
  const contrastEvidence = paint?.pair && contrast.measured.size > 0 ? {
    background: paint.pair.background,
    observation: Buffer.from(canonicalizeToJson({ schemaVersion: 1, width: selection.width, height: selection.height, frame: selection.frame, metadata: inspection.metadata } as never)),
  } : undefined;
  if (paint) delete paint.pair;
  input.signal?.throwIfAborted();
  const priorFindings = inspection.findings.filter(finding => {
    if (finding.code !== "TEXT_PAINT_UNVERIFIED" || !finding.details || typeof finding.details !== "object") return true;
    const id = (finding.details as Record<string, unknown>).nodeId;
    return typeof id !== "string" || !contrast.measured.has(id);
  });
  const contrastUnverified = unverifiedArrangementContrast(inspection.metadata, contrast.measured, priorFindings, selection.frame);
  const observed = { ...inspection, findings: [...priorFindings, ...pixelFindings, ...layoutFindings, ...contrast.findings, ...contrastUnverified, ...arrangementSelectionFindings(selection)] };
  // Whole-CLI bytes are provenance, not review identity: unrelated command
  // changes must not invalidate identical pixels and measured selections.
  // Bump the rule-set version when review semantics change.
  const { producer: _producer, ...reviewSelection } = selection;
  const captureSelectionDigest = digest({ schemaVersion: 1, ruleSet: "arrangement-review-v10", selection: reviewSelection, assets: observed.assets, fonts: observed.fonts, pngHash, programDigest: observed.programDigest, contrastEvidence: contrastEvidence ? { background: createHash("sha256").update(contrastEvidence.background).digest("hex"), observation: createHash("sha256").update(contrastEvidence.observation).digest("hex") } : null });
  const config = { width: selection.width, height: selection.height, fps: selection.fps, duration: selection.duration, totalFrames: selection.totalFrames };
  const coordinates = { variantId: "default", editionId: selection.editionId };
  const sample = { at: `f:${selection.frame}`, frame: selection.frame, seconds: selection.encodedSeconds,
    progress: selection.totalFrames <= 1 ? 0 : selection.frame / (selection.totalFrames - 1), activePhase: null, phaseLocal: null,
    htmlBytes: 0, text: [], colors: [], eqKeys: [], waitLabels: [], cameraScale: null };
  const report = { schemaVersion: 0, template: input.sourcePath, evaluationMode: "runtime", config, coordinates, phases: null, samples: [sample], runtime: observed };
  const outDir = join(input.outRoot, captureSelectionDigest);
  const packet = await writeReviewPacket({ report, arrangementIdentity: { inputDigest: selection.inputDigest, producer: selection.producer }, arrangementSelection: { requestedSeconds: selection.requestedSeconds, origin: selection.origin, clamped: selection.clamped, frame: selection.frame, encodedSeconds: selection.encodedSeconds }, packetFilename: "review.json", findingRenditionId: selection.renditionId, captureSelectionDigest, outDir, data: {}, clips: false, ...(contrastEvidence ? { contrastEvidence } : {}), ...(input.signal ? { signal: input.signal } : {}), renderPng: async () => png });
  return { path: packet.reportPath, captureSelectionDigest, packet };
}
