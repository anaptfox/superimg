//! Compile Familiar `.toml` rig files into JS modules with the shape of one `PETS` entry.
//!
//! Import rule:
//! - Any file ending in `.rig.toml`
//! - Any `.toml` import with an explicit `?rig` query (`import pig from "./pig.toml?rig"`)
//! - Any `.toml` file that lives in a `rigs/` or `cast/` directory OR contains a Familiar rig
//!   header (`id = "..."` and `canvas = [...]`).
//! - Any other `.toml` file (or a `_*` shared rig include imported directly) is rejected
//!   with a clear error explaining the rule.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";

export const RIG_FILE_SUFFIX = ".rig.toml";
export const RIG_QUERY_SUFFIX = "?rig";

export interface RigShapePath {
  readonly fill: string;
  readonly d: string;
}

export interface RigMoveFrame {
  readonly pose: string;
  readonly ms: number;
  readonly alt: number;
}

export interface RigPetEntry {
  readonly w: number;
  readonly h: number;
  readonly poses: Record<string, RigShapePath[]>;
  readonly moves: Record<string, RigMoveFrame[]>;
}

export interface FamiliarExportedRig {
  readonly id?: string;
  readonly poses: Record<string, readonly string[]>;
  readonly palettes: {
    readonly light: Record<string, string>;
    readonly dark?: Record<string, string>;
  };
  readonly moves?: Record<
    string,
    readonly {
      readonly pose: string;
      readonly ms: number;
      readonly alt?: number;
    }[]
  >;
}

export interface ExportRigOptions {
  /** Media file or starting path used to locate `<project root>/.superimg/cache/rigs/`. */
  readonly projectFrom?: string;
  /** Override the `familiar` binary path (defaults to `process.env.SUPERIMG_FAMILIAR || "familiar"`). */
  readonly familiarBin?: string;
  /** Timeout in milliseconds for `familiar` commands (default: 15_000). */
  readonly timeoutMs?: number;
}

export interface ExportRigResult {
  readonly rigPath: string;
  readonly sharedFiles: readonly string[];
  readonly dependencies: readonly string[];
  readonly cacheKey: string;
  readonly cachePath: string;
  readonly jsonText: string;
  readonly rawRig: FamiliarExportedRig;
  readonly pet: RigPetEntry;
}

/** Strip `?rig` query from a specifier or module ID. */
export function stripRigQuery(id: string): { path: string; hasRigQuery: boolean } {
  if (id.endsWith(RIG_QUERY_SUFFIX)) {
    return { path: id.slice(0, -RIG_QUERY_SUFFIX.length), hasRigQuery: true };
  }
  return { path: id, hasRigQuery: false };
}

/** True when a path or module ID targets a `.toml` file (with or without `?rig`). */
export function isTomlImport(id: string): boolean {
  const { path } = stripRigQuery(id);
  return path.toLowerCase().endsWith(".toml");
}

/** True when a `.toml` text contains a Familiar rig header (`id = "..."` and `canvas = [...]`). */
export function hasFamiliarRigHeader(text: string): boolean {
  const hasId = /^\s*id\s*=\s*"[^"\r\n]+"/m.test(text);
  const hasCanvas = /^\s*canvas\s*=\s*\[\s*\d+\s*,\s*\d+\s*\]/m.test(text);
  return hasId && hasCanvas;
}

/** True when the file path lives directly inside a `rigs/` or `cast/` directory. */
export function isInRigDirectory(filePath: string): boolean {
  const parts = resolve(filePath).split(sep).map((segment) => segment.toLowerCase());
  const parent = parts.at(-2);
  return parent === "rigs" || parent === "cast";
}

/**
 * Validate that a `.toml` import obeys the Familiar rig import rule.
 * Throws a clear error on shared `_*.toml` includes or ambiguous/non-rig `.toml` files.
 */
export function assertValidRigTomlImport(
  filePath: string,
  tomlText: string,
  hasRigQuery = false,
): void {
  const name = basename(filePath);
  const lower = name.toLowerCase();
  if (!lower.endsWith(".toml")) {
    throw new TypeError(`Rig imports must point to a .toml file: ${filePath}`);
  }
  if (name.startsWith("_")) {
    throw new TypeError(
      `Cannot import shared Familiar include "${name}" directly as a rig; import the character rig .toml file instead.`,
    );
  }
  const hasHeader = hasFamiliarRigHeader(tomlText);
  const isExplicitRig = lower.endsWith(RIG_FILE_SUFFIX) || hasRigQuery;
  const inRigDir = isInRigDirectory(filePath);

  if (!isExplicitRig && !inRigDir && !hasHeader) {
    throw new TypeError(
      `Ambiguous .toml import "${name}": SuperImg only loads Familiar rigs (` +
        `name the file "*.rig.toml", import with "?rig", place it in a "rigs/" directory, ` +
        `or include a Familiar rig header with \`id = "..."\` and \`canvas = [w, h]\`).`,
    );
  }
  if (!hasHeader) {
    throw new TypeError(
      `Invalid Familiar rig "${name}": missing required Familiar rig header (\`id = "..."\` and \`canvas = [w, h]\`).`,
    );
  }
}

/** Walk up from `startPath` to find the nearest directory containing `package.json`. */
export function findNearestPackageRoot(startPath: string): string {
  let dir = resolve(startPath);
  if (!existsSync(dir) || !dir.endsWith(sep)) {
    // If startPath is a file path (or doesn't exist yet), check it and walk up.
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  const initial = dir;
  while (true) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return initial;
    dir = parent;
  }
}

/** Convert a grid of palette glyphs into grouped SVG `M{x} {y}h1v1h-1z` path entries (same as `prep.mjs`). */
export function gridToPaths(
  grid: readonly string[],
  palette: Readonly<Record<string, string>>,
): RigShapePath[] {
  const by: Record<string, string> = {};
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || !palette[ch]) return;
      const fill = palette[ch]!;
      by[fill] = (by[fill] ?? "") + `M${x} ${y}h1v1h-1z`;
    });
  });
  return Object.entries(by).map(([fill, d]) => ({ fill, d }));
}

/**
 * Convert an exported `familiar rig export` JSON object into the exact shape of one `PETS` entry:
 * `{ w, h, poses: Record<pose, {fill, d}[]>, moves: Record<name, {pose, ms, alt}[]> }`.
 */
export function rigToPet(rig: FamiliarExportedRig): RigPetEntry {
  if (!rig || typeof rig !== "object" || !rig.poses || typeof rig.poses !== "object") {
    throw new TypeError("Familiar rig export JSON is missing `poses`");
  }
  const restGrid = rig.poses.rest;
  if (!Array.isArray(restGrid) || restGrid.length === 0 || typeof restGrid[0] !== "string") {
    throw new TypeError("Familiar rig export JSON is missing a non-empty `poses.rest` grid");
  }
  const lightPalette = rig.palettes?.light;
  if (!lightPalette || typeof lightPalette !== "object") {
    throw new TypeError("Familiar rig export JSON is missing `palettes.light`");
  }
  const poses: Record<string, RigShapePath[]> = {};
  for (const [pose, grid] of Object.entries(rig.poses)) {
    poses[pose] = gridToPaths(grid, lightPalette);
  }
  const moves: Record<string, RigMoveFrame[]> = {};
  for (const [name, frames] of Object.entries(rig.moves ?? {})) {
    moves[name] = frames.map(({ pose, ms, alt = 0 }) => ({ pose, ms, alt }));
  }
  return {
    w: restGrid[0].length,
    h: restGrid.length,
    poses,
    moves,
  };
}

/** Emit the JS module source code for a compiled rig (or raw `familiar rig export` JSON). */
export function rigModuleCode(input: FamiliarExportedRig | RigPetEntry | string): string {
  const parsed: unknown = typeof input === "string" ? JSON.parse(input) : input;
  const isAlreadyPet =
    parsed !== null &&
    typeof parsed === "object" &&
    "w" in parsed &&
    "h" in parsed &&
    "poses" in parsed &&
    "moves" in parsed &&
    !("palettes" in parsed);
  const pet = isAlreadyPet
    ? (parsed as RigPetEntry)
    : rigToPet(parsed as FamiliarExportedRig);
  return `const rig = ${JSON.stringify(pet)};\nexport default rig;\n`;
}

function runExecFile(
  file: string,
  args: readonly string[],
  options: { cwd: string; timeoutMs: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      file,
      [...args],
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
      },
      (error, stdout, stderr) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            rejectPromise(
              new Error(
                `Familiar binary not found (checked SUPERIMG_FAMILIAR=${JSON.stringify(
                  process.env.SUPERIMG_FAMILIAR ?? "",
                )} and "familiar" on PATH; tried ${JSON.stringify(
                  file,
                )}). Set the SUPERIMG_FAMILIAR environment variable to the familiar executable path or add familiar to PATH.`,
              ),
            );
            return;
          }
          const detail = stderr?.trim() || stdout?.trim() || error.message;
          rejectPromise(
            new Error(`familiar ${args.join(" ")} failed: ${detail}`),
          );
          return;
        }
        resolvePromise({ stdout, stderr });
      },
    );
  });
}

/** Find all `_*.toml` shared sibling files in `rigDir`, sorted by filename. */
export async function listSharedRigTomlFiles(rigDir: string): Promise<string[]> {
  const entries = await readdir(rigDir, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        (entry.isFile() || entry.isSymbolicLink()) &&
        entry.name.startsWith("_") &&
        entry.name.toLowerCase().endsWith(".toml"),
    )
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => join(rigDir, name));
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });
  const tempPath = join(
    dir,
    `.rig-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, targetPath);
}

const inflightExports = new Map<string, Promise<{ rawRig: FamiliarExportedRig; jsonText: string }>>();

const LOCAL_FAMILIAR_CANDIDATES = [
  process.env.HOME ? join(process.env.HOME, ".local", "bin", "familiar") : "",
].filter(Boolean);

function resolveDefaultFamiliarBin(startDir: string): string {
  const pathDirs = (process.env.PATH ?? "").split(process.platform === "win32" ? ";" : ":").filter(Boolean);
  for (const dir of pathDirs) {
    const candidate = join(dir, process.platform === "win32" ? "familiar.exe" : "familiar");
    if (existsSync(candidate)) return candidate;
  }
  let dir = resolve(startDir);
  for (let depth = 0; depth < 6; depth++) {
    const sibling = join(dir, "familiar", "zig-out", "bin", "familiar");
    if (existsSync(sibling)) return sibling;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const candidate of LOCAL_FAMILIAR_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return "familiar";
}

/**
 * Compile and cache a `.toml` rig using the `familiar` CLI (`SUPERIMG_FAMILIAR` or `familiar` on `PATH`).
 * Caches the raw JSON output at `<project root>/.superimg/cache/rigs/<sha256>.json`.
 */
export async function exportRig(
  rigFilePath: string,
  options: ExportRigOptions & { hasRigQuery?: boolean; onSourceRead?: (file: string, text: string) => void } = {},
): Promise<ExportRigResult> {
  const { path: cleanPath, hasRigQuery: strippedQuery } = stripRigQuery(rigFilePath);
  const rigPath = resolve(cleanPath);
  const rigDir = dirname(rigPath);
  const timeoutMs = options.timeoutMs ?? 15_000;
  const familiarBin =
    options.familiarBin?.trim() ||
    process.env.SUPERIMG_FAMILIAR?.trim() ||
    resolveDefaultFamiliarBin(rigDir);

  const rigContent = await readFile(rigPath, "utf8");
  options.onSourceRead?.(rigPath, rigContent);
  assertValidRigTomlImport(
    rigPath,
    rigContent,
    options.hasRigQuery ?? strippedQuery,
  );

  const sharedFiles = await listSharedRigTomlFiles(rigDir);
  const sharedContents = await Promise.all(
    sharedFiles.map(async (file) => {
      const content = await readFile(file, "utf8");
      options.onSourceRead?.(file, content);
      return [basename(file), content] as const;
    }),
  );

  const { stdout: versionOut } = await runExecFile(
    familiarBin,
    ["--version"],
    { cwd: rigDir, timeoutMs },
  );

  const hash = createHash("sha256");
  hash.update(`familiar-version\0${versionOut.trim()}\0`);
  hash.update(`rig\0${basename(rigPath)}\0${rigContent}\0`);
  for (const [name, content] of sharedContents) {
    hash.update(`shared\0${name}\0${content}\0`);
  }
  const cacheKey = hash.digest("hex");

  const projectRoot = findNearestPackageRoot(options.projectFrom ?? rigPath);
  const cacheDir = join(projectRoot, ".superimg", "cache", "rigs");
  const cachePath = join(cacheDir, `${cacheKey}.json`);

  let jsonText: string | undefined;
  if (existsSync(cachePath)) {
    try {
      jsonText = await readFile(cachePath, "utf8");
    } catch {
      jsonText = undefined;
    }
  }

  let rawRig: FamiliarExportedRig;
  if (jsonText !== undefined) {
    rawRig = JSON.parse(jsonText) as FamiliarExportedRig;
  } else {
    let pending = inflightExports.get(cachePath);
    if (!pending) {
      pending = (async () => {
        const { stdout } = await runExecFile(
          familiarBin,
          ["rig", "export", rigPath],
          { cwd: rigDir, timeoutMs },
        );
        const parsed = JSON.parse(stdout) as FamiliarExportedRig;
        const formatted = `${JSON.stringify(parsed)}\n`;
        await writeFileAtomic(cachePath, formatted);
        return { rawRig: parsed, jsonText: formatted };
      })();
      inflightExports.set(cachePath, pending);
    }
    try {
      const exported = await pending;
      rawRig = exported.rawRig;
      jsonText = exported.jsonText;
    } finally {
      inflightExports.delete(cachePath);
    }
  }

  const pet = rigToPet(rawRig);
  const dependencies = [rigPath, ...sharedFiles];

  return {
    rigPath,
    sharedFiles,
    dependencies,
    cacheKey,
    cachePath,
    jsonText,
    rawRig,
    pet,
  };
}

/**
 * Vite plugin that loads Familiar `.toml` / `.rig.toml` / `.toml?rig` imports
 * with the same cache, validation, and hot-reload watching as the SuperImg bundler.
 */
export function superimgRigVitePlugin(options: ExportRigOptions = {}) {
  const watchedDirs = new Map<string, Set<string>>();
  return {
    name: "superimg-rig",
    async load(
      this: { addWatchFile?: (id: string) => void },
      id: string,
    ) {
      if (!isTomlImport(id)) return null;
      const { path, hasRigQuery } = stripRigQuery(id);
      if (!isAbsolute(path)) return null;
      const result = await exportRig(path, { ...options, hasRigQuery });
      for (const dep of result.dependencies) {
        this.addWatchFile?.(dep);
      }
      const dir = dirname(result.rigPath);
      let set = watchedDirs.get(dir);
      if (!set) {
        set = new Set();
        watchedDirs.set(dir, set);
      }
      set.add(id);
      return {
        code: rigModuleCode(result.pet),
        moduleType: "js",
      };
    },
    hotUpdate(
      this: { environment: { moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: unknown): void } } },
      ctx: { file: string; modules: unknown[] },
    ) {
      if (!ctx.file.toLowerCase().endsWith(".toml")) return;
      if (basename(ctx.file).startsWith("_")) {
        const rigIds = watchedDirs.get(dirname(ctx.file));
        if (!rigIds || rigIds.size === 0) return;
        const extra: unknown[] = [];
        for (const rigId of rigIds) {
          const mod = this.environment.moduleGraph.getModuleById(rigId);
          if (mod) {
            this.environment.moduleGraph.invalidateModule(mod);
            extra.push(mod);
          }
        }
        return [...ctx.modules, ...extra];
      }
      return ctx.modules;
    },
  };
}
