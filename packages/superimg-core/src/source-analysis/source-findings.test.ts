import { describe, expect, it } from "vitest";
import { analyzeMediaSourceFindings } from "./source-findings.js";

describe("analyzeMediaSourceFindings", () => {
  it("returns portable authored findings without evaluating the module", () => {
    const findings = analyzeMediaSourceFindings(
      'const motion = director.motion({ for: 30 });',
      { isAnimated: true },
    );

    expect(findings).toEqual([
      expect.objectContaining({
        severity: "error",
        category: "authoring",
        code: "UNITLESS_MOTION_TIME",
        details: { context: "for: 30" },
      }),
    ]);
  });
});
