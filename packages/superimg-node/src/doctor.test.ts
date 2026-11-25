import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserStatus } from "@superimg/playwright";
import { RuntimeCancelledError } from "@superimg/types";

vi.mock("@superimg/playwright", async () => {
  const actual = await vi.importActual<typeof import("@superimg/playwright")>("@superimg/playwright");
  return {
    ...actual,
    checkBrowserStatus: vi.fn(),
    ensureBrowser: vi.fn(async () => undefined),
  };
});

import { checkBrowserStatus, ensureBrowser } from "@superimg/playwright";
import { doctor, setup } from "./doctor.js";

function status(patch: Partial<BrowserStatus>): BrowserStatus {
  return {
    installed: false,
    markerPresent: false,
    executablePath: null,
    browsersPath: "/cache",
    browsersPathSource: "default",
    ignoredPlaywrightPath: null,
    platform: "darwin",
    architecture: "arm64",
    ...patch,
  };
}

describe("doctor and setup", () => {
  beforeEach(() => {
    vi.mocked(checkBrowserStatus).mockReset();
    vi.mocked(ensureBrowser).mockClear();
  });

  it("reports chromium health and the same encoder probes as node capabilities", async () => {
    vi.mocked(checkBrowserStatus).mockResolvedValue(status({
      installed: false,
      markerPresent: true,
      executablePath: "/cache/chrome-headless-shell",
    }));
    const report = await doctor();
    expect(report.ok).toBe(false);
    expect(report.chromium).toEqual({
      status: "launch-denied",
      executablePath: "/cache/chrome-headless-shell",
      browsersPath: "/cache",
      installCommand: "superimg setup",
    });
    expect(report.encoders).toEqual({
      mp4: expect.any(Boolean),
      gif: expect.any(Boolean),
      jpegWebp: expect.any(Boolean),
    });
  });

  it("installs Chromium and then returns the doctor report", async () => {
    vi.mocked(checkBrowserStatus).mockResolvedValue(status({
      installed: true,
      executablePath: "/cache/chrome-headless-shell",
    }));
    const events: string[] = [];
    const report = await setup({ onProgress: (event) => { events.push(event); } });
    expect(ensureBrowser).toHaveBeenCalledWith({
      autoInstall: true,
      onProgress: expect.any(Function),
    });
    expect(report.ok).toBe(true);
    expect(report.chromium.status).toBe("ok");
    expect(events).toEqual([]);
  });

  it("rejects setup when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(setup({ signal: controller.signal })).rejects.toBeInstanceOf(RuntimeCancelledError);
    expect(ensureBrowser).not.toHaveBeenCalled();
  });
});
