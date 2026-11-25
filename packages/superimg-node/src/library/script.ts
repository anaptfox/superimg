//! Script operations for editors: which films read a script, and where each
//! script block sits on a film's clock.
//!
//! The film owns the clock. These functions only report what the film
//! declares; they never compute a time from the script.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { parseSync } from "oxc-parser";
import { applyTemplateResolve, normalizeCues, parseDuration } from "@superimg/core";
import { filmScript, filmScriptHash, parseScript } from "@foxworth/superimg-script";
import type { TemplateModule } from "@superimg/types";
import { loadCollectionEntries } from "../collection/index.js";
import {
  discoverMediaSources,
  normalizeProjectRoot,
  resolveMediaSource,
  type ResolvedMediaSource,
} from "./project.js";
import { compileNodeMediaSource, type NodeMediaAuthoringOptions } from "./source.js";

const SCRIPT_SUFFIX = ".script.md";
const MODULE_SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", "/index.ts", "/index.js"];
/** A film's own import graph is small. This bounds a pathological project. */
const MAX_MODULES_PER_SOURCE = 400;

export class MediaScriptError extends Error {
  /** These operations only read. A refusal is a finished answer, not an unknown outcome. */
  readonly certainty = "completed";
  readonly certaintyScope = "command";
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MediaScriptError";
  }
}

export type MediaScriptSource = Readonly<{
  sourceId: string;
  relativePath: string;
}>;

export type MediaScriptSources = Readonly<{
  schemaVersion: 0;
  kind: "media-script-sources";
  /** Project-relative path of the script. */
  scriptPath: string;
  sources: readonly MediaScriptSource[];
}>;

export type MediaScriptCue = Readonly<{
  blockId: string;
  startSeconds: number;
  endSeconds: number;
  /** The moment that best shows the block. */
  stillSeconds: number;
  /** From this cue's start to the next cue's start. The last cue runs to the end. */
  costSeconds: number;
}>;

export type MediaScriptCueFinding = Readonly<{
  blockId: string;
  code: string;
  message: string;
}>;

export type MediaScriptCues = Readonly<{
  schemaVersion: 0;
  kind: "media-script-cues";
  sourceId: string;
  relativePath: string;
  /** Selected static collection entry id, present when the source is a collection(). */
  entryId?: string;
  programHash: string;
  /** Project-relative path of the script the film reads. */
  scriptPath: string;
  /** Hash of what the film sees in that script. */
  scriptHash: string;
  fps: number;
  durationSeconds: number;
  /** Cues for blocks the script has, ordered by start. */
  cues: readonly MediaScriptCue[];
  /** Script block ids the film publishes no cue for, in file order. */
  unplaced: readonly string[];
  /** Cue ids the script no longer has. */
  unknownCues: readonly string[];
  findings: readonly MediaScriptCueFinding[];
}>;

function insideRoot(root: string, file: string): boolean {
  const back = relative(root, file);
  return back !== "" && back !== ".." && !back.startsWith(`..${sep}`) && !isAbsolute(back);
}

function projectRelative(root: string, file: string): string {
  return relative(root, file).replaceAll(sep, "/");
}

/** Resolve a script path the caller gave (absolute, or relative to the root). */
function resolveScriptFile(root: string, scriptPath: string): string {
  if (!scriptPath.trim()) throw new MediaScriptError("INVALID_INPUT", "A script path is required.");
  const candidate = resolve(root, scriptPath);
  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    throw new MediaScriptError("SCRIPT_NOT_FOUND", `Script does not exist: ${scriptPath}`);
  }
  const file = realpathSync(candidate);
  if (!insideRoot(root, file)) {
    throw new MediaScriptError("SCRIPT_OUTSIDE_ROOT", `Script must be inside the project root: ${scriptPath}`);
  }
  if (!file.toLowerCase().endsWith(SCRIPT_SUFFIX)) {
    throw new MediaScriptError("NOT_A_SCRIPT", `A script file is named *${SCRIPT_SUFFIX}: ${scriptPath}`);
  }
  return file;
}

/** Relative specifiers a module imports, read from its syntax. No code runs. */
function relativeImports(file: string): string[] {
  let code: string;
  try {
    code = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const parsed = parseSync(file, code, { sourceType: "module" });
  const specifiers = new Set<string>();
  for (const item of parsed.module.staticImports) specifiers.add(item.moduleRequest.value);
  for (const item of parsed.module.staticExports) {
    for (const entry of item.entries) if (entry.moduleRequest) specifiers.add(entry.moduleRequest.value);
  }
  return [...specifiers].filter((specifier) => specifier.startsWith("."));
}

function resolveModuleFile(importer: string, specifier: string): string | null {
  const base = resolve(dirname(importer), specifier);
  for (const suffix of MODULE_SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return realpathSync(candidate);
  }
  return null;
}

/** Script files a media source imports, directly or through its local modules. */
function scriptsImportedBy(root: string, entry: string): Set<string> {
  const scripts = new Set<string>();
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0 && seen.size <= MAX_MODULES_PER_SOURCE) {
    const file = queue.shift()!;
    for (const specifier of relativeImports(file)) {
      const target = resolveModuleFile(file, specifier);
      if (!target || !insideRoot(root, target)) continue;
      if (target.toLowerCase().endsWith(SCRIPT_SUFFIX)) scripts.add(target);
      else if (/\.[cm]?[jt]sx?$/.test(target) && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return scripts;
}

/**
 * The media sources under `projectRoot` that import one script file.
 * Reads import syntax only. No film code is compiled or run, and nothing
 * outside the root is read.
 */
export function findScriptSources(projectRoot: string, scriptPath: string): MediaScriptSources {
  const root = normalizeProjectRoot(projectRoot);
  const script = resolveScriptFile(root, scriptPath);
  const sources: MediaScriptSource[] = [];
  for (const source of discoverMediaSources(root)) {
    if (scriptsImportedBy(root, realpathSync(source.entrypoint)).has(script)) {
      sources.push(Object.freeze({ sourceId: source.name, relativePath: source.relativePath }));
    }
  }
  return Object.freeze({
    schemaVersion: 0,
    kind: "media-script-sources",
    scriptPath: projectRelative(root, script),
    sources: Object.freeze(sources),
  });
}

const round = (seconds: number) => Math.round(seconds * 1e6) / 1e6;

/**
 * Where each script block sits on one film's clock. Compiles the film and runs
 * its `resolve()` once. Never renders a frame.
 */
export async function readScriptCues(
  projectRoot: string,
  requested: string | ResolvedMediaSource,
  options: NodeMediaAuthoringOptions & Readonly<{ signal?: AbortSignal; entryId?: string }> = {},
): Promise<MediaScriptCues> {
  const root = normalizeProjectRoot(projectRoot);
  const source = typeof requested === "string" ? resolveMediaSource(root, requested) : requested;
  const loaded = await compileNodeMediaSource(root, source, options);
  if (!loaded.compiled.media) {
    throw new MediaScriptError(
      "UNSUPPORTED_SOURCE",
      `Script cues need a deterministic video, image, or static collection source, not an interactive definition: ${source.relativePath}`,
    );
  }
  let entryData: Record<string, unknown> | undefined;
  let resolvedEntryId: string | undefined;
  if (loaded.descriptor.kind === "collection") {
    if (loaded.descriptor.entries.kind === "provider") {
      throw new MediaScriptError(
        "COLLECTION_PROVIDER_DEFERRED",
        `Script cues do not execute collection providers; use a static collection or snapshot first: ${source.relativePath}`,
      );
    }
    const entries = await loadCollectionEntries<Record<string, unknown>>(loaded.descriptor, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
    if (entries.length === 0) {
      throw new MediaScriptError(
        "EMPTY_COLLECTION",
        `Static collection ${source.relativePath} has no entries to resolve script cues against.`,
      );
    }
    const selected = options.entryId !== undefined
      ? entries.find((entry) => entry.id === options.entryId)
      : entries[0];
    if (!selected) {
      throw new MediaScriptError(
        "UNKNOWN_ENTRY",
        `Collection ${source.relativePath} has no entry ${JSON.stringify(options.entryId)}. Available: ${entries.map((entry) => entry.id).join(", ")}`,
      );
    }
    resolvedEntryId = selected.id;
    entryData = selected.data;
  } else if (options.entryId !== undefined) {
    throw new MediaScriptError(
      "INVALID_INPUT",
      `entryId (${JSON.stringify(options.entryId)}) is only valid for collection() sources: ${source.relativePath}`,
    );
  }
  const scripts = (loaded.bundle.dependencies ?? []).filter((file) => file.toLowerCase().endsWith(SCRIPT_SUFFIX));
  if (scripts.length === 0) {
    throw new MediaScriptError("NO_SCRIPT", `${source.relativePath} does not import a *${SCRIPT_SUFFIX} file.`);
  }
  if (scripts.length > 1) {
    throw new MediaScriptError("MULTIPLE_SCRIPTS", `${source.relativePath} imports more than one script file.`);
  }
  const scriptFile = scripts[0]!;
  const doc = parseScript(readFileSync(scriptFile, "utf8"));
  if (!doc) throw new MediaScriptError("NOT_A_SCRIPT", `${projectRelative(root, scriptFile)} has no script block.`);

  const applied = await applyTemplateResolve(loaded.compiled.media as unknown as TemplateModule, {
    ...(entryData === undefined ? {} : { data: entryData }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const config = applied.template.config ?? {};
  const fps = config.fps ?? 30;
  const durationSeconds = parseDuration(config.duration, "duration", fps);
  const film = filmScript(doc);
  const blockIds = film.blocks.flatMap((block) => (block.id ? [block.id] : []));
  const known = new Set(blockIds);
  let timed: ReturnType<typeof normalizeCues>;
  try {
    timed = normalizeCues(applied.resolved?.cues ?? [], fps, durationSeconds);
  } catch (error) {
    if (error instanceof RangeError) throw new MediaScriptError("INVALID_CUE", error.message);
    throw error;
  }

  const cues: MediaScriptCue[] = [];
  timed.forEach((cue, index) => {
    if (!known.has(cue.id)) return;
    const next = timed[index + 1];
    cues.push(Object.freeze({
      blockId: cue.id,
      startSeconds: round(cue.startSeconds),
      endSeconds: round(cue.endSeconds),
      stillSeconds: round(cue.stillSeconds),
      costSeconds: round(Math.max(0, (next ? next.startSeconds : durationSeconds) - cue.startSeconds)),
    }));
  });
  const placed = new Set(cues.map((cue) => cue.blockId));

  return Object.freeze({
    schemaVersion: 0,
    kind: "media-script-cues",
    sourceId: source.sourceId,
    relativePath: source.relativePath,
    ...(resolvedEntryId === undefined ? {} : { entryId: resolvedEntryId }),
    programHash: createHash("sha256").update(loaded.bundle.code).digest("hex"),
    scriptPath: projectRelative(root, scriptFile),
    scriptHash: filmScriptHash(film),
    fps,
    durationSeconds: round(durationSeconds),
    cues: Object.freeze(cues),
    unplaced: Object.freeze(blockIds.filter((id) => !placed.has(id))),
    unknownCues: Object.freeze(timed.filter((cue) => !known.has(cue.id)).map((cue) => cue.id)),
    findings: Object.freeze((applied.resolved?.cueFindings ?? []).map((finding) => Object.freeze({
      blockId: finding.id,
      code: finding.code ?? "FILM_FINDING",
      message: finding.message,
    }))),
  });
}

/** Width and height from a PNG's header. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Scale a PNG down to `maxWidth`, keeping its shape. A narrower image is returned as is. */
export async function fitPngWidth(bytes: Uint8Array, maxWidth: number | undefined): Promise<Uint8Array> {
  if (maxWidth === undefined || pngSize(bytes).width <= maxWidth) return bytes;
  const { default: sharp } = await import("sharp");
  return new Uint8Array(await sharp(bytes).resize({ width: maxWidth }).png().toBuffer());
}
