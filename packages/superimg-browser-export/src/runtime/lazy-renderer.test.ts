import { afterEach, describe, expect, it, vi } from "vitest";
import { image, MEDIA_ELEMENT } from "@superimg/types";

const media = image({ size: { width: 16, height: 16 }, render: () => ({
  $$typeof: MEDIA_ELEMENT, type: "Html", props: { width: "fill", height: "fill", html: "<p>document</p>" }, children: [],
}) });
const selection = { media, data: {}, coordinates: { variantId: "default", editionId: "default" } };
const loadDocumentPreview = vi.fn(() => { throw Error("document operation imported raster renderer"); });

// Guard the adapter's initial import as well as each document render.
vi.doMock("../preview.js", loadDocumentPreview);
const { createBrowserRuntimeAdapter } = await import("./adapter.js");
afterEach(() => { vi.doUnmock("../preview.js"); });

async function request(as: "html" | "png", signal?: AbortSignal) {
  const adapter = createBrowserRuntimeAdapter({ defaultFonts: false });
  const input = { operation: "render" as const, media, selection, programDigest: "a".repeat(64), options: { as, ...(signal === undefined ? {} : { signal }) } };
  const preflight = await adapter.preflight(input);
  return { adapter, input, preflight };
}

describe("operation-owned lazy raster renderer", () => {
  it("renders documents without importing the raster renderer", async () => {
    vi.doMock("../preview.js", loadDocumentPreview);
    const { adapter, input, preflight } = await request("html");
    try {
      expect(new TextDecoder().decode((await adapter.render({ ...input, preflight })).bytes)).toContain("document");
      expect(loadDocumentPreview).not.toHaveBeenCalled();
    } finally { await preflight.dispose?.(); await adapter.dispose(); }
  });
  it("checks cancellation after the import and before constructing a renderer", async () => {
    const controller = new AbortController();
    const constructed = vi.fn();
    const reason = new DOMException("cancelled during module load", "AbortError");
    vi.doMock("../preview.js", () => { controller.abort(reason); return { BrowserRenderer: class { constructor() { constructed(); } } }; });
    const { adapter, input, preflight } = await request("png", controller.signal);
    try {
      await expect(adapter.render({ ...input, preflight })).rejects.toBe(reason);
      expect(constructed).not.toHaveBeenCalled();
    } finally { await preflight.dispose?.(); await adapter.dispose(); }
  });
  it("disposes an operation's renderer when initialization fails", async () => {
    const failure = Error("initialization failed");
    const dispose = vi.fn(async () => {});
    vi.doMock("../preview.js", () => ({ BrowserRenderer: class { async init() { throw failure; } dispose = dispose; } }));
    const { adapter, input, preflight } = await request("png");
    try {
      await expect(adapter.render({ ...input, preflight })).rejects.toBe(failure);
      expect(dispose).toHaveBeenCalledTimes(1);
    } finally { await preflight.dispose?.(); await adapter.dispose(); }
  });
});
