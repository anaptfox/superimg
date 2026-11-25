import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ExportArtifact,
  ExportBundle,
  ExportOptions as RuntimeExportOptions,
  MediaElement,
  MediaDefinition,
  Runtime,
} from "@superimg/types";
import { MEDIA_ELEMENT } from "@superimg/types";

const runtimeMocks = vi.hoisted(() => ({
  init: vi.fn(),
  exportMedia: vi.fn(),
}));

vi.mock("../../runtime.browser.js", () => runtimeMocks);

import { usePlaygroundExport } from "./usePlaygroundExport.js";

const template = {
  kind: "media",
  media: "video",
  fallbackFormat: "mp4",
  medium: "html",
  animated: true,
  sample: { title: "sample", theme: "light" },
  config: { width: 640, height: 360, fps: 24, duration: 2 },
  render: () => htmlNode("<div>frame</div>"),
} satisfies MediaDefinition<{ title: string; theme: string }, "video">;

describe("usePlaygroundExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports authored media through the browser runtime and disposes both owners", async () => {
    const runtime = runtimeFixture();
    const bundle = bundleFixture(new Uint8Array([1, 2, 3, 4]), "video/webm");
    runtimeMocks.init.mockResolvedValue(runtime);
    runtimeMocks.exportMedia.mockResolvedValue(bundle.value);

    const { result } = renderHook(() => usePlaygroundExport({
      media: template,
      data: { title: "runtime" },
      size: { width: 720, height: 720 },
      duration: 3,
      encoding: { video: { quality: { bitrate: 2_000_000 }, codec: "vp9" } },
    }));

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.exportMp4({
        size: { width: 1080, height: 1080 },
        encoding: { format: "webm", video: { quality: { bitrate: 4_000_000 } } },
      });
    });

    expect(runtimeMocks.init).toHaveBeenCalledOnce();
    const initOptions = runtimeMocks.init.mock.calls[0]![0] as { signal: AbortSignal };
    expect(initOptions.signal).toBeInstanceOf(AbortSignal);
    expect(runtimeMocks.exportMedia).toHaveBeenCalledOnce();

    const [media, options] = runtimeMocks.exportMedia.mock.calls[0] as [
      MediaDefinition,
      RuntimeExportOptions,
    ];
    expect(options.runtime).toBe(runtime);
    expect(media).not.toBe(template);
    expect(media.config).toMatchObject({ width: 640, height: 360, fps: 24, duration: 3 });
    expect(options).toMatchObject({
      for: [{ id: "playground", format: "webm", width: 1080, height: 1080 }],
      data: { title: "runtime" },
      encoding: { video: { quality: { bitrate: 4_000_000 }, codec: "vp9" } },
    });
    expect(options.signal).toBe(initOptions.signal);
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(bundle.stream).toHaveBeenCalledOnce();
    expect(bundle.dispose).toHaveBeenCalledOnce();
    expect(runtime.dispose.mock.invocationCallOrder[0]).toBeLessThan(
      bundle.stream.mock.invocationCallOrder[0]!,
    );
    expect(bundle.stream.mock.invocationCallOrder[0]).toBeLessThan(
      bundle.dispose.mock.invocationCallOrder[0]!,
    );
    expect(blob).toBeInstanceOf(Blob);
    const exported = requireBlob(blob);
    expect(exported.type).toBe("video/webm");
    expect([...new Uint8Array(await exported.arrayBuffer())]).toEqual([1, 2, 3, 4]);
    expect(result.current.exporting).toBe(false);
    expect(result.current.exportProgress).toBe(1);
    expect(result.current.status).toBe("Export complete!");
  });

  it("uses the hook size, fallback fps, default duration, data, and MP4 format", async () => {
    const runtime = runtimeFixture();
    const bundle = bundleFixture(new Uint8Array([9]), "video/mp4");
    runtimeMocks.init.mockResolvedValue(runtime);
    runtimeMocks.exportMedia.mockResolvedValue(bundle.value);
    const noTiming = {
      ...template,
      config: { width: 320, height: 180 },
    } satisfies MediaDefinition<{ title: string; theme: string }, "video">;
    const { result } = renderHook(() => usePlaygroundExport({
      media: noTiming,
      data: { title: "chosen", theme: "dark" },
      size: { width: 800, height: 450 },
      fps: 60,
    }));

    await act(async () => {
      await result.current.exportMp4();
    });

    const [media, options] = runtimeMocks.exportMedia.mock.calls[0] as [
      MediaDefinition,
      RuntimeExportOptions,
    ];
    expect(media.config).toMatchObject({ width: 320, height: 180, fps: 60, duration: 5 });
    expect(options.for).toEqual([
      { id: "playground", format: "mp4", width: 800, height: 450 },
    ]);
    expect(options.data).toEqual({ title: "chosen", theme: "dark" });
    expect(options).not.toHaveProperty("encoding");
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(bundle.dispose).toHaveBeenCalledOnce();
  });

  it("cancels the active runtime export and still disposes the runtime", async () => {
    const runtime = runtimeFixture();
    runtimeMocks.init.mockResolvedValue(runtime);
    runtimeMocks.exportMedia.mockImplementation(
      (_media: MediaDefinition, options: RuntimeExportOptions) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("cancelled"), { code: "RUNTIME_CANCELLED" }));
          }, { once: true });
        }),
    );
    const { result } = renderHook(() => usePlaygroundExport({ media: template }));

    let pending!: Promise<Blob | null>;
    act(() => {
      pending = result.current.exportMp4();
    });
    await waitFor(() => expect(runtimeMocks.exportMedia).toHaveBeenCalledOnce());
    act(() => result.current.cancel());

    let blob: Blob | null = null;
    await act(async () => {
      blob = await pending;
    });
    expect(blob).toBeNull();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(result.current.exporting).toBe(false);
    expect(result.current.status).toBe("Export cancelled");
  });

  it("surfaces typed capability failures without exposing a partial bundle", async () => {
    const runtime = runtimeFixture();
    runtimeMocks.init.mockResolvedValue(runtime);
    runtimeMocks.exportMedia.mockRejectedValue(Object.assign(
      new Error("Media preflight found authored conditions that block this operation"),
      {
        code: "MEDIA_PREFLIGHT_FAILED",
        findings: [{ message: "This runtime cannot export mp4" }],
      },
    ));
    const { result } = renderHook(() => usePlaygroundExport({ media: template }));

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.exportMp4();
    });

    expect(blob).toBeNull();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("Export failed: This runtime cannot export mp4");
  });

  it("does not initialize a runtime without authored media", async () => {
    const { result } = renderHook(() => usePlaygroundExport({ media: null }));
    await expect(result.current.exportMp4()).resolves.toBeNull();
    expect(runtimeMocks.init).not.toHaveBeenCalled();
  });
});

function runtimeFixture() {
  const dispose = vi.fn(async () => undefined);
  return {
    abi: "superimg-runtime-v0/browser",
    capabilities: {
      schemaVersion: 0,
      check: true,
      inspect: true,
      documents: ["html", "svg"],
      rasters: ["png"],
      animated: ["mp4", "webm"],
      collections: { static: true, providers: false },
      assets: { url: true, bytes: true },
      fonts: { logical: true, frozenBytes: true },
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  } as Runtime & { dispose: ReturnType<typeof vi.fn> };
}

function htmlNode(html: string): MediaElement {
  return {
    $$typeof: MEDIA_ELEMENT,
    type: "Html",
    props: { width: "fill", height: "fill", html },
    children: [],
  };
}

function requireBlob(value: Blob | null): Blob {
  if (value === null) throw new Error("Expected an exported Blob");
  return value;
}

function bundleFixture(bytes: Uint8Array, mimeType: string) {
  const stream = vi.fn(() => new ReadableStream<Uint8Array>({
    start(controller) {
      const split = Math.max(1, Math.floor(bytes.length / 2));
      controller.enqueue(bytes.slice(0, split));
      if (split < bytes.length) controller.enqueue(bytes.slice(split));
      controller.close();
    },
  }));
  const dispose = vi.fn(async () => undefined);
  const artifact = {
    path: `playground.${mimeType.endsWith("webm") ? "webm" : "mp4"}`,
    mimeType,
    byteLength: bytes.byteLength,
    sha256: "sha256:artifact",
    coordinates: { variantId: "default", editionId: "default", renditionId: "playground" },
    stream,
  } satisfies ExportArtifact;
  const value = {
    manifest: {
      kind: "@foxworth/superimg/export-bundle",
      schemaVersion: 0,
      programDigest: "sha256:program",
      coordinates: [{ variantId: "default", editionId: "default" }],
      artifacts: [{
        path: artifact.path,
        mimeType,
        byteLength: bytes.byteLength,
        sha256: artifact.sha256,
        coordinates: artifact.coordinates,
      }],
      assets: [],
      fonts: [],
    },
    artifacts: [artifact],
    dispose,
    [Symbol.asyncDispose]: dispose,
  } satisfies ExportBundle;
  return { value, stream, dispose };
}
