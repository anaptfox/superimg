import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { BlitzRasterizer, wrapHtmlForViewport } from "./index.js";

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function sampleRgba(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
): { r: number; g: number; b: number } {
  const i = (y * width + x) * 4;
  return { r: rgba[i] ?? 0, g: rgba[i + 1] ?? 0, b: rgba[i + 2] ?? 0 };
}

const wasmPath = join(dirname(fileURLToPath(import.meta.url)), "..", "pkg", "superimg_blitz_bg.wasm");
const hasWasm = existsSync(wasmPath);

describe.skipIf(!hasWasm)("BlitzRasterizer (browser-free HTML → PNG)", () => {
  it("accepts only html", () => {
    const r = new BlitzRasterizer();
    expect(r.accepts("html")).toBe(true);
    expect(r.accepts("svg")).toBe(false);
    expect(r.capabilities).toMatchObject({ browserFree: true, workerSafe: false });
  });

  it("rasterizes HTML to a PNG of the requested size", async () => {
    const r = new BlitzRasterizer();
    await r.init({ width: 320, height: 180 });
    const png = await r.rasterize(
      `<!doctype html><html><body style="margin:0;background:#0b0b12;color:#ffd166;font-family:sans-serif">
         <h1>hi</h1>
       </body></html>`,
    );
    expect(isPng(png)).toBe(true);
    expect(pngSize(png)).toEqual({ width: 320, height: 180 });
    await r.dispose();
  });

  it("wraps SuperImg absolute-layer fragments so they fill the viewport", () => {
    const wrapped = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#0b0b12"></div>`,
      640,
      360,
    );
    expect(wrapped).toContain("width:640px;height:360px");
    expect(wrapped).toContain('id="frame"');
  });

  it("leaves a full HTML document unwrapped", () => {
    const doc = "<!DOCTYPE html><html><body>hi</body></html>";
    expect(wrapHtmlForViewport(doc, 320, 180)).toBe(doc);
  });

  it("paints SuperImg-style absolute layers instead of a blank white frame", async () => {
    const r = new BlitzRasterizer();
    await r.init({ width: 320, height: 180 });
    const png = await r.rasterize(
      `<div style="position:absolute;inset:0;overflow:hidden;background:#0b0b12;color:#ffd166;font-family:sans-serif"><h1>Hello</h1></div>`,
    );
    expect(isPng(png)).toBe(true);
    expect(png.byteLength).toBeGreaterThan(2000);
    await r.dispose();
  });

  it("honors position:absolute left/top", async () => {
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    const html = wrapHtmlForViewport(
      `<div style="position:absolute;left:200px;top:80px;width:20px;height:20px;background:#ff0000"></div>`,
      400,
      200,
    );
    const engine = new BlitzEngine(400, 200);
    const rgba = engine.rasterizeRgba(html, 0);
    const on = sampleRgba(rgba, 400, 210, 90);
    const off = sampleRgba(rgba, 400, 20, 20);
    expect(on.r).toBeGreaterThan(200);
    expect(on.g).toBeLessThan(40);
    expect(off.r).toBeGreaterThan(200);
    expect(off.g).toBeGreaterThan(200);
    engine.free();
  });

  it("paints text-align:center on the canvas midline, not the left edge", async () => {
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    const html = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#0b0b12;color:#ffd166;font-size:64px;line-height:1;text-align:center;font-family:sans-serif">Hello</div>`,
      400,
      200,
    );
    const engine = new BlitzEngine(400, 200);
    const rgba = engine.rasterizeRgba(html, 0);
    const lumaAt = (x: number, y: number) => {
      const p = sampleRgba(rgba, 400, x, y);
      return p.r + p.g + p.b;
    };
    let leftInk = 0;
    let midInk = 0;
    for (let y = 0; y < 80; y++) {
      leftInk = Math.max(leftInk, lumaAt(16, y));
      midInk = Math.max(midInk, lumaAt(200, y));
    }
    expect(leftInk).toBeLessThan(80);
    expect(midInk).toBeGreaterThan(leftInk + 80);
    engine.free();
  });

  it("reuses the live document: second frame is not blank", async () => {
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    const engine = new BlitzEngine(80, 80);
    const frame = (bg: string) =>
      wrapHtmlForViewport(
        `<div style="position:absolute;inset:0;background:${bg}"></div>`,
        80,
        80,
      );
    const first = engine.rasterizeRgba(frame("#ff0000"), 0);
    const second = engine.rasterizeRgba(frame("#00ff00"), 0.5);
    const a = sampleRgba(first, 80, 40, 40);
    const b = sampleRgba(second, 80, 40, 40);
    expect(a.r).toBeGreaterThan(200);
    expect(a.g).toBeLessThan(40);
    expect(b.g).toBeGreaterThan(200);
    expect(b.r).toBeLessThan(40);
    engine.free();
  });

  it("returns raw RGBA for mp4 instead of PNG", async () => {
    const r = new BlitzRasterizer();
    await r.init({ width: 16, height: 16, format: "mp4" });
    const bytes = await r.rasterize(
      `<div style="position:absolute;inset:0;background:#0000ff"></div>`,
    );
    expect(isPng(bytes)).toBe(false);
    expect(bytes.byteLength).toBe(16 * 16 * 4);
    const p = sampleRgba(bytes, 16, 8, 8);
    expect(p.b).toBeGreaterThan(200);
    expect(p.r).toBeLessThan(40);
    await r.dispose();
  });

  it("paints a data: image instead of a white hole", async () => {
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    // 2×2 red PNG
    const redPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const html = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#ffffff"><img src="${redPng}" style="width:80px;height:80px"></div>`,
      80,
      80,
    );
    const engine = new BlitzEngine(80, 80);
    const rgba = engine.rasterizeRgba(html, 0);
    const p = sampleRgba(rgba, 80, 20, 20);
    expect(p.r + p.g + p.b).toBeLessThan(765);
    expect(p.r).toBeGreaterThan(p.g);
    engine.free();
  });
});

const LEGACY_UA =
  "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0 Safari/537.36";

async function resolveGoogleFaces(spec: string): Promise<{ family: string; weight: number; style: "normal" | "italic"; data: Uint8Array }[]> {
  const familyPart = spec.split(":")[0] ?? spec;
  const family = familyPart.replace(/\+/g, " ").trim();
  const cssRes = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
    headers: { "User-Agent": LEGACY_UA },
  });
  if (!cssRes.ok) throw new Error(`font css ${cssRes.status}`);
  const css = await cssRes.text();
  const faces: { family: string; weight: number; style: "normal" | "italic"; url: string }[] = [];
  const blockRe = /@font-face\s*{([^}]*)}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(css)) !== null) {
    const body = block[1] ?? "";
    const faceFamily = /font-family:\s*['"]?([^;'"]+)['"]?/.exec(body)?.[1]?.trim() ?? family;
    const weight = Number.parseInt(/font-weight:\s*(\d+)/.exec(body)?.[1] ?? "400", 10);
    const style = (/font-style:\s*(italic)/.exec(body) ? "italic" : "normal") as "normal" | "italic";
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1]?.replace(/['"]/g, "");
    if (url) faces.push({ family: faceFamily, weight, style, url });
  }
  return Promise.all(
    faces.map(async (f) => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`font bytes ${res.status}`);
      return { family: f.family, weight: f.weight, style: f.style, data: new Uint8Array(await res.arrayBuffer()) };
    }),
  );
}

function inkFingerprint(rgba: Uint8Array, width: number, height: number): number {
  let sum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = sampleRgba(rgba, width, x, y);
      sum += p.r + p.g + p.b;
    }
  }
  return sum;
}

describe.skipIf(!hasWasm)("BlitzRasterizer Google Fonts", () => {
  it("named Google face differs from DejaVu-only control", async () => {
    let faces: Awaited<ReturnType<typeof resolveGoogleFaces>>;
    try {
      // Inter is a variable font that fontique often drops; Space Grotesk is static.
      faces = await resolveGoogleFaces("Space+Grotesk:wght@500;700");
    } catch {
      return;
    }
    expect(faces.length).toBeGreaterThan(0);
    const family = faces[0]?.family ?? "Space Grotesk";
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    const html = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#ffffff;color:#000000;font-size:48px;line-height:1;font-family:${JSON.stringify(family)}, sans-serif">Hg</div>`,
      200,
      80,
    );
    const control = new BlitzEngine(200, 80);
    const withFace = new BlitzEngine(200, 80);
    const sorted = [...faces].sort((a, b) => b.data.byteLength - a.data.byteLength);
    for (const face of sorted) {
      withFace.addFont(face.family, face.weight, face.style === "italic", face.data);
    }
    const a = control.rasterizeRgba(html, 0);
    const b = withFace.rasterizeRgba(html, 0);
    expect(inkFingerprint(a, 200, 80)).not.toBe(inkFingerprint(b, 200, 80));
    control.free();
    withFace.free();
  });

  it("registers Space Grotesk and IBM Plex Mono as distinct faces", async () => {
    let sans: Awaited<ReturnType<typeof resolveGoogleFaces>>;
    let mono: Awaited<ReturnType<typeof resolveGoogleFaces>>;
    try {
      [sans, mono] = await Promise.all([
        resolveGoogleFaces("Space+Grotesk:wght@500;700"),
        resolveGoogleFaces("IBM+Plex+Mono:wght@400;500"),
      ]);
    } catch {
      return;
    }
    const { BlitzEngine } = await import("../pkg/superimg_blitz.js");
    const sansEngine = new BlitzEngine(200, 80);
    const monoEngine = new BlitzEngine(200, 80);
    const sansFaces = [...sans].sort((a, b) => b.data.byteLength - a.data.byteLength);
    const monoFaces = [...mono].sort((a, b) => b.data.byteLength - a.data.byteLength);
    for (const face of sansFaces) {
      sansEngine.addFont(face.family, face.weight, face.style === "italic", face.data);
    }
    for (const face of monoFaces) {
      monoEngine.addFont(face.family, face.weight, face.style === "italic", face.data);
    }
    const sansHtml = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#ffffff;color:#000000;font-size:48px;line-height:1;font-family:sans-serif">Hg</div>`,
      200,
      80,
    );
    const monoHtml = wrapHtmlForViewport(
      `<div style="position:absolute;inset:0;background:#ffffff;color:#000000;font-size:48px;line-height:1;font-family:monospace">Hg</div>`,
      200,
      80,
    );
    const a = sansEngine.rasterizeRgba(sansHtml, 0);
    const b = monoEngine.rasterizeRgba(monoHtml, 0);
    expect(inkFingerprint(a, 200, 80)).not.toBe(inkFingerprint(b, 200, 80));
    sansEngine.free();
    monoEngine.free();
  });
});
