import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { bundleMediaProgram, prepareMediaProgram } from "@superimg/core/bundler";
import { compileTemplate, normalizeSourceId, validateMediaIR } from "@superimg/core";
import type { MediaIR } from "@superimg/types";
import { normalizeProjectRoot, resolveMediaSource } from "./project.js";
import { evaluatePreparedSourceIR } from "./source-evaluate.js";
import { loadNodeMediaValue } from "./source.js";

export interface PrepareSourceOptions {
  readonly kind: "singular";
  /** Existing project-relative JavaScript/TypeScript files and their replacement text. */
  readonly overrides?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}
export interface PreparedSource {
  readonly ir: MediaIR;
  /** SHA-256 of exact effective source bytes, keyed by project-relative path. */
  readonly sourceHashes: Readonly<Record<string, string>>;
}

/** Compile a singular source without executing providers or encoding media. */
export async function prepareSource(projectRoot: string, requested: string, options: PrepareSourceOptions): Promise<PreparedSource> {
  if (options.kind !== "singular") throw new TypeError("prepareSource requires kind: singular");
  options.signal?.throwIfAborted();
  const root = normalizeProjectRoot(projectRoot);
  const source = resolveMediaSource(root, requested);
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.overrides ?? {})) {
    if (isAbsolute(key) || key.includes("\\") || key.split("/").some(part => !part || part === "." || part === "..") || !/\.[cm]?[jt]sx?$/.test(key) || typeof value !== "string") throw new TypeError(`Invalid project-relative source override: ${key}`);
    const path = resolve(root, key);
    const stat = await lstat(path);
    const actual = await realpath(path);
    if (stat.isSymbolicLink() || !stat.isFile() || actual !== path || relative(root, actual).startsWith(`..${sep}`)) throw new Error(`Override must name a regular project file: ${key}`);
    overrides[path] = value;
  }
  const consumed = new Map<string, string>();
  const compilerOptions = { projectRoot: root, sourceOverrides: overrides, onSourceRead: (file: string, text: string) => consumed.set(file, text) };
  const prepared = await prepareMediaProgram(source.templatePath, compilerOptions);
  if (prepared.descriptor.kind !== "media") throw new Error("prepareSource requires a singular deterministic media source");
  const bundle = await bundleMediaProgram(source.templatePath, { ...compilerOptions, prepared });
  options.signal?.throwIfAborted();
  const files = new Set([source.templatePath, ...(bundle.dependencies ?? [])]);
  for (const path of Object.keys(overrides)) if (!files.has(path)) throw new Error(`Override is not an input of this source: ${relative(root, path)}`);
  const hashes: Record<string, string> = {};
  for (const path of [...files].sort()) {
    const rel = relative(root, path);
    if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || rel.split(sep).includes("node_modules")) continue;
    const bytes = consumed.get(path) ?? overrides[path] ?? await readFile(path);
    hashes[rel.split(sep).join("/")] = createHash("sha256").update(bytes).digest("hex");
  }
  const compiled = compileTemplate(bundle);
  if (compiled.error) throw compiled.error;
  if (!compiled.media || compiled.interactive) throw new Error("prepareSource requires a singular deterministic media source");
  const signal = options.signal === undefined ? {} : { signal: options.signal };
  const loaded = await loadNodeMediaValue(root, source, {
    ...signal,
    preparedSource: { source, descriptor: prepared.descriptor, bundle, compiled, sourceText: prepared.sourceText },
  });
  const evaluated = await evaluatePreparedSourceIR({ ...signal, loaded, sourceId: normalizeSourceId(source.sourceId) });
  if (!evaluated.ir) throw new Error(`Source has no canonical IR: ${evaluated.fallbackReason ?? evaluated.mode}`);
  for (const [file, hash] of Object.entries(hashes)) {
    options.signal?.throwIfAborted();
    const path = resolve(root, file);
    if (overrides[path] !== undefined) continue;
    if (createHash("sha256").update(await readFile(path)).digest("hex") !== hash) {
      throw new Error(`Source changed during preparation: ${file}`);
    }
  }
  return Object.freeze({ ir: validateMediaIR(evaluated.ir), sourceHashes: Object.freeze(hashes) });
}
