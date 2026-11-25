//! Tests for browser-utils

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isSuperImgError } from "@superimg/types";
import { BrowserInstallError } from "./runtime-install.js";
import {
  BrowserLaunchDeniedError,
  BrowserNotInstalledError,
  chromiumHealth,
  chromiumLaunchError,
  isCI,
} from "./browser-utils.js";

describe("isCI", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.TRAVIS;
    delete process.env.JENKINS_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false when no CI env vars are set", () => {
    expect(isCI()).toBe(false);
  });

  it("returns true when CI is set", () => {
    process.env.CI = "true";
    expect(isCI()).toBe(true);
  });

  it("returns true when GITHUB_ACTIONS is set", () => {
    process.env.GITHUB_ACTIONS = "true";
    expect(isCI()).toBe(true);
  });
});
describe("chromium errors", () => {
  it("codes a missing runtime in one line and keeps the cause", () => {
    const cause = new Error("browserType.launch: Executable doesn't exist at /missing");
    const error = new BrowserNotInstalledError({ browsersPath: "/cache", cause });
    expect(error).toBeInstanceOf(BrowserNotInstalledError);
    expect(error.message).toBe("SuperImg Chromium runtime is not installed");
    expect(error.message).not.toContain("\n");
    expect(error.code).toBe("CHROMIUM_MISSING");
    expect(error.installCommand).toBe("superimg setup");
    expect(error.browsersPath).toBe("/cache");
    expect(error.cause).toBe(cause);
    expect(error.details).toMatchObject({ installCommand: "superimg setup", browsersPath: "/cache" });
    expect(error.suggestion).toContain("superimg setup");
    expect(error.suggestion).toContain("setup()");
    expect(isSuperImgError(error, "CHROMIUM_MISSING")).toBe(true);
  });

  it("codes launch denial from the installation marker", () => {
    const cause = new Error("spawn EPERM");
    const error = chromiumLaunchError(cause, { browsersPath: "/cache", markerPresent: true });
    expect(error).toBeInstanceOf(BrowserLaunchDeniedError);
    expect(error).toMatchObject({
      code: "CHROMIUM_LAUNCH_DENIED",
      browsersPath: "/cache",
      cause,
    });
    expect((error as BrowserLaunchDeniedError).suggestion).toContain("superimg setup");
    expect((error as BrowserLaunchDeniedError).suggestion).toContain("setup()");
  });

  it("codes a missing executable and leaves unrelated launch failures alone", () => {
    const missing = new Error("Executable doesn't exist at /none");
    const mapped = chromiumLaunchError(missing, { browsersPath: "/cache", markerPresent: false });
    expect(mapped).toBeInstanceOf(BrowserNotInstalledError);
    expect((mapped as BrowserNotInstalledError).cause).toBe(missing);

    const other = new Error("protocol timeout");
    expect(chromiumLaunchError(other, { browsersPath: "/cache", markerPresent: false })).toBe(other);
  });

  it("codes an install failure with the exit code and registry", () => {
    const error = new BrowserInstallError(1, "download failed", { browsersPath: "/cache" });
    expect(error.code).toBe("CHROMIUM_INSTALL_FAILED");
    expect(error.exitCode).toBe(1);
    expect(error.installCommand).toBe("superimg setup");
    expect(error.browsersPath).toBe("/cache");
    expect(error.suggestion).toContain("setup()");
  });

  it("classifies doctor chromium status from launch and the marker", () => {
    expect(chromiumHealth({
      installed: true,
      markerPresent: true,
      executablePath: "/cache/chrome-headless-shell",
      browsersPath: "/cache",
    })).toEqual({
      status: "ok",
      executablePath: "/cache/chrome-headless-shell",
      browsersPath: "/cache",
      installCommand: "superimg setup",
    });
    expect(chromiumHealth({
      installed: false,
      markerPresent: true,
      executablePath: null,
      browsersPath: "/cache",
    }).status).toBe("launch-denied");
    expect(chromiumHealth({
      installed: false,
      markerPresent: false,
      executablePath: null,
      browsersPath: "/cache",
    }).status).toBe("missing");
  });
});
