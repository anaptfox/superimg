import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCompileTemplate = vi.hoisted(() =>
  vi.fn(() => ({
    template: {
      config: {},
      render: () => "",
    },
  })),
);

const mockBundleTemplateQueued = vi.hoisted(() => vi.fn());

vi.mock("../../index.browser.js", () => ({
  compileTemplate: mockCompileTemplate,
}));

vi.mock("./bundler-worker-client.js", () => ({
  bundleTemplateQueued: mockBundleTemplateQueued,
}));

import { clearTemplateCache, useCompiledTemplate } from "./useCompiledTemplate.js";

describe("useCompiledTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTemplateCache();
  });

  it("uses bundledUrl only when wasmCompile is false", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => ({
      ok: true,
      text: async () => `iife:${String(url)}`,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCompiledTemplate({
        codeUrl: "/playground/examples/demo/code.ts",
        bundledUrl: "/playground/examples/demo/bundle.iife.js",
        wasmCompile: false,
      }),
    );

    await waitFor(() => expect(result.current.template).toBeTruthy());

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
