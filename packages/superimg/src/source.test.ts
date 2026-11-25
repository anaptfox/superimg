import { describe, expect, it } from "vitest";
import { source } from "../../superimg-core/src/source.js";
import { sequence, time } from "@superimg/core/composition";
import { createRenderContext } from "../../superimg-core/src/rendering/create-render-context.js";
import { lowerRenderOutput } from "../../superimg-core/src/rendering/lower-output.js";
import { FrameExtractor } from "../../superimg-playwright/src/frame-extractor.js";
import { walkMediaTree } from "../../superimg-stdlib/src/tree/walk.js";
import { scanTreeSemanticIssues } from "../../superimg-core/src/validation/tree.js";
import { check, init, render, shutdown } from "./runtime.node.js";
import { image, svg, video } from "@superimg/types";
import { svgDocument, SvgArtwork } from "../../superimg-stdlib/src/svg/document-artwork.js";
import { Frame, Html } from "../../superimg-stdlib/src/tree/primitives.js";
import sharp from "sharp";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const size = { width: 64, height: 48 };

describe("direct media sources", () => {
  it("owns image bytes and composes the still at an explicit hold", () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    const still = source.image({ src: { bytes, mimeType: "image/png" }, size, fit: "contain" });
    bytes[0] = 0;
    expect("bytes" in still.config!.assets!.source && still.config!.assets!.source.bytes[0]).toBe(137);
    const film = time(sequence([{ id: "photo", content: still, hold: "1s" }]), { size, fps: 30 });
    const html = lowerRenderOutput(film.render(createRenderContext(0, 30, 30, size.width, size.height)));
    expect(html).toContain("data:image/png;base64,iVBORw==");
    expect(html).toContain("object-fit:contain");
  });

  it("keeps SVG as a vector definition with an owned image resource", () => {
    const vector = source.svg({ src: { bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), mimeType: "image/svg+xml" }, size });
    expect(vector.media).toBe("svg");
    expect(vector.medium).toBe("svg");
    const rendered = vector.render({ asset: () => "data:image/svg+xml;base64,PHN2Zz4=", width: 64, height: 48 } as never);
    expect(lowerRenderOutput(rendered, "svg", size)).toContain("<image");
    expect(walkMediaTree(rendered, size).find((node) => node.tag === "image")?.namespace).toBe("svg");
    expect(scanTreeSemanticIssues(walkMediaTree(rendered, size), { frame: 0, progress: 0 }))
      .not.toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
  });

  it("checks and renders a whole SVG source through the Node runtime", async () => {
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="blue"/></svg>');
    const media = source.svg({ src: { bytes, mimeType: "image/svg+xml" }, size });
    try {
      const report = await check(media);
      expect(report.ok).toBe(true);
      expect(report.findings).not.toContainEqual(expect.objectContaining({ code: "NAMESPACE_MISMATCH" }));
      const svg = await (await render(media, { as: "svg" })).text();
      expect(svg).toContain("<image");
      const png = await (await render(media, { as: "png" })).bytes();
      expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    } finally {
      await shutdown();
    }
  });

  it("renders the same unedited artwork through both SVG routes", async () => {
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect id="shape" width="64" height="48" fill="#0000ff"/></svg>');
    const original = source.svg({ src: { bytes, mimeType: "image/svg+xml" }, size });
    const document = svgDocument(bytes);
    const editable = svg({ size, render: () => SvgArtwork({ document, id: "art", ...size }) });
    try {
      expect((await check(editable)).ok).toBe(true);
      const baseline = await (await render(original, { as: "png" })).bytes();
      const current = await (await render(editable, { as: "png" })).bytes();
      expect(current).toEqual(baseline);
    } finally { await shutdown(); }
  });

  it("renders imported SVG text with a host-declared font", async () => {
    const regular = resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf");
    const bold = resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-700.ttf");
    const make = (family: string, weight = 400, style = "normal") => svgDocument(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><text x="4" y="55" font-family="${family}" font-weight="${weight}" font-style="${style}" font-size="42" fill="#000">Wide <tspan>glyphs</tspan></text></svg>`));
    const artwork = make("OwnedRegular"), fallback = make("OwnedBold");
    const fonts = [
      { family: "OwnedRegular", src: regular },
      { family: "OwnedBold", src: bold },
      { family: "Weighted", weight: 400, src: regular },
      { family: "Weighted", weight: 700, src: bold },
      { family: "Reversed", weight: 700, src: regular },
      { family: "Reversed", weight: 400, src: bold },
      { family: "StyleSwap", weight: 400, style: "normal" as const, src: bold },
      { family: "StyleSwap", weight: 400, style: "italic" as const, src: regular },
    ];
    const media = (document: typeof artwork, browser: boolean, vector: boolean, faces = fonts) => {
      const config = {
        size: { width: 300, height: 80 }, background: "#fff", fonts: faces,
        render: () => browser
          ? Frame({ width: 300, height: 80 }, SvgArtwork({ document, width: 300, height: 80 }), Html({ id: "browser", width: 1, height: 1, html: "<span></span>" }))
          : SvgArtwork({ document, width: 300, height: 80 }),
      };
      return vector ? svg(config) : image(config);
    };
    const pixels = async (document: typeof artwork, browser = false, vector = false, faces = fonts) => {
      const runtime = await init({ defaultFonts: false });
      try { return await sharp(await (await render(media(document, browser, vector, faces), { as: "png", runtime })).bytes()).ensureAlpha().raw().toBuffer(); }
      finally { await runtime.dispose(); }
    };
    const owned = await pixels(artwork);
    const fallbackPixels = await pixels(fallback);
    expect(await pixels(artwork, true)).not.toEqual(await pixels(fallback, true));
    expect.soft(owned).not.toEqual(fallbackPixels);
    expect(owned).toEqual(await pixels(artwork));
    expect.soft(await pixels(artwork, false, true)).not.toEqual(await pixels(fallback, false, true));
    expect.soft(await pixels(make("Weighted", 400))).not.toEqual(await pixels(make("Weighted", 700)));
    const nativeRegular = await pixels(make("Inter"), false, false, [{ family: "Inter", src: regular }]);
    const nativeBold = await pixels(make("Inter", 700), false, false, [{ family: "Inter", weight: 700, src: bold }]);
    expect.soft(owned).toEqual(nativeRegular);
    expect.soft(fallbackPixels).toEqual(nativeBold);
    expect.soft(await pixels(make("Weighted", 700))).toEqual(nativeBold);
    expect.soft(await pixels(make("Reversed", 400))).toEqual(nativeBold);
    expect.soft(await pixels(make("Reversed", 700))).toEqual(nativeRegular);
    expect.soft(await pixels(make("StyleSwap"))).toEqual(nativeBold);
    expect.soft(await pixels(make("StyleSwap", 400, "italic"))).toEqual(nativeRegular);
  }, 30000);

  it("renders SVG text when the declared face is a TrueType collection", async () => {
    const font = await readFile(resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf"));
    const header = Buffer.alloc(16);
    header.write("ttcf", 0, "ascii");
    header.writeUInt32BE(0x00010000, 4);
    header.writeUInt32BE(1, 8);
    header.writeUInt32BE(16, 12);
    const collection = Buffer.concat([header, font]);
    for (let i = 0; i < font.readUInt16BE(4); i++) {
      const offset = 16 + 12 + i * 16 + 8;
      collection.writeUInt32BE(collection.readUInt32BE(offset) + 16, offset);
    }
    const document = svgDocument(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><text x="4" y="55" font-family="CollectionAlias" font-size="42" fill="#000">Wide glyphs</text></svg>'));
    const media = (bytes: Uint8Array, forceBrowser = false, vector = false) => {
      const config = { size: { width: 300, height: 80 }, background: "#fff", fonts: [{ family: "CollectionAlias", src: bytes }], render: () => forceBrowser ? Frame({ width: 300, height: 80 }, SvgArtwork({ document, width: 300, height: 80 }), Html({ id: "browser", width: 1, height: 1, html: "<span></span>" })) : SvgArtwork({ document, width: 300, height: 80 }) };
      return vector ? svg(config) : image(config);
    };
    const runtime = await init({ defaultFonts: false });
    try {
      const bytes = await (await render(media(new Uint8Array(collection)), { as: "png", runtime })).bytes();
      const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
      expect(pixels.some((value, index) => index % 4 !== 3 && value < 128)).toBe(true);
      const singleFont = await (await render(media(new Uint8Array(font)), { as: "png", runtime })).bytes();
      expect(pixels).toEqual(await sharp(singleFont).ensureAlpha().raw().toBuffer());
      const vector = await (await render(media(new Uint8Array(collection), false, true), { as: "png", runtime })).bytes();
      const vectorPixels = await sharp(vector).ensureAlpha().raw().toBuffer();
      expect(Buffer.compare(vectorPixels, pixels)).toBe(0);
    } finally { await runtime.dispose(); }
  }, 30000);

  it("renders a format-1 font through the browser fallback", async () => {
    const regular = await readFile(resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf"));
    const directory = Array.from({ length: regular.readUInt16BE(4) }, (_, index) => 12 + 16 * index)
      .find((offset) => regular.toString("ascii", offset, offset + 4) === "name")!;
    const start = regular.readUInt32BE(directory + 8), length = regular.readUInt32BE(directory + 12);
    const old = regular.subarray(start, start + length);
    const count = old.readUInt16BE(2), storage = old.readUInt16BE(4), end = 6 + 12 * count;
    const tag = Buffer.from([0, 101, 0, 110]);
    const language = Buffer.alloc(6);
    language.writeUInt16BE(1, 0);
    language.writeUInt16BE(tag.length, 2);
    language.writeUInt16BE(old.length - storage, 4);
    const name = Buffer.concat([old.subarray(0, end), language, old.subarray(storage), tag]);
    name.writeUInt16BE(1, 0);
    name.writeUInt16BE(end + language.length, 4);
    const pad = Buffer.alloc((4 - regular.length % 4) % 4);
    const nameOffset = regular.length + pad.length;
    const formatOne = Buffer.concat([regular, pad, name, Buffer.alloc((4 - name.length % 4) % 4)]);
    formatOne.writeUInt32BE(nameOffset, directory + 8);
    formatOne.writeUInt32BE(name.length, directory + 12);
    let nameChecksum = 0;
    for (let i = nameOffset; i < formatOne.length; i += 4) nameChecksum = (nameChecksum + formatOne.readUInt32BE(i)) >>> 0;
    formatOne.writeUInt32BE(nameChecksum, directory + 4);
    const headDirectory = Array.from({ length: regular.readUInt16BE(4) }, (_, index) => 12 + 16 * index)
      .find((offset) => regular.toString("ascii", offset, offset + 4) === "head")!;
    const head = formatOne.readUInt32BE(headDirectory + 8);
    formatOne.writeUInt32BE(0, head + 8);
    let totalChecksum = 0;
    for (let i = 0; i < formatOne.length; i += 4) totalChecksum = (totalChecksum + formatOne.readUInt32BE(i)) >>> 0;
    formatOne.writeUInt32BE((0xb1b0afba - totalChecksum) >>> 0, head + 8);
    const document = svgDocument(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><text x="4" y="55" font-family="Fixture" font-size="42" fill="#000">Wide glyphs</text></svg>'));
    const media = (bytes: Uint8Array, browser: boolean, vector = false) => {
      const config = { size: { width: 300, height: 80 }, background: "#fff", fonts: [{ family: "Fixture", src: bytes }], render: () => browser ? Frame({ width: 300, height: 80 }, SvgArtwork({ document, width: 300, height: 80 }), Html({ id: "browser", width: 1, height: 1, html: "<span></span>" })) : SvgArtwork({ document, width: 300, height: 80 }) };
      return vector ? svg(config) : image(config);
    };
    const runtime = await init({ defaultFonts: false });
    try {
      const pixels = async (value: ReturnType<typeof media>) => sharp(await (await render(value, { as: "png", runtime })).bytes()).ensureAlpha().raw().toBuffer();
      const reference = await pixels(media(regular, true));
      expect(Buffer.compare(await pixels(media(formatOne, false)), reference)).toBe(0);
      expect(Buffer.compare(await pixels(media(formatOne, false, true)), reference)).toBe(0);
    } finally { await runtime.dispose(); }
  }, 30000);

  it("selects declared weights from a multi-face TrueType collection", async () => {
    const regular = await readFile(resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-400.ttf"));
    const bold = await readFile(resolve(process.cwd(), "../superimg-core/assets/fonts/Inter-700.ttf"));
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
    const document = (weight: number) => svgDocument(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80"><text x="4" y="55" font-family="CollectionAlias" font-weight="${weight}" font-size="42" fill="#000">Wide glyphs</text></svg>`));
    const media = (weight: number, faces: { family: string; weight: number; src: Uint8Array }[], browser = false) => image({ size: { width: 300, height: 80 }, background: "#fff", fonts: faces, render: () => browser ? Frame({ width: 300, height: 80 }, SvgArtwork({ document: document(weight), width: 300, height: 80 }), Html({ id: "browser", width: 1, height: 1, html: "<span></span>" })) : SvgArtwork({ document: document(weight), width: 300, height: 80 }) });
    const runtime = await init({ defaultFonts: false });
    const pixels = async (value: ReturnType<typeof media>) => sharp(await (await render(value, { as: "png", runtime })).bytes()).ensureAlpha().raw().toBuffer();
    try {
      const collectionFaces = [400, 700].map((weight) => ({ family: "CollectionAlias", weight, src: new Uint8Array(collection) }));
      const originalFaces = [{ family: "CollectionAlias", weight: 400, src: new Uint8Array(regular) }, { family: "CollectionAlias", weight: 700, src: new Uint8Array(bold) }];
      expect(Buffer.compare(await pixels(media(400, collectionFaces)), await pixels(media(400, originalFaces)))).toBe(0);
      expect(Buffer.compare(await pixels(media(700, collectionFaces)), await pixels(media(700, originalFaces)))).toBe(0);
      expect(Buffer.compare(await pixels(media(400, collectionFaces, true)), await pixels(media(400, originalFaces, true)))).toBe(0);
      expect(Buffer.compare(await pixels(media(700, collectionFaces, true)), await pixels(media(700, originalFaces, true)))).toBe(0);
      if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0) {
        const movie = (faces: typeof collectionFaces) => video({ size: { width: 300, height: 80 }, duration: "1s", fps: 1, background: "#fff", fonts: faces, render: () => SvgArtwork({ document: document(700), width: 300, height: 80 }) });
        const decode = async (faces: typeof collectionFaces) => {
          const bytes = await (await render(movie(faces), { as: "mp4", runtime })).bytes();
          const decoded = spawnSync("ffmpeg", ["-loglevel", "error", "-i", "pipe:0", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"], { input: bytes, maxBuffer: 4 * 1024 * 1024 });
          if (decoded.status !== 0) throw new Error(`Could not decode collection fixture: ${decoded.stderr.toString()}`);
          return sharp(decoded.stdout).ensureAlpha().raw().toBuffer();
        };
        expect(Buffer.compare(await decode(collectionFaces), await decode(originalFaces))).toBe(0);
      }
      const mediumCollection = [{ family: "CollectionAlias", weight: 500, src: new Uint8Array(collection) }];
      const mediumReference = [{ family: "CollectionAlias", weight: 500, src: new Uint8Array(regular) }];
      expect(Buffer.compare(await pixels(media(500, mediumCollection)), await pixels(media(500, mediumReference)))).toBe(0);
      const unsupported = Buffer.from(collection);
      const secondTable = offsets[1]! + 12;
      unsupported.write("fvar", secondTable, "ascii");
      await expect(pixels(media(700, [{ family: "CollectionAlias", weight: 700, src: unsupported }]))).rejects.toThrow(/cannot be selected reliably/);
      await expect(pixels(media(700, [{ family: "CollectionAlias", weight: 700, src: unsupported }], true))).rejects.toThrow(/cannot be selected reliably/);
    } finally { await runtime.dispose(); }
  }, 30000);

  it("emits frame-extraction placeholders for trimmed video", () => {
    const clip = source.video({ src: new URL("file:///tmp/clip.mp4"), size, fps: 30, trim: { from: "0.5s", to: "1.5s" } });
    expect(clip.config?.duration).toBe("1s");
    const film = time(sequence([{ id: "clip", content: clip }]), { size, fps: 30 });
    const html = lowerRenderOutput(film.render(createRenderContext(15, 30, 30, size.width, size.height)));
    expect(html).toContain("data-superimg-clip");
    expect(html).toContain('data-t="1"');
  });

  it.skipIf(spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0)("extracts an actual frame from frozen video bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "superimg-source-test-"));
    const filename = join(dir, "red.mp4");
    const extractor = new FrameExtractor();
    try {
      const encoded = spawnSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=64x48:r=30:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", filename]);
      if (encoded.status !== 0) throw new Error(`ffmpeg fixture failed: ${encoded.stderr}`);
      const bytes = new Uint8Array(await readFile(filename));
      const clip = source.video({ src: { bytes, mimeType: "video/mp4" }, size, fps: 30, duration: "1s" });
      const film = time(sequence([{ id: "clip", content: clip }]), { size, fps: 30 });
      const html = lowerRenderOutput(film.render(createRenderContext(15, 30, 30, size.width, size.height)));
      const src = html.match(/data-src="([^"]+)"/)?.[1];
      expect(src?.startsWith("data:video/mp4;base64,")).toBe(true);
      const frame = await extractor.extractFrame(src!, 0.5, 30);
      expect(frame.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    } finally {
      await extractor.dispose();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects ambiguous or unsupported locations and trim ranges", () => {
    expect(() => source.image({ src: "./image.png", size })).toThrow(/absolute file URL/);
    expect(() => source.image({ src: "https://example.test/image.png", size })).toThrow(/file URL/);
    expect(() => source.video({ src: new URL("file:///tmp/clip.mp4"), size, fps: 30, trim: { from: "2s", to: "1s" } })).toThrow(/after trim.from/);
  });
});
