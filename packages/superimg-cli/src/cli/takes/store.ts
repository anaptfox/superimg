//! Content-addressed source takes, stored beside the media file.
// A take keeps the project's imported source bytes, a rendition receipt, and an optional poster.
// Files that belong to another package are recorded as that package's version, never as bytes,
// and restore never writes outside the project.
// It does not keep the rendered video. `good` and `bad` survive a later export of
// the same bytes so an agent can read what worked.

import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const TAKE_SCHEMA_VERSION = 1;
/** Sources at or under this size are stored. Larger files stay in the id only. */
export const MAX_TAKE_FILE_BYTES = 8 * 1024 * 1024;
/**
 * Declared media (a film's score, images, video, fonts) may be larger. Blobs are content-addressed,
 * so a score shared by many takes is stored once.
 */
export const MAX_TAKE_MEDIA_BYTES = 256 * 1024 * 1024;
const MEDIA_FILE = /\.(wav|mp3|m4a|aac|ogg|oga|opus|flac|aif|aiff|mp4|m4v|mov|webm|png|jpe?g|webp|gif|avif|svg|woff2?|ttf|otf)$/i;

/** The most bytes a take stores for this path. Larger files are recorded by hash only. */
export function takeFileLimit(path: string): number {
  return MEDIA_FILE.test(path) ? MAX_TAKE_MEDIA_BYTES : MAX_TAKE_FILE_BYTES;
}

const SEARCH_SKIP = new Set(["node_modules", ".git", "dist"]);

export type TakeFile = {
  path: string;
  sha256: string;
};

export type TakeOmission = {
  path: string;
  reason: string;
};

export type TakeRendition = {
  sha256: string;
  path?: string;
  mimeType?: string;
  label?: string;
};

export type TakeRecord = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  mediaFile: string;
  /** A name a person gave this take, such as "cut 3". Works wherever an id does. */
  label?: string;
  /** Packages the film imported, by name and version. Their files are not stored. */
  packages?: Record<string, string>;
  programHash?: string;
  canvas?: { width: number; height: number };
  fps?: number;
  duration?: number;
  note?: string;
  good: string[];
  bad: string[];
  files: TakeFile[];
  omitted?: TakeOmission[];
  renditions: TakeRendition[];
  poster?: "poster.jpg";
};

export type TakeSourceInput = {
  /** Absolute, or relative to the media directory. */
  path: string;
  bytes?: Uint8Array;
  sha256?: string;
  omitReason?: string;
};

export type RecordTakeInput = {
  mediaDir: string;
  mediaFile: string;
  sources: readonly TakeSourceInput[];
  programHash?: string;
  canvas?: { width: number; height: number };
  fps?: number;
  duration?: number;
  renditions?: readonly TakeRendition[];
  poster?: Uint8Array;
  label?: string;
  packages?: Readonly<Record<string, string>>;
  now?: Date;
};

export type TakeHit = {
  mediaDir: string;
  record: TakeRecord;
};

export type RestoreResult = {
  target: TakeRecord;
  /** Snapshot of the files that were current. Null when they already are this take. */
  saved: TakeRecord | null;
  wrote: readonly string[];
  omitted: readonly string[];
  /** Files the take lists that restore refused to write, with the reason. */
  skipped: readonly TakeOmission[];
};

type NormalizedSource = {
  path: string;
  sha256: string;
  bytes?: Uint8Array;
  omitReason?: string;
};

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function sha256Hex(bytes: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export function hashFileSync(file: string): string {
  const hash = createHash("sha256");
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    while (true) {
      const read = readSync(fd, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

export function isScratchMedia(filePath: string): boolean {
  return filePath.split(/[/\\]/).filter(Boolean).includes("scratch");
}

type PackageInfo = { dir: string; name?: string; version?: string };

/** The nearest directory at or above `start` that holds a package.json. */
function nearestPackage(start: string): PackageInfo | undefined {
  let dir = resolve(start);
  while (true) {
    const manifest = join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown; version?: unknown };
        return {
          dir,
          ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
          ...(typeof parsed.version === "string" ? { version: parsed.version } : {}),
        };
      } catch {
        return { dir };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** The project a media directory belongs to: its nearest package, or the directory itself. */
export function takeProjectRoot(mediaDir: string): string {
  return nearestPackage(mediaDir)?.dir ?? resolve(mediaDir);
}

/** True when a file is inside the media directory's project and not inside a nested package. */
export function isProjectFile(mediaDir: string, filePath: string): boolean {
  const root = takeProjectRoot(mediaDir);
  const absolute = resolve(mediaDir, filePath);
  if (absolute !== root && !absolute.startsWith(root + sep)) return false;
  const owner = nearestPackage(dirname(absolute));
  return owner === undefined || owner.dir === root || !owner.dir.startsWith(root + sep);
}

/** Name and version of every other package the listed files belong to. */
export function packagesFromFiles(mediaDir: string, files: readonly string[]): Record<string, string> {
  const packages: Record<string, string> = {};
  for (const file of files) {
    const absolute = resolve(mediaDir, file);
    if (absolute.split(sep).includes("node_modules") || isProjectFile(mediaDir, absolute)) continue;
    const owner = nearestPackage(dirname(absolute));
    if (owner?.name) packages[owner.name] = owner.version ?? "unknown";
  }
  return Object.fromEntries(Object.entries(packages).sort(([left], [right]) => (left < right ? -1 : 1)));
}

function writeFileAtomic(destination: string, bytes: Uint8Array): void {
  const temporary = join(dirname(destination), `.take-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  writeFileSync(temporary, bytes);
  renameSync(temporary, destination);
}

export function takesRoot(mediaDir: string): string {
  return join(resolve(mediaDir), ".superimg", "takes");
}

export function takeDirectory(mediaDir: string, id: string): string {
  if (!/^[a-f0-9]{64}$/.test(id)) fail("TAKE_PATH", `Take id is not 64 hex characters: ${id}`);
  return join(takesRoot(mediaDir), id);
}

/** Relative posix path. `..` is allowed for a sibling import inside the project. */
export function takeRelativePath(mediaDir: string, filePath: string): string {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\0")) {
    fail("TAKE_PATH", "Take path is empty or contains NUL");
  }
  const root = resolve(mediaDir);
  const absolute = resolve(root, filePath);
  const stored = relative(root, absolute).split(sep).join("/");
  if (!stored || stored === "." || isAbsolute(stored) || stored.startsWith("/")) {
    fail("TAKE_PATH", `Take path must be a file: ${filePath}`);
  }
  if (stored.split("/").some((segment) => segment === ".superimg" || segment === "node_modules")) {
    fail("TAKE_PATH", `Take path cannot include .superimg or node_modules: ${stored}`);
  }
  if (!isProjectFile(root, absolute)) {
    fail("TAKE_PATH", `Take path is outside the project or belongs to another package: ${stored}`);
  }
  const destination = resolve(root, stored);
  const store = takesRoot(root);
  if (destination === store || destination.startsWith(store + sep)) {
    fail("TAKE_PATH", `Take path lands inside the take store: ${stored}`);
  }
  return stored;
}

export function takeContentId(files: readonly { path: string; sha256: string }[]): string {
  const lines = [...files]
    .sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
    .map((file) => `${file.path}\n${file.sha256}\n`)
    .join("");
  return sha256Hex(lines);
}

function cleanLines(values: readonly string[]): string[] {
  const lines: string[] = [];
  for (const value of values) {
    const text = value.trim();
    if (!text || lines.includes(text)) continue;
    lines.push(text);
  }
  return lines;
}

function normalizeSources(mediaDir: string, sources: readonly TakeSourceInput[]): NormalizedSource[] {
  const seen = new Set<string>();
  const parts: NormalizedSource[] = [];
  for (const source of sources) {
    const path = takeRelativePath(mediaDir, source.path);
    if (seen.has(path)) fail("TAKE_PATH", `Take source is listed twice: ${path}`);
    seen.add(path);
    if (source.bytes) {
      const sha256 = sha256Hex(source.bytes);
      const limit = takeFileLimit(path);
      if (source.bytes.byteLength > limit) {
        parts.push({ path, sha256, omitReason: `larger than ${limit} bytes` });
      } else {
        parts.push({ path, sha256, bytes: source.bytes });
      }
      continue;
    }
    if (source.sha256 && source.omitReason) {
      const sha256 = source.sha256.toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(sha256)) fail("TAKE_PATH", `Take source hash is not 64 hex characters: ${path}`);
      parts.push({ path, sha256, omitReason: source.omitReason });
      continue;
    }
    fail("TAKE_SOURCE", `Take source has no bytes: ${path}`);
  }
  parts.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return parts;
}

export function sourcesFromFiles(mediaDir: string, files: readonly string[]): TakeSourceInput[] {
  const sources: TakeSourceInput[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const absolute = resolve(mediaDir, file);
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const segments = absolute.split(sep);
    // The store must not snapshot itself, and dependencies never include installed packages.
    if (segments.includes("node_modules") || segments.includes(".superimg")) continue;
    // Another package's files are recorded as its version. See `packagesFromFiles`.
    if (!isProjectFile(mediaDir, absolute)) continue;
    if (!existsSync(absolute)) fail("TAKE_SOURCE", `Take source is missing: ${absolute}`);
    const stat = statSync(absolute);
    if (!stat.isFile()) fail("TAKE_SOURCE", `Take source is not a file: ${absolute}`);
    const limit = takeFileLimit(absolute);
    if (stat.size > limit) {
      sources.push({
        path: absolute,
        sha256: hashFileSync(absolute),
        omitReason: `larger than ${limit} bytes`,
      });
      continue;
    }
    sources.push({ path: absolute, bytes: new Uint8Array(readFileSync(absolute)) });
  }
  return sources;
}

function blobPath(mediaDir: string, sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail("TAKE_PATH", `Blob hash is not 64 hex characters`);
  return join(takesRoot(mediaDir), "objects", sha256);
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail("TAKE_RECORD", `Take ${label} must be an array of strings`);
  }
  return [...value];
}

function readTake(file: string, directoryName: string): TakeRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    fail("TAKE_RECORD", `Take record is not JSON: ${file} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!parsed || typeof parsed !== "object") fail("TAKE_RECORD", `Take record is not an object: ${file}`);
  const record = parsed as Record<string, unknown>;
  if (typeof record.schemaVersion !== "number" || !Number.isInteger(record.schemaVersion) || record.schemaVersion < 0) {
    fail("TAKE_RECORD", `Take record has no schema version: ${file}`);
  }
  if (record.schemaVersion !== TAKE_SCHEMA_VERSION) {
    fail("TAKE_RECORD", `Unsupported take schema ${record.schemaVersion}; expected ${TAKE_SCHEMA_VERSION}: ${file}`);
  }
  if (record.id !== directoryName || typeof record.id !== "string") {
    fail("TAKE_RECORD", `Take id does not match its directory: ${directoryName}`);
  }
  if (typeof record.createdAt !== "string" || typeof record.updatedAt !== "string" || typeof record.mediaFile !== "string") {
    fail("TAKE_RECORD", `Take record is missing createdAt, updatedAt, or mediaFile: ${file}`);
  }
  const filesValue = record.files;
  if (!Array.isArray(filesValue)) fail("TAKE_RECORD", `Take files must be an array: ${file}`);
  const files: TakeFile[] = filesValue.map((item) => {
    if (!item || typeof item !== "object") fail("TAKE_RECORD", `Take file entry is not an object: ${file}`);
    const entry = item as Record<string, unknown>;
    if (typeof entry.path !== "string" || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail("TAKE_RECORD", `Take file entry needs a path and sha256: ${file}`);
    }
    return { path: entry.path, sha256: entry.sha256 };
  });
  const renditionsValue = record.renditions ?? [];
  if (!Array.isArray(renditionsValue)) fail("TAKE_RECORD", `Take renditions must be an array: ${file}`);
  const renditions: TakeRendition[] = renditionsValue.map((item) => {
    if (!item || typeof item !== "object") fail("TAKE_RECORD", `Take rendition is not an object: ${file}`);
    const entry = item as Record<string, unknown>;
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      fail("TAKE_RECORD", `Take rendition needs a sha256: ${file}`);
    }
    return {
      sha256: entry.sha256,
      ...(typeof entry.path === "string" ? { path: entry.path } : {}),
      ...(typeof entry.mimeType === "string" ? { mimeType: entry.mimeType } : {}),
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
    };
  });
  let omitted: TakeOmission[] | undefined;
  if (record.omitted !== undefined) {
    if (!Array.isArray(record.omitted)) fail("TAKE_RECORD", `Take omitted must be an array: ${file}`);
    omitted = record.omitted.map((item) => {
      if (!item || typeof item !== "object") fail("TAKE_RECORD", `Take omission is not an object: ${file}`);
      const entry = item as Record<string, unknown>;
      if (typeof entry.path !== "string" || typeof entry.reason !== "string") {
        fail("TAKE_RECORD", `Take omission needs a path and reason: ${file}`);
      }
      return { path: entry.path, reason: entry.reason };
    });
  }
  const canvasValue = record.canvas;
  let canvas: { width: number; height: number } | undefined;
  if (canvasValue && typeof canvasValue === "object") {
    const canvasRecord = canvasValue as Record<string, unknown>;
    if (typeof canvasRecord.width === "number" && typeof canvasRecord.height === "number") {
      canvas = { width: canvasRecord.width, height: canvasRecord.height };
    }
  }
  const good = record.good === undefined ? [] : asStringArray(record.good, "good");
  const bad = record.bad === undefined ? [] : asStringArray(record.bad, "bad");
  let packages: Record<string, string> | undefined;
  if (record.packages && typeof record.packages === "object" && !Array.isArray(record.packages)) {
    packages = {};
    for (const [name, version] of Object.entries(record.packages)) {
      if (typeof version === "string") packages[name] = version;
    }
  }
  return {
    schemaVersion: 1,
    id: directoryName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    mediaFile: record.mediaFile,
    ...(typeof record.label === "string" && record.label ? { label: record.label } : {}),
    ...(packages && Object.keys(packages).length > 0 ? { packages } : {}),
    ...(typeof record.programHash === "string" ? { programHash: record.programHash } : {}),
    ...(canvas ? { canvas } : {}),
    ...(typeof record.fps === "number" ? { fps: record.fps } : {}),
    ...(typeof record.duration === "number" ? { duration: record.duration } : {}),
    ...(typeof record.note === "string" && record.note ? { note: record.note } : {}),
    good,
    bad,
    files,
    ...(omitted && omitted.length > 0 ? { omitted } : {}),
    renditions,
    ...(record.poster === "poster.jpg" ? { poster: "poster.jpg" as const } : {}),
  };
}

function writeRecord(directory: string, record: TakeRecord): void {
  mkdirSync(directory, { recursive: true });
  const destination = join(directory, "take.json");
  const temporary = join(directory, `.take-${process.pid}-${Date.now()}.json`);
  writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(temporary, destination);
}

function readExisting(directory: string, id: string): TakeRecord | undefined {
  const file = join(directory, "take.json");
  if (!existsSync(file)) return undefined;
  return readTake(file, id);
}

function mergeRenditions(existing: readonly TakeRendition[], incoming: readonly TakeRendition[]): TakeRendition[] {
  const merged = [...existing];
  for (const rendition of incoming) {
    if (merged.some((item) => item.sha256 === rendition.sha256 && item.path === rendition.path)) continue;
    merged.push({ ...rendition });
  }
  return merged;
}

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function recordTake(input: RecordTakeInput): TakeRecord {
  const mediaDir = resolve(input.mediaDir);
  const mediaFile = takeRelativePath(mediaDir, input.mediaFile);
  const parts = normalizeSources(mediaDir, input.sources);
  const id = takeContentId(parts);
  const directory = takeDirectory(mediaDir, id);
  const now = (input.now ?? new Date()).toISOString();
  mkdirSync(join(takesRoot(mediaDir), "objects"), { recursive: true });
  for (const part of parts) {
    if (!part.bytes) continue;
    const blob = blobPath(mediaDir, part.sha256);
    if (existsSync(blob)) continue;
    writeFileAtomic(blob, part.bytes);
  }
  if (input.poster && input.poster.byteLength > 0 && input.poster.byteLength <= MAX_TAKE_FILE_BYTES) {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "poster.jpg"), input.poster);
  }
  // Read again after blobs so feedback written during the copy is kept.
  const existing = readExisting(directory, id);
  const omitted = parts
    .filter((part) => part.omitReason)
    .map((part) => ({ path: part.path, reason: part.omitReason! }));
  const poster = existsSync(join(directory, "poster.jpg")) ? "poster.jpg" as const : undefined;
  const fps = finiteNumber(input.fps) ?? existing?.fps;
  const duration = finiteNumber(input.duration) ?? existing?.duration;
  const programHash = input.programHash ?? existing?.programHash;
  const canvas = input.canvas && Number.isFinite(input.canvas.width) && Number.isFinite(input.canvas.height)
    ? { width: input.canvas.width, height: input.canvas.height }
    : existing?.canvas;
  const label = input.label?.trim() || existing?.label;
  const packages = input.packages && Object.keys(input.packages).length > 0 ? { ...input.packages } : existing?.packages;
  const record: TakeRecord = {
    schemaVersion: 1,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    mediaFile,
    ...(label ? { label } : {}),
    ...(packages ? { packages } : {}),
    ...(programHash ? { programHash } : {}),
    ...(canvas ? { canvas } : {}),
    ...(fps !== undefined ? { fps } : {}),
    ...(duration !== undefined ? { duration } : {}),
    ...(existing?.note ? { note: existing.note } : {}),
    good: existing?.good ?? [],
    bad: existing?.bad ?? [],
    files: parts.map((part) => ({ path: part.path, sha256: part.sha256 })),
    ...(omitted.length > 0 ? { omitted } : {}),
    renditions: mergeRenditions(existing?.renditions ?? [], input.renditions ?? []),
    ...(poster ? { poster } : {}),
  };
  writeRecord(directory, record);
  return record;
}

export function listTakes(mediaDir: string): TakeRecord[] {
  const root = takesRoot(mediaDir);
  if (!existsSync(root)) return [];
  const records: TakeRecord[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (!/^[a-f0-9]{64}$/.test(entry.name)) continue;
    records.push(readTake(join(root, entry.name, "take.json"), entry.name));
  }
  return records.sort((left, right) => (
    left.updatedAt < right.updatedAt ? 1
      : left.updatedAt > right.updatedAt ? -1
        : left.id < right.id ? -1 : 1
  ));
}

/** Takes whose id starts with the query, or failing that, whose label is the query. */
export function matchTakes(records: readonly TakeRecord[], idOrLabel: string): TakeRecord[] {
  const query = idOrLabel.trim();
  if (!query) fail("TAKE_NOT_FOUND", "Pass a take id, a unique id prefix, or a label");
  if (/^[a-f0-9]+$/.test(query) && query.length <= 64) {
    const byId = records.filter((record) => record.id.startsWith(query));
    if (byId.length > 0) return byId;
  }
  const wanted = query.toLowerCase();
  return records.filter((record) => record.label?.toLowerCase() === wanted);
}

function matchId(records: readonly TakeRecord[], idOrPrefix: string): TakeRecord[] {
  return matchTakes(records, idOrPrefix);
}

function oneMatch(records: readonly TakeRecord[], idOrPrefix: string): TakeRecord {
  const matches = matchId(records, idOrPrefix);
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) fail("TAKE_NOT_FOUND", `No take matches ${idOrPrefix}`);
  fail("TAKE_AMBIGUOUS", `Take prefix ${idOrPrefix} matches more than one take: ${matches.map((record) => record.id).join(", ")}`);
}

export function findTake(mediaDir: string, idOrPrefix: string): TakeRecord {
  return oneMatch(listTakes(mediaDir), idOrPrefix);
}

export function searchTakes(root: string): TakeHit[] {
  const found: TakeHit[] = [];
  const visit = (directory: string): void => {
    if (existsSync(join(directory, ".superimg", "takes"))) {
      for (const record of listTakes(directory)) found.push({ mediaDir: directory, record });
    }
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
      if (entry.name === ".superimg" || SEARCH_SKIP.has(entry.name)) continue;
      visit(join(directory, entry.name));
    }
  };
  visit(resolve(root));
  return found;
}

export function findTakeInSearch(root: string, idOrPrefix: string, mediaFile?: string): TakeHit {
  const pool = searchTakes(root).filter((hit) => mediaFile === undefined || hit.record.mediaFile === mediaFile);
  const matches = matchId(pool.map((hit) => hit.record), idOrPrefix);
  if (matches.length === 0) fail("TAKE_NOT_FOUND", `No take matches ${idOrPrefix}`);
  if (matches.length > 1) {
    fail("TAKE_AMBIGUOUS", `Take prefix ${idOrPrefix} matches more than one take: ${matches.map((record) => record.id).join(", ")}`);
  }
  const hit = pool.find((item) => item.record.id === matches[0]!.id);
  if (!hit) fail("TAKE_NOT_FOUND", `No take matches ${idOrPrefix}`);
  return hit;
}

export function takesForRendition(root: string, sha256: string): TakeHit[] {
  const hash = sha256.toLowerCase();
  return searchTakes(root).filter((hit) => hit.record.renditions.some((rendition) => rendition.sha256 === hash));
}

export function recordFeedback(input: {
  mediaDir: string;
  id: string;
  good?: readonly string[];
  bad?: readonly string[];
  note?: string;
  label?: string;
  replace?: boolean;
  now?: Date;
}): TakeRecord {
  if (input.good === undefined && input.bad === undefined && input.note === undefined && input.label === undefined) {
    fail("TAKE_FEEDBACK", "Pass --good, --bad, --note, or --label");
  }
  const current = findTake(input.mediaDir, input.id);
  const replace = input.replace === true;
  const good = input.good === undefined
    ? [...current.good]
    : replace
      ? cleanLines(input.good)
      : appendUnique(current.good, cleanLines(input.good));
  const bad = input.bad === undefined
    ? [...current.bad]
    : replace
      ? cleanLines(input.bad)
      : appendUnique(current.bad, cleanLines(input.bad));
  let note = current.note;
  if (input.note !== undefined) {
    const trimmed = input.note.trim();
    note = trimmed ? trimmed : undefined;
  }
  const record: TakeRecord = {
    ...current,
    updatedAt: (input.now ?? new Date()).toISOString(),
    good,
    bad,
    ...(note ? { note } : {}),
  };
  if (!note) delete record.note;
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (label) record.label = label;
    else delete record.label;
  }
  writeRecord(takeDirectory(input.mediaDir, current.id), record);
  return record;
}

function appendUnique(existing: readonly string[], incoming: readonly string[]): string[] {
  const lines = [...existing];
  for (const line of incoming) if (!lines.includes(line)) lines.push(line);
  return lines;
}

export function restoreTake(input: {
  mediaDir: string;
  id: string;
  mediaFile: string;
  current: readonly TakeSourceInput[];
  programHash?: string;
  now?: Date;
}): RestoreResult {
  const mediaDir = resolve(input.mediaDir);
  const target = findTake(mediaDir, input.id);
  const parts = normalizeSources(mediaDir, input.current);
  if (takeContentId(parts) === target.id) {
    return { target, saved: null, wrote: [], omitted: [], skipped: [] };
  }
  const saved = recordTake({
    mediaDir,
    mediaFile: input.mediaFile,
    sources: input.current,
    ...(input.programHash ? { programHash: input.programHash } : {}),
    ...(input.now ? { now: input.now } : {}),
  });
  // A take never writes outside its project.
  const inProject = (file: TakeFile): boolean => isProjectFile(mediaDir, resolve(mediaDir, file.path));
  const missing = target.files.filter((file) => {
    if (!inProject(file)) return false;
    if (target.omitted?.some((item) => item.path === file.path)) return false;
    return !existsSync(blobPath(mediaDir, file.sha256));
  });
  if (missing.length > 0) {
    fail("TAKE_MISSING_BLOB", `Take ${target.id} is missing stored bytes for ${missing.map((file) => file.path).join(", ")}`);
  }
  const wrote: string[] = [];
  const omitted: string[] = [];
  const skipped: TakeOmission[] = [];
  const writes: { path: string; destination: string; bytes: Uint8Array }[] = [];
  for (const file of target.files) {
    if (!inProject(file)) {
      skipped.push({ path: file.path, reason: "outside the project or in another package" });
      continue;
    }
    const reason = target.omitted?.find((item) => item.path === file.path)?.reason;
    if (reason) {
      omitted.push(file.path);
      continue;
    }
    const bytes = new Uint8Array(readFileSync(blobPath(mediaDir, file.sha256)));
    if (sha256Hex(bytes) !== file.sha256) {
      fail("TAKE_CORRUPT_BLOB", `Stored bytes for ${file.path} no longer match their hash. Nothing was restored.`);
    }
    writes.push({ path: file.path, destination: resolve(mediaDir, takeRelativePath(mediaDir, file.path)), bytes });
  }
  // Every blob is verified before the first file is written.
  for (const write of writes) {
    mkdirSync(dirname(write.destination), { recursive: true });
    writeFileAtomic(write.destination, write.bytes);
    wrote.push(write.path);
  }
  return { target, saved, wrote, omitted, skipped };
}

export function readTakeFile(mediaDir: string, id: string, file: string): { path: string; sha256: string; bytes: Uint8Array } {
  const take = findTake(mediaDir, id);
  const wanted = file.split(sep).join("/");
  const exact = take.files.filter((item) => item.path === wanted);
  const suffixed = exact.length > 0
    ? exact
    : take.files.filter((item) => item.path.endsWith(`/${wanted}`));
  const matches = suffixed.length > 0
    ? suffixed
    : take.files.filter((item) => item.path.split("/").at(-1) === wanted);
  if (matches.length === 0) fail("TAKE_NOT_FOUND", `Take ${take.id} has no file ${file}`);
  if (matches.length > 1) {
    fail("TAKE_AMBIGUOUS", `Take file ${file} matches more than one path: ${matches.map((item) => item.path).join(", ")}`);
  }
  const match = matches[0]!;
  const reason = take.omitted?.find((item) => item.path === match.path)?.reason;
  if (reason) fail("TAKE_OMITTED", `Take file was not kept (${reason}): ${match.path}`);
  const blob = blobPath(mediaDir, match.sha256);
  if (!existsSync(blob)) fail("TAKE_MISSING_BLOB", `Take ${take.id} is missing stored bytes for ${match.path}`);
  return { path: match.path, sha256: match.sha256, bytes: new Uint8Array(readFileSync(blob)) };
}
