import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockExportToVideo = vi.hoisted(() => vi.fn());

vi.mock("@superimg/browser-export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@superimg/browser-export")>();
  return {
    ...actual,
    exportToVideo: mockExportToVideo,
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
        { width: 640, height: 360, fps: 30, duration: 5 },
        renderFrame
      );
    });

    expect(result.current.exporting).toBe(false);
    expect(mockExportToVideo).toHaveBeenCalled();
  });

  it("download creates and releases an object URL", () => {
    const { result } = renderHook(() => useExport());
    const blob = new Blob();
    const url = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    act(() => result.current.download(blob, "test.mp4"));
    expect(url).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
});
