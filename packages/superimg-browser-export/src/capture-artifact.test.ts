import { afterEach, describe, expect, it, vi } from "vitest";
import { captureBrowserArtifact, captureHtmlArtifact, prepareBrowserVector } from "./capture-artifact.js";
import { SnapdomCaptureBackend } from "./capture.js";

const state = vi.hoisted(() => ({ snapdom: Object.assign(vi.fn(), { fromString: vi.fn() }), pdf: vi.fn(() => ({ name: "pdf" })), vector: vi.fn(() => ({ name: "vector" })), pdfLoads: 0, vectorLoads: 0 }));
vi.mock("@zumer/snapdom", () => ({ snapdom: state.snapdom }));
vi.mock("@zumer/snapdom-pdf", () => { state.pdfLoads++; return { pdf: state.pdf }; });
vi.mock("@zumer/snapdom-vector", () => { state.vectorLoads++; return { vector: state.vector }; });
afterEach(() => { state.snapdom.mockReset(); state.snapdom.fromString.mockReset(); state.pdf.mockClear(); state.vector.mockClear(); vi.restoreAllMocks(); document.body.replaceChildren(); });

function pngHeader(width: number, height: number): Blob {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new Blob([bytes], { type: "image/png" });
}
const size = { width: 4, height: 3, dpr: 1 };

describe("browser capture artifacts", () => {
  it("exports PNG bytes directly without loading plugins or reading full-frame pixels", async () => {
    const blob = pngHeader(4, 3);
    const toBlob = vi.fn(async () => blob);
    const toCanvas = vi.fn();
    state.snapdom.mockResolvedValue({ toBlob, toCanvas, warnings: [] });
    const result = await captureBrowserArtifact(document.createElement("div"), size);
    expect(result).toBe(blob);
    expect(toBlob).toHaveBeenCalledWith({ format: "png" });
    expect(toCanvas).not.toHaveBeenCalled();
    expect(state.vectorLoads).toBe(0);
    expect(state.pdfLoads).toBe(0);
  });

  it("shares clipped scale/DPR sizing and rejects silent PNG downscaling", async () => {
    state.snapdom.mockResolvedValue({ toBlob: async () => pngHeader(9, 6), warnings: [] });
    await captureBrowserArtifact(document.createElement("div"), { ...size, scale: 2, dpr: 1.5, region: { x: 1, y: 0, width: 3, height: 2 } });
    expect(state.snapdom.mock.calls[0]![1]).toMatchObject({ width: 6, height: 4, dpr: 1.5, scale: 1 });
    state.snapdom.mockResolvedValue({ toBlob: async () => pngHeader(4, 3), warnings: [] });
    await expect(captureBrowserArtifact(document.createElement("div"), { ...size, scale: 2 })).rejects.toThrow(/PNG capture was resized/);
  });

  it("uses the trusted HTML capture path with the same direct Blob and dimension contract", async () => {
    const blob = pngHeader(4, 3);
    state.snapdom.fromString.mockResolvedValue({ toBlob: async () => blob, warnings: [] });
    const html = '<div style="width:4px;height:3px">card</div>';
    expect(await captureHtmlArtifact(html, size)).toBe(blob);
    expect(state.snapdom.fromString).toHaveBeenCalledWith(html, expect.objectContaining({ width: 4, height: 3, dpr: 1, plugins: [] }));
    expect(state.snapdom).not.toHaveBeenCalled();
  });

  it("validates unsupported formats before capture", async () => {
    await expect(captureBrowserArtifact(document.createElement("div"), { ...size, format: "tiff" } as never)).rejects.toThrow(/Unsupported.*tiff/);
    expect(state.snapdom).not.toHaveBeenCalled();
  });

  it("loads PDF only on demand and prevents automatic downloads", async () => {
    const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
    const toPdf = vi.fn(async () => blob);
    state.snapdom.mockResolvedValue({ toPdf });
    expect(await captureBrowserArtifact(document.createElement("div"), { ...size, format: "pdf", pdf: { page: "letter", download: true } } as never)).toBe(blob);
    expect(state.pdf).toHaveBeenCalledWith({ page: "letter", download: false });
    expect(toPdf).toHaveBeenCalledWith({ page: "letter", download: false });
  });

  it("returns editable vector SVG without copying to Figma", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const toVector = vi.fn(async () => '<svg xmlns="http://www.w3.org/2000/svg"><text>Keep</text></svg>');
    const toFigma = vi.fn();
    state.snapdom.mockResolvedValue({ toVector, toFigma });
    const blob = await captureBrowserArtifact(root, { ...size, format: "vector-svg", vector: { exclude: ".omit" } });
    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toContain("Keep");
    expect(state.vector).toHaveBeenCalledWith({ exclude: ".omit" });
    expect(toFigma).not.toHaveBeenCalled();
  });

  it("requires a current gesture for Figma and releases prepared capture references", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const toFigma = vi.fn(async () => {});
    state.snapdom.mockResolvedValue({ toVector: async () => "<svg/>", toFigma });
    const activation = { isActive: false };
    const previousActivation = Object.getOwnPropertyDescriptor(navigator, "userActivation");
    Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => activation });
    const prepared = await prepareBrowserVector(root, size);
    await expect(prepared.copyToFigma()).rejects.toThrow(/user gesture/);
    expect(toFigma).not.toHaveBeenCalled();
    activation.isActive = true;
    const copied = prepared.copyToFigma();
    await copied;
    expect(toFigma).toHaveBeenCalledTimes(1);
    root.remove();
    await expect(prepared.toSvg()).rejects.toThrow(/connected/);
    document.body.append(root);
    prepared.dispose();
    prepared.dispose();
    await expect(prepared.toSvg()).rejects.toThrow(/disposed/);
    await expect(prepared.copyToFigma()).rejects.toThrow(/disposed/);
    if (previousActivation) Object.defineProperty(navigator, "userActivation", previousActivation);
    else Reflect.deleteProperty(navigator, "userActivation");
  });

  it("backend artifact capture shares disposal with frame capture", async () => {
    state.snapdom.mockResolvedValue({ toBlob: async () => pngHeader(4, 3), warnings: [] });
    const backend = new SnapdomCaptureBackend();
    const blob = await backend.captureArtifact(document.createElement("div"), size);
    await backend.dispose();
    expect(blob.size).toBe(24);
    await expect(backend.captureArtifact(document.createElement("div"), size)).rejects.toThrow(/disposed/);
  });
});
