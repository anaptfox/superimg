//! Versioned storage for the complete host-prepared native module closure.
import type { PreparedNativeModuleSet, TemplateBundle, TemplateSourceMap } from "@superimg/types";
import { hashTemplateOutputs } from "./pure/serialize.js";
import { MediaIRError } from "./pure/errors.js";
import { toTemplateSourceMap } from "../bundler/source-map.js";

type Output = NonNullable<TemplateBundle["outputs"]>[number];
const invalid = (message: string): never => { throw new MediaIRError("artifact_integrity", message); };
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

/** Verify identities before publication and retain text and binary assets exactly. */
export function serializeNativeArtifact(sets: readonly PreparedNativeModuleSet[]): string {
  const seen = new Set<string>();
  const records = sets.map(set => {
    if (!/^[a-f0-9]{64}$/.test(set.identity) || seen.has(set.identity) || hashTemplateOutputs(set.outputs) !== set.identity) invalid("Invalid native module set identity");
    seen.add(set.identity);
    const maps = new Map(set.outputs.flatMap(output => output.type === "asset" && typeof output.source === "string" ? [[output.fileName, output.source] as const] : []));
    return { identity: set.identity, outputs: set.outputs.map(output => {
      if (output.type === "asset") return { type: "asset", fileName: output.fileName, encoding: typeof output.source === "string" ? "utf8" : "base64", source: typeof output.source === "string" ? output.source : Buffer.from(output.source).toString("base64") };
      const name = `${output.fileName}.map`, source = maps.get(name);
      if (source !== undefined) {
        try {
          if (JSON.stringify(toTemplateSourceMap(JSON.parse(source))) === JSON.stringify(output.sourceMap)) {
            const { sourceMap: _map, ...chunk } = output;
            return { ...chunk, sourceMapAsset: name };
          }
        } catch { /* Keep the original metadata when a map cannot be reconstructed. */ }
      }
      return output;
    }) };
  });
  // Version the closure representation independently of the artifact envelope.
  // Existing schema-1 closure readers reject this representation rather than
  // interpreting a source-map reference as an embedded map.
  return JSON.stringify({ schemaVersion: 2, sets: records });
}

/** Decode only the published shape and independently verify each complete set. */
export function parseNativeArtifact(text: string): readonly PreparedNativeModuleSet[] {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return invalid("Invalid native module artifact JSON"); }
  if (!object(value) || !Array.isArray(value.sets)) return invalid("Invalid native module artifact");
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) throw new MediaIRError("invalid_schema", `Unsupported native module artifact version: ${String(value.schemaVersion)}`);
  const sets: PreparedNativeModuleSet[] = value.sets.map((candidate: unknown) => {
    if (!object(candidate) || typeof candidate.identity !== "string" || !Array.isArray(candidate.outputs)) return invalid("Invalid native module set");
    const maps = new Map<string, string>();
    for (const item of candidate.outputs) {
      if (object(item) && item.type === "asset" && item.encoding === "utf8" && typeof item.fileName === "string" && typeof item.source === "string") maps.set(item.fileName, item.source);
    }
    const filenames = new Set<string>();
    const outputs: Output[] = candidate.outputs.map((item: unknown) => {
      if (!object(item) || typeof item.fileName !== "string" || !item.fileName || item.fileName.startsWith("/") || item.fileName.split("/").some(segment => segment === ".." || segment === "." || segment === "") || /[%?#\\\s\x00-\x1f]/.test(item.fileName) || filenames.has(item.fileName)) return invalid("Invalid or duplicate native module filename");
      filenames.add(item.fileName);
      if (item.type === "chunk") {
        if (typeof item.code !== "string" || typeof item.isEntry !== "boolean" || (item.sourceMap !== undefined && item.sourceMapAsset !== undefined)) return invalid("Invalid native module chunk");
        let map: unknown = item.sourceMap;
        if (typeof item.sourceMapAsset === "string") {
          if (value.schemaVersion !== 2) return invalid("Source map references require native module schema 2");
          const source = maps.get(item.sourceMapAsset);
          if (source === undefined) return invalid("Missing native module source map asset");
          try { map = toTemplateSourceMap(JSON.parse(source)); } catch { return invalid("Invalid native module source map asset"); }
        }
        if (!object(map)) return invalid("Invalid native module chunk");
        if (map.version !== 3 || !Array.isArray(map.sources) || !map.sources.every(v => typeof v === "string") || !Array.isArray(map.names) || !map.names.every(v => typeof v === "string") || typeof map.mappings !== "string" || (map.file !== undefined && typeof map.file !== "string") || (map.sourceRoot !== undefined && typeof map.sourceRoot !== "string") || (map.sourcesContent !== undefined && (!Array.isArray(map.sourcesContent) || !map.sourcesContent.every(v => v === null || typeof v === "string")))) return invalid("Invalid native module source map");
        return { type: "chunk", fileName: item.fileName, code: item.code, isEntry: item.isEntry, sourceMap: map as unknown as TemplateSourceMap };
      }
      if (item.type !== "asset" || typeof item.source !== "string") return invalid("Invalid native module asset");
      if (item.encoding === "utf8") return { type: "asset", fileName: item.fileName, source: item.source };
      if (item.encoding !== "base64") return invalid("Invalid native module asset encoding");
      const bytes = Buffer.from(item.source, "base64");
      if (bytes.toString("base64") !== item.source) return invalid("Invalid native module base64");
      return { type: "asset", fileName: item.fileName, source: new Uint8Array(bytes) };
    });
    return { identity: candidate.identity, outputs };
  });
  // Reuse the publication checks, including duplicate identities and digest.
  serializeNativeArtifact(sets);
  return sets;
}
