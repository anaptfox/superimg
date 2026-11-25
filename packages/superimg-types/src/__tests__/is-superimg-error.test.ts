import { describe, expect, it } from "vitest";
import { isSuperImgError, SuperImgError } from "../results.js";
import { RuntimeInfrastructureError } from "../runtime.js";

describe("isSuperImgError", () => {
  it("matches instances and an optional code", () => {
    const error = new SuperImgError(
      "Chromium missing",
      "CHROMIUM_MISSING",
      { installCommand: "superimg setup" },
      "Install the Chromium runtime with `superimg setup` or call setup().",
    );
    expect(isSuperImgError(error)).toBe(true);
    expect(isSuperImgError(error, "CHROMIUM_MISSING")).toBe(true);
    expect(isSuperImgError(error, "CHROMIUM_LAUNCH_DENIED")).toBe(false);
    expect(isSuperImgError(new RuntimeInfrastructureError("down"), "RUNTIME_INFRASTRUCTURE_ERROR")).toBe(true);
  });

  it("matches a duplicated module copy by name and code", () => {
    const foreign = Object.assign(new Error("Chromium missing"), {
      name: "BrowserNotInstalledError",
      code: "CHROMIUM_MISSING",
      details: { installCommand: "superimg setup" },
      suggestion: "Install the Chromium runtime with `superimg setup` or call setup().",
    });
    expect(foreign instanceof SuperImgError).toBe(false);
    expect(isSuperImgError(foreign, "CHROMIUM_MISSING")).toBe(true);
    expect(isSuperImgError(foreign, "RUNTIME_DISPOSED")).toBe(false);
  });

  it("rejects values that only share a name or a Node error code", () => {
    expect(isSuperImgError(new Error("nope"))).toBe(false);
    expect(isSuperImgError(Object.assign(new Error("missing file"), { code: "ENOENT" }))).toBe(false);
    expect(isSuperImgError({ name: "SuperImgError", code: "CHROMIUM_MISSING" })).toBe(false);
    expect(isSuperImgError(null)).toBe(false);
    expect(isSuperImgError("CHROMIUM_MISSING")).toBe(false);
  });
});
