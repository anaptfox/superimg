import { describe, expect, it } from "vitest";
import {
  CapabilityUnavailableError,
  ExportBundleDisposedError,
  MediaPreflightError,
  RuntimeCancelledError,
  RuntimeDisposedError,
  RuntimeInfrastructureError,
  type RuntimeFinding,
} from "../runtime.js";
import { SuperImgError } from "../results.js";

describe("value-first runtime errors", () => {
  it.each([
    [new RuntimeInfrastructureError("renderer failed"), "RUNTIME_INFRASTRUCTURE_ERROR"],
    [new RuntimeDisposedError(), "RUNTIME_DISPOSED"],
    [new CapabilityUnavailableError("html rasterization"), "CAPABILITY_UNAVAILABLE"],
    [new RuntimeCancelledError(), "RUNTIME_CANCELLED"],
    [new ExportBundleDisposedError("youtube/video.mp4"), "EXPORT_BUNDLE_DISPOSED"],
  ])("keeps %s as a serializable SuperImgError", (error, code) => {
    expect(error).toBeInstanceOf(SuperImgError);
    expect(error.code).toBe(code);
    expect(error.toJSON()).toMatchObject({ name: error.name, code });
  });

  it("retains typed authored findings on complete preflight failure", () => {
    const findings = [
      {
        severity: "error",
        category: "font",
        code: "FONT_UNRESOLVED",
        message: "Could not freeze Inter 700",
      },
    ] satisfies readonly RuntimeFinding[];

    const error = new MediaPreflightError(findings);

    expect(error).toBeInstanceOf(SuperImgError);
    expect(error.code).toBe("MEDIA_PREFLIGHT_FAILED");
    expect(error.findings).toBe(findings);
    expect(error.toJSON().details).toEqual({ findings });
  });
});
