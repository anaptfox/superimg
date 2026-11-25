import { describe, expect, it } from "vitest";
import { hashTemplateOutputs } from "./pure/serialize.js";
import { parseNativeArtifact, serializeNativeArtifact } from "./native-artifact.js";

describe("native artifact closure", () => {
  it("round-trips binary assets and source maps and refuses changed content", () => {
    const outputs = [
      { type: "chunk" as const, fileName: "world.js", code: "export default 1", isEntry: true, sourceMap: { version: 3, sources: ["world.ts"], names: [], mappings: "AAAA", sourcesContent: ["export default 1"] } },
      { type: "asset" as const, fileName: "texture.bin", source: new Uint8Array([0, 127, 128, 255]) },
    ];
    const identity = hashTemplateOutputs(outputs);
    const encoded = serializeNativeArtifact([{ identity, outputs }]);
    expect(parseNativeArtifact(encoded)).toEqual([{ identity, outputs }]);
    expect(() => parseNativeArtifact(encoded.replace("export default 1", "export default 2"))).toThrow(/identity/);
    expect(() => parseNativeArtifact(encoded.replace("texture.bin", "../texture.bin"))).toThrow(/filename/);
    expect(() => parseNativeArtifact(encoded.replace("AH+A/w==", "AH+A/w==!"))).toThrow(/base64/);
  });
  it("stores a matching emitted map once and retains legacy and nonmatching maps", () => {
    const sourceMap = { version: 3, sources: ["world.ts"], names: [], mappings: "AAAA", file: "world.js", sourcesContent: ["example source"] };
    const mapAsset = JSON.stringify({ version: 3, file: "world.js", sources: ["world.ts"], sourcesContent: ["example source"], names: [], mappings: "AAAA" });
    const chunk = { type: "chunk" as const, fileName: "world.js", code: "export default 1", isEntry: true, sourceMap };
    const map = { type: "asset" as const, fileName: "world.js.map", source: mapAsset };
    const outputs = [chunk, map];
    const set = { identity: hashTemplateOutputs(outputs), outputs };
    const encoded = serializeNativeArtifact([set]);
    expect(encoded).toContain('"sourceMapAsset":"world.js.map"');
    expect(parseNativeArtifact(encoded)).toEqual([set]);
    expect(() => parseNativeArtifact(encoded.replace('"schemaVersion":2', '"schemaVersion":3'))).toThrow(/Unsupported native module artifact version/);
    const legacy = JSON.stringify({ schemaVersion: 1, sets: [{ identity: set.identity, outputs: [chunk, { ...map, encoding: "utf8" }] }] });
    expect(parseNativeArtifact(legacy)).toEqual([set]);
    const mismatch = [{ ...chunk, sourceMap: { ...sourceMap, mappings: "BBBB" } }, map];
    const distinct = { identity: hashTemplateOutputs(mismatch), outputs: mismatch };
    expect(serializeNativeArtifact([distinct])).not.toContain("sourceMapAsset");
    expect(parseNativeArtifact(serializeNativeArtifact([distinct]))).toEqual([distinct]);
    expect(() => parseNativeArtifact(encoded.replace('"sourceMapAsset":"world.js.map"', '"sourceMapAsset":"missing.map"'))).toThrow(/Missing native module source map/);
  });
});
