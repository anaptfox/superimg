//! Node binder for `@foxworth/superimg/runtime`.

import { bindRuntimeApi, createRuntime } from "@superimg/core/runtime";
import { createNodeRuntimeAdapter } from "@superimg/node/runtime";
import {
  RuntimeCancelledError,
  type InitOptions,
  type Runtime,
} from "@superimg/types";
import { doctor, setup } from "@superimg/node";
import { hashTemplateOutputs, toTemplateSourceMap } from "@superimg/core";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import type { PreparedNativeModuleSet } from "@superimg/types";

export * from "./runtime.shared.js";

export { doctor, setup };

/** Prepare a host-built browser module for trusted Node rendering.
 * The host owns compilation and must supply the complete emitted closure.
 */
export async function prepareNativeSurface(options: Readonly<{
  entry: string;
  files: Readonly<Record<string, string | Uint8Array>>;
}>): Promise<Readonly<{
  module: Readonly<{ identity: string; moduleUrl: string; bridgeUrl: string }>;
  nativeModuleSets: readonly PreparedNativeModuleSet[];
}>> {
  const valid = (name: string) => !!name && !name.startsWith("/") && !name.split("/").some(part => !part || part === "." || part === "..") && !/[%?#\\\s\x00-\x1f]/.test(name);
  const bridgeName = "__superimg_bridge__.js";
  if (!valid(options.entry) || !/\.m?js$/.test(options.entry) || !Object.hasOwn(options.files, options.entry) || typeof options.files[options.entry] !== "string") throw new TypeError("Native surface entry must name a built JavaScript file in the prepared closure");
  const entries = Object.entries(options.files);
  if (entries.some(([name, value]) => !valid(name) || name === bridgeName || (typeof value !== "string" && !(value instanceof Uint8Array)))) throw new TypeError("Invalid or reserved native surface filename or content");
  const bridgePath = createRequire(import.meta.url).resolve("@foxworth/superimg/internal/native-surface-browser");
  const bridge = await readFile(bridgePath, "utf8");
  const emptyMap = { version: 3, sources: [] as string[], names: [] as string[], mappings: "" };
  Object.freeze(emptyMap.sources); Object.freeze(emptyMap.names); Object.freeze(emptyMap);
  function sourceMap(fileName: string) {
    const raw = options.files[`${fileName}.map`];
    if (raw === undefined) return emptyMap;
    let value: unknown;
    try { value = JSON.parse(typeof raw === "string" ? raw : new TextDecoder("utf-8", { fatal: true }).decode(raw)); }
    catch { throw new TypeError(`Invalid source map for ${fileName}`); }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`Invalid source map for ${fileName}`);
    const map = value as Record<string, unknown>;
    if (map.version !== 3 || !Array.isArray(map.sources) || !map.sources.every(item => typeof item === "string") || !Array.isArray(map.names) || !map.names.every(item => typeof item === "string") || typeof map.mappings !== "string" || (map.sourcesContent !== undefined && (!Array.isArray(map.sourcesContent) || !map.sourcesContent.every(item => item === null || typeof item === "string"))) || (map.file !== undefined && typeof map.file !== "string") || (map.sourceRoot !== undefined && typeof map.sourceRoot !== "string")) throw new TypeError(`Invalid source map for ${fileName}`);
    const normalized = toTemplateSourceMap(value);
    Object.freeze(normalized.sources); Object.freeze(normalized.names);
    if (normalized.sourcesContent) Object.freeze(normalized.sourcesContent);
    return Object.freeze(normalized);
  }
  const outputs: PreparedNativeModuleSet["outputs"] = Object.freeze([
    ...entries.map(([fileName, content]) => typeof content === "string" && /\.(?:m?js)$/.test(fileName)
      ? Object.freeze({ type: "chunk" as const, fileName, code: content, isEntry: fileName === options.entry, sourceMap: sourceMap(fileName) })
      : (() => { const owned = typeof content === "string" ? content : new Uint8Array(content); return Object.freeze({ type: "asset" as const, fileName, get source() { return typeof owned === "string" ? owned : new Uint8Array(owned); } }); })()),
    Object.freeze({ type: "chunk" as const, fileName: bridgeName, code: bridge, isEntry: true, sourceMap: emptyMap }),
  ]);
  const identity = hashTemplateOutputs(outputs);
  const base = `https://superimg-native.invalid/${identity}/`;
  return Object.freeze({ module: Object.freeze({ identity, moduleUrl: base + options.entry, bridgeUrl: base + bridgeName }), nativeModuleSets: Object.freeze([Object.freeze({ identity, outputs })]) });
}

export async function init(options: InitOptions = {}): Promise<Runtime> {
  if (options.signal?.aborted) throw new RuntimeCancelledError({ operation: "init" });
  const adapter = createNodeRuntimeAdapter({
    ...(options.poolStillPages === true ? { poolStillPages: true } : {}),
    ...(options.defaultFonts !== undefined ? { defaultFonts: options.defaultFonts } : {}),
  });
  if (options.signal?.aborted) {
    await adapter.dispose();
    throw new RuntimeCancelledError({ operation: "init" });
  }
  return createRuntime(adapter, options);
}

export const {
  check,
  inspect,
  inspectFile,
  render,
  renderResponse,
  exportMedia,
  startExport,
  startConversion,
  shutdown,
} = bindRuntimeApi(init, { idleDisposeMs: 2000 });
