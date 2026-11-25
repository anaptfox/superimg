import { loadDataScriptWithIdentity } from "./data-loader.js";

//! Bounded review evidence for authored beats. Facts, probes, and craft are separate.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { JsonObject, MediaIRCapabilities, RuntimeTechnicalCoverage } from "@superimg/types";
import { canonicalizeToJson } from "@superimg/core";
import { observeReviewBeat, evaluateReviewAssertions, type ReviewAssertion } from "@superimg/core/review";
export { observeReviewBeat, evaluateReviewAssertions, type ReviewAssertion } from "@superimg/core/review";
import type { ReviewPlan, InspectReport as RuntimeInspectReport } from "@superimg/types";
import type { InspectTreeSnapshot } from "@superimg/core/validation";
export interface ReviewSample { at: string; frame: number; activePhase: string | null; tree?: InspectTreeSnapshot; pngPath?: string; error?: { message: string; code?: string } }
export interface ReviewReport { template: string; config: { width: number; height: number; fps: number; duration: number; totalFrames: number }; coordinates: { entryId?: string; editionId: string; variantId: string }; samples: ReviewSample[]; runtime: RuntimeInspectReport }


import { parseAtList, resolveAtSample, type AtSample } from "./review-clock.js";

const MAX_BEATS = 24;
const MAX_CHECKS = 128;
const MAX_CLIP_SECONDS = 3;
const MAX_TOTAL_CLIP_SECONDS = 8;

export interface LoadedReviewPlan {
  readonly path: string;
  readonly bundleHash: string;
  readonly plan: ReviewPlan;
}

export interface ReviewEvidence {
  readonly kind: "frame" | "crop" | "contact-sheet" | "clip" | "contrast-background" | "contrast-observation";
  readonly path: string;
  readonly sha256: string;
  readonly byteLength: number;
  /** Delivery derivatives name the exact encoded source and its frame indices. */
  readonly decodedFrom?: { readonly movieSha256: string; readonly frames: readonly number[] };
  /** Crops are authored canvas coordinates; extraction uses captured PNG pixels. */
  readonly crop?: {
    readonly authored: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    readonly pixels: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
    readonly capture: { readonly width: number; readonly height: number };
  };
}

export interface ReviewPacket {
  readonly schemaVersion: 1;
  readonly kind: "superimg-review-packet";
  readonly template: string;
  readonly reportPath: string;
  readonly selectionPath?: string;
  readonly sourceIdentity: { readonly mediaBundleHash: string; readonly valueDigest: string; readonly reviewBundleHash: string | null } | { readonly kind: "arrangement"; readonly inputDigest: string; readonly valueDigest: string; readonly producer: string };
  /** Captures are specific to data, selection, clock, resources and requested evidence. */
  readonly captureSelectionDigest: string;
  readonly delivery?: MovieReviewDelivery;
  readonly selection?: { readonly requestedSeconds: number; readonly origin: string; readonly clamped: boolean; readonly frame: number; readonly encodedSeconds: number };
  readonly config: ReviewReport["config"];
  readonly coordinates: ReviewReport["coordinates"];
  readonly technical: {
    readonly scope?: "encoded-delivery";
    readonly coverage?: RuntimeTechnicalCoverage;
    readonly status: "pass" | "fail";
    readonly findings: readonly { id?: string; code: string; severity: string; message: string; category?: string; details?: Readonly<JsonObject> }[];
  };
  readonly authored: { readonly status: "pass" | "fail" | "unverified"; readonly origin: "author-reported"; readonly checks: readonly ReviewAssertion[] };
  readonly visual: { readonly status: "unreviewed"; readonly reason: string };
  readonly coverage: {
    readonly sampledFrames: readonly number[];
    readonly fullFrameCaptures: number;
    readonly clips: number;
    readonly observations: number;
    readonly capabilities: MediaIRCapabilities | null;
    readonly capabilityIssueCount: number;
    readonly unverified: readonly string[];
  };
  readonly beats: readonly {
    id: string;
    label: string;
    requestedAt: string;
    resolved: { frame: number; seconds: number; timelineSeconds: number; progress: number };
    activePhase: string | null;
    treeCoverage?: NonNullable<ReviewSample["tree"]>["coverage"];
    observation?: JsonObject;
    observationError?: string;
    evidence: readonly ReviewEvidence[];
    clip?: { requestedRange: readonly [string, string]; startFrame: number; endFrameExclusive: number; sourceFrames: readonly number[]; fps: number; durationSeconds: number };
  }[];
  readonly evidence: readonly ReviewEvidence[];
}

export interface MovieReviewDelivery {
  readonly kind: "encoded-movie";
  readonly path: string;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly publication: { readonly targetId: string; readonly publicationId: string; readonly manifestDigest: string };
  readonly decoder: "mediabunny-node";
  readonly clock: { readonly fps: number; readonly totalFrames: number };
  readonly decodedFrames: readonly { readonly frame: number; readonly timestamp: number; readonly duration: number }[];
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function identifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) {
    throw new Error(`Review ${field} must be a stable id with at most 64 letters, numbers, '.', '_' or '-'`);
  }
}

/** Reject bad plans before rendering; author files are trusted first-party code. */
export function validateReviewPlan(value: unknown): ReviewPlan {
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.beats) || value.beats.length === 0 || value.beats.length > MAX_BEATS) {
    throw new Error(`Review plan requires schemaVersion: 1 and 1–${MAX_BEATS} beats`);
  }
  const ids = new Set<string>();
  for (const beat of value.beats) {
    if (!object(beat)) throw new Error("Review beat must be an object");
    identifier(beat.id, "beat id");
    if (ids.has(beat.id)) throw new Error(`Duplicate review beat id: ${beat.id}`);
    ids.add(beat.id);
    if (typeof beat.label !== "string" || beat.label.length === 0 || beat.label.length > 100) throw new Error(`Review beat ${beat.id} needs a label of 1–100 characters`);
    if (typeof beat.at !== "string" || parseAtList(beat.at).length !== 1) throw new Error(`Review beat ${beat.id} needs one time selector`);
    if (beat.range !== undefined) {
      if (!Array.isArray(beat.range) || beat.range.length !== 2 || !beat.range.every((at) => typeof at === "string" && parseAtList(at).length === 1)) throw new Error(`Review beat ${beat.id} range requires two time selectors`);
    }
    if (beat.crop !== undefined) {
      if (!object(beat.crop) || ![beat.crop.x, beat.crop.y, beat.crop.width, beat.crop.height].every((number) => finite(number) && Number.isInteger(number)) || Number(beat.crop.x) < 0 || Number(beat.crop.y) < 0 || Number(beat.crop.width) <= 0 || Number(beat.crop.height) <= 0) throw new Error(`Review beat ${beat.id} crop must have finite integer coordinates and positive dimensions`);
    }
  }
  if (value.observe !== undefined && typeof value.observe !== "function") throw new Error("Review observe must be a pure function");
  if (value.checks !== undefined) {
    if (!Array.isArray(value.checks) || value.checks.length > MAX_CHECKS) throw new Error(`Review checks must be an array of at most ${MAX_CHECKS}`);
    const checkIds = new Set<string>();
    for (const check of value.checks) {
      if (!object(check)) throw new Error("Review check must be an object");
      identifier(check.id, "check id");
      if (checkIds.has(check.id)) throw new Error(`Duplicate review check id: ${check.id}`);
      checkIds.add(check.id);
      if (typeof check.label !== "string" || check.label.length === 0 || check.label.length > 200) throw new Error(`Review check ${check.id} needs a label`);
      if (check.beat !== undefined && !ids.has(String(check.beat))) throw new Error(`Review check ${check.id} refers to an unknown beat`);
      if (typeof check.metric !== "string" || check.metric.length > 200 || !check.metric.split(".").every((part) => /^[a-zA-Z0-9_-]+$/.test(part) && !["__proto__", "prototype", "constructor"].includes(part))) throw new Error(`Review check ${check.id} needs a safe metric path`);
      if (check.min !== undefined && !finite(check.min) || check.max !== undefined && !finite(check.max)) throw new Error(`Review check ${check.id} bounds must be finite`);
      if (finite(check.min) && finite(check.max) && check.min > check.max) throw new Error(`Review check ${check.id} min exceeds max`);
      if (check.equals !== undefined && check.equals !== null && !["string", "number", "boolean"].includes(typeof check.equals) || typeof check.equals === "number" && !finite(check.equals)) throw new Error(`Review check ${check.id} equals must be a finite JSON primitive`);
      if (check.min === undefined && check.max === undefined && check.equals === undefined) throw new Error(`Review check ${check.id} needs min, max or equals`);
    }
  }
  return value as unknown as ReviewPlan;
}

/** Compile the companion and include imported helpers in its identity. */
export async function loadReviewPlan(templatePath: string, explicitPath?: string): Promise<LoadedReviewPlan | undefined> {
  const path = explicitPath === undefined ? templatePath.replace(/\.media\.[^.]+$/, ".review.ts") : resolve(dirname(templatePath), explicitPath);
  if (!existsSync(path)) {
    if (explicitPath !== undefined) throw new Error(`Review companion not found: ${path}`);
    return undefined;
  }
  const loaded = await loadDataScriptWithIdentity(path);
  return { path, bundleHash: loaded.bundleHash, plan: validateReviewPlan(loaded.value) };
}

export function reviewAtSamples(plan: ReviewPlan): AtSample[] {
  return plan.beats.flatMap((beat) => parseAtList(beat.at));
}

/** Generic evidence stays bounded; retain endpoints and spread paired handoffs. */
export function boundReviewSamples<T>(
  samples: readonly T[],
  frameOf: (sample: T) => number,
  boundaryFrames: readonly number[] = [],
): T[] {
  const byFrame = new Map(samples.map((sample) => [frameOf(sample), sample]));
  const frames = [...byFrame.keys()].sort((left, right) => left - right);
  if (frames.length <= MAX_BEATS) return frames.map((frame) => byFrame.get(frame)!);
  const selected = new Set([frames[0]!, frames.at(-1)!]);
  const distance = (frame: number): number => Math.min(...[...selected].map((chosen) => Math.abs(frame - chosen)));
  const groups = [...new Set(boundaryFrames)].sort((left, right) => left - right)
    .map((frame) => [frame - 1, frame].filter((candidate) => byFrame.has(candidate)))
    .filter((group) => group.length === 2);
  while (selected.size < MAX_BEATS) {
    const remaining = MAX_BEATS - selected.size;
    const candidates = groups.filter((group) => {
      const missing = group.filter((frame) => !selected.has(frame)).length;
      return missing > 0 && missing <= remaining;
    });
    // Prefer complete boundary pairs across the story. Sorted candidates break
    // equal-distance ties consistently; any remaining slot fills the widest gap.
    const group = candidates.reduce<number[] | undefined>((best, candidate) =>
      best === undefined || distance((candidate[0]! + candidate[1]!) / 2) > distance((best[0]! + best[1]!) / 2) ? candidate : best, undefined);
    if (group !== undefined) {
      group.forEach((frame) => selected.add(frame));
      continue;
    }
    const frame = frames.filter((candidate) => !selected.has(candidate))
      .reduce((best, candidate) => distance(candidate) > distance(best) ? candidate : best);
    selected.add(frame);
  }
  return frames.filter((frame) => selected.has(frame)).map((frame) => byFrame.get(frame)!);
}

export function resolveReviewClip(range: readonly [string, string], config: ReviewReport["config"]): { startFrame: number; endFrameExclusive: number; sourceFrames: number[]; fps: number; durationSeconds: number } {
  const start = resolveAtSample(parseAtList(range[0])[0]!, config).frame;
  const end = resolveAtSample(parseAtList(range[1])[0]!, config).frame;
  if (end <= start) throw new Error("Review clip range must advance by at least one frame");
  if ((end - start) / config.fps > MAX_CLIP_SECONDS) throw new Error(`Review clips are bounded to ${MAX_CLIP_SECONDS}s each`);
  const stride = Math.max(1, Math.ceil(config.fps / 15));
  const sourceFrames = Array.from({ length: Math.ceil((end - start) / stride) }, (_, index) => start + index * stride);
  const durationSeconds = (end - start) / config.fps;
  // Retain every chosen source pose; the exact rate closes the bounded clip
  // rather than extending a 25fps source's three-second range to 3.04s.
  return { startFrame: start, endFrameExclusive: end, sourceFrames, fps: sourceFrames.length / durationSeconds, durationSeconds };
}

export function validateReviewCoordinates(plan: ReviewPlan, config: ReviewReport["config"]): void {
  let seconds = 0;
  for (const beat of plan.beats) {
    resolveAtSample(parseAtList(beat.at)[0]!, config);
    if (beat.crop !== undefined && (beat.crop.x + beat.crop.width > config.width || beat.crop.y + beat.crop.height > config.height)) throw new Error(`Review crop ${beat.id} exceeds the authored frame`);
    if (beat.range !== undefined) {
      const clip = resolveReviewClip(beat.range, config);
      seconds += (clip.endFrameExclusive - clip.startFrame) / config.fps;
    }
  }
  if (seconds > MAX_TOTAL_CLIP_SECONDS) throw new Error(`Review clip ranges are bounded to ${MAX_TOTAL_CLIP_SECONDS}s in total`);
}

export function reviewSelectionDigest(input: {
  config: ReviewReport["config"];
  coordinates: ReviewReport["coordinates"];
  data: Record<string, unknown>;
  samples: readonly AtSample[];
  plan?: ReviewPlan;
  clips: boolean;
  renderedLayout: boolean;
  resources: Pick<ReviewReport["runtime"], "assets" | "fonts">;
}): string {
  return createHash("sha256").update(canonicalizeToJson({
    config: input.config, coordinates: input.coordinates, data: input.data,
    samples: input.samples.map((sample) => ({ requested: sample.label, ...resolveAtSample(sample, input.config) })),
    beats: input.plan?.beats ?? null, checks: input.plan?.checks ?? null, clips: input.clips, renderedLayout: input.renderedLayout,
    assets: input.resources.assets, fonts: input.resources.fonts,
  })).digest("hex");
}

export function reviewOutputDirectory(templatePath: string, mediaBundleHash: string, reviewBundleHash: string | undefined, captureSelectionDigest: string): string {
  const identity = createHash("sha256").update(`${mediaBundleHash}\n${reviewBundleHash ?? "no-companion"}\n${captureSelectionDigest}`).digest("hex").slice(0, 16);
  return join(dirname(templatePath), "output", ".superimg", "review", identity);
}

function evidence(path: string, kind: ReviewEvidence["kind"]): ReviewEvidence {
  const bytes = readFileSync(path);
  return { path, kind, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
}

function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function renderContactSheet(beats: ReviewPacket["beats"], path: string, config: ReviewReport["config"]): Promise<ReviewEvidence> {
  const sharp = (await import("sharp")).default;
  const width = Math.min(480, config.width);
  const height = Math.round(width * config.height / config.width);
  const labelHeight = 52, gap = 16, padding = 20, columns = Math.min(3, beats.length);
  const rows = Math.ceil(beats.length / columns);
  const inputs: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const [index, beat] of beats.entries()) {
    const full = beat.evidence.find((entry) => entry.kind === "frame");
    const left = padding + (index % columns) * (width + gap);
    const top = padding + Math.floor(index / columns) * (height + labelHeight + gap);
    if (full !== undefined) inputs.push({ input: await sharp(full.path).resize(width, height, { fit: "contain", background: "#111318" }).png().toBuffer(), left, top });
    const label = `${beat.resolved.seconds.toFixed(2)}s · f:${beat.resolved.frame} · ${beat.label}`;
    inputs.push({ input: Buffer.from(`<svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><text x="0" y="23" fill="#d7dce5" font-family="sans-serif" font-size="14">${xml(label.slice(0, 65))}</text><text x="0" y="43" fill="#9da8ba" font-family="sans-serif" font-size="12">${full ? "Full authored frame" : "Capture unavailable"} · craft awaits review</text></svg>`), left, top: top + height });
  }
  await sharp({ create: { width: padding * 2 + columns * width + (columns - 1) * gap, height: padding * 2 + rows * (height + labelHeight) + (rows - 1) * gap, channels: 4, background: "#090b10" } }).composite(inputs).png().toFile(path);
  return evidence(path, "contact-sheet");
}

/** Uses runtime PNG captures; clip time is local, source poses keep original frames. */
export async function writeReviewPacket(input: {
  report: ReviewReport;
  mediaBundleHash?: string;
  arrangementIdentity?: { inputDigest: string; producer: string };
  packetFilename?: string;
  findingRenditionId?: string;
  arrangementSelection?: NonNullable<ReviewPacket["selection"]>;
  captureSelectionDigest: string;
  capabilities?: MediaIRCapabilities;
  companion?: LoadedReviewPlan;
  plan?: ReviewPlan;
  outDir: string;
  data: Record<string, unknown>;
  clips: boolean;
  renderPng: (frame: number) => Promise<Uint8Array>;
  contrastEvidence?: { background: Uint8Array; observation: Uint8Array };
  delivery?: MovieReviewDelivery;
  signal?: AbortSignal;
  profileStage?: <T>(stage: string, work: () => Promise<T>) => Promise<T>;
}): Promise<ReviewPacket> {
  input.signal?.throwIfAborted();
  const { report, companion, outDir } = input;
  const profileStage = input.profileStage ?? (async <T>(_stage: string, work: () => Promise<T>): Promise<T> => work());
  if (input.arrangementIdentity === undefined && input.mediaBundleHash === undefined) throw new Error("Review requires a source identity");
  mkdirSync(outDir, { recursive: true });
  const plan: ReviewPlan = input.plan ?? companion?.plan ?? {
    schemaVersion: 1 as const,
    beats: boundReviewSamples(report.samples, (sample) => sample.frame)
      .map((sample, index) => ({ id: `sample-${index + 1}`, label: sample.activePhase ?? `Frame ${sample.frame}`, at: sample.at })),
  };
  validateReviewPlan(plan);
  validateReviewCoordinates(plan, report.config);
  const beats: Array<ReviewPacket["beats"][number]> = [];
  const checks: ReviewAssertion[] = [];
  const artifactFindings: Array<{ code: string; severity: "error"; message: string }> = [];
  const unverified: string[] = [];
  const captureCache = new Map<number, Buffer>();
  const png = async (frame: number): Promise<Buffer> => {
    input.signal?.throwIfAborted();
    const cached = captureCache.get(frame);
    if (cached !== undefined) return cached;
    if (input.delivery && !input.delivery.decodedFrames.some(item => item.frame === frame)) throw new Error(`No verified decoded movie frame ${frame}`);
    const bytes = Buffer.from(await input.renderPng(frame));
    input.signal?.throwIfAborted();
    captureCache.set(frame, bytes);
    return bytes;
  };
  const fromMovie = (frames: readonly number[]) => input.delivery === undefined ? {} : { decodedFrom: { movieSha256: input.delivery.sha256, frames } };
  for (const beat of plan.beats) {
    input.signal?.throwIfAborted();
    const at = parseAtList(beat.at)[0]!;
    const selected = resolveAtSample(at, report.config);
    const resolved = { ...selected, progress: report.config.totalFrames <= 1 ? 1 : selected.frame / (report.config.totalFrames - 1) };
    const timelineSeconds = resolved.timelineSeconds;
    const sample = report.samples.find((candidate) => candidate.frame === resolved.frame);
    const observed = observeReviewBeat(plan, { ...resolved, timelineSeconds, width: report.config.width, height: report.config.height, fps: report.config.fps, data: input.data });
    checks.push(...evaluateReviewAssertions(plan.checks ?? [], beat.id, observed.observation));
    if (observed.observationError !== undefined) unverified.push(`${beat.id}: ${observed.observationError}`);
    const files: ReviewEvidence[] = [];
    try {
      const path = join(outDir, `${beat.id}-f${resolved.frame}.png`);
      if (input.delivery === undefined && sample?.pngPath !== undefined) writeFileSync(path, readFileSync(sample.pngPath));
      else writeFileSync(path, await png(resolved.frame));
      files.push({ ...evidence(path, "frame"), ...fromMovie([resolved.frame]) });
      if (beat.crop !== undefined) {
        const cropPath = join(outDir, `${beat.id}-crop.png`);
        const sharp = (await import("sharp")).default;
        const metadata = await sharp(path).metadata();
        if (!metadata.width || !metadata.height) throw new Error("Captured PNG has no dimensions for authored crop mapping");
        const capture = { width: metadata.width, height: metadata.height };
        const scaleX = capture.width / report.config.width;
        const scaleY = capture.height / report.config.height;
        if (Math.abs(capture.width - report.config.width * scaleY) > 1 || Math.abs(capture.height - report.config.height * scaleX) > 1) throw new Error("Captured PNG aspect ratio does not match the authored canvas for crop mapping");
        // Round edges rather than dimensions; adjacent crops share a pixel edge.
        // Clamp rounding only: invalid authored rectangles are rejected above.
        const left = Math.max(0, Math.min(capture.width, Math.round(beat.crop.x * scaleX)));
        const top = Math.max(0, Math.min(capture.height, Math.round(beat.crop.y * scaleY)));
        const right = Math.max(left, Math.min(capture.width, Math.round((beat.crop.x + beat.crop.width) * scaleX)));
        const bottom = Math.max(top, Math.min(capture.height, Math.round((beat.crop.y + beat.crop.height) * scaleY)));
        const crop = { left, top, width: right - left, height: bottom - top };
        if (crop.width < 1 || crop.height < 1) throw new Error("Authored crop maps to an empty captured pixel rectangle");
        await sharp(path).extract(crop).png().toFile(cropPath);
        files.push({ ...evidence(cropPath, "crop"), ...fromMovie([resolved.frame]), crop: { authored: { ...beat.crop }, pixels: crop, capture } });
      }
    } catch (error) {
      input.signal?.throwIfAborted();
      const message = `${beat.id}: capture failed: ${error instanceof Error ? error.message : String(error)}`;
      unverified.push(message);
      artifactFindings.push({ code: "REVIEW_CAPTURE_FAILED", severity: "error", message });
    }
    let clip: ReviewPacket["beats"][number]["clip"];
    if (beat.range !== undefined && input.clips) {
      const range = resolveReviewClip(beat.range, report.config);
      try {
        const { NodeVideoEncoder } = await import("../internal.js");
        const sharp = (await import("sharp")).default;
        const encoder = new NodeVideoEncoder();
        const width = Math.min(640, report.config.width), height = Math.round(width * report.config.height / report.config.width);
        try {
          await encoder.init({ width, height, fps: range.fps, durationSeconds: range.durationSeconds, encoding: { format: "mp4" } });
          for (const [index, frame] of range.sourceFrames.entries()) {
            input.signal?.throwIfAborted();
            await profileStage("encoding.frame", async () => encoder.addFrame(await sharp(await png(frame)).resize(width, height).png().toBuffer(), index / range.fps));
          }
          const path = join(outDir, `${beat.id}-clip.mp4`);
          writeFileSync(path, await profileStage("encoding.finalize", () => encoder.finalize()));
          input.signal?.throwIfAborted();
          files.push({ ...evidence(path, "clip"), ...fromMovie(range.sourceFrames) });
          clip = { requestedRange: beat.range, ...range };
        } finally { await encoder.dispose(); }
      } catch (error) {
        input.signal?.throwIfAborted();
        const message = `${beat.id}: clip failed: ${error instanceof Error ? error.message : String(error)}`;
        unverified.push(message);
        artifactFindings.push({ code: "REVIEW_CLIP_FAILED", severity: "error", message });
      }
      // Bound retained image bytes independently of the number of ranges.
      captureCache.clear();
    }
    beats.push({ id: beat.id, label: beat.label, requestedAt: beat.at, resolved: { ...resolved, timelineSeconds }, activePhase: sample?.activePhase ?? null, ...(sample?.tree === undefined ? {} : { treeCoverage: sample.tree.coverage }), ...observed, evidence: files, ...(clip === undefined ? {} : { clip }) });
  }
  input.signal?.throwIfAborted();
  if (companion === undefined) unverified.push("No authored review companion; sampling generic inspection frames");
  if (plan.observe === undefined) unverified.push("No authored procedural observations");
  if (!input.clips && plan.beats.some((beat) => beat.range !== undefined)) unverified.push("Authored ranges have no motion evidence; add --review-clips");
  const capabilities = input.capabilities === undefined ? null : {
    ...input.capabilities,
    issues: input.capabilities.issues.slice(0, 64),
  };
  if (capabilities === null) unverified.push("IR capability coverage is unavailable");
  if (input.delivery) unverified.push("Delivery review decodes the published movie; source geometry/paint findings are not re-inspected from these pixels. Authored observations remain author-reported, and clips are re-encoded derivatives of selected decoded frames.");
  if (capabilities?.determinism === "unverified") unverified.push("IR determinism is unverified; selected captures and authored probes do not establish repeatability across every frame");
  if (capabilities?.motion === "none" && report.config.totalFrames > 1) unverified.push("IR records no instrumented motion; raw procedural motion may still be visible and requires authored observations or clip review");
  if ((input.capabilities?.issues.length ?? 0) > 64) unverified.push("Capability issue detail is limited to 64 entries; inspect the full IR for remaining issue details");
  const artifacts: ReviewEvidence[] = [];
  if (beats.length > 0) artifacts.push({ ...await renderContactSheet(beats, join(outDir, "contact-sheet.png"), report.config), ...fromMovie(beats.filter(beat => beat.evidence.some(item => item.kind === "frame")).map(beat => beat.resolved.frame)) });
  if (input.contrastEvidence) {
    for (const [name, kind, bytes] of [
      ["contrast-background.png", "contrast-background", input.contrastEvidence.background],
      ["contrast-observation.json", "contrast-observation", input.contrastEvidence.observation],
    ] as const) {
      input.signal?.throwIfAborted();
      const path = join(outDir, name);
      writeFileSync(path, bytes);
      artifacts.push(evidence(path, kind));
    }
  }
  input.signal?.throwIfAborted();
  const technicalFindings = [
    ...report.runtime.findings.map(({ code, severity, message, category, details }) => {
      const compact = compactFindingDetails(details);
      return { id: `${code}:${String(details?.nodeId ?? details?.nodePath ?? details?.path ?? "stage")}:${input.findingRenditionId ?? report.coordinates.editionId}`, code, severity, message, category, ...(Object.keys(compact).length ? { details: compact } : {}) };
    }),
    ...report.samples.flatMap((sample) => sample.error === undefined ? [] : [{ code: sample.error.code ?? "CAPTURE_FAILED", severity: "error", message: sample.error.message }]),
    ...artifactFindings,
  ];
  const packet: ReviewPacket = {
    schemaVersion: 1, kind: "superimg-review-packet", template: report.template, reportPath: join(outDir, input.packetFilename ?? "report.json"),
    sourceIdentity: input.arrangementIdentity === undefined ? { mediaBundleHash: input.mediaBundleHash!, valueDigest: report.runtime.programDigest, reviewBundleHash: companion?.bundleHash ?? null } : { kind: "arrangement", ...input.arrangementIdentity, valueDigest: report.runtime.programDigest },
    captureSelectionDigest: input.captureSelectionDigest,
    ...(input.delivery === undefined ? {} : { delivery: input.delivery }),
    ...(input.arrangementSelection === undefined ? {} : { selection: input.arrangementSelection }),
    config: report.config, coordinates: report.coordinates,
    technical: { ...(input.delivery ? { scope: "encoded-delivery" as const } : {}), status: technicalFindings.some((finding) => finding.severity === "error") ? "fail" : "pass", findings: technicalFindings, ...(report.runtime.coverage ? { coverage: report.runtime.coverage } : {}) },
    authored: { origin: "author-reported", status: checks.some((check) => check.status === "fail") ? "fail" : checks.length > 0 && checks.every((check) => check.status === "pass") ? "pass" : "unverified", checks },
    visual: { status: "unreviewed", reason: "Geometry and authored probes do not establish framing, readability or motion craft; review the linked frames and clips" },
    coverage: { sampledFrames: [...new Set(beats.map((beat) => beat.resolved.frame))], fullFrameCaptures: beats.filter((beat) => beat.evidence.some((entry) => entry.kind === "frame")).length, clips: beats.filter((beat) => beat.clip !== undefined).length, observations: beats.filter((beat) => beat.observation !== undefined).length, capabilities, capabilityIssueCount: input.capabilities?.issues.length ?? 0, unverified },
    beats, evidence: artifacts,
  };
  input.signal?.throwIfAborted();
  writeFileSync(packet.reportPath, JSON.stringify(packet, null, 2));
  return packet;
}

/** Keep measured evidence in the packet without copying arbitrary source trees. */
function compactFindingDetails(details: Readonly<JsonObject> | undefined): JsonObject {
  const allowed = ["nodeId", "nodePath", "frame", "ratio", "minimum", "evidence", "observedLines", "expectedLines", "observedHeightFraction", "minimumHeightFraction", "ancestorId", "clippedX", "clippedY", "width", "height", "reason", "requestedSeconds", "resolvedSeconds"];
  const result: JsonObject = {};
  for (const key of allowed) {
    const value = details?.[key];
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)) || (typeof value === "string" && value.length <= 256)) result[key] = value;
  }
  return result;
}

export * from "./arrangement-review.js";
export * from "./arrangement-selection.js";
export * from "./arrangement-pixels.js";
export * from "./arrangement-layout.js";
export * from "./arrangement-contrast.js";
export * from "./movie-review.js";
export * from "./data-loader.js";
export * from "./find-project-root.js";
export * from "./project-review-store.js";

export { captureValueReview, captureSourceReview, captureLoadedSourceReview, captureDeliveryReview, type CaptureReviewOptions, type OwnedReviewEvidence } from "./review-operation.js";
