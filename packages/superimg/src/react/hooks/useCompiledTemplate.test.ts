import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateCompilationError } from "@superimg/types";
vi.mock("@superimg/core/errors", async () => import(new URL("../../../../superimg-core/src/errors/compiler-diagnostics.ts", import.meta.url).pathname));

const mockCompileTemplate = vi.hoisted(() =>
  vi.fn(() => ({
    media: {
      kind: "media",
      media: "image",
      medium: "html",
      animated: false,
      fallbackFormat: "png",
      config: {},
      render: () => ({
        $$typeof: "@foxworth/superimg/element" as const,
        type: "Html",
        props: { width: "fill", height: "fill", html: "" },
        children: [],
      }),
    },
  })),
);

const mockBundleTemplateQueued = vi.hoisted(() => vi.fn());

vi.mock("@superimg/core", () => ({
  compileTemplate: mockCompileTemplate,
}));

vi.mock("./bundler-worker-client.js", () => ({
  bundleTemplateQueued: mockBundleTemplateQueued,
}));

import { clearMediaCache, useCompiledMedia } from "./useCompiledMedia.js";

describe("useCompiledMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMediaCache();
  });

  it("uses bundledUrl only when wasmCompile is false", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => ({
      ok: true,
      text: async () => `iife:${String(url)}`,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCompiledMedia({
        codeUrl: "/playground/examples/demo/code.ts",
        bundledUrl: "/playground/examples/demo/bundle.iife.js",
        wasmCompile: false,
      }),
    );

    await waitFor(() => expect(result.current.media).toBeTruthy());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/playground/examples/demo/bundle.iife.js",
      expect.any(Object),
    );
    expect(mockCompileTemplate).toHaveBeenCalledWith(
      "iife:/playground/examples/demo/bundle.iife.js",
    );
    expect(mockBundleTemplateQueued).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});


it("retains structured compiler failures in the queued compile hook", async () => {
  const failure = new TemplateCompilationError({ syntaxError: "invalid" });
  Object.assign(failure, { code: "MEDIA_SOURCE_PARSE_ERROR" });
  failure.details.compilerDiagnostics = [{ code: "MEDIA_SOURCE_PARSE_ERROR", severity: "error", stage: "source", message: "invalid", labels: [{ start: 5, end: 6 }] }];
  mockBundleTemplateQueued.mockRejectedValueOnce(failure);
  const { result } = renderHook(() => useCompiledMedia({ code: "invalid", cache: false, debounceMs: 0 }));
  await waitFor(() => expect(result.current.error).toBe(failure));
  expect(result.current.diagnostics).toEqual(failure.details.compilerDiagnostics);
});
