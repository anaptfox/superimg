import { randomUUID } from "node:crypto";
import { lstat, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { inspectEncodedMedia } from "../narration-probe.js";
import type { MediaInspection } from "@superimg/types";
import { hashJson } from "./provider.js";

export type NarrationPlan = Readonly<{
  schemaVersion: 1;
  kind: "narration-plan";
  mode: "natural" | "fixed";
  fps: number;
  totalFrames: number;
  durationSeconds: number;
  segments: readonly Readonly<{ id: string; startFrame: number; endFrame: number; startSeconds: number; endSeconds: number; speechStartSeconds: number; speechDurationSeconds: number; paddingSeconds: number }>[];
  phases: Readonly<Record<string, string>>;
  audio: Readonly<{ clips?: readonly unknown[] }>;
  findings: readonly unknown[];
}>;
import { sha256, validateWavPcm } from "./speech/wav.js";

export interface PreparedNarrationAsset {
  readonly id: string;
  readonly src: string;
  readonly sha256: string;
  readonly metadata: Readonly<{
    sampleRate: number;
    channels: number;
    bitsPerSample: 8 | 16 | 24 | 32;
    sampleFrames: number;
    durationSeconds: number;
  }>;
  readonly provenance: unknown;
}

export interface PreparedNarrationManifest {
  readonly schemaVersion: 1;
  readonly kind: "prepared-narration";
  readonly recipeHash: string;
  readonly recipe?: unknown;
  readonly plan: NarrationPlan;
  readonly assets: readonly PreparedNarrationAsset[];
}

export interface NarrationReviewFinding {
  readonly severity: "error" | "warning";
  readonly code: string;
  readonly message: string;
  readonly assetId?: string;
  readonly segmentId?: string;
}

export interface NarrationAudioReview {
  readonly id: string;
  readonly src: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly metadata: ReturnType<typeof validateWavPcm>;
  readonly declaredMetadata: PreparedNarrationAsset["metadata"];
  readonly peak: number;
  readonly rms: number;
  readonly clippingSamples: number;
  readonly clipping: boolean;
  readonly provenance: unknown;
}

export interface NarrationReviewReport {
  readonly schemaVersion: 1;
  readonly kind: "narration-review";
  readonly manifest: {
    readonly path: "narration.json";
    readonly sha256: string;
    readonly recipeHash: string;
    readonly recipeHashValid: boolean;
    readonly recipeHashMatches?: boolean;
  };
  readonly plan: NarrationPlan;
  readonly audio: readonly NarrationAudioReview[];
  readonly findings: readonly NarrationReviewFinding[];
  readonly metrics: {
    readonly peak: number;
    readonly rms: number;
    readonly clippingSamples: number;
    readonly lufs: null;
  };
}

export interface NarrationExportReview extends NarrationReviewReport {
  readonly encoded: {
    readonly path: string;
    readonly sha256: string;
    readonly byteLength: number;
    readonly inspection: MediaInspection;
    readonly audioLevels: null;
    readonly findings: readonly NarrationReviewFinding[];
  };
}

export type NarrationReviewOptions = Readonly<{ signal?: AbortSignal }>;
export type NarrationWriteOptions = Readonly<{ signal?: AbortSignal; encodedPath?: string }>;

export async function verifyNarrationExport(
  preparedDirectory: string,
  encodedPath: string,
  options: NarrationReviewOptions = {},
): Promise<NarrationExportReview> {
  const report = await reviewPreparedNarration(preparedDirectory, options);
  const path = resolve(encodedPath);
  const bytes = await readRegularFile(path, options.signal);
  const inspection = await inspectEncodedMedia(bytes, options.signal);
  const findings: NarrationReviewFinding[] = [];
  if (!/^[a-f0-9]{64}$/u.test(inspection.sha256)) {
    findings.push({ severity: "error", code: "ENCODED_HASH_INVALID", message: "Encoded artifact hash is invalid" });
  }
  const video = inspection.tracks.filter((track) => track.kind === "video");
  const audioTracks = inspection.tracks.filter((track) => track.kind === "audio");
  if (video.length === 0) findings.push({ severity: "error", code: "ENCODED_VIDEO_TRACK_MISSING", message: "Encoded artifact has no video track" });
  if (report.plan.audio.clips !== undefined && report.plan.audio.clips.length > 0 && audioTracks.length === 0) {
    findings.push({ severity: "error", code: "ENCODED_AUDIO_TRACK_MISSING", message: "Encoded artifact has no audio track for the prepared narration plan" });
  }
  if (inspection.durationSeconds !== undefined) {
    const tolerance = Math.max(0.05, 2 / report.plan.fps);
    if (Math.abs(inspection.durationSeconds - report.plan.durationSeconds) > tolerance) {
      findings.push({ severity: "error", code: "ENCODED_DURATION_MISMATCH", message: `Encoded duration ${inspection.durationSeconds.toFixed(3)}s differs from the plan by more than ${tolerance.toFixed(3)}s` });
    }
  }
  return Object.freeze({
    ...report,
    findings: Object.freeze([...report.findings, ...findings]),
    encoded: Object.freeze({ path, sha256: sha256(bytes), byteLength: bytes.byteLength, inspection, audioLevels: null, findings: Object.freeze(findings) }),
  });
}

export async function reviewPreparedNarration(
  directory: string,
  options: NarrationReviewOptions = {},
): Promise<NarrationReviewReport> {
  const root = await realDirectory(directory);
  const manifestPath = confinedPath(root, "narration.json");
  const manifestBytes = await readOwnedFile(manifestPath, root, options.signal);
  const manifestHash = sha256(manifestBytes);
  const manifest = parseManifest(manifestBytes);
  const findings: NarrationReviewFinding[] = [];
  const audio: NarrationAudioReview[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();

  const recipeHashValid = /^[a-f0-9]{64}$/u.test(manifest.recipeHash);
  const recipeHashMatches = manifest.recipe === undefined
    ? undefined
    : recipeHashValid && hashJson(manifest.recipe) === manifest.recipeHash;
  if (!recipeHashValid) {
    findings.push({ severity: "error", code: "INVALID_RECIPE_HASH", message: "recipeHash must be a lowercase SHA-256 digest" });
  }
  if (recipeHashMatches === false) {
    findings.push({ severity: "error", code: "RECIPE_HASH_MISMATCH", message: "recipeHash does not match the prepared recipe" });
  }
  for (const asset of manifest.assets) {
    throwIfAborted(options.signal);
    if (seenIds.has(asset.id)) {
      findings.push({ severity: "error", code: "DUPLICATE_ASSET_ID", assetId: asset.id, message: `Duplicate narration asset id ${JSON.stringify(asset.id)}` });
      continue;
    }
    seenIds.add(asset.id);
    let assetPath: string;
    try {
      assetPath = confinedPath(root, asset.src);
      if (seenPaths.has(assetPath)) {
        findings.push({ severity: "error", code: "DUPLICATE_ASSET_PATH", assetId: asset.id, message: `Narration assets reuse path ${JSON.stringify(asset.src)}` });
        continue;
      }
      seenPaths.add(assetPath);
      const bytes = await readOwnedFile(assetPath, root, options.signal);
      const actualHash = sha256(bytes);
      if (actualHash !== asset.sha256) {
        findings.push({ severity: "error", code: "AUDIO_HASH_MISMATCH", assetId: asset.id, message: `Audio bytes do not match declared sha256 for ${JSON.stringify(asset.src)}` });
      }
      const metadata = validateWavPcm(bytes);
      compareMetadata(asset, metadata, findings);
      const levels = pcmLevels(bytes, metadata);
      audio.push(Object.freeze({
        id: asset.id,
        src: asset.src,
        sha256: actualHash,
        bytes: bytes.byteLength,
        metadata,
        declaredMetadata: asset.metadata,
        ...levels,
        provenance: asset.provenance,
      }));
    } catch (error) {
      findings.push({ severity: "error", code: "AUDIO_REVIEW_FAILED", assetId: asset.id, message: errorMessage(error) });
    }
  }
  const peak = audio.reduce((value, item) => Math.max(value, item.peak), 0);
  const rms = audio.length === 0 ? 0 : Math.sqrt(audio.reduce((value, item) => value + item.rms ** 2, 0) / audio.length);
  const clippingSamples = audio.reduce((value, item) => value + item.clippingSamples, 0);
  return Object.freeze({
    schemaVersion: 1,
    kind: "narration-review",
    manifest: Object.freeze({ path: "narration.json", sha256: manifestHash, recipeHash: manifest.recipeHash, recipeHashValid, ...(recipeHashMatches === undefined ? {} : { recipeHashMatches }) }),
    plan: manifest.plan,
    audio: Object.freeze(audio),
    findings: Object.freeze(findings),
    metrics: Object.freeze({ peak, rms, clippingSamples, lufs: null }),
  });
}

export function writeNarrationReview(
  directory: string,
  options: NarrationWriteOptions & { encodedPath: string },
): Promise<NarrationExportReview>;
export function writeNarrationReview(
  directory: string,
  options?: NarrationWriteOptions,
): Promise<NarrationReviewReport>;
export async function writeNarrationReview(
  directory: string,
  options: NarrationWriteOptions = {},
): Promise<NarrationReviewReport | NarrationExportReview> {
  const initialReport = options.encodedPath === undefined
    ? await reviewPreparedNarration(directory, options)
    : await verifyNarrationExport(directory, options.encodedPath, options);
  const root = await realDirectory(directory);
  const report = options.encodedPath === undefined
    ? initialReport
    : await copyEncodedArtifact(root, options.encodedPath, initialReport as NarrationExportReview, options.signal);
  const jsonPath = resolve(root, "review.json");
  const htmlPath = resolve(root, "review.html");
  const jsonTemp = `${jsonPath}.tmp-${randomUUID()}`;
  const htmlTemp = `${htmlPath}.tmp-${randomUUID()}`;
  try {
    throwIfAborted(options.signal);
    await writeFile(jsonTemp, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    await writeFile(htmlTemp, renderReviewHtml(report), { flag: "wx" });
    throwIfAborted(options.signal);
    await rename(jsonTemp, jsonPath);
    await rename(htmlTemp, htmlPath);
    return report;
  } catch (error) {
    await Promise.all([rm(jsonTemp, { force: true }), rm(htmlTemp, { force: true })]);
    throw error;
  }
}

async function copyEncodedArtifact(
  root: string,
  sourcePath: string,
  report: NarrationExportReview,
  signal: AbortSignal | undefined,
): Promise<NarrationExportReview> {
  const bytes = await readRegularFile(resolve(sourcePath), signal);
  const copiedHash = sha256(bytes);
  if (copiedHash !== report.encoded.sha256) {
    throw new Error(`Encoded artifact changed while preparing review: expected ${report.encoded.sha256}, got ${copiedHash}`);
  }
  const extension = extensionForMime(report.encoded.inspection.mimeType);
  const relativeName = `encoded-${report.encoded.sha256}.${extension}`;
  const destination = resolve(root, relativeName);
  const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? undefined : Promise.reject(error));
  if (existing?.isSymbolicLink()) throw new Error(`Encoded review destination cannot be a symlink: ${destination}`);
  const temporary = `${destination}.tmp-${randomUUID()}`;
  try {
    throwIfAborted(signal);
    await writeFile(temporary, bytes, { flag: "wx" });
    throwIfAborted(signal);
    await rename(temporary, destination);
    const published = await readFile(destination, signal === undefined ? undefined : { signal });
    if (sha256(published) !== report.encoded.sha256) {
      throw new Error(`Published encoded review bytes do not match verification hash at ${destination}`);
    }
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return Object.freeze({
    ...report,
    encoded: Object.freeze({ ...report.encoded, path: relativeName }),
  });
}

function extensionForMime(mimeType: string): string {
  switch (mimeType.toLocaleLowerCase("en-US")) {
    case "video/mp4": return "mp4";
    case "video/webm": return "webm";
    case "video/quicktime": return "mov";
    case "audio/wav": return "wav";
    default: throw new Error(`Cannot publish encoded review artifact with unsupported MIME type ${JSON.stringify(mimeType)}`);
  }
}

function parseManifest(bytes: Uint8Array): PreparedNarrationManifest {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (error) {
    throw new Error(`Could not parse narration.json: ${errorMessage(error)}`);
  }
  if (value === null || typeof value !== "object") throw new Error("narration.json must contain an object");
  const manifest = value as Record<string, unknown>;
  if (manifest.schemaVersion !== 1 || manifest.kind !== "prepared-narration" || typeof manifest.recipeHash !== "string" || !Array.isArray(manifest.assets) || manifest.plan === null || typeof manifest.plan !== "object") {
    throw new Error("narration.json is not a schemaVersion 1 prepared-narration manifest");
  }
  return manifest as unknown as PreparedNarrationManifest;
}

function compareMetadata(asset: PreparedNarrationAsset, actual: ReturnType<typeof validateWavPcm>, findings: NarrationReviewFinding[]): void {
  const fields = ["sampleRate", "channels", "bitsPerSample", "sampleFrames", "durationSeconds"] as const;
  for (const field of fields) {
    if (asset.metadata[field] !== actual[field]) {
      findings.push({ severity: "error", code: "AUDIO_METADATA_MISMATCH", assetId: asset.id, message: `Audio ${field} does not match the prepared manifest` });
    }
  }
}

function pcmLevels(bytes: Uint8Array, metadata: ReturnType<typeof validateWavPcm>): { peak: number; rms: number; clippingSamples: number; clipping: boolean } {
  const data = findData(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bytesPerSample = metadata.bitsPerSample / 8;
  let sum = 0;
  let peak = 0;
  let clippingSamples = 0;
  const samples = metadata.sampleFrames * metadata.channels;
  for (let index = 0; index < samples; index++) {
    const offset = data + index * bytesPerSample;
    const raw = readSample(view, offset, metadata.bitsPerSample);
    const normalized = metadata.bitsPerSample === 8 ? (raw - 128) / 128 : raw / (2 ** (metadata.bitsPerSample - 1));
    const magnitude = Math.abs(normalized);
    peak = Math.max(peak, magnitude);
    sum += normalized * normalized;
    if (metadata.bitsPerSample === 8 ? raw === 0 || raw === 255 : raw === -(2 ** (metadata.bitsPerSample - 1)) || raw === 2 ** (metadata.bitsPerSample - 1) - 1) clippingSamples++;
  }
  return { peak, rms: samples === 0 ? 0 : Math.sqrt(sum / samples), clippingSamples, clipping: clippingSamples > 0 };
}

function findData(bytes: Uint8Array): number {
  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset + 4, true);
    if (Buffer.from(bytes.subarray(offset, offset + 4)).toString("ascii") === "data") return offset + 8;
    offset += 8 + size + (size % 2);
  }
  throw new Error("Speech WAV data chunk is missing");
}

function readSample(view: DataView, offset: number, bits: 8 | 16 | 24 | 32): number {
  if (bits === 8) return view.getUint8(offset);
  if (bits === 16) return view.getInt16(offset, true);
  if (bits === 32) return view.getInt32(offset, true);
  const value = view.getUint8(offset) | view.getUint8(offset + 1) << 8 | view.getUint8(offset + 2) << 16;
  return value & 0x800000 ? value - 0x1000000 : value;
}

function renderReviewHtml(report: NarrationReviewReport | NarrationExportReview): string {
  const nav = report.plan.segments.map((segment) => `<button type="button" data-target="segment-${escapeHtml(segment.id)}">${escapeHtml(segment.id)}</button>`).join("\n");
  const sections = report.audio.map((asset) => `<article id="segment-${escapeHtml(asset.id)}"><h2>${escapeHtml(asset.id)}</h2><p>Peak ${asset.peak.toFixed(6)} · RMS ${asset.rms.toFixed(6)} · ${asset.clippingSamples} clipped samples</p><audio controls preload="metadata" src="${escapeHtml(asset.src)}"></audio><p><a download href="${escapeHtml(asset.src)}">Download WAV</a> · SHA-256 <code>${escapeHtml(asset.sha256)}</code></p></article>`).join("\n");
  const findings = report.findings.length === 0 ? "<p>No findings.</p>" : `<ul>${report.findings.map((finding) => `<li data-severity="${finding.severity}">${escapeHtml(finding.code)}: ${escapeHtml(finding.message)}</li>`).join("\n")}</ul>`;
  const encoded = "encoded" in report
    ? `<section><h2>Encoded export</h2><video id="encoded-export" controls preload="metadata" src="${escapeHtml(report.encoded.path)}"></video><p><a download href="${escapeHtml(report.encoded.path)}">Download encoded export</a> · SHA-256 <code>${escapeHtml(report.encoded.sha256)}</code></p></section>`
    : "";
  const segmentTimes = report.plan.segments.map((segment) => `<button type="button" data-target="segment-${escapeHtml(segment.id)}" data-time="${segment.startSeconds}">${escapeHtml(segment.id)}</button>`).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>Narration review</title><style>body{font:16px system-ui;max-width:70rem;margin:2rem auto;padding:0 1rem}button{margin:.2rem;padding:.4rem .7rem}article{border-top:1px solid #ccc;padding:1rem 0}li[data-severity="error"]{color:#a00}audio,video{display:block;margin:.8rem 0;max-width:100%}</style><h1>Narration review</h1><p>Manifest SHA-256: <code>${report.manifest.sha256}</code></p><nav>${segmentTimes}</nav>${encoded}<section><h2>Findings</h2>${findings}</section>${sections}<script>document.querySelectorAll('button[data-target]').forEach(button=>button.addEventListener('click',()=>{document.getElementById(button.dataset.target).scrollIntoView();const video=document.getElementById('encoded-export');if(video&&button.dataset.time)video.currentTime=Number(button.dataset.time)}))</script>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

async function realDirectory(directory: string): Promise<string> {
  const path = resolve(directory);
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Narration review directory must be a regular directory: ${path}`);
  return realpath(path);
}

async function readOwnedFile(path: string, root: string, signal: AbortSignal | undefined): Promise<Uint8Array> {
  throwIfAborted(signal);
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Narration asset must be a regular non-symlink file: ${path}`);
  const canonical = await realpath(path);
  if (!isContained(root, canonical)) throw new Error(`Narration asset must stay inside the prepared directory: ${path}`);
  const bytes = new Uint8Array(await readFile(canonical, signal === undefined ? undefined : { signal }));
  throwIfAborted(signal);
  return bytes;
}

async function readRegularFile(path: string, signal: AbortSignal | undefined): Promise<Uint8Array> {
  throwIfAborted(signal);
  const metadata = await lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Encoded media must be a regular non-symlink file: ${path}`);
  const bytes = new Uint8Array(await readFile(path, signal === undefined ? undefined : { signal }));
  throwIfAborted(signal);
  return bytes;
}

function confinedPath(root: string, value: string): string {
  if (!value || isAbsolute(value) || value.includes("\\") || value.includes("\0") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) throw new Error(`Narration asset path must be a relative local path: ${JSON.stringify(value)}`);
  const path = resolve(root, value);
  if (!isContained(root, path)) throw new Error(`Narration asset path must stay inside the prepared directory: ${JSON.stringify(value)}`);
  return path;
}

function isContained(root: string, candidate: string): boolean {
  const back = relative(root, candidate);
  return back !== ".." && !back.startsWith(`..${sep}`) && !isAbsolute(back);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("Aborted", "AbortError");
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
