//! Server-side template bundling with Rolldown (Node/Bun/Deno)

import { rolldown, VERSION } from "rolldown";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseSync } from "oxc-parser";
import {
  createSuperimgPlugin,
  resolveInteractivePath,
} from "./plugin.js";
import {
  analyzeMediaSource,
  type MediaSourceAnalysisOptions,
  type SourceDescriptor,
} from "../source-analysis/analyze-media-source.js";
import {
  logBundlerEntry,
  logBundlerDebug,
  TEMPLATE_IIFE_OUTPUT,
} from "./bundler-debug.js";
import { rethrowBundleFailure } from "./missing-export.js";
import {
  bundlerOnLog,
  templateBundlerInputOptions,
  TEMPLATE_COMPILER_BEHAVIOR,
  unresolvedImports,
} from "./rolldown-log.js";
export { bundlerOnLog };
import { toTemplateSourceMap } from "./source-map.js";
import type { MediaAuthoringFacadeModules } from "./plugin.shared.js";
import type {
  TemplateBundle as BundledTemplate,
  TemplateSourceMap as RawSourceMap,
} from "@superimg/types";
import { createProgramEntry, type MediaProgramSelection } from "./program-entry.js";
import { scriptModuleCode } from "./script-module.js";
import {
  exportRig,
  gridToPaths,
  hasFamiliarRigHeader,
  isInRigDirectory,
  isTomlImport,
  listSharedRigTomlFiles,
  RIG_FILE_SUFFIX,
  RIG_QUERY_SUFFIX,
  rigModuleCode,
  rigToPet,
  stripRigQuery,
  superimgRigVitePlugin,
  type ExportRigOptions,
  type ExportRigResult,
  type FamiliarExportedRig,
  type RigMoveFrame,
  type RigPetEntry,
  type RigShapePath,
} from "./rig-module.js";
import { compilerDiagnostics, normalizeCompilerError } from "../errors/compiler-diagnostics.js";
import { hashBytes, hashTemplateOutputs } from "../ir/pure/serialize.js";
import type { CompilerDiagnostic } from "@superimg/types";
export { TEMPLATE_COMPILER_BEHAVIOR };
export type { MediaProgramSelection } from "./program-entry.js";
export {
  exportRig,
  gridToPaths,
  hasFamiliarRigHeader,
  isInRigDirectory,
  isTomlImport,
  listSharedRigTomlFiles,
  RIG_FILE_SUFFIX,
  RIG_QUERY_SUFFIX,
  rigModuleCode,
  rigToPet,
  stripRigQuery,
  superimgRigVitePlugin,
  type ExportRigOptions,
  type ExportRigResult,
  type FamiliarExportedRig,
  type RigMoveFrame,
  type RigPetEntry,
  type RigShapePath,
};

export type { BundledTemplate, RawSourceMap };
export type { MediaAuthoringFacadeModules } from "./plugin.shared.js";

/** Compile an admitted native module and its browser bridge as one file set. */
export async function bundleNativeSurfaceModule(entryPoint: string, bridgeEntry?: string, options: Pick<BundleTemplateOptions, "onDependencies"> = {}): Promise<Readonly<{
  surfaceEntry: string;
  bridgeEntry: string;
  outputs: NonNullable<BundledTemplate["outputs"]>;
  outputSetIdentity: string;
  dependencies: readonly string[];
}>> {
  const surface = resolve(entryPoint);
  let bridge: string;
  if (bridgeEntry !== undefined) bridge = resolve(bridgeEntry);
  else {
    const resolver = createRequire(import.meta.url);
    try { bridge = resolver.resolve("@foxworth/superimg/internal/native-surface-browser"); }
    catch { bridge = resolver.resolve("@superimg/stdlib/viz/native-surface-browser"); }
  }
  const dependencies = observeDependencies(surface, options);
  const bundle = await rolldown({ input: { surface, bridge }, platform: "browser", ...templateRolldownInput(), plugins: [dependencies.plugin] });
  try {
    const { output } = await bundle.generate({ format: "es", sourcemap: true });
    const chunks = output.filter(item => item.type === "chunk");
    const emitted = new Set(output.map(item => item.fileName));
    for (const chunk of chunks) {
      for (const imported of [...chunk.imports, ...chunk.dynamicImports]) {
        if (!emitted.has(imported)) throw new Error(`Unresolved native module import: ${imported}`);
      }
    }
    const surfaceChunk = chunks.find(item => item.isEntry && item.name === "surface");
    const bridgeChunk = chunks.find(item => item.isEntry && item.name === "bridge");
    if (!surfaceChunk || !bridgeChunk) throw new Error("Native surface compiler did not emit both entries");
    const outputs: NonNullable<BundledTemplate["outputs"]> = Object.freeze(output.map(item => {
      if (item.type === "chunk") {
        const sourceMap = toTemplateSourceMap(item.map || { version: 3, sources: [], mappings: "" });
        Object.freeze(sourceMap.sources); Object.freeze(sourceMap.names); if (sourceMap.sourcesContent) Object.freeze(sourceMap.sourcesContent);
        return Object.freeze({ type: "chunk" as const, fileName: item.fileName, code: item.code, isEntry: item.isEntry, sourceMap: Object.freeze(sourceMap) });
      }
      const source = typeof item.source === "string" ? item.source : new Uint8Array(item.source);
      return Object.freeze({ type: "asset" as const, fileName: item.fileName, get source() { return typeof source === "string" ? source : new Uint8Array(source); } });
    }));
    return Object.freeze({ surfaceEntry: surfaceChunk.fileName, bridgeEntry: bridgeChunk.fileName, outputs, outputSetIdentity: hashTemplateOutputs(outputs), dependencies: Object.freeze(dependencies.files()) });
  } finally { await bundle.close(); }
}

function templateRolldownInput() {
  return templateBundlerInputOptions({
    alias: {
      "@foxworth/superimg/stdlib": "@superimg/stdlib",
    },
  });
}

function createTemplatePlugin(authoringFacades?: MediaAuthoringFacadeModules) {
  return createSuperimgPlugin(
    authoringFacades === undefined ? {} : { authoringFacades },
  );
}

function effectiveSourceAnalysis(options: Readonly<{
  sourceAnalysis?: MediaSourceAnalysisOptions;
  authoringFacades?: MediaAuthoringFacadeModules;
}>): MediaSourceAnalysisOptions | undefined {
  const configured = options.sourceAnalysis?.facades ?? [];
  const mapped = Object.keys(options.authoringFacades ?? {});
  const unresolved = configured.filter((specifier) => !mapped.includes(specifier));
  if (unresolved.length > 0) {
    throw new Error(
      `Authoring facade ${JSON.stringify(unresolved[0])} must have an authoringFacades module mapping`,
    );
  }
  if (mapped.length === 0) return options.sourceAnalysis;
  return {
    ...options.sourceAnalysis,
    facades: Object.freeze([
      ...new Set([...configured, ...mapped]),
    ]),
  };
}

/**
 * Extract a parsed sourcemap from the trailing `//# sourceMappingURL=data:...` comment.
 * Returns null when the bundle has no inline map (we always emit one, but defensive).
 */
export function extractInlineSourceMap(code: string): RawSourceMap | null {
  const match = code.match(
    /\/\/# sourceMappingURL=data:application\/json(?:;charset=utf-?8)?;base64,([A-Za-z0-9+/=]+)\s*$/,
  );
  if (!match) return null;
  try {
    const json = globalThis.atob
      ? globalThis.atob(match[1]!)
      : Buffer.from(match[1]!, "base64").toString("utf-8");
    return JSON.parse(json) as RawSourceMap;
  } catch {
    return null;
  }
}

/**
 * Bundle a template file, resolving all imports. Server-side only (Node/Bun/Deno).
 *
 * Returns the bundled code as a string. For runtime error enrichment with
 * mapped source locations, prefer {@link bundleTemplateWithMap}, which returns
 * `{ code, sourceMap, sourceFile }`.
 */
export interface BundleTemplateOptions {
  /** Project boundary for diagnostics; defaults to the entry directory. */
  projectRoot?: string;
  /** Minify the generated IIFE. Intended for distributable preview assets. */
  minify?: boolean;
  selection?: MediaProgramSelection;
  prepared?: PreparedMediaProgram;
  /** Defaults to inline so runtime errors retain source context. */
  sourcemap?: boolean | "inline";
  /** Additional authoring facades recognized during source projection. */
  sourceAnalysis?: MediaSourceAnalysisOptions;
  /** Host-defined facade specifiers mapped to absolute browser-safe module files. */
  authoringFacades?: MediaAuthoringFacadeModules;
  /** Trusted host-provided absolute-path source snapshots. */
  sourceOverrides?: Readonly<Record<string, string>>;
  /** Observe the exact textual input snapshot consumed by the compiler. */
  onSourceRead?: (file: string, source: string) => void;
  /** Observe local inputs during compilation, including unresolved relative imports. */
  onDependencies?: (inputs: { files: readonly string[]; directories: readonly string[] }) => void;
}

function observeDependencies(sourceFile: string, options: BundleTemplateOptions) {
  const files = new Set([sourceFile]);
  const directories = new Set<string>();
  const local = (id: string) => isAbsolute(id) && !id.includes(`${sep}node_modules${sep}`);
  const publish = () => options.onDependencies?.({ files: [...files].sort(), directories: [...directories].sort() });
  const plugin: import("rolldown").Plugin = {
    name: "superimg-local-dependencies",
    resolveId(specifier, importer) {
      if (importer && local(importer) && specifier.startsWith(".")) {
        // Watch the directory too: an extensionless missing import may later
        // become helper.ts, helper.js, or a directory with an index module.
        directories.add(dirname(resolve(dirname(importer), specifier)));
        publish();
      }
      return null;
    },
    buildEnd() {
      for (const id of this.getModuleIds()) if (local(id)) files.add(id);
      publish();
    },
  };
  return { plugin, files: () => [...files].sort() };
}

export interface PreparedMediaProgram {
  readonly code: string;
  readonly sourceText: string;
  readonly sourceFile: string;
  readonly resolveDir: string;
  readonly descriptor: SourceDescriptor;
  readonly projectionIdentity: string;
}
interface PreparedState {
  options: BundleTemplateOptions;
  fingerprint: string;
  modules: Map<string, Promise<string>>;
  resolutions: Map<string, Promise<Awaited<ReturnType<import("rolldown").PluginContext["resolve"]>>>>;
  nativeModules: Map<string, Promise<Awaited<ReturnType<typeof bundleNativeSurfaceModule>>>>;
  unresolved: ReturnType<typeof unresolvedImports>;
}
const preparedStates = new WeakMap<PreparedMediaProgram, PreparedState>();
const parserVersion = createRequire(import.meta.url)("oxc-parser/package.json").version as string;
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

interface SourceNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function sourceNode(value: unknown): value is SourceNode {
  return typeof value === "object" && value !== null &&
    typeof (value as SourceNode).type === "string" &&
    typeof (value as SourceNode).start === "number" &&
    typeof (value as SourceNode).end === "number";
}

/** Preserve the entry's source URL when projecting it into an IIFE. */
function bindEntryImportMetaUrl(code: string, sourceFile: string): string {
  if (!code.includes("import.meta")) return code;
  // OXC spans identify syntax rather than matching text inside strings or
  // comments. Syntax diagnostics remain owned by analyzeMediaSource().
  const parsed = parseSync(sourceFile, code, { range: true, sourceType: "module" });
  if (parsed.errors.some((error) => error.severity === "Error")) return code;
  const spans: Array<{ start: number; end: number }> = [];
  const seen = new Set<object>();
  const walk = (value: unknown): void => {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);
    if (sourceNode(value)) {
      const object = value.object;
      const property = value.property;
      if (value.type === "MemberExpression" && value.computed === false &&
        sourceNode(object) && object.type === "MetaProperty" &&
        sourceNode(object.meta) && object.meta.name === "import" &&
        sourceNode(object.property) && object.property.name === "meta" &&
        sourceNode(property) && property.type === "Identifier" && property.name === "url") {
        spans.push({ start: value.start, end: value.end });
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "parent" || key === "range") continue;
      if (Array.isArray(child)) child.forEach(walk);
      else if (typeof child === "object") walk(child);
    }
  };
  walk(parsed.program);
  if (spans.length === 0) return code;
  const replacement = JSON.stringify(pathToFileURL(sourceFile).href);
  for (const span of spans.sort((a, b) => b.start - a.start)) {
    code = code.slice(0, span.start) + replacement + code.slice(span.end);
  }
  return code;
}

/** One host-owned entry/projection; module reads are shared for its lifetime. */
export async function prepareMediaProgram(entryPoint: string, options: BundleTemplateOptions = {}): Promise<PreparedMediaProgram> {
  const sourceFile = resolve(entryPoint);
  try {
    const sourceText = options.sourceOverrides?.[sourceFile] ?? await readFile(sourceFile, "utf8");
    options.onSourceRead?.(sourceFile, sourceText);
    return prepareMediaProgramCode(sourceText, { ...options, sourcefile: sourceFile });
  }
  catch (error) { throw normalizeCompilerError(error, "source", sourceFile); }
}

function canonicalPath(path: string): string {
  try { return realpathSync(path); } catch { return resolve(path); }
}

function defaultProjectRoot(sourceFile: string): string {
  const entryDirectory = dirname(sourceFile);
  let directory = entryDirectory;
  while (true) {
    if (["package.json", "_config.ts"].some(name => existsSync(join(directory, name)))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return entryDirectory;
    directory = parent;
  }
}

function prepareMediaProgramCode(sourceText: string, options: BundleTemplateCodeOptions): PreparedMediaProgram {
  const resolveDir = options.resolveDir ?? process.cwd();
  const sourceFile = resolve(resolveDir, options.sourcefile ?? "stdin.ts");
  try {
    const sourceAnalysis = effectiveSourceAnalysis(options);
    const descriptor = analyzeMediaSource(sourceText, sourceFile, sourceAnalysis);
    const code = bindEntryImportMetaUrl(descriptor.mediaProjection.code, sourceFile);
    const prepared = freeze({ code, sourceText, sourceFile, resolveDir: dirname(sourceFile), descriptor, projectionIdentity: hashBytes(code) });
    const authoringFacades = freeze({ ...options.authoringFacades });
    const projectRoot = canonicalPath(options.projectRoot ?? defaultProjectRoot(sourceFile));
    const facadePaths = new Set(Object.values(authoringFacades).map(canonicalPath));
    const isProjectSource = (file: string) => {
      const absolute = canonicalPath(file);
      const within = relative(projectRoot, absolute);
      if (within.startsWith(`..${sep}`) || within === ".." || isAbsolute(within) || facadePaths.has(absolute)) return false;
      const parts = within.split(sep);
      if (parts.includes("node_modules")) return false;
      for (let index = 0; index < parts.length - 1; index++) {
        if (parts[index] !== "dist") continue;
        const parent = join(projectRoot, ...parts.slice(0, index));
        if (index === 0 || existsSync(join(parent, "package.json"))) return false;
      }
      return true;
    };
    const frozenAnalysis = sourceAnalysis ? freeze({ ...sourceAnalysis, ...(sourceAnalysis.facades ? { facades: [...sourceAnalysis.facades] } : {}) }) : undefined;
    preparedStates.set(prepared, { options: { projectRoot, ...(frozenAnalysis ? { sourceAnalysis: frozenAnalysis } : {}), authoringFacades },
      fingerprint: JSON.stringify({ behavior: TEMPLATE_COMPILER_BEHAVIOR, rolldown: VERSION, parser: parserVersion, projectRoot, sourceAnalysis, authoringFacades }), modules: new Map(), resolutions: new Map(), nativeModules: new Map(), unresolved: unresolvedImports(isProjectSource, {
        relativeFile: file => relative(projectRoot, canonicalPath(file)).split(sep).join("/"),
        onSkipped: (specifier, file) => logBundlerDebug("unresolved:skipped", { kind: "bundleTemplateWithMap", entry: sourceFile }, { specifier, file }),
      }) });
    return prepared;
  } catch (error) { throw normalizeCompilerError(error, "source", sourceFile); }
}

export async function preparedMediaInputIdentity(prepared: PreparedMediaProgram, selection: MediaProgramSelection = {}): Promise<string> {
  const state = preparedStates.get(prepared);
  if (!state) throw new TypeError("Prepared media program belongs to a different compiler");
  const modules = await Promise.all([...state.modules].map(async ([id, code]) => [id, hashBytes(await code)] as const));
  const resolutions = await Promise.all([...state.resolutions].map(async ([key, value]) => [key, (await value)?.id] as const));
  const native = await Promise.all([...state.nativeModules].map(async ([id, value]) => [id, (await value).outputSetIdentity] as const));
  return hashBytes(JSON.stringify([prepared.projectionIdentity, state.fingerprint, selection, modules.sort(([a], [b]) => a.localeCompare(b)), resolutions.sort(([a], [b]) => a.localeCompare(b)), native.sort(([a], [b]) => a.localeCompare(b))]));
}

async function sourceFor(entryPoint: string, options: BundleTemplateOptions): Promise<PreparedMediaProgram> {
  if (!options.prepared) return prepareMediaProgram(entryPoint, options);
  if (options.prepared.sourceFile !== resolve(entryPoint) || !preparedStates.has(options.prepared)) throw new TypeError("Prepared media program does not match the requested source");
  const state = preparedStates.get(options.prepared)!;
  if ((options.sourceAnalysis !== undefined || options.authoringFacades !== undefined || options.projectRoot !== undefined) &&
    JSON.stringify({ behavior: TEMPLATE_COMPILER_BEHAVIOR, rolldown: VERSION, parser: parserVersion, projectRoot: canonicalPath(options.projectRoot ?? defaultProjectRoot(options.prepared.sourceFile)), sourceAnalysis: effectiveSourceAnalysis(options), authoringFacades: options.authoringFacades ?? {} }) !== state.fingerprint) {
    throw new TypeError("Prepared media program does not match the requested compiler configuration");
  }
  return options.prepared;
}

function throwFailure(error: unknown, sourceFile: string, warnings: readonly CompilerDiagnostic[]): never {
  const diagnostics = [...compilerDiagnostics(error, "generate", sourceFile), ...warnings];
  try { rethrowBundleFailure(error); } catch (failure) {
    if (failure && typeof failure === "object") Object.assign(failure, { compilerDiagnostics: diagnostics });
    throw normalizeCompilerError(failure, "generate", sourceFile);
  }
}

async function emitProgram(prepared: PreparedMediaProgram, format: "iife" | "es", options: BundleTemplateOptions): Promise<BundledTemplate> {
  options = { ...options, selection: JSON.parse(JSON.stringify(options.selection ?? {})) as MediaProgramSelection };
  const state = preparedStates.get(prepared);
  if (!state) throw new TypeError("Unknown prepared media program");
  const nativeDependencies = new Set<string>();
  const nativeDirectories = new Set<string>();
  let ordinaryFiles: readonly string[] = [];
  let ordinaryDirectories: readonly string[] = [];
  const publishDependencies = () => options.onDependencies?.({ files: [...new Set([...ordinaryFiles, ...nativeDependencies])].sort(), directories: [...new Set([...ordinaryDirectories, ...nativeDirectories])].sort() });
  const dependencies = observeDependencies(prepared.sourceFile, { ...options, onDependencies(inputs) {
    ordinaryFiles = inputs.files; ordinaryDirectories = inputs.directories; publishDependencies();
  } });
  const diagnostics: CompilerDiagnostic[] = [...prepared.descriptor.diagnostics ?? []];
  const nativeIds = new Set<string>();
  const prefix = "\0superimg-native-surface:";
  const svgPrefix = "\0superimg-svg:";
  const svgPlugin: import("rolldown").Plugin = {
    name: "superimg-svg-source",
    resolveId(id, importer) {
      if (id.startsWith(svgPrefix)) return id;
      if (!id.endsWith("?superimg-svg")) return null;
      const path = id.slice(0, -"?superimg-svg".length);
      if (!importer || !path.startsWith(".") || !path.toLowerCase().endsWith(".svg")) throw new TypeError("SVG imports must use a relative .svg file path");
      const resolved = resolve(dirname(importer), path);
      nativeDependencies.add(resolved); nativeDirectories.add(dirname(resolved)); publishDependencies();
      return svgPrefix + resolved;
    },
    async load(id) {
      if (!id.startsWith(svgPrefix)) return null;
      const path = id.slice(svgPrefix.length);
      let content = state.modules.get(id);
      if (!content) {
        content = readFile(path).then(bytes => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
        state.modules.set(id, content);
      }
      return `export default new TextEncoder().encode(${JSON.stringify(await content)});`;
    },
  };
  const nativePlugin: import("rolldown").Plugin = {
    name: "superimg-native-surface",
    resolveId(id, importer) {
      if (id.startsWith(prefix)) return id;
      if (!id.endsWith("?superimg-surface")) return null;
      const path = id.slice(0, -"?superimg-surface".length);
      if (!importer || !path.startsWith(".")) throw new TypeError("Native surface imports must use a relative file path");
      const resolved = resolve(dirname(importer), path);
      nativeDependencies.add(resolved);
      nativeDirectories.add(dirname(resolved));
      publishDependencies();
      const virtual = prefix + resolved;
      nativeIds.add(virtual);
      return virtual;
    },
    async load(id) {
      if (!id.startsWith(prefix)) return null;
      const path = id.slice(prefix.length);
      let work = state.nativeModules.get(path);
      if (!work) { work = bundleNativeSurfaceModule(path, undefined, { onDependencies(inputs) {
        for (const file of inputs.files) nativeDependencies.add(file);
        for (const directory of inputs.directories) nativeDirectories.add(directory);
        publishDependencies();
      } }); state.nativeModules.set(path, work); }
      const result = await work;
      for (const dependency of result.dependencies) { nativeDependencies.add(dependency); nativeDirectories.add(dirname(dependency)); }
      publishDependencies();
      const base = `https://superimg-native.invalid/${result.outputSetIdentity}/`;
      // The browser projection references host-served URLs; the host evaluates
      // its IIFE with the prepared closure supplied separately by the bundle.
      const outputs = format === "iife"
        ? `__superimgNativeModules[${JSON.stringify(result.outputSetIdentity)}]`
        : "[]";
      return `const outputs = ${outputs};
${format === "iife" ? 'if (!outputs) throw new Error("Missing prepared native surface module set; evaluate the complete template bundle");' : ""}
export default { identity: ${JSON.stringify(result.outputSetIdentity)}, moduleUrl: ${JSON.stringify(base + result.surfaceEntry)}, bridgeUrl: ${JSON.stringify(base + result.bridgeEntry)}, outputs };`;
    },
  };
  // A film reads its script by importing the file: `import script from "../x.script.md"`.
  // The module holds only what a film may see, so storyboards and Markdown prose never reach a frame.
  const scriptPlugin: import("rolldown").Plugin = {
    name: "superimg-script-source",
    async load(id) {
      if (!isAbsolute(id) || !id.toLowerCase().endsWith(".script.md")) return null;
      let text = state.modules.get(id);
      if (!text) { text = readFile(id, "utf8"); state.modules.set(id, text); }
      const source = await text;
      options.onSourceRead?.(id, source);
      return { code: scriptModuleCode(source, id), moduleType: "js" };
    },
  };
  // A film or cast module imports a Familiar rig directly: `import pig from "./pig.toml"`.
  const rigPrefix = "\0superimg-rig:";
  const rigPlugin: import("rolldown").Plugin = {
    name: "superimg-rig-source",
    resolveId(id, importer) {
      if (id.startsWith(rigPrefix)) return id;
      if (!id.endsWith(RIG_QUERY_SUFFIX)) return null;
      const path = id.slice(0, -RIG_QUERY_SUFFIX.length);
      if (!importer || !path.startsWith(".") || !path.toLowerCase().endsWith(".toml")) {
        throw new TypeError("Rig ?rig imports must use a relative .toml file path");
      }
      const resolved = resolve(dirname(importer), path);
      nativeDependencies.add(resolved);
      nativeDirectories.add(dirname(resolved));
      publishDependencies();
      return rigPrefix + resolved;
    },
    async load(id) {
      const hasRigQuery = id.startsWith(rigPrefix);
      const path = hasRigQuery ? id.slice(rigPrefix.length) : id;
      if (!isAbsolute(path) || !path.toLowerCase().endsWith(".toml")) return null;
      const result = await exportRig(path, {
        projectFrom: prepared.sourceFile,
        hasRigQuery,
        ...(options.onSourceRead ? { onSourceRead: options.onSourceRead } : {}),
      });
      for (const dependency of result.dependencies) {
        nativeDependencies.add(dependency);
        nativeDirectories.add(dirname(dependency));
        if (!state.modules.has(dependency)) {
          state.modules.set(dependency, readFile(dependency, "utf8"));
        }
      }
      publishDependencies();
      return { code: rigModuleCode(result.pet), moduleType: "js" };
    },
  };
  const entry = createProgramEntry(prepared.sourceFile, options.selection, () => [...nativeIds].sort());
  const input = templateRolldownInput();
  const snapshotPlugin: import("rolldown").Plugin = {
    name: "superimg-input-snapshot",
    resolveId(id, importer, resolveOptions) {
      if (id === prepared.sourceFile) return id;
      const key = JSON.stringify([importer, id, resolveOptions.kind, resolveOptions.isEntry]);
      let resolution = state.resolutions.get(key);
      if (!resolution) { resolution = this.resolve(id, importer, { ...resolveOptions, skipSelf: true }); state.resolutions.set(key, resolution); }
      return resolution;
    },
    async load(id) {
      if (id === prepared.sourceFile) return prepared.code;
      if (!isAbsolute(id) || !/\.(?:[cm]?[jt]sx?|json)$/.test(id)) return null;
      let code = state.modules.get(id);
      if (!code) { code = options.sourceOverrides?.[id] === undefined ? readFile(id, "utf8") : Promise.resolve(options.sourceOverrides[id]!); state.modules.set(id, code); }
      const text = await code;
      options.onSourceRead?.(id, text);
      return text;
    },
  };
  let bundle: Awaited<ReturnType<typeof rolldown>> | undefined;
  const debug = { kind: "bundleTemplateWithMap" as const, entry: prepared.sourceFile };
  try {
    bundle = await rolldown({ input: entry.id, ...input, plugins: [dependencies.plugin, svgPlugin, scriptPlugin, rigPlugin, nativePlugin, snapshotPlugin, entry.plugin, createTemplatePlugin(state.options.authoringFacades)],
      onLog(level, log, handler) {
        state.unresolved.observe(log);
        if (state.unresolved.isGuessedGlobal(log)) return;
        diagnostics.push(...compilerDiagnostics(log, "transform", prepared.sourceFile).map(item => ({ ...item, severity: level === "warn" ? "warning" as const : "info" as const })));
        input.onLog(level, log, handler);
      },
    });
    const outputOptions = { ...(format === "iife" ? TEMPLATE_IIFE_OUTPUT : { format: "es" as const }), sourcemap: options.sourcemap ?? true, minify: options.minify ?? false };
    logBundlerDebug("rolldown:built", debug, { outputOptions, projectionIdentity: prepared.projectionIdentity });
    const { output } = await bundle.generate(outputOptions);
    state.unresolved.assertResolved(output);
    logBundlerDebug("generate:ok", debug, { chunkCount: output.length, chunks: output.map(chunk => ({ fileName: chunk.fileName, type: chunk.type, bytes: "code" in chunk ? chunk.code.length : undefined })) });
    const chunk = output.filter(item => item.type === "chunk").find(item => item.isEntry);
    if (!chunk) throw new Error("Compiler did not emit a media program");
    const outputs: NonNullable<BundledTemplate["outputs"]> = Object.freeze(output.map(item => {
      if (item.type === "chunk") {
        const sourceMap = toTemplateSourceMap(item.map || { version: 3, sources: [], mappings: "" });
        Object.freeze(sourceMap.sources);
        Object.freeze(sourceMap.names);
        if (sourceMap.sourcesContent) Object.freeze(sourceMap.sourcesContent);
        return Object.freeze({ type: "chunk" as const, fileName: item.fileName, code: item.code, isEntry: item.isEntry, sourceMap: Object.freeze(sourceMap) });
      }
      const source = typeof item.source === "string" ? item.source : new Uint8Array(item.source);
      return Object.freeze({ type: "asset" as const, fileName: item.fileName, get source() { return typeof source === "string" ? source : new Uint8Array(source); } });
    }));
    const outputSetIdentity = hashTemplateOutputs(outputs);
    const nativeModuleSets = await Promise.all([...nativeIds].sort().map(async id => {
      const native = await state.nativeModules.get(id.slice(prefix.length))!;
      return Object.freeze({ identity: native.outputSetIdentity, outputs: native.outputs });
    }));
    return { code: chunk.code, sourceMap: toTemplateSourceMap(chunk.map || { version: 3, sources: [], mappings: "" }), sourceFile: prepared.sourceFile,
      dependencies: [...new Set([...dependencies.files(), ...nativeDependencies])].sort(), inputIdentity: await preparedMediaInputIdentity(prepared, options.selection), projectionIdentity: prepared.projectionIdentity,
      outputIdentity: hashBytes(chunk.code), outputSetIdentity, outputs, ...(nativeModuleSets.length ? { nativeModuleSets: Object.freeze(nativeModuleSets) } : {}), diagnostics: Object.freeze(diagnostics) };
  } catch (error) {
    logBundlerDebug("generate:fail", debug, { format, error: error instanceof Error ? error.message : String(error) });
    return throwFailure(error, prepared.sourceFile, diagnostics);
  }
  finally { await bundle?.close(); }
}

/** The paired outputs consume the same entry and module read snapshot. */
export async function bundleMediaProgramPair(entryPoint: string, options: BundleTemplateOptions = {}): Promise<{ iife: BundledTemplate; esm: BundledTemplate }> {
  options = { ...options, selection: JSON.parse(JSON.stringify(options.selection ?? {})) as MediaProgramSelection };
  const prepared = await sourceFor(entryPoint, options);
  const iife = await emitProgram(prepared, "iife", options);
  const esm = await emitProgram(prepared, "es", options);
  const inputIdentity = await preparedMediaInputIdentity(prepared, options.selection);
  return { iife: { ...iife, inputIdentity }, esm: { ...esm, inputIdentity } };
}

export async function bundleTemplate(entryPoint: string, options: BundleTemplateOptions = {}): Promise<string> {
  return (await bundleMediaProgram(entryPoint, { ...options, sourcemap: options.sourcemap ?? "inline" })).code;
}
export async function bundleTemplateWithMap(entryPoint: string, options: BundleTemplateOptions = {}): Promise<BundledTemplate> {
  return bundleMediaProgram(entryPoint, options);
}
export async function bundleMediaProgram(entryPoint: string, options: BundleTemplateOptions = {}): Promise<BundledTemplate> {
  logBundlerEntry({ kind: "bundleTemplateWithMap", entry: entryPoint });
  return emitProgram(await sourceFor(entryPoint, options), "iife", options);
}
export async function bundleTemplateESM(entryPoint: string, options: BundleTemplateOptions = {}): Promise<string> {
  return (await emitProgram(await sourceFor(entryPoint, options), "es", { ...options, minify: options.minify ?? true, sourcemap: options.sourcemap ?? false })).code;
}
export async function bundleTemplateESMWithMap(entryPoint: string, options: BundleTemplateOptions = {}): Promise<BundledTemplate> {
  return emitProgram(await sourceFor(entryPoint, options), "es", options);
}
export interface BundleTemplateCodeOptions extends BundleTemplateOptions {
  resolveDir?: string;
  sourcefile?: string;
}
export async function bundleTemplateCode(code: string, resolveDirOrOptions?: string | BundleTemplateCodeOptions): Promise<string> {
  const options = typeof resolveDirOrOptions === "string" ? { resolveDir: resolveDirOrOptions } : resolveDirOrOptions ?? {};
  return (await emitProgram(prepareMediaProgramCode(code, options), "iife", { ...options, sourcemap: options.sourcemap ?? "inline" })).code;
}
export async function bundleTemplateCodeWithMap(code: string, options: BundleTemplateCodeOptions = {}): Promise<BundledTemplate> {
  return emitProgram(prepareMediaProgramCode(code, options), "iife", options);
}
