import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { fonts } from "@superimg/core";
import { googleFont, MEDIA_ELEMENT, svg, video, type AudioTimeline } from "@superimg/types";
import { prepareRuntimeResources } from "./resources.js";

afterEach(() => vi.restoreAllMocks());

describe("frozen font format", () => {
  it.each([
    [0x00010000, "font/ttf", "truetype"],
    [0x4f54544f, "font/otf", "opentype"],
    [0x74746366, "font/collection", "collection"],
  ] as const)("records the container bytes %s in metadata and CSS", async (signature, mimeType, format) => {
    const bytes = new Uint8Array(12);
    new DataView(bytes.buffer).setUint32(0, signature);
    vi.spyOn(fonts, "resolve").mockResolvedValue([{ family: "Fixture", weight: 400, style: "normal", data: bytes }]);
    const media = svg({ fonts: [googleFont("Fixture:wght@400")], render: () => ({
      $$typeof: MEDIA_ELEMENT, type: "Vector", props: { width: 10, height: 10 }, children: [],
    }) });
    const resources = await prepareRuntimeResources(media, fetch);
    expect(resources.findings).toEqual([]);
    const fixture = resources.fonts.find((font) => font.family === "Fixture");
    const css = resources.fontCss.find((rule) => rule.includes("Fixture"));
    expect(fixture).toMatchObject({ mimeType, byteLength: 12 });
    expect(css).toContain(`data:${mimeType};base64,`);
    expect(css).toContain(`format("${format}")`);
    expect(resources.fonts.some((font) => font.family === "Inter" && font.weight === 400)).toBe(true);
    expect(resources.fontBuffers.some((buffer) => buffer.byteLength === 12 && buffer[0] === bytes[0])).toBe(true);
  });
});

describe("local composition resources", () => {
  it("owns file URL asset and audio bytes before frame rendering", async () => {
    const directory = mkdtempSync(join(tmpdir(), "superimg-composition-resources-"));
    try {
      const assetPath = join(directory, "mark.svg");
      const audioPath = join(directory, "tick.wav");
      writeFileSync(assetPath, '<svg xmlns="http://www.w3.org/2000/svg"/>');
      writeFileSync(audioPath, new Uint8Array([82, 73, 70, 70]));
      const media = video({
        size: { width: 64, height: 64 }, fps: 25, duration: "1f",
        assets: { mark: { url: pathToFileURL(assetPath).href, type: "image" } },
        audio: { id: "tick", src: pathToFileURL(audioPath).href },
        render: () => ({ $$typeof: MEDIA_ELEMENT, type: "Html", props: { html: "" }, children: [] }),
      });
      const fetcher = vi.fn(() => { throw new Error("file URLs must be read locally"); });
      const resources = await prepareRuntimeResources(media, fetcher as never);
      expect(resources.findings).toEqual([]);
      expect(resources.assets).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "mark", mimeType: "image/svg+xml" }),
        expect.objectContaining({ name: "@audio/0", mimeType: "audio/wav" }),
      ]));
      expect(resources.assetUrls.mark).toMatch(/^data:image\/svg\+xml;base64,/);
      expect(resources.audio).toMatchObject({ clips: [expect.objectContaining({ id: "tick", src: expect.stringMatching(/^data:audio\/wav;base64,/) })] });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("lazy resource projection", () => {
  it("freezes and hashes before generating URLs, then reuses owned bytes", async () => {
    const { image } = await import("@superimg/types");
    const input = new Uint8Array([0, 1, 254, 255]);
    const encode = vi.spyOn(Buffer, "from");
    const resources = await prepareRuntimeResources(image({ assets: { mark: { bytes: input, mimeType: "image/png" } }, render: () => { throw Error("not rendering"); } }), fetch, undefined, false);
    expect(resources.assets[0]).toMatchObject({ byteLength: 4, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(encode).not.toHaveBeenCalled();
    input.fill(55);
    const urls = resources.assetUrls;
    expect(urls.mark).toBe("data:image/png;base64,AAH+/w==");
    expect(resources.assetUrls).toBe(urls);
    expect(resources.assetMetadata.mark?.url).toBe(urls.mark);
    expect(Object.isFrozen(urls)).toBe(true);
    expect(encode).toHaveBeenCalledTimes(1);
  });
  it("snapshots authored audio metadata before lazy source serialization", async () => {
    const audio: AudioTimeline = { clips: [{ id: "original", src: "https://example.test/tick.wav", volume: 0.4, at: "0.2s" }], mix: { master: 0.7 } };
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/wav" } }));
    const resources = await prepareRuntimeResources(video({ duration: "1s", audio, render: () => { throw Error("not rendering"); } }), fetcher as typeof fetch, undefined, false);
    expect(resources.findings).toEqual([]);
    Object.assign(audio.clips[0]!, { id: "changed", src: "https://example.test/changed.wav", volume: 0.9, at: "0.8s" });
    audio.clips.push({ id: "late", src: "https://example.test/late.wav" });
    audio.mix = { master: 0.1 };
    const projected = resources.audio;
    expect(projected).toMatchObject({ mix: { master: 0.7 }, clips: [{ id: "original", volume: 0.4, at: "0.2s", src: "data:audio/wav;base64,AQID" }] });
    expect((projected as AudioTimeline).clips).toHaveLength(1);
    expect(resources.audio).toBe(projected);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

});
