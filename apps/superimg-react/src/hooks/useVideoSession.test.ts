//! Tests for useVideoSession hook

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("superimg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("superimg")>();
  return {
    ...actual,
    initBundler: vi.fn().mockResolvedValue(undefined),
    bundleTemplateBrowser: vi.fn().mockImplementation(async (code: string) => {
      // Mock produces defineTemplate-style output: { default: { render, config, defaults } }
      const hasValidTemplate = /defineTemplate|render\s*\(/.test(code);
      if (hasValidTemplate) {
        return "var __template = { default: { render: function() { return '<div></div>'; } } };";
      }
      // Invalid code: return object without render so compile fails
      return "var __template = { default: {} };";
    }),
  };
});

import { useVideoSession, resolveFormat } from "./useVideoSession.js";

describe("resolveFormat", () => {
  it('resolves "vertical" to 1080x1920', () => {
    expect(resolveFormat("vertical")).toEqual({ width: 1080, height: 1920 });
  });

  it('resolves "horizontal" to 1920x1080', () => {
    expect(resolveFormat("horizontal")).toEqual({ width: 1920, height: 1080 });
  });

  it('resolves "square" to 1080x1080', () => {
    expect(resolveFormat("square")).toEqual({ width: 1080, height: 1080 });
  });

  it('resolves stdlib preset paths (e.g., "youtube.video.short")', () => {
    expect(resolveFormat("youtube.video.short")).toEqual({ width: 1080, height: 1920 });
  });

  it('resolves "instagram.video.reel" preset', () => {
    expect(resolveFormat("instagram.video.reel")).toEqual({ width: 1080, height: 1920 });
  });

  it('resolves "tiktok.video.post" preset', () => {
    expect(resolveFormat("tiktok.video.post")).toEqual({ width: 1080, height: 1920 });
  });

  it("passes through custom dimensions", () => {
    expect(resolveFormat({ width: 720, height: 480 })).toEqual({ width: 720, height: 480 });
  });

  it("throws for unknown preset", () => {
    expect(() => resolveFormat("invalid.preset")).toThrow("Unknown format");
  });

  it("throws for empty string", () => {
    expect(() => resolveFormat("")).toThrow("Unknown format");
  });
});

describe("useVideoSession", () => {
  describe("state initialization", () => {
    it("initializes with correct dimensions from initialPreviewFormat", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.previewWidth).toBe(1080);
      expect(result.current.previewHeight).toBe(1920);
      expect(result.current.fps).toBe(30);
    });

    it("uses custom fps when provided", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5, fps: 60 })
      );

      expect(result.current.fps).toBe(60);
    });

    it("initializes with horizontal dimensions", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "horizontal", duration: 3 })
      );

      expect(result.current.previewWidth).toBe(1920);
      expect(result.current.previewHeight).toBe(1080);
    });

    it("initializes with square dimensions", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "square", duration: 3 })
      );

      expect(result.current.previewWidth).toBe(1080);
      expect(result.current.previewHeight).toBe(1080);
    });

    it("initializes with custom dimensions", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: { width: 800, height: 600 }, duration: 3 })
      );

      expect(result.current.previewWidth).toBe(800);
      expect(result.current.previewHeight).toBe(600);
    });

    it("defaults to vertical when no initialPreviewFormat provided", () => {
      const { result } = renderHook(() =>
        useVideoSession({ duration: 5 })
      );

      expect(result.current.previewWidth).toBe(1080);
      expect(result.current.previewHeight).toBe(1920);
      expect(result.current.previewFormat).toBe("vertical");
    });

    it("starts not ready (no template compiled)", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.ready).toBe(false);
      expect(result.current.template).toBeNull();
    });

    it("initializes player state correctly", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentFrame).toBe(0);
      expect(result.current.totalFrames).toBe(150); // 5s * 30fps
      expect(result.current.progress).toBe(0);
    });

    it("calculates totalFrames with custom fps", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5, fps: 60 })
      );

      expect(result.current.totalFrames).toBe(300); // 5s * 60fps
    });

    it("initializes export state correctly", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.exporting).toBe(false);
      expect(result.current.exportProgress).toBe(0);
    });

    it("initializes status as Ready", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.status).toBe("Ready");
    });

    it("initializes error as null", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.error).toBeNull();
    });
  });

  describe("previewFormat", () => {
    it("returns the current preview format", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "horizontal", duration: 5 })
      );

      expect(result.current.previewFormat).toBe("horizontal");
    });

    it("can change preview format with setPreviewFormat", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      expect(result.current.previewFormat).toBe("vertical");
      expect(result.current.previewWidth).toBe(1080);
      expect(result.current.previewHeight).toBe(1920);

      act(() => {
        result.current.setPreviewFormat("horizontal");
      });

      expect(result.current.previewFormat).toBe("horizontal");
      expect(result.current.previewWidth).toBe(1920);
      expect(result.current.previewHeight).toBe(1080);
    });

    it("can change to square format", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      act(() => {
        result.current.setPreviewFormat("square");
      });

      expect(result.current.previewFormat).toBe("square");
      expect(result.current.previewWidth).toBe(1080);
      expect(result.current.previewHeight).toBe(1080);
    });

    it("can change to custom dimensions", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      act(() => {
        result.current.setPreviewFormat({ width: 640, height: 480 });
      });

      expect(result.current.previewWidth).toBe(640);
      expect(result.current.previewHeight).toBe(480);
    });

    it("can change to stdlib preset", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      act(() => {
        result.current.setPreviewFormat("youtube.video.long");
      });

      expect(result.current.previewFormat).toBe("youtube.video.long");
      expect(result.current.previewWidth).toBe(1920);
      expect(result.current.previewHeight).toBe(1080);
    });
  });

  describe("compile()", () => {
    it("sets error on invalid code", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => {
        await result.current.compile("invalid syntax {{{{");
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.status).toBe("Compile error");
      expect(result.current.template).toBeNull();
    });

    it("clears error on valid code after error", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => { await result.current.compile("invalid {{"); });
      expect(result.current.error).not.toBeNull();

      await act(async () => { await result.current.compile('import { defineTemplate } from "superimg"; export default defineTemplate({ render() { return "<div></div>"; } });'); });
      expect(result.current.error).toBeNull();
      expect(result.current.template).not.toBeNull();
    });

    it("updates status to Ready on successful compile", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => {
        await result.current.compile('import { defineTemplate } from "superimg"; export default defineTemplate({ render() { return "<div></div>"; } });');
      });

      expect(result.current.status).toBe("Ready");
    });

    it("sets template on successful compile", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => {
        await result.current.compile('import { defineTemplate } from "superimg"; export default defineTemplate({ render() { return "<div>Hello</div>"; } });');
      });

      expect(result.current.template).not.toBeNull();
      expect(typeof result.current.template?.render).toBe("function");
    });

    it("handles empty code as error", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => {
        await result.current.compile("");
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.template).toBeNull();
    });

    it("handles code without render export as error", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => {
        await result.current.compile("const x = 1;");
      });

      expect(result.current.error).not.toBeNull();
      expect(result.current.template).toBeNull();
    });
  });

  describe("duration reactivity", () => {
    it("updates totalFrames when duration changes", () => {
      const { result, rerender } = renderHook(
        ({ duration }) => useVideoSession({ initialPreviewFormat: "vertical", duration }),
        { initialProps: { duration: 5 } }
      );

      expect(result.current.totalFrames).toBe(150); // 5s * 30fps

      rerender({ duration: 10 });

      expect(result.current.totalFrames).toBe(300); // 10s * 30fps
    });

    it("updates totalFrames when duration decreases", () => {
      const { result, rerender } = renderHook(
        ({ duration }) => useVideoSession({ initialPreviewFormat: "vertical", duration }),
        { initialProps: { duration: 10 } }
      );

      expect(result.current.totalFrames).toBe(300); // 10s * 30fps

      rerender({ duration: 3 });

      expect(result.current.totalFrames).toBe(90); // 3s * 30fps
    });

    it("maintains correct totalFrames with custom fps after duration change", () => {
      const { result, rerender } = renderHook(
        ({ duration }) => useVideoSession({ initialPreviewFormat: "vertical", duration, fps: 60 }),
        { initialProps: { duration: 5 } }
      );

      expect(result.current.totalFrames).toBe(300); // 5s * 60fps

      rerender({ duration: 8 });

      expect(result.current.totalFrames).toBe(480); // 8s * 60fps
    });
  });

  describe("setTemplate()", () => {
    it("sets template directly without compilation", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      const mockTemplate = {
        render: () => "<div>Mock</div>",
      };

      act(() => {
        result.current.setTemplate(mockTemplate);
      });

      expect(result.current.template).toBe(mockTemplate);
      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe("Ready");
    });

    it("clears previous compile error when setting template", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      await act(async () => { await result.current.compile("invalid {{"); });
      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.setTemplate({ render: () => "<div>Mock</div>" });
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("player controls", () => {
    it("play sets isPlaying to true", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      act(() => {
        result.current.play();
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it("pause sets isPlaying to false", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});
      act(() => result.current.play());
      expect(result.current.isPlaying).toBe(true);

      act(() => {
        result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it("togglePlayPause toggles isPlaying", async () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      await act(async () => {});

      act(() => result.current.togglePlayPause());
      expect(result.current.isPlaying).toBe(true);

      act(() => result.current.togglePlayPause());
      expect(result.current.isPlaying).toBe(false);
    });

    it("seek updates currentFrame", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      act(() => {
        result.current.seek(50);
      });

      expect(result.current.currentFrame).toBe(50);
    });

    it("seek updates progress", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );

      // totalFrames = 150, progress = currentFrame / (totalFrames - 1)
      act(() => {
        result.current.seek(74); // ~halfway through
      });

      // 74 / 149 ≈ 0.4966
      expect(result.current.progress).toBeCloseTo(74 / 149, 4);
    });
  });

  describe("export API", () => {
    it("provides exportMp4, exportMultiple, and download functions", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      expect(typeof result.current.exportMp4).toBe("function");
      expect(typeof result.current.exportMultiple).toBe("function");
      expect(typeof result.current.download).toBe("function");
    });
  });

  describe("store", () => {
    it("provides store for Timeline component", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      expect(result.current.store).toBeDefined();
      expect(typeof result.current.store.subscribe).toBe("function");
      expect(typeof result.current.store.getState).toBe("function");
    });
  });

  describe("canvas management", () => {
    it("provides setCanvas function", () => {
      const { result } = renderHook(() =>
        useVideoSession({ initialPreviewFormat: "vertical", duration: 5 })
      );
      expect(typeof result.current.setCanvas).toBe("function");
    });
  });
});
