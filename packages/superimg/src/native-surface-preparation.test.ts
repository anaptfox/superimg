import { describe, expect, it } from "vitest";
import { prepareNativeSurface } from "./runtime.node.js";
import { hashTemplateOutputs } from "@superimg/core";

describe("preparing host-built native modules", () => {
  it("owns binary files and derives the existing output-set identity", async () => {
    const asset = new Uint8Array([1, 2, 3]);
    const prepared = await prepareNativeSurface({ entry: "world.js", files: { "world.js": "export default {}", "asset.bin": asset } });
    asset[0] = 9;
    const set = prepared.nativeModuleSets[0]!;
    expect(set.identity).toBe(hashTemplateOutputs(set.outputs));
    expect(prepared.module.identity).toBe(set.identity);
    expect(prepared.module.moduleUrl).toMatch(/\/world\.js$/);
    expect(set.outputs.find(file => file.fileName === "asset.bin")).toMatchObject({ source: new Uint8Array([1, 2, 3]) });
    const saved = set.outputs.find(file => file.fileName === "asset.bin");
    if (!saved || saved.type !== "asset" || !(saved.source instanceof Uint8Array)) throw new Error("Missing asset");
    saved.source[0] = 8;
    expect(hashTemplateOutputs(set.outputs)).toBe(set.identity);
  });

  it("rejects source files, unsafe names, and collisions with the bridge", async () => {
    await expect(prepareNativeSurface({ entry: "world.ts", files: { "world.ts": "export default {}" } })).rejects.toThrow(/built JavaScript/);
    await expect(prepareNativeSurface({ entry: "world.js", files: { "world.js": "", "../asset": "" } })).rejects.toThrow(/Invalid or reserved/);
    await expect(prepareNativeSurface({ entry: "world.js", files: { "world.js": "", "__superimg_bridge__.js": "" } })).rejects.toThrow(/Invalid or reserved/);
  });

  it("retains sidecar source-map metadata and refuses a malformed map", async () => {
    const map = { version: 3, sources: ["world.ts"], names: [], mappings: "AAAA", sourcesContent: ["export default {}"] };
    const prepared = await prepareNativeSurface({ entry: "world.js", files: { "world.js": "export default {}", "world.js.map": JSON.stringify(map) } });
    const world = prepared.nativeModuleSets[0]!.outputs.find(file => file.fileName === "world.js");
    expect(world?.type === "chunk" && world.sourceMap).toEqual(map);
    await expect(prepareNativeSurface({ entry: "world.js", files: { "world.js": "", "world.js.map": "not json" } })).rejects.toThrow(/Invalid source map/);
  });

  it("refuses preparation on browser and edge hosts", async () => {
    const browser = await import("./runtime.browser.js");
    const edge = await import("./runtime.edge.js");
    const options = { entry: "world.js", files: { "world.js": "export default {}" } };
    await expect(browser.prepareNativeSurface(options)).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
    await expect(edge.prepareNativeSurface(options)).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });
});
