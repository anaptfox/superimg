import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { image } from "@superimg/types";
import * as edge from "@superimg/core/edge";
import { prepareRuntimeResources } from "./resources.js";

vi.mock("@superimg/core/edge", async (original) => {
  const module = await original<typeof import("@superimg/core/edge")>();
  return { ...module, bytesDataUrl: vi.fn(module.bytesDataUrl) };
});
afterEach(() => vi.mocked(edge.bytesDataUrl).mockClear());
describe("resource metadata and lazy projection", () => {
  it("owns bytes and hashes without encoding, then materializes an immutable projection once", async () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255]);
    const media = image({ assets: { mark: { bytes, mimeType: "image/png" } }, render: () => { throw Error("not rendering"); } });
    const resources = await prepareRuntimeResources(media, fetch, undefined, false);
    expect(resources.findings).toEqual([]);
    expect(resources.assets[0]).toMatchObject({ name: "mark", byteLength: 5, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(edge.bytesDataUrl).not.toHaveBeenCalled();
    bytes.fill(99);
    const urls = resources.assetUrls;
    expect(urls.mark).toBe("data:image/png;base64,AAEC/v8=");
    expect(resources.assetUrls).toBe(urls);
    expect(Object.isFrozen(urls)).toBe(true);
    expect(resources.assetMetadata.mark).toMatchObject({ url: urls.mark });
    expect(edge.bytesDataUrl).toHaveBeenCalledTimes(1);
  });
  it("defers font CSS while retaining the owned faces for measurement", async () => {
    const input = new Uint8Array(readFileSync(join(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf")));
    const expected = Buffer.from(input).toString("base64");
    const resources = await prepareRuntimeResources(image({ fonts: [{ family: "Fixture", weight: 400, src: input }], render: () => { throw Error("not rendering"); } }), fetch, undefined, false);
    expect(resources.findings).toEqual([]);
    expect(resources.fonts).toHaveLength(1);
    expect(resources.fontBuffers[0]).not.toBe(input);
    expect(edge.bytesDataUrl).not.toHaveBeenCalled();
    input.fill(0);
    const css = resources.fontCss;
    expect(css[0]).toContain(`data:font/ttf;base64,${expected}`);
    expect(resources.fontCss).toBe(css);
    expect(Object.isFrozen(css)).toBe(true);
    expect(edge.bytesDataUrl).toHaveBeenCalledTimes(1);
  });
  it("projects a selected collection face as a standalone browser font", async () => {
    const regular = readFileSync(join(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf"));
    const bold = readFileSync(join(process.cwd(), "../superimg-core/assets/fonts/Inter-700.ttf"));
    const header = Buffer.alloc(20);
    header.write("ttcf", 0, "ascii");
    header.writeUInt32BE(0x00010000, 4);
    header.writeUInt32BE(2, 8);
    const pad = Buffer.alloc((4 - regular.length % 4) % 4);
    const offsets = [header.length, header.length + regular.length + pad.length];
    header.writeUInt32BE(offsets[0]!, 12);
    header.writeUInt32BE(offsets[1]!, 16);
    const collection = Buffer.concat([header, regular, pad, bold]);
    for (const [index, original] of [regular, bold].entries()) {
      for (let i = 0; i < original.readUInt16BE(4); i++) {
        const offset = offsets[index]! + 12 + i * 16 + 8;
        collection.writeUInt32BE(collection.readUInt32BE(offset) + offsets[index]!, offset);
      }
    }
    const input = new Uint8Array(collection);
    const resources = await prepareRuntimeResources(image({ fonts: [{ family: "Fixture", weight: 700, src: input }], render: () => { throw Error("not rendering"); } }), fetch, undefined, false);
    expect(resources.findings).toEqual([]);
    expect(resources.fontBuffers[0]).toEqual(input);
    let css: string;
    vi.stubGlobal("Buffer", undefined);
    try { css = resources.fontCss[0]!; }
    finally { vi.unstubAllGlobals(); }
    expect(css).toContain('format("truetype")');
    const encoded = /base64,([^\"]+)/.exec(css)?.[1];
    expect(encoded).toBeDefined();
    const prepared = new Uint8Array(Buffer.from(encoded!, "base64"));
    expect(Buffer.compare(Buffer.from(prepared), Buffer.from(edge.aliasSvgFont(bold, "Fixture", 700)))).toBe(0);
    expect(resources.fontBuffers[0]).toEqual(input);
  }, 15_000);
  it("does not materialize a cancelled operation", async () => {
    const controller = new AbortController();
    const resources = await prepareRuntimeResources(image({ assets: { x: { bytes: new Uint8Array([1]), mimeType: "image/png" } }, render: () => { throw Error("not rendering"); } }), fetch, controller.signal, false);
    controller.abort();
    expect(() => resources.assetUrls).toThrow();
    expect(() => resources.fontCss).toThrow();
    expect(edge.bytesDataUrl).not.toHaveBeenCalled();
  });
});
