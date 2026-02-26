import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockExportToVideo = vi.hoisted(() => vi.fn());
const mockDownloadBlob = vi.hoisted(() => vi.fn());

vi.mock("superimg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("superimg")>();
  return {
    ...actual,
    exportToVideo: mockExportToVideo,
    downloadBlob: mockDownloadBlob,
  };
});

import { useExport } from "./useExport.js";

describe("useExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportToVideo.mockResolvedValue(new Blob());
  });

  it("starts with exporting false", () => {
    const { result } = renderHook(() => useExport());
    expect(result.current.exporting).toBe(false);
    expect(result.current.progress).toBe(0);
  });

  it("exportMp4 completes and sets exporting to false", async () => {
    const { result } = renderHook(() => useExport());
    const canvas = document.createElement("canvas");
    const renderFrame = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.exportMp4(
        canvas,
        { width: 640, height: 360, fps: 30, durationSeconds: 5 },
        renderFrame
      );
    });

    expect(result.current.exporting).toBe(false);
    expect(mockExportToVideo).toHaveBeenCalled();
  });

  it("download calls downloadBlob", () => {
    const { result } = renderHook(() => useExport());
    const blob = new Blob();
    act(() => result.current.download(blob, "test.mp4"));
    expect(mockDownloadBlob).toHaveBeenCalledWith(blob, "test.mp4");
  });
});