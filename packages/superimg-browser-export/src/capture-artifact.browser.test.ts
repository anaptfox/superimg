import { afterEach, describe, expect, it, vi } from "vitest";
import type { MediaSession } from "@superimg/media";
import { captureBrowserArtifact, captureBrowserArtifactWithEvidence, captureHtmlArtifact, prepareBrowserVector } from "./capture-artifact.js";
import { createBrowserExporter } from "./exporter.js";

const roots: HTMLElement[] = [];
afterEach(() => { for (const root of roots.splice(0)) root.remove(); });
function mount(css: string): HTMLDivElement {
  const root = document.createElement("div");
  root.style.cssText = `position:fixed;left:0;top:0;${css}`;
  document.body.append(root);
  roots.push(root);
  return root;
}
async function pngSize(blob: Blob): Promise<readonly number[]> {
  const bytes = await blob.slice(0, 24).arrayBuffer();
  const view = new DataView(bytes);
  expect(Array.from(new Uint8Array(bytes, 0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  return [view.getUint32(16), view.getUint32(20)];
}
async function samplePng(blob: Blob, points: readonly (readonly [number, number])[]) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("PNG fixture did not load")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    try {
      return points.map(([x, y]) => { context.clearRect(0, 0, 1, 1); context.drawImage(image, x, y, 1, 1, 0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); });
    } finally { canvas.width = canvas.height = 0; }
  } finally { image.src = ""; URL.revokeObjectURL(url); }
}

describe("browser artifact consumer", () => {
  it("retains bounded text and geometry paired with captured bytes after the live DOM changes", async () => {
    const root = mount("width:80px;height:40px;background:white;color:black;font:12px Arial");
    root.innerHTML = '<button id="accepted">Before</button>';
    const result = await captureBrowserArtifactWithEvidence(root, { width: 80, height: 40, dpr: 1, embedFonts: false });
    const serialized = JSON.stringify(result.evidence.context);
    expect(serialized).toContain("Before");
    expect(result.evidence).toMatchObject({ actual: { width: 80, height: 40 }, geometry: { w0: 80, h0: 40 }, context: { truncated: false } });
    root.innerHTML = '<button id="replacement">After</button>';
    expect(JSON.stringify(result.evidence.context)).toBe(serialized);
    expect(await pngSize(result.output)).toEqual([80, 40]);
  });

  it("captures trusted HTML and cleans up its temporary mount", async () => {
    const children = Array.from(document.body.children).filter(node => !node.hasAttribute("data-snapdom-internal"));
    const blob = await captureHtmlArtifact('<section style="width:18px;height:12px;background:lime"></section>', { width: 18, height: 12, dpr: 1, embedFonts: false });
    expect(await pngSize(blob)).toEqual([18, 12]);
    expect(await samplePng(blob, [[5, 5]])).toEqual([[0, 255, 0, 255]]);
    // SnapDOM owns a bounded shared raster-decoder iframe. The temporary HTML
    // mount is gone; capture content must not remain in the live document.
    expect(Array.from(document.body.children).filter(node => !node.hasAttribute("data-snapdom-internal"))).toEqual(children);
    expect(Array.from(document.querySelectorAll("[data-snapdom-internal]")).some(node => node.querySelector("section"))).toBe(false);
  });

  it("preserves clipped dimensions with combined scale and fractional DPR", async () => {
    const root = mount("width:40px;height:30px;background:#102030");
    const blob = await captureBrowserArtifact(root, { width: 40, height: 30, scale: 1.25, dpr: 1.5, region: { x: 4, y: 4, width: 12, height: 8 } });
    expect(blob.type).toBe("image/png");
    expect(await pngSize(blob)).toEqual([22, 15]);
    expect(await samplePng(blob, [[8, 8]])).toEqual([[16, 32, 48, 255]]);
  });

  it.each(["jpeg", "webp"] as const)("encodes %s with the requested raster dimensions", async (format) => {
    const root = mount("width:16px;height:12px;background:#102030");
    const blob = await captureBrowserArtifact(root, { width: 16, height: 12, dpr: 2, format });
    expect(blob.type).toBe(`image/${format}`);
    const bitmap = await createImageBitmap(blob);
    try { expect([bitmap.width, bitmap.height]).toEqual([32, 24]); }
    finally { bitmap.close(); }
  });

  it("exports a 40003px PNG without losing its final pixels", async () => {
    const root = mount("width:12px;height:40003px;background:red");
    root.innerHTML = '<div style="position:absolute;left:0;top:40000px;width:12px;height:3px;background:blue"></div>';
    const blob = await captureBrowserArtifact(root, { width: 12, height: 40003, dpr: 1, embedFonts: false });
    expect(await pngSize(blob)).toEqual([12, 40003]);
    expect(await samplePng(blob, [[5, 0], [5, 8191], [5, 32768], [5, 40002]])).toEqual([
      [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255], [0, 0, 255, 255],
    ]);
  });

  it("captures changing live canvas frames through the session export surface", async () => {
    const root = mount("width:16px;height:16px");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    root.append(canvas);
    const context = canvas.getContext("2d")!;
    const session = {
      renderFrame: async (frame: number) => { context.fillStyle = frame === 0 ? "red" : "blue"; context.fillRect(0, 0, 16, 16); },
      getSurface: () => ({ kind: "dom", getElement: () => root }),
    } as unknown as MediaSession;
    const exporter = createBrowserExporter(session, { width: 16, height: 16, dpr: 1, burst: true });
    try {
      const [red, blue] = await Promise.all([exporter.captureArtifact(0), exporter.captureArtifact(1)]);
      expect(await samplePng(red, [[4, 4]])).toEqual([[255, 0, 0, 255]]);
      expect(await samplePng(blue, [[4, 4]])).toEqual([[0, 0, 255, 255]]);
      await exporter.dispose();
      expect(await pngSize(red)).toEqual([16, 16]);
      await expect(exporter.captureArtifact(2)).rejects.toThrow(/disposed/);
    } finally { await exporter.dispose(); }
  });

  it("exports SVG, editable vector shapes/text, and a PDF on explicit requests", async () => {
    const root = mount("width:180px;height:80px;background:white;color:black;font:16px Arial");
    root.innerHTML = '<div style="width:24px;height:24px;background:red"></div><span>Keep this text</span><span class="omit">Omit this text</span>';
    const options = { width: 180, height: 80, dpr: 1, embedFonts: false };
    const svg = await captureBrowserArtifact(root, { ...options, format: "svg" });
    expect(svg.type).toBe("image/svg+xml");
    expect(await svg.text()).toContain("foreignObject");
    const vector = await captureBrowserArtifact(root, { ...options, format: "vector-svg", vector: { exclude: ".omit" } });
    expect(vector.type).toBe("image/svg+xml");
    const vectorText = await vector.text();
    expect(vectorText).toMatch(/<svg\b/);
    expect(vectorText).not.toContain("foreignObject");
    expect(vectorText).toContain("Keep this text");
    expect(vectorText).not.toContain("Omit this text");
    const pdf = await captureBrowserArtifact(root, { ...options, format: "pdf", pdf: { page: "letter", tagged: true, lang: "en", meta: { title: "Capture fixture" } } });
    expect(pdf.type).toBe("application/pdf");
    expect(await pdf.slice(0, 8).text()).toMatch(/^%PDF-/);
    expect(pdf.size).toBeGreaterThan(500);
    const prepared = await prepareBrowserVector(root, options);
    // The test runner can inherit transient activation. Explicitly withdraw it
    // and guard the clipboard rather than attempting a real clipboard write.
    const activation = vi.spyOn(navigator, "userActivation", "get").mockReturnValue({ isActive: false, hasBeenActive: false });
    const clipboard = vi.spyOn(navigator.clipboard, "write").mockRejectedValue(new Error("Unexpected clipboard write"));
    try {
      await expect(prepared.copyToFigma()).rejects.toThrow(/user gesture/);
      expect(clipboard).not.toHaveBeenCalled();
    } finally { prepared.dispose(); activation.mockRestore(); clipboard.mockRestore(); }
  });
});
