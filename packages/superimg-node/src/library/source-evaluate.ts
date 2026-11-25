//! One projection-safe evaluation path for deterministic media and singular interactive media.

import { basename, dirname, resolve as resolvePath } from "node:path";
import { realpathSync } from "node:fs";
import { bundleMediaProgram } from "@superimg/core/bundler";
import {
  applyTemplateResolve,
  compileTemplate,
  hashBytes,
  normalizeSourceId,
  parseDuration,
  createPreparedStdlibForTemplate,
  resolveMediaIR,
  textMeasurerForDeclarations,
  MediaIRError,
  type MediaIRFrameCapture,
} from "@superimg/core";
import { renderTemplateFrame } from "@superimg/core/testing";
import { assertPreparedRuntimeReport, type PreparedRuntimeReport } from "@superimg/core/runtime";
import type {
  JsonObject,
  MediaDefinition,
  MediaIR,
  RetainedComposition,
  TemplateModule,
} from "@superimg/types";
import { inspectIRAssets } from "./ir-assets.js";
import { resolveRenderConfig } from "./template-config.js";
import { bundleInteractiveOfflineProgram } from "./interactive-offline.js";
import type { LoadedNodeMediaValue } from "./source.js";

function realpath(path: string): string {
  try {
    return realpathSync(resolvePath(path));
  } catch {
    return resolvePath(path);
  }
}

export interface IrEvalConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
  totalFrames: number;
}

export interface IrEvalResult {
  mode: "ir" | "runtime-fallback";
  fallbackReason?: string;
  ir?: MediaIR;
  template: TemplateModule;
  resolvedData: Record<string, unknown>;
  config: IrEvalConfig;
  programHash: string;
  programCode: string;
  captures?: Map<number, MediaIRFrameCapture>;
  entryId?: string;
  variantId: string;
  editionId: string;
}

export interface EvaluateTemplateIROptions {
  data?: Record<string, unknown>;
  entry?: string;
  /** Command-owned snapshot prevents one provider execution per rendition/check. */

  captureFrames?: number[];
  captureProgresses?: number[];
  /** Resolve encoded seconds only after authored data/resolve changes the clock. */
  captureSeconds?: number[];
  verify?: boolean;
  sourceId?: string;
  edition?: string;
  variant?: string;
  signal?: AbortSignal;
  /** Internal already-compiled command value; prevents source/provider reloads. */
  loaded: LoadedNodeMediaValue;
  /** Native command-owned resolution; the CLI keeps its own IR source identity. */
  preparedReport?: PreparedRuntimeReport;
}

function configFromIR(ir: MediaIR): IrEvalConfig {
  return {
    width: ir.canvas.width,
    height: ir.canvas.height,
    fps: ir.clock.fps,
    duration: ir.clock.durationSeconds,
    totalFrames: ir.clock.totalFrames,
  };
}

function configFromResolved(template: TemplateModule & { readonly composition?: RetainedComposition }): IrEvalConfig {
  const config = template.config ?? {};
  const fps = config.fps ?? 30;
  const duration = config.duration == null
    ? resolveRenderConfig({ templateConfig: config }).duration
    : parseDuration(config.duration, "duration", fps);
  return {
    width: config.width ?? 1920,
    height: config.height ?? 1080,
    fps,
    duration,
    totalFrames: template.composition?.schedule.totalFrames ?? Math.max(1, Math.ceil(duration * fps)),
  };
}

async function runtimeFallback(
  template: TemplateModule,
  programCode: string,
  programHash: string,
  options: EvaluateTemplateIROptions,
  reason: string,
  coordinates: Pick<IrEvalResult, "entryId" | "variantId" | "editionId">,
): Promise<IrEvalResult> {
  const applied = options.preparedReport?.analysis.selections[0]?.preparedResolve ?? await applyTemplateResolve(template, {
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  });
  const config = configFromResolved(applied.template);
  const preparedStdlib = await createPreparedStdlibForTemplate(applied.template);
  const measurer = await textMeasurerForDeclarations(applied.template.config?.fonts, options.signal);
  const captures = new Map<number, MediaIRFrameCapture>();
  const frames = selectedFrames(config, options);
  for (const frame of frames) {
    options.signal?.throwIfAborted();
    const rendered = renderTemplateFrame({
      template: applied.template,
      frame,
      fps: config.fps,
      durationSeconds: config.duration,
      totalFrames: config.totalFrames,
      width: config.width,
      height: config.height,
      data: applied.data,
      composite: false,
      preparedStdlib,
      ...(measurer !== undefined ? { measurer } : {}),
    });
    captures.set(frame, {
      html: rendered.html,
      lane: rendered.lane,
      ...(rendered.tree !== undefined ? { tree: rendered.tree } : {}),
    });
  }
  return {
    mode: "runtime-fallback",
    fallbackReason: reason,
    template: applied.template,
    resolvedData: applied.data,
    config,
    programHash,
    programCode,
    ...(captures.size ? { captures } : {}),
    ...coordinates,
  };
}

function selectedFrames(config: IrEvalConfig, options: EvaluateTemplateIROptions): Set<number> {
  const frames = new Set<number>();
  for (const value of options.captureFrames ?? []) {
    frames.add(Math.max(0, Math.min(config.totalFrames - 1, Math.floor(value))));
  }
  for (const value of options.captureProgresses ?? []) {
    const progress = Math.max(0, Math.min(1, value));
    frames.add(config.totalFrames <= 1 ? 0 : Math.round(progress * (config.totalFrames - 1)));
  }
  for (const seconds of options.captureSeconds ?? []) {
    if (!Number.isFinite(seconds)) throw new Error("Capture seconds must be finite");
    frames.add(Math.max(0, Math.min(config.totalFrames - 1, Math.round(seconds * config.fps))));
  }
  return frames;
}

export async function evaluatePreparedSourceIR(
  options: EvaluateTemplateIROptions,
): Promise<IrEvalResult> {
  options.signal?.throwIfAborted();
  const absolutePath = realpath(options.loaded.source.templatePath);
  if (options.preparedReport !== undefined) {
    if (options.loaded === undefined) throw new Error("Prepared IR analysis requires its command-owned loaded source");
    assertPreparedRuntimeReport(options.preparedReport, options.preparedReport.runtime, options.loaded.value, {
      ...(options.data === undefined ? {} : { data: options.data as JsonObject }),
      ...(options.entry === undefined ? {} : { entryId: options.entry }),
      ...(options.variant === undefined ? {} : { variantId: options.variant }),
      ...(options.edition === undefined ? {} : { editionId: options.edition }),
      providers: "skip",
    });
  }
  const snapshot = {
    descriptor: options.loaded.descriptor,
    ...(options.loaded.snapshot === undefined ? {} : { entries: options.loaded.snapshot.entries }),
  };
  if (snapshot.descriptor.kind !== "collection" && options.entry !== undefined) throw new Error("--entry is only valid for deterministic collections");
  const collectionEntry = options.entry === undefined
    ? snapshot.entries?.[0]
    : snapshot.entries?.find((entry) => entry.id === options.entry);
  if (snapshot.descriptor.kind === "collection" && !collectionEntry) {
    throw new Error(`Unknown collection entry ${JSON.stringify(options.entry)}`);
  }
  if (snapshot.descriptor.kind === "collection" && options.data !== undefined) {
    throw new Error("--data cannot replace deterministic collection entries; use --entry");
  }

  let bundle = options.loaded?.bundle ?? await bundleMediaProgram(absolutePath);
  const compiled = options.loaded?.compiled ?? compileTemplate(bundle);
  if (compiled.error) throw compiled.error;
  let media: MediaDefinition<JsonObject>;
  if (compiled.interactive) {
    if (compiled.interactive.sample === undefined) {
      throw new Error("Offline interactive inspection requires explicit sample/default data");
    }
    bundle = await bundleInteractiveOfflineProgram(absolutePath);
    const lowered = compileTemplate(bundle);
    if (lowered.error || !lowered.media) {
      throw lowered.error ?? new Error("Interactive definition could not lower for offline inspection");
    }
    media = lowered.media as MediaDefinition<JsonObject>;
  } else if (compiled.media) {
    const loadedValue = options.loaded?.value;
    media = (
      loadedValue?.kind === "collection"
        ? loadedValue.media
        : loadedValue?.kind === "media"
          ? loadedValue
          : compiled.media
    ) as MediaDefinition<JsonObject>;
  } else {
    throw new Error("Media source did not compile to an inspectable definition");
  }


  const editionId = options.edition ?? "default";
  if (editionId !== "default") {
    const edition = media.editions?.[editionId];
    if (!edition) throw new Error(`Unknown media edition ${JSON.stringify(editionId)}`);
    media = {
      ...media,
      render: (edition.render ?? media.render) as MediaDefinition<JsonObject>["render"],
      config: { ...media.config, width: edition.size.width, height: edition.size.height },
    };
  }

  const variantId = options.variant ?? "default";
  const variant = variantId === "default" ? undefined : media.variants?.[variantId];
  if (variantId !== "default" && !variant) {
    throw new Error(`Unknown media variant ${JSON.stringify(variantId)}`);
  }
  const baseData = collectionEntry?.data
    ?? (options.data !== undefined
      ? { ...((media.sample ?? {}) as JsonObject), ...(options.data as JsonObject) }
      : ((media.sample ?? {}) as JsonObject));
  const data = { ...baseData, ...(variant ?? {}) } as JsonObject;
  media = { ...media, sample: data };

  const template = media as unknown as TemplateModule;
  const programHash = hashBytes(bundle.code);
  const inspected = inspectIRAssets(absolutePath, template);
  const coordinates = {
    ...(collectionEntry !== undefined ? { entryId: collectionEntry.id } : {}),
    variantId,
    editionId,
  };
  try {
    const result = await resolveMediaIR(template, {
      ...(options.preparedReport?.analysis.selections[0]?.preparedResolve === undefined ? {} : {
        preparedResolve: options.preparedReport.analysis.selections[0]!.preparedResolve,
      }),
      sourceId: options.sourceId ?? normalizeSourceId(basename(absolutePath)),
      programHash,
      ...(options.captureFrames !== undefined ? { captureFrames: options.captureFrames } : {}),
      ...(options.captureProgresses !== undefined ? { captureProgresses: options.captureProgresses } : {}),
      verify: options.verify === true,
      additionalAssets: inspected.additionalAssets,
      additionalIssues: inspected.additionalIssues,
      sourceDir: dirname(absolutePath),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
    const config = configFromIR(result.ir);
    const captures = new Map(
          [...(result.captures ?? [])].map(([frame, capture]) => [
            frame,
            {
              html: capture.html,
              ...(capture.tree !== undefined ? { tree: capture.tree } : {}),
              ...(capture.lane !== undefined ? { lane: capture.lane } : {}),
            },
          ]),
        );
    const missing = [...selectedFrames(config, options)].filter((frame) => !captures.has(frame));
    if (missing.length > 0) {
      // Reuse the already-resolved media and data. A second resolve could
      // observe different provider state and give the requested time a new clock.
      const preparedStdlib = await createPreparedStdlibForTemplate(result.template);
      const measurer = await textMeasurerForDeclarations(result.template.config?.fonts, options.signal);
      for (const frame of missing) {
        options.signal?.throwIfAborted();
        const rendered = renderTemplateFrame({
          template: result.template, frame, fps: config.fps,
          durationSeconds: config.duration, totalFrames: config.totalFrames,
          width: config.width, height: config.height, data: result.data,
          composite: false, preparedStdlib,
          ...(measurer === undefined ? {} : { measurer }),
        });
        captures.set(frame, {
          html: rendered.html, lane: rendered.lane,
          ...(rendered.tree === undefined ? {} : { tree: rendered.tree }),
        });
      }
    }
    return {
      mode: "ir",
      ir: result.ir,
      template: result.template,
      resolvedData: result.data,
      config,
      programHash,
      programCode: bundle.code,
      ...(captures.size > 0 ? { captures } : {}),
      ...coordinates,
    };
  } catch (error) {
    if (!(error instanceof MediaIRError) || String(error.code) !== "runtime_fallback") throw error;
    return runtimeFallback(template, bundle.code, programHash, options, error.message, coordinates);
  }
}
