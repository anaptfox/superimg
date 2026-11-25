//! Native delivery review: one retained source, one published movie, no rerender.
import { createHash } from "node:crypto";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonicalizeToJson, resolveMediaIR, resolveRuntimeTemplateInfo } from "@superimg/core";
import { assertPortableArtifactPath, selectMediaDefinition } from "@superimg/core/runtime";
import { resolveDestinationTarget, type DestinationTarget } from "@superimg/core/destinations";
import type { TemplateModule } from "@superimg/types";
import { decodeNodeMovieFrames, assertMovieReviewSelection } from "../runtime/movie-review.js";
import { createReviewCapture, publishProjectReview } from "./project-review-store.js";
import { loadReviewPlan } from "./review.js";
import type { LoadedNodeMediaValue } from "./source.js";
type MediaExportReceipt = { targetId: string; publicationId: string; manifestDigest: string; manifest: unknown };
type MediaSourceDescription = { sourceKind: "media" | "collection" | "interactive"; animated: boolean; variantIds: readonly string[]; editionIds: readonly string[] };
type ExportOptions = { for: string[]; dryRun?: boolean; at?: string | number; poster?: boolean; entry?: string[]; variant?: string[]; edition?: string[] };
import type { ExportManifest, ReviewPlan } from "@superimg/types";


import { parseAtList, resolveAtSample } from "./review-clock.js";
import { derivePhasesFromIR } from "./ir-phases.js";
import { resolveReviewClip, validateReviewCoordinates, writeReviewPacket, type ReviewPacket, type LoadedReviewPlan, type ReviewReport } from "./review.js";


const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const digest = (value: unknown) => hash(Buffer.from(canonicalizeToJson(value as never)));

function unsupported(message: string): never { throw Object.assign(new Error(message), { code: "UNSUPPORTED_SELECTION" }); }

function movieReviewCanvas(target: DestinationTarget | undefined): { width: number; height: number } | undefined {
  if (!target) return undefined;
  if (target.kind === "custom") {
    const format = target.format ?? "mp4";
    if (format !== "mp4" && format !== "webm") return undefined;
    return { width: target.width, height: target.height };
  }
  const format = target.destination.encoding.video?.format.value;
  if (format !== "mp4" && format !== "webm") return undefined;
  return target.destination.recommendedCanvas.value;
}

async function phaseHoldPlan(media: TemplateModule): Promise<ReviewPlan | undefined> {
  try {
    const resolved = await resolveMediaIR(media, { sourceId: "movie-review" });
    const phases = derivePhasesFromIR(resolved.ir).allPhases;
    if (phases.length === 0) return undefined;
    return {
      schemaVersion: 1,
      beats: phases.map((phase) => {
        const progress = Number(((phase.start + phase.end) / 2).toFixed(6));
        return { id: `hold-${phase.name}`, label: `${phase.name} hold`, at: String(progress) };
      }),
    };
  } catch {
    return undefined;
  }
}

export async function prepareMovieExportReview(template: string, description: Pick<MediaSourceDescription, "sourceKind" | "animated" | "variantIds" | "editionIds">, options: ExportOptions, dependencies: { loadReviewPlan?: (template: string) => Promise<LoadedReviewPlan | undefined>; createReviewCapture?: typeof createReviewCapture; decodeMovie?: typeof decodeNodeMovieFrames; publishProjectReview?: typeof publishProjectReview } = {}) {
  const target = options.for.length === 1 ? resolveDestinationTarget(options.for[0]!) : undefined;
  const canvas = movieReviewCanvas(target);
  if (!canvas) unsupported("Movie --review requires one video destination: WIDTHxHEIGHT[.mp4|.webm] or a catalog id such as youtube or tiktok");
  if (description.sourceKind === "collection" || !description.animated || options.dryRun || options.at !== undefined || options.poster || options.entry?.length || (options.variant?.length ?? 0) > 1 || (options.edition?.length ?? 0) > 1) unsupported("Movie --review requires one animated authored source and selection, without --at, --poster, --entry or --dry-run");
  if ((!options.variant?.length && description.variantIds.some(id => id !== "default")) || (!options.edition?.length && description.editionIds.some(id => id !== "default"))) unsupported("Movie --review requires an explicit --variant and/or --edition when the source declares alternatives");
  const companion = await (dependencies.loadReviewPlan ?? loadReviewPlan)(template);
  let retained: { config: ReviewReport["config"]; plan: ReviewPlan; frames: number[]; data: Record<string, unknown>; mediaBundleHash: string; media: TemplateModule } | undefined;
  return {
    retainSource(loaded: { value: LoadedNodeMediaValue["value"]; bundle: Pick<LoadedNodeMediaValue["bundle"], "code"> }) {
      if (loaded.value.kind === "collection" || loaded.value.kind === "interactive") unsupported("Movie --review requires a deterministic authored source");
      if (!loaded.value.animated || (!options.variant?.length && Object.keys(loaded.value.variants ?? {}).length) || (!options.edition?.length && Object.keys(loaded.value.editions ?? {}).length)) unsupported("Movie --review requires an animated source with one explicitly selected variant/edition");
      const selected = selectMediaDefinition(loaded.value, { ...(options.variant?.[0] ? { variantId: options.variant[0] } : {}), ...(options.edition?.[0] ? { editionId: options.edition[0] } : {}) });
      if (selected.resolve !== undefined) unsupported("Movie --review does not yet retain dynamically resolved observation data");
      const info = resolveRuntimeTemplateInfo(selected);
      const config = Object.freeze({ width: canvas.width, height: canvas.height, fps: info.fps, totalFrames: info.totalFrames, duration: info.totalFrames / info.fps });
      const plan: ReviewPlan = companion?.plan ?? { schemaVersion: 1, beats: parseAtList(undefined).map((at, index) => ({ id: `sample-${index + 1}`, label: `Movie frame at ${at.label}`, at: at.label })) };
      validateReviewCoordinates(plan, config);
      const frames = [...new Set(plan.beats.flatMap(beat => [resolveAtSample(parseAtList(beat.at)[0]!, config).frame, ...(beat.range ? resolveReviewClip(beat.range, config).sourceFrames : [])]))].sort((a, b) => a - b);
      assertMovieReviewSelection(config, frames);
      retained = { config, plan, frames, data: structuredClone(info.data), mediaBundleHash: hash(Buffer.from(loaded.bundle.code)), media: selected as TemplateModule };
    },
    async write(receipt: MediaExportReceipt, publicationPath: string, signal?: AbortSignal) {
      const source = retained;
      if (!source) throw new Error("Export did not retain its loaded source identity");
      const renditions = (receipt.manifest as { renditions: unknown }).renditions as unknown as readonly { path: string; mimeType: string; sha256: string; bytes: number; coordinates: { variantId: string; editionId: string; renditionId: string } }[];
      if (renditions?.length !== 1 || !["video/mp4", "video/webm"].includes(renditions[0]!.mimeType)) throw new Error("Review expected exactly one published movie");
      const rendition = renditions[0]!;
      const moviePath = join(publicationPath, assertPortableArtifactPath(rendition.path));
      const bytes = await readBoundedReviewFile(moviePath, rendition.bytes, signal);
      const runtime = (receipt.manifest as { runtime: unknown }).runtime as unknown as ExportManifest;
      const { config, data } = source;
      let { plan, frames } = source;
      if (!companion) {
        const holds = await phaseHoldPlan(source.media);
        if (holds) {
          validateReviewCoordinates(holds, config);
          plan = holds;
          frames = [...new Set(holds.beats.flatMap(beat => [resolveAtSample(parseAtList(beat.at)[0]!, config).frame, ...(beat.range ? resolveReviewClip(beat.range, config).sourceFrames : [])]))].sort((a, b) => a - b);
          assertMovieReviewSelection(config, frames);
        }
      }
      const captureSelectionDigest = digest({ subject: rendition, source: source.mediaBundleHash, valueDigest: runtime.programDigest, config, data, plan: plan.beats, companion: companion?.bundleHash ?? null, assets: runtime.assets, fonts: runtime.fonts, decoder: "mediabunny-node-cfr-v1" });
      const temp = await mkdtemp(join(tmpdir(), "superimg-movie-review-"));
      let captureDirectory: string | undefined;
      let publicationStarted = false;
      try {
        const decodedFrames: { frame: number; timestamp: number; duration: number }[] = [];
        for await (const decoded of (dependencies.decodeMovie ?? decodeNodeMovieFrames)({ bytes, byteLength: rendition.bytes, sha256: rendition.sha256, clock: config, frames, ...(signal ? { signal } : {}) })) {
          await writeFile(join(temp, `${decoded.frame}.png`), decoded.png);
          decodedFrames.push({ frame: decoded.frame, timestamp: decoded.timestamp, duration: decoded.duration });
        }
        signal?.throwIfAborted();
        const capture = await (dependencies.createReviewCapture ?? createReviewCapture)(template, rendition.coordinates.editionId);
        const outDir = capture.directory;
        captureDirectory = outDir;
        // Keep the exact reviewed bytes with the evidence. A later export may
        // replace the publication path while this capture remains inspectable.
        const retainedMoviePath = join(outDir, rendition.mimeType === "video/mp4" ? "movie.mp4" : "movie.webm");
        await writeFile(retainedMoviePath, bytes, { flag: "wx" });
        signal?.throwIfAborted();
        const report = {
          schemaVersion: 0, template, evaluationMode: "runtime", config, phases: null,
          samples: plan.beats.map(beat => ({ at: beat.at, ...resolveAtSample(parseAtList(beat.at)[0]!, config), activePhase: null, phaseLocal: null, htmlBytes: 0, text: [], colors: [], eqKeys: [], waitLabels: [], cameraScale: null })),
          coordinates: { variantId: rendition.coordinates.variantId, editionId: rendition.coordinates.editionId },
          runtime: { schemaVersion: 0 as const, programDigest: runtime.programDigest, kind: "video" as const, coordinates: [], findings: [], assets: runtime.assets, fonts: runtime.fonts },
        };
        const packet = await writeReviewPacket({ report, mediaBundleHash: source.mediaBundleHash, captureSelectionDigest, packetFilename: "review.json", ...(companion ? { companion } : {}), data, clips: true, outDir, ...(signal ? { signal } : {}),
          delivery: { kind: "encoded-movie", path: retainedMoviePath, mimeType: rendition.mimeType, sha256: rendition.sha256, byteLength: rendition.bytes,
            publication: { targetId: receipt.targetId, publicationId: receipt.publicationId, manifestDigest: receipt.manifestDigest }, decoder: "mediabunny-node", clock: { fps: config.fps, totalFrames: config.totalFrames }, decodedFrames },
          renderPng: async frame => { const file = await open(join(temp, `${frame}.png`)); try { return await file.readFile(); } finally { await file.close(); } },
        });
        await assertMovieReviewCurrent(packet, captureSelectionDigest, signal);
        signal?.throwIfAborted();
        publicationStarted = true;
        const published = await (dependencies.publishProjectReview ?? publishProjectReview)(capture.indexPath, { kind: "movie", coordinates: rendition.coordinates, config, data, plan: { beats: plan.beats, checks: plan.checks ?? [], companionDigest: companion?.bundleHash ?? null }, mimeType: rendition.mimeType }, packet, signal);
        const evidence = [...packet.evidence, ...packet.beats.flatMap(beat => beat.evidence)];
        return { packet: published, artifacts: [{ kind: "movie", path: moviePath, mimeType: rendition.mimeType, sha256: rendition.sha256, bytes: rendition.bytes },
          ...evidence.map(item => ({ kind: item.kind, path: item.path, sha256: item.sha256, bytes: item.byteLength, ...(item.decodedFrom ? { decodedFrom: item.decodedFrom } : {}) }))] };
      } finally {
        await rm(temp, { recursive: true, force: true });
        // Once publication starts, an index may already refer to this capture.
        if (captureDirectory !== undefined && !publicationStarted) await rm(captureDirectory, { recursive: true, force: true });
      }
    },
  };
}

/** Reusing a delivery review requires both the movie and its retained evidence. */
export async function assertMovieReviewCurrent(packet: ReviewPacket, expectedCaptureSelectionDigest: string, signal?: AbortSignal): Promise<void> {
  if (!packet.delivery || packet.captureSelectionDigest !== expectedCaptureSelectionDigest) throw Object.assign(new Error("Review subject or source/selection identity is stale"), { code: "REVIEW_MOVIE_STALE" });
  for (const item of [{ path: packet.delivery.path, sha256: packet.delivery.sha256, byteLength: packet.delivery.byteLength }, ...packet.evidence, ...packet.beats.flatMap(beat => beat.evidence)]) {
    const bytes = await readBoundedReviewFile(item.path, item.byteLength, signal);
    if (bytes.byteLength !== item.byteLength || hash(bytes) !== item.sha256) throw Object.assign(new Error("Movie review evidence is stale"), { code: "REVIEW_MOVIE_STALE" });
  }
}

/** Open once and read only the receipt's bounded length, including a growth check. */
async function readBoundedReviewFile(path: string, expectedLength: number, signal?: AbortSignal): Promise<Uint8Array> {
  signal?.throwIfAborted();
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 0 || expectedLength > 512 * 1024 * 1024) throw Object.assign(new Error("Review file exceeds 512 MiB"), { code: "REVIEW_DECODE_LIMIT" });
  const file = await open(path, "r");
  try {
    if ((await file.stat()).size !== expectedLength) throw Object.assign(new Error("Review file length changed"), { code: "REVIEW_MOVIE_STALE" });
    const bytes = new Uint8Array(expectedLength);
    let position = 0;
    while (position < expectedLength) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(bytes, position, Math.min(64 * 1024, expectedLength - position), position);
      if (!bytesRead) throw Object.assign(new Error("Review file was truncated"), { code: "REVIEW_MOVIE_STALE" });
      position += bytesRead;
    }
    if ((await file.read(new Uint8Array(1), 0, 1, expectedLength)).bytesRead) throw Object.assign(new Error("Review file grew"), { code: "REVIEW_MOVIE_STALE" });
    signal?.throwIfAborted();
    return bytes;
  } finally { await file.close(); }
}
