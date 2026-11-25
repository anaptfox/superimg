import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("execa", () => ({ execa: vi.fn().mockResolvedValue({ stdout: "ffmpeg test" }) }));
vi.mock("@superimg/node", () => ({
  getRuntimeStatus: vi.fn().mockResolvedValue({ browsersPath: "/browser", browsersPathSource: "test" }),
  chromiumHealth: vi.fn().mockReturnValue({ status: "ok" }),
}));
vi.mock("../utils/find-project-root.js", () => ({ findProjectRoot: () => "/fake-project" }));
vi.mock("../utils/discover-videos.js", () => ({ discoverVideos: () => [] }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

import { checkNode, doctorCommand, MIN_NODE_VERSION, nodeMeetsEngines } from "./doctor.js";

describe("doctor Node runtime requirement", () => {
  it("matches the package engines and tests the exact boundary", () => {
    const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../../../package.json", import.meta.url)), "utf8"));
    expect(manifest.engines.node).toBe(`>=${MIN_NODE_VERSION}`);
    expect(nodeMeetsEngines("22.12.0")).toBe(false);
    expect(nodeMeetsEngines("24.20.9")).toBe(false);
    expect(nodeMeetsEngines("24.21.0")).toBe(true);
    expect(nodeMeetsEngines("24.21.1")).toBe(true);
    expect(nodeMeetsEngines("25.0.0")).toBe(true);
    expect(nodeMeetsEngines("26.11.1")).toBe(true);
    expect(checkNode("24.20.9")).toMatchObject({
      status: "fail", code: "NODE_VERSION",
      hint: `Upgrade Node to ${MIN_NODE_VERSION} or newer (package engines).`,
    });
    expect(checkNode("24.21.0")).toMatchObject({ status: "ok", code: "NODE_VERSION" });
  });

  it("reports the same requirement and status in doctor JSON", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await doctorCommand({ json: true });
      const report = JSON.parse(String(log.mock.calls[0]?.[0]));
      expect(report.engines.node).toBe(`>=${MIN_NODE_VERSION}`);
      expect(report.checks.find((check: { code: string }) => check.code === "NODE_VERSION"))
        .toMatchObject({ status: "ok", label: `Node ≥ ${MIN_NODE_VERSION}`, detail: `v${process.versions.node}` });
    } finally {
      log.mockRestore();
    }
  });
});
