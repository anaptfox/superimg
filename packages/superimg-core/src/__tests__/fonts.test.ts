import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { googleFont, image, MEDIA_ELEMENT } from "@superimg/types";
import { clearBundledInterCache, loadBundledInter } from "../rendering/bundled-inter.js";
import { fonts, resolveRuntimeFonts } from "../rendering/fonts.js";
import { digestMediaProgram, programDigestWithFonts } from "../runtime/semantic.js";
import { sha256Hex } from "../ir/pure/sha256.js";
import { assertNativeFont } from "../rendering/font-format.js";
import { nodeEnsureInit, rasterizeSvgSync } from "../rendering/resvg-rasterizer.node.js";

// Reuse the font shipped with the stdlib's pinned KaTeX dependency. No network
// or host system fonts participate in this glyph-rendering regression.
const requireStdlib = createRequire(new URL("../../../superimg-stdlib/package.json", import.meta.url));
const ttf = new Uint8Array(readFileSync(join(dirname(requireStdlib.resolve("katex")), "fonts/KaTeX_Main-Regular.ttf")));
const faceCss = `@font-face { font-family: 'KaTeX_Main'; font-style: normal; font-weight: 400; src: url(https://fonts.example/font.ttf) format('truetype'); }`;

afterEach(() => {
  fonts.clear();
  clearBundledInterCache();
  vi.unstubAllGlobals();
});

describe("native SVG font bytes", () => {
  it("requests raw TrueType and renders visible glyphs from the resolved bytes", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://fonts.googleapis.com/")) {
        // Google serves WOFF to Chrome 40 even though it is an old browser.
        expect(new Headers(init?.headers).get("User-Agent")).toBe("Mozilla/4.0");
        return new Response(faceCss);
      }
      return new Response(ttf);
    });
    vi.stubGlobal("fetch", fetcher);
    const [face] = await fonts.resolve([googleFont("KaTeX_Main:wght@400")]);
    expect(face?.data).toEqual(ttf);
    await nodeEnsureInit();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" fill="white"/><text x="10" y="42" font-family="KaTeX_Main" font-size="40">ABC</text></svg>`;
    const empty = rasterizeSvgSync(svg.replace(/<text.*?<\/text>/, ""), { width: 160 });
    const rendered = rasterizeSvgSync(svg, { width: 160, fontBuffers: [face!.data] });
    expect(rendered).not.toEqual(empty);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(["wOFF", "wOF2"])("rejects %s before caching or rasterizing instead of dropping text", async (signature) => {
    const webFont = new Uint8Array(12);
    webFont.set(new TextEncoder().encode(signature));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.startsWith("https://fonts.googleapis.com/")
      ? new Response(faceCss) : new Response(webFont)));
    await expect(fonts.resolve([googleFont("Unexpected:wght@400")])).rejects.toThrow(/TrueType\/OpenType.*WOFF/);
    expect(() => fonts.seed([{ url: "https://fonts.example/seed", data: webFont }])).toThrow(/WOFF/);
    expect(() => rasterizeSvgSync('<svg xmlns="http://www.w3.org/2000/svg"/>', { width: 10, fontBuffers: [webFont] })).toThrow(/WOFF/);
  });

  it("unpacks local WOFF1 bytes before the native font check", async () => {
    const woff = new Uint8Array(readFileSync(join(dirname(requireStdlib.resolve("katex")), "fonts/KaTeX_Main-Regular.woff")));
    const [face] = await fonts.resolve([{ family: "KaTeX_Main", src: woff }]);
    expect(new DataView(face!.data.buffer, face!.data.byteOffset, face!.data.byteLength).getUint32(0)).toBe(0x00010000);
  });

  it("rejects truncated and unknown font containers", () => {
    expect(() => assertNativeFont(new Uint8Array([0, 1, 0, 0]))).toThrow(/unrecognized/);
    expect(() => assertNativeFont(new TextEncoder().encode("not a font file"))).toThrow(/unrecognized/);
  });
});


describe("web font resolution", () => {
  const webFont = new Uint8Array(readFileSync(join(dirname(requireStdlib.resolve("katex")), "fonts/KaTeX_Main-Regular.woff2")));

  it("accepts browser font containers through the supplied fetch capability", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).startsWith("https://fonts.googleapis.com/")) {
        return new Response(faceCss);
      }
      return new Response(webFont);
    });
    const [face] = await fonts.resolve([googleFont("Fixture:wght@400")], { fetch: fetcher, format: "web" });
    expect(face).toMatchObject({ mimeType: "font/woff2", data: webFont });
    expect(new Headers(fetcher.mock.calls[0]![1]?.headers).has("User-Agent")).toBe(false);
    await fonts.resolve([googleFont("Fixture:wght@400")], { fetch: fetcher, format: "web" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(fonts.resolve([googleFont("Fixture:wght@400")], { fetch: fetcher, format: "native" })).rejects.toThrow(/WOFF/);
  });

  it("isolates fetch capabilities and cancellation without reusing network bytes", async () => {
    const nativeFetcher = vi.fn<typeof fetch>(async (url) => new Response(
      String(url).startsWith("https://fonts.googleapis.com/") ? faceCss : ttf));
    const webFetcher = vi.fn<typeof fetch>(async (url) => new Response(
      String(url).startsWith("https://fonts.googleapis.com/") ? faceCss : webFont));
    await fonts.resolve([googleFont("Fixture:wght@400")], { fetch: nativeFetcher });
    const controller = new AbortController();
    const [face] = await fonts.resolve([googleFont("Fixture:wght@400")], { fetch: webFetcher, format: "web", signal: controller.signal });
    expect(face?.mimeType).toBe("font/woff2");
    expect(webFetcher).toHaveBeenCalledTimes(2);
    controller.abort();
    await expect(fonts.resolve([googleFont("Fixture:wght@400")], { fetch: webFetcher, format: "web", signal: controller.signal })).rejects.toThrow();
    expect(webFetcher).toHaveBeenCalledTimes(2);
    await fonts.resolve([googleFont("Fixture:wght@400")], { fetch: webFetcher, format: "web" });
    expect(webFetcher).toHaveBeenCalledTimes(4);
  });
});

describe("font declarations", () => {
  it("rejects bare strings and points at googleFont()", async () => {
    await expect(fonts.resolve(["Anton"] as never)).rejects.toThrow(/FONT_DECLARATION_INVALID[\s\S]*googleFont\("Anton"\)/);
  });

  it("uses Uint8Array bytes without fetching", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    const [face] = await fonts.resolve(
      [{ family: "Fixture", weight: 500, style: "italic", src: ttf }],
      { fetch: fetcher },
    );
    expect(face).toMatchObject({ family: "Fixture", weight: 500, style: "italic", data: ttf });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reads a filesystem path", async () => {
    const path = fileURLToPath(new URL("../../assets/fonts/Inter-400.ttf", import.meta.url));
    const [face] = await fonts.resolve([{ family: "Packaged", weight: 400, src: path }]);
    expect(face?.family).toBe("Packaged");
    expect(face?.weight).toBe(400);
    expect(face?.data.byteLength).toBeGreaterThan(1000);
  });

  it("resolves bundled Inter while fetch throws", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("offline");
    });
    const resolved = await resolveRuntimeFonts([], { fetch: fetcher });
    expect(resolved.errors).toEqual([]);
    expect(resolved.faces.map((face) => face.weight).sort()).toEqual([400, 500, 700]);
    expect(resolved.faces.every((face) => face.family === "Inter")).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    const direct = await loadBundledInter({ fetch: fetcher });
    expect(direct).toHaveLength(3);
  });

  it("changes the program digest when resolved font bytes change", () => {
    const media = image({
      render: () => ({ $$typeof: MEDIA_ELEMENT, type: "Html", props: { html: "" }, children: [] }),
    });
    const base = digestMediaProgram(media);
    const first = programDigestWithFonts(base, [{ family: "Fixture", weight: 400, style: "normal", sha256: sha256Hex(ttf) }]);
    const flipped = ttf.slice();
    flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 0xff;
    const second = programDigestWithFonts(base, [{ family: "Fixture", weight: 400, style: "normal", sha256: sha256Hex(flipped) }]);
    expect(first).not.toBe(base);
    expect(second).not.toBe(first);
  });
});
