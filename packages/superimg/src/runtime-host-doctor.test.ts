import { describe, expect, it, vi } from "vitest";

vi.mock("@superimg/browser-export/runtime", () => ({
  createBrowserRuntimeAdapter: () => ({ dispose: async () => undefined }),
}));

vi.mock("@superimg/edge-runtime/document", () => ({
  createEdgeDocumentRuntimeAdapter: () => ({ dispose: async () => undefined }),
}));

vi.mock("@superimg/core/runtime", () => ({
  createRuntime: () => ({}),
  bindRuntimeApi: () => ({
    check: async () => undefined,
    inspect: async () => undefined,
    inspectFile: async () => undefined,
    render: async () => undefined,
    renderResponse: async () => undefined,
    exportMedia: async () => undefined,
    startExport: () => undefined,
    startConversion: () => undefined,
    shutdown: async () => undefined,
  }),
}));

import { CapabilityUnavailableError } from "@superimg/types";
import { doctor as browserDoctor, setup as browserSetup } from "./runtime.browser.js";
import { doctor as edgeDoctor, setup as edgeSetup } from "./runtime.edge.js";

describe("browser and edge runtime doctor", () => {
  it.each([
    ["browser", browserSetup, browserDoctor],
    ["edge", edgeSetup, edgeDoctor],
  ] as const)("%s setup and doctor reject as unavailable capabilities", async (_host, setup, doctor) => {
    await expect(setup()).rejects.toMatchObject({
      name: "CapabilityUnavailableError",
      code: "CAPABILITY_UNAVAILABLE",
      details: { capability: "setup" },
    });
    await expect(doctor()).rejects.toBeInstanceOf(CapabilityUnavailableError);
    await expect(doctor()).rejects.toMatchObject({ details: { capability: "doctor" } });
  });
});
