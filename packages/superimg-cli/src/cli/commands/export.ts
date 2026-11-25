//! Destination-first export CLI adapter over native direct media interactions.

import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parseDuration } from "@superimg/core";
import { assertPortableArtifactPath } from "@superimg/core/runtime";
import {
  MEDIA_INTERACTION_IDS,
  compileNodeMediaSource,
  MEDIA_COMPILED_INTERACTIONS,
  type MediaExportInteractionInput,
  type MediaExportReceipt,
  type MediaJsonObject,
  type MediaInteractionRequestFor,
  type MediaPublicationTarget,
  type MediaSourceDescription,
} from "@foxworth/superimg-interactions";
import { buildEncodingOptions } from "./render-encoding.js";
import { findProjectRoot } from "../utils/find-project-root.js";
import {
  createCliMediaInteractionSession,
  type CliMediaInteractionContext,
} from "../utils/media-interactions.js";
import { resolveTemplatePathOrSole } from "../utils/resolve-template.js";
import { commandResult } from "../utils/command-result.js";
import { isMediaFilename, warnIfMediaFilename } from "../utils/output-directory.js";
import { rememberExportTake } from "../takes/capture.js";

/** CLI-shaped policy. Source loading and publication remain host interactions. */
export interface ExportOptions {
  for: string[];
  entry?: string[];
  variant?: string[];
  edition?: string[];
  output?: string;
  /** Name the take this export records, such as "cut 3". */
  label?: string;
  poster?: boolean;
  at?: string | number;
  duration?: string;
  review?: boolean;
  dryRun?: boolean;
  json?: boolean;
  timeout?: string;
  providerTimeout?: string;
  rasterizer?: "playwright" | "blitz";
  preset?: string;
  quality?: string;
  alpha?: string;
  videoQuantizer?: string;
  videoCodec?: string;
  videoBitrate?: string;
  audioCodec?: string;
  audioBitrate?: string;
  keyframeInterval?: string;
  bitrateMode?: string;
  latencyMode?: string;
  hardwareAccel?: string;
  audioBitrateMode?: string;
  fastStart?: string;
  clusterDuration?: string;
  maxColors?: string;
  gifLoop?: string;
  gifDither?: string;
  dpr?: string;
  capture?: string;
  captureCache?: boolean;
  stillQuality?: string;
  lossless?: boolean;
  colorProfile?: string;
  deband?: string;
  debandStrength?: string;
  stillBitDepth?: string;
  /** Programmatic cancellation; not exposed as a Commander flag. */
  signal?: AbortSignal;
}

type ExportRequest = MediaInteractionRequestFor<typeof MEDIA_INTERACTION_IDS.export>;

export async function exportCommand(
  template: string | undefined,
  options: ExportOptions,
): Promise<MediaExportReceipt | undefined> {
  validateExportOptions(options);
  if (template?.toLowerCase().endsWith(".json")) {
    warnIfMediaFilename(options.output);
    const { classifyArrangement, exportArrangement } = await import("../utils/arrangement-input.js");
    const input = await classifyArrangement(template);
    if (input) {
      const result = await exportArrangement(template, options, input);
      print(options, result);
      return result;
    }
  }
  if (options.duration !== undefined) throw Object.assign(new Error("--duration is only supported for arrangements"), { code: "UNSUPPORTED_SELECTION" });

  const templatePath = resolveTemplatePathOrSole(template);
  const projectRoot = findProjectRoot(dirname(templatePath));
  const source = relative(projectRoot, templatePath).split(sep).join("/");
  const baseContext: CliMediaInteractionContext = {
    ...executionContext(options),
    ...(options.review ? { preparedSource: await compileNodeMediaSource(projectRoot, source, options.signal ? { signal: options.signal } : {}) } : {}),
  };
  const session = createCliMediaInteractionSession(projectRoot);

  try {
    const description = await session.mount.dispatch({
      interactionId: MEDIA_INTERACTION_IDS.describe,
      input: { source },
    }, baseContext);
    const movieReview = options.review
      ? await (await import("../utils/movie-export-review.js")).prepareMovieExportReview(templatePath, description, options)
      : undefined;
    const publication = publicationDestination(
      projectRoot,
      description.sourceId,
      options.output,
    );
    const context: CliMediaInteractionContext = {
      ...baseContext,
      ...(movieReview ? { retainExportSource: movieReview.retainSource } : {}),
      ...(publication.rootPath === undefined
        ? {}
        : { publicationRoot: publication.rootPath }),
    };

    // Dry run is deliberately only a truthful projection of the exact direct
    // request. It does not run a provider, runtime preflight, renderer, or
    // publisher and therefore is not presented as a grant proposal.
    if (options.dryRun) {
      const request = exportRequest(source, options, publication.target);
      print(options, {
        ...directDryRunProjection(request, description, publication.path) as Record<string, unknown>,
        ...(publication.copyTo === undefined ? {} : { file: publication.copyTo }),
      });
      return undefined;
    }

    const snapshot = description.sourceKind === "collection"
      ? await session.mount.dispatch({
          interactionId: MEDIA_INTERACTION_IDS.snapshot,
          input: { source },
        }, context)
      : undefined;
    const request = exportRequest(source, options, publication.target, snapshot);
    const receipt = await session.mount.dispatch(request, context);
    if (movieReview) {
      let review;
      let artifacts;
      try {
        const result = await movieReview.write(receipt, publication.path, options.signal);
        const sheet = result.packet.evidence.find((item) => item.kind === "contact-sheet");
        if (sheet) console.error(resolve(sheet.path));
        for (const line of result.packet.coverage.unverified) {
          if (line.includes("capture failed")) console.error(line);
        }
        artifacts = result.artifacts;
        const complete = result.packet.technical.status === "pass" && result.packet.coverage.fullFrameCaptures === result.packet.beats.length;
        review = { state: complete ? "completed" : "incomplete", path: result.packet.reportPath, selectionPath: result.packet.selectionPath, captureSelectionDigest: result.packet.captureSelectionDigest, technical: result.packet.technical.status, authored: result.packet.authored.status, visual: "unreviewed" };
        if (!complete || result.packet.authored.status === "fail") process.exitCode = 1;
      } catch (error) {
        review = { state: options.signal?.aborted ? "cancelled" : "failed", code: options.signal?.aborted ? "REVIEW_CANCELLED" : (error as { code?: string })?.code ?? "REVIEW_FAILED", message: error instanceof Error ? error.message : String(error) };
        process.exitCode = 1;
      }
      const file = await copySingleRendition(receipt, publication);
      const published = { ...receipt, path: publication.path, ...(file === undefined ? {} : { file }), publication: { state: "completed" }, review, ...(artifacts ? { artifacts } : {}) };
      const result = await attachTake(templatePath, description, receipt, publication, published, options.label);
      print(options, result);
      return result;
    }
    const file = await copySingleRendition(receipt, publication);
    const published = file === undefined ? receipt : { ...receipt, file };
    const result = await attachTake(templatePath, description, receipt, publication, published, options.label);
    print(options, result);
    return result;
  } finally {
    await session.dispose();
  }
}

function exportRequest(
  source: string,
  options: ExportOptions,
  publication: MediaPublicationTarget,
  snapshot?: MediaExportInteractionInput["snapshot"],
): ExportRequest {
  return {
    interactionId: MEDIA_INTERACTION_IDS.export,
    input: {
      source,
      publication,
      destinations: [...options.for],
      ...(options.entry?.length ? { entryIds: [...options.entry] } : {}),
      ...(options.variant?.length ? { variantIds: [...options.variant] } : {}),
      ...(options.edition?.length ? { editionIds: [...options.edition] } : {}),
      ...(snapshot === undefined ? {} : { snapshot }),
      ...(options.poster
        ? { stillFrame: { kind: "poster" as const } }
        : options.at === undefined
          ? {}
          : { stillFrame: { kind: "at" as const, at: options.at } }),
      ...(options.rasterizer === undefined
        ? {}
        : { rasterizer: options.rasterizer }),
      ...interactionEncoding(options),
    },
  };
}

export function publicationDestination(
  projectRoot: string,
  sourceId: string,
  output: string | undefined,
): Readonly<{
  target: MediaPublicationTarget;
  path: string;
  rootPath?: string;
  /** Set when -o names one media file. The receipt stays in `.superimg/exports`. */
  copyTo?: string;
}> {
  if (output !== undefined && isMediaFilename(output)) {
    const publicationId = `${sourceId}.export`;
    // Root stays the exports directory. A slashed source id is one path
    // segment under that root; dirname(path) would make the publisher join
    // the id a second time.
    const rootPath = resolve(projectRoot, ".superimg", "exports");
    const path = resolve(rootPath, publicationId);
    return Object.freeze({
      target: Object.freeze({
        targetId: "cli-publication",
        publicationId,
      }),
      path,
      rootPath,
      copyTo: resolve(output),
    });
  }
  if (output === undefined) {
    const publicationId = `${sourceId}.export`;
    return Object.freeze({
      target: Object.freeze({
        targetId: "project-output",
        publicationId,
      }),
      path: resolve(projectRoot, "output", publicationId),
    });
  }
  const path = resolve(output);
  return Object.freeze({
    target: Object.freeze({
      targetId: "cli-publication",
      publicationId: basename(path),
    }),
    path,
    rootPath: dirname(path),
  });
}

async function copySingleRendition(
  receipt: MediaExportReceipt,
  publication: { path: string; copyTo?: string },
): Promise<string | undefined> {
  if (publication.copyTo === undefined) return undefined;
  const renditions = receipt.manifest["renditions"];
  const paths = Array.isArray(renditions)
    ? renditions.flatMap((entry) => {
        if (entry !== null && typeof entry === "object" && "path" in entry && typeof entry.path === "string") return [entry.path];
        return [];
      })
    : [];
  if (paths.length !== 1) {
    throw Object.assign(
      new Error("--output names a media file, which requires exactly one rendition. Pass a directory when exporting multiple destinations or collection entries."),
      { code: "UNSUPPORTED_SELECTION" },
    );
  }
  const from = join(publication.path, assertPortableArtifactPath(paths[0]!));
  await mkdir(dirname(publication.copyTo), { recursive: true });
  await copyFile(from, publication.copyTo);
  return publication.copyTo;
}

function executionContext(options: ExportOptions): CliMediaInteractionContext {
  const timeoutMs = secondsToMilliseconds(options.timeout);
  const providerTimeoutMs = secondsToMilliseconds(
    options.providerTimeout ?? options.timeout,
  );
  return {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(providerTimeoutMs === undefined ? {} : { providerTimeoutMs }),
  };
}

function interactionEncoding(
  options: ExportOptions,
): { encoding?: MediaJsonObject } {
  const parsed = buildEncodingOptions(options);
  if (parsed === undefined) return {};
  const { format: _format, ...encoding } = parsed;
  return Object.keys(encoding).length === 0
    ? {}
    : { encoding: encoding as unknown as MediaJsonObject };
}

function secondsToMilliseconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds * 1_000)
    : undefined;
}

function directDryRunProjection(
  request: ExportRequest,
  description: MediaSourceDescription,
  path: string,
): unknown {
  const handle = MEDIA_COMPILED_INTERACTIONS.handles.export;
  return {
    schemaVersion: 1,
    kind: "media-interaction-projection",
    dryRun: true,
    mode: "direct",
    execution: "not-run",
    path,
    interaction: {
      programDigest: MEDIA_COMPILED_INTERACTIONS.program.programDigest,
      interactionId: handle.interactionId,
      contractDigest: handle.contractDigest,
      input: request.input,
    },
    deferred: {
      contractValidation: true,
      provider: description.sourceKind === "collection",
      runtimePreflight: true,
      rendering: true,
      publication: true,
    },
  };
}

function validateExportOptions(options: ExportOptions): void {
  if (options.at !== undefined) {
    try {
      const at = parseDuration(options.at, "--at");
      if (!Number.isFinite(at) || at < 0) throw new Error("--at must be non-negative and finite");
    } catch (error) {
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: "INVALID_TIME" });
    }
  }
  if (options.poster && options.at !== undefined) {
    throw Object.assign(new Error("Pass either --poster or --at, not both"), { code: "CONFLICTING_STILL_SELECTION" });
  }
  if (!options.for?.length) {
    throw Object.assign(new Error("Export requires at least one --for destination or custom size"), { code: "MISSING_DESTINATION" });
  }
  if (
    options.rasterizer !== undefined &&
    options.rasterizer !== "playwright" &&
    options.rasterizer !== "blitz"
  ) {
    throw new Error(
      `Unknown --rasterizer ${String(options.rasterizer)} (expected playwright | blitz)`,
    );
  }
}


async function attachTake<T extends object>(
  templatePath: string,
  description: MediaSourceDescription,
  receipt: MediaExportReceipt,
  publication: { path: string; copyTo?: string },
  result: T,
  label?: string,
): Promise<T & { take?: { id: string; path: string; label?: string } }> {
  try {
    const take = await rememberExportTake({
      templatePath,
      description,
      manifest: receipt.manifest,
      publicationPath: publication.path,
      ...(publication.copyTo === undefined ? {} : { copyTo: publication.copyTo }),
      ...(label?.trim() ? { label: label.trim() } : {}),
    });
    if (!take) return result;
    const named = take.record.label;
    console.error(named ? `take ${take.id}  "${named}"` : `take ${take.id}  unlabelled (name it with --label "cut 1")`);
    console.error(take.directory);
    return { ...result, take: { id: take.id, path: take.directory, ...(named ? { label: named } : {}) } };
  } catch (error) {
    console.error(`take not recorded: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

function print(options: ExportOptions, value: unknown): void {
  if (options.json) {
    const result = value as Record<string, unknown> & { review?: { state?: string; technical?: string; authored?: string; code?: string; message?: string } };
    const review = result.review;
    const ok = review === undefined || (review.state === "completed" && review.technical !== "fail" && review.authored !== "fail");
    process.stdout.write(`${JSON.stringify(commandResult(result, { ok, ...(ok ? {} : { code: review?.code ?? "REVIEW_FAILED", message: review?.message ?? "Publication completed, but its review did not pass." }) }))}\n`);
  }
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
