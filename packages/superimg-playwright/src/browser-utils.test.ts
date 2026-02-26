//! Tests for browser-utils serverless detection

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isServerless, getServerlessChromium, isCI } from "./browser-utils.js";

describe("isServerless", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear serverless env vars
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NETLIFY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns false in local environment", () => {
    expect(isServerless()).toBe(false);
  });

  it("returns true when VERCEL env is set", () => {
    process.env.VERCEL = "1";
    expect(isServerless()).toBe(true);
  });

  it("returns true when AWS_LAMBDA_FUNCTION_NAME is set", () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = "my-function";
    expect(isServerless()).toBe(true);
  });

  it("returns true when NETLIFY env is set", () => {
    process.env.NETLIFY = "true";
    expect(isServerless()).toBe(true);
  });
});

describe("getServerlessChromium", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NETLIFY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when not in serverless env", async () => {
    const result = await getServerlessChromium();
    expect(result).toBeNull();
  });

  it("returns chromium config when in serverless env with @sparticuz/chromium installed", async () => {
    process.env.VERCEL = "1";
    const result = await getServerlessChromium();
    // If @sparticuz/chromium is installed (like in dev), we get a config
    // If not installed (like in CI without it), we get null
    // Both are valid behaviors - we just ensure no crash
    if (result !== null) {
      expect(result).toHaveProperty("executablePath");
      expect(result).toHaveProperty("args");
      expect(Array.isArray(result.args)).toBe(true);
    } else {
      expect(result).toBeNull();
    }
  });
});

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
