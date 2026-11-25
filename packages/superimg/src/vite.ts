//! Vite SSR integration. The caller supplies its own Vite build function;
//! SuperImg does not load or own the application's compiler.
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isScriptFile, scriptModuleCode } from "@superimg/core/bundler";
export {
  exportRig,
  rigModuleCode,
  rigToPet,
  superimgRigVitePlugin,
  type ExportRigOptions,
  type ExportRigResult,
  type FamiliarExportedRig,
  type RigMoveFrame,
  type RigPetEntry,
  type RigShapePath,
} from "@superimg/core/bundler";

/** Load SuperImg scripts in Vite using the same film projection as the CLI. */
export function superimgScriptVite() {
  return {
    name: "superimg-script-source",
    enforce: "pre" as const,
    async load(id: string) {
      if (!isAbsolute(id) || !isScriptFile(id)) return null;
      return scriptModuleCode(await readFile(id, "utf8"), id);
    },
  };
}

interface EmittedChunk {
  readonly type: "chunk";
  readonly fileName: string;
  readonly code: string;
  readonly isEntry: boolean;
  readonly moduleIds: readonly string[];
  readonly imports?: readonly string[];
  readonly dynamicImports?: readonly string[];
}
interface EmittedAsset {
  readonly type: "asset";
  readonly fileName: string;
  readonly source: string | Uint8Array;
}

/** Compile trusted surface imports with the host's Vite, for Node SSR only. */
export function nativeSurfaceVite(options: Readonly<{
  build: (...args: never[]) => Promise<unknown>;
  world?: Readonly<{ resolve?: object; plugins?: readonly unknown[] }>;
}>) {
  const build = options.build as unknown as (config: object) => Promise<unknown>;
  const prefix = "\0superimg-vite-surface:";
  const suffix = "?superimg-surface";
  const imports = new Map<string, { entry: string; importers: Set<string>; dependencies: Set<string>; failed: boolean; generation: number; pending: number }>();
  type ViteHost = {
    watcher: { add(path: string): unknown; on(event: "add" | "change" | "unlink", callback: (path: string) => void): unknown };
    moduleGraph: { getModuleById(id: string): unknown; invalidateModule: (...args: never[]) => unknown };
  };
  let host: ViteHost | undefined;
  return {
    name: "superimg-native-surface",
    enforce: "pre" as const,
    configureServer(server: ViteHost) {
      host = server;
      const changed = (path: string) => {
        for (const [id, item] of imports) {
          if (!item.failed && item.pending === 0) continue;
          const within = relative(dirname(item.entry), path);
          if ((within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) && !item.dependencies.has(path)) continue;
          item.generation++;
          for (const affected of [id, ...item.importers]) {
            const module = server.moduleGraph.getModuleById(affected);
            if (module) (server.moduleGraph.invalidateModule as (value: unknown) => unknown)(module);
          }
        }
      };
      server.watcher.on("add", changed);
      server.watcher.on("change", changed);
      server.watcher.on("unlink", changed);
    },
    resolveId(id: string, importer?: string) {
      if (!id.endsWith(suffix)) return null;
      if (!importer || !id.startsWith(".")) throw new TypeError("Native surface imports must use a relative file path");
      const entry = resolve(dirname(importer), id.slice(0, -suffix.length));
      const virtual = prefix + entry;
      let item = imports.get(virtual);
      if (!item) { item = { entry, importers: new Set(), dependencies: new Set(), failed: false, generation: 0, pending: 0 }; imports.set(virtual, item); }
      item.importers.add(importer);
      return virtual;
    },
    async load(this: { addWatchFile(path: string): void }, id: string, context?: { ssr?: boolean }) {
      if (!id.startsWith(prefix)) return null;
      if (!context?.ssr) throw new TypeError("Native surface Vite imports require a Node SSR host");
      const entry = id.slice(prefix.length);
      this.addWatchFile(entry);
      host?.watcher.add(dirname(entry));
      const item = imports.get(id);
      const watchInput = (id: string) => {
        const path = id.split("?", 1)[0]!;
        if (!isAbsolute(path)) return;
        item?.dependencies.add(path);
        this.addWatchFile(path);
        if (!existsSync(path)) host?.watcher.add(dirname(path));
      };
      let result: unknown;
      let stable = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const generation = item?.generation;
        if (item) item.pending++;
        try {
          const observeInputs = { name: "superimg-observe-world-inputs", enforce: "pre", load(sourceId: string) { watchInput(sourceId); return null; } };
          result = await build({ configFile: false, logLevel: "silent", ...(options.world?.resolve === undefined ? {} : { resolve: options.world.resolve }), plugins: [observeInputs, ...(options.world?.plugins ?? [])], build: { write: false, sourcemap: true, minify: false, lib: { entry, formats: ["es"], fileName: () => "world.js" } } });
        } catch (error) {
          if (item && item.generation !== generation) continue;
          if (item) item.failed = true;
          throw error;
        } finally {
          if (item) item.pending--;
        }
        if (!item || item.generation === generation) { stable = true; break; }
      }
      if (!stable) { if (item) item.failed = true; throw new Error("Native surface kept changing during compilation; retry the current Vite module"); }
      if (item) item.failed = false;
      const results = Array.isArray(result) ? result : [result];
      const files: Record<string, string | Uint8Array> = {};
      let surfaceEntry: string | undefined;
      for (const group of results) {
        if (!group || typeof group !== "object" || !Array.isArray((group as { output?: unknown }).output)) throw new TypeError("Vite did not return emitted surface files");
        for (const file of (group as { output: (EmittedChunk | EmittedAsset)[] }).output) {
          if (Object.hasOwn(files, file.fileName)) throw new TypeError(`Duplicate native surface output: ${file.fileName}`);
          if (file.type === "chunk") {
            files[file.fileName] = file.code;
            for (const dependency of file.moduleIds) {
              const path = dependency.split("?", 1)[0]!;
              if (isAbsolute(path)) watchInput(path);
            }
            if (file.isEntry) {
              if (surfaceEntry) throw new TypeError("Vite emitted multiple native surface entries");
              surfaceEntry = file.fileName;
            }
          } else if (file.type === "asset") files[file.fileName] = file.source;
          else throw new TypeError("Unknown native surface output");
        }
      }
      if (!surfaceEntry) throw new TypeError("Vite did not emit a native surface entry");
      for (const group of results) {
        for (const file of (group as { output: (EmittedChunk | EmittedAsset)[] }).output) {
          if (file.type !== "chunk") continue;
          for (const dependency of [...(file.imports ?? []), ...(file.dynamicImports ?? [])]) {
            if (!Object.hasOwn(files, dependency)) throw new TypeError(`Unresolved native surface import: ${dependency}`);
          }
        }
      }
      const serializedFiles = Object.entries(files).map(([name, value]) => `${JSON.stringify(name)}: ${typeof value === "string" ? JSON.stringify(value) : `new Uint8Array(Buffer.from(${JSON.stringify(Buffer.from(value).toString("base64"))}, "base64"))`}`).join(",\n");
      return `import { prepareNativeSurface } from "@foxworth/superimg/runtime";\nconst prepared = await prepareNativeSurface({ entry: ${JSON.stringify(surfaceEntry)}, files: {${serializedFiles}} });\nexport default { ...prepared.module, outputs: prepared.nativeModuleSets[0].outputs };`;
    },
  };
}
