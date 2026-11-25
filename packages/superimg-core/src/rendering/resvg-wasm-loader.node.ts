//! Node-only default loader for @resvg/resvg-wasm.
//! No static `node:` imports: browser builds reach this module through shared
//! core entries, and Node builtins are looked up only when a raster is needed.

import { installedAssetPaths } from "./package-assets.node-fallback.js";

interface NodeBuiltins {
  createRequire(filename: string): { resolve(specifier: string): string };
  readFile(path: string): Promise<Uint8Array>;
}

function nodeBuiltins(): NodeBuiltins | undefined {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  const moduleApi = proc?.getBuiltinModule?.("node:module") as Pick<NodeBuiltins, "createRequire"> | undefined;
  const fsApi = proc?.getBuiltinModule?.("node:fs/promises") as Pick<NodeBuiltins, "readFile"> | undefined;
  if (!moduleApi || !fsApi) return undefined;
  return { createRequire: moduleApi.createRequire, readFile: fsApi.readFile };
}

export async function loadDefaultWasm(): Promise<Uint8Array> {
  const node = nodeBuiltins();
  if (!node) throw new Error("The default resvg wasm loader needs Node (process.getBuiltinModule).");
  const candidates: string[] = [];
  try {
    candidates.push(node.createRequire(import.meta.url).resolve(wasmSpecifier()));
  } catch {
    // Bundled into an app (Next/Turbopack): the dependency is not resolvable
    // from the bundle's location.
  }
  candidates.push(...installedAssetPaths("resvg/index_bg.wasm"));
  for (const path of candidates) {
    try {
      return new Uint8Array(await node.readFile(path));
    } catch {
      // Try the next location.
    }
  }
  throw new Error(
    "Cannot load the resvg wasm: @resvg/resvg-wasm is not resolvable and no installed superimg package ships dist/assets/resvg/index_bg.wasm.",
  );
}

function wasmSpecifier(): string {
  return ["@resvg", "resvg-wasm", "index_bg.wasm"].join("/");
}
