import { describe, expect, it } from "vitest";
import { createMediaIR } from "@superimg/types";
import {
  loaderPayload,
  posterFromLoader,
} from "./server.js";
import { superimgReactRouter } from "./vite.js";

const sampleIR = () => createMediaIR({ sourceId: "rr-demo", width: 800, height: 450, durationSeconds: 1, totalFrames: 30, phases: [] });

describe("@superimg/react-router", () => {
  it("loader payload + poster", () => {
    const data = loaderPayload(sampleIR());
    expect(data.sourceId).toBe("rr-demo");
    expect(posterFromLoader(data)).toContain("data-superimg-poster");
  });

  it("vite plugin name", () => {
    expect(superimgReactRouter().name).toBe("superimg");
  });
});
