import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@superimg/node", () => ({
  getRuntimeStatus: vi.fn(),
  chromiumHealth: (status: {
    installed: boolean;
    markerPresent: boolean;
    executablePath?: string | null;
    browsersPath: string;
  }) => ({
    status: status.installed ? "ok" as const : status.markerPresent ? "launch-denied" as const : "missing" as const,
    browsersPath: status.browsersPath,
    installCommand: "superimg setup",
    ...(status.executablePath ? { executablePath: status.executablePath } : {}),
  }),
  BrowserNotInstalledError: class BrowserNotInstalledError extends Error {
    readonly browsersPath: string | null;
    constructor(details: { browsersPath?: string | null }) {
      super("SuperImg Chromium runtime is not installed");
      this.name = "BrowserNotInstalledError";
      this.browsersPath = details.browsersPath ?? null;
    }
  },
  BrowserLaunchDeniedError: class BrowserLaunchDeniedError extends Error {
    readonly browsersPath: string;
    constructor(details: { browsersPath: string }) {
      super("SuperImg Chromium runtime is installed but could not launch");
      this.name = "BrowserLaunchDeniedError";
      this.browsersPath = details.browsersPath;
    }
  },
}));

import { getRuntimeStatus } from "@superimg/node";
import { assertChromiumRuntime } from "../chromium-preflight.js";

describe("assertChromiumRuntime", () => {
  beforeEach(() => {
    vi.mocked(getRuntimeStatus).mockReset();
  });

  it("returns when Chromium is installed", async () => {
    vi.mocked(getRuntimeStatus).mockResolvedValue({
      installed: true,
      markerPresent: true,
      browsersPath: "/browsers",
      browsersPathSource: "default",
    } as Awaited<ReturnType<typeof getRuntimeStatus>>);
    await expect(assertChromiumRuntime()).resolves.toBeUndefined();
  });

  it("throws when Chromium is missing", async () => {
    vi.mocked(getRuntimeStatus).mockResolvedValue({
      installed: false,
      markerPresent: false,
      browsersPath: "/missing",
      browsersPathSource: "default",
    } as Awaited<ReturnType<typeof getRuntimeStatus>>);
    await expect(assertChromiumRuntime()).rejects.toMatchObject({
      name: "BrowserNotInstalledError",
    });
  });

  it("throws launch-denied when the marker is present but launch failed", async () => {
    vi.mocked(getRuntimeStatus).mockResolvedValue({
      installed: false,
      markerPresent: true,
      browsersPath: "/browsers",
      browsersPathSource: "default",
    } as Awaited<ReturnType<typeof getRuntimeStatus>>);
    await expect(assertChromiumRuntime()).rejects.toMatchObject({
      name: "BrowserLaunchDeniedError",
    });
  });
});
