//! Tests for browser-utils

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCI } from "./browser-utils.js";

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
