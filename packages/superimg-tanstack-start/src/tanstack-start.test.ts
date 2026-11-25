import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  loaderPayload,
  posterHtml,
} from "./server.js";
import { superimgTanstackStart } from "./vite.js";

const sampleIR = () =>
  createMediaIR({
    sourceId: "tanstack-demo",
    width: 800,
    height: 450,
    durationSeconds: 1,
    totalFrames: 30,
    phases: [],
  });

describe("@superimg/tanstack-start", () => {
  it("builds a loader payload and poster", () => {
    const payload = loaderPayload(sampleIR(), {
      data: { title: "x" },
    });
    expect(posterHtml(payload)).toContain("800");
    expect(payload.sourceId).toBe("tanstack-demo");
  });

  it("vite plugin", () => {
    expect(superimgTanstackStart().name).toBe("superimg");
  });
});
