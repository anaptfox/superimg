import { describe, it, expect } from "vitest";
import {
  isStillOutputFormat,
  PRORES_MASTER_ENCODING,
  PRORES_MASTER_ALPHA_ENCODING,
  resolveCaptureDefaults,
} from "./encoding-types.js";

describe("resolveCaptureDefaults", () => {
  it.each([PRORES_MASTER_ENCODING, PRORES_MASTER_ALPHA_ENCODING])("uses lossless capture for editing masters", (encoding) => {
    expect(resolveCaptureDefaults(encoding.format, encoding.capture, encoding.video.alpha === "keep").intermediate).toBe("png");
  });

  it("defaults stills to dpr 2, device scale, png intermediate", () => {
    const c = resolveCaptureDefaults("png");
    expect(c.dpr).toBe(2);
    expect(c.scale).toBe("device");
    expect(c.intermediate).toBe("png");
    expect(c.jpegQuality).toBe(95);
    expect(c.colorProfile).toBe("srgb");
  });

  it("defaults video to dpr 1, css scale, jpeg intermediate", () => {
    const c = resolveCaptureDefaults("mp4");
    expect(c.dpr).toBe(1);
    expect(c.scale).toBe("css");
    expect(c.intermediate).toBe("jpeg");
  });

  it("uses png intermediate when alpha keep for video", () => {
    const c = resolveCaptureDefaults("mp4", undefined, true);
    expect(c.intermediate).toBe("png");
    expect(c.dpr).toBe(1);
  });

  it("honors explicit capture overrides", () => {
    const c = resolveCaptureDefaults("png", {
      dpr: 1,
      scale: "css",
      intermediate: "jpeg",
      jpegQuality: 88,
      colorProfile: "display-p3",
    });
    expect(c.dpr).toBe(1);
    expect(c.scale).toBe("css");
    expect(c.intermediate).toBe("jpeg");
    expect(c.jpegQuality).toBe(88);
    expect(c.colorProfile).toBe("display-p3");
  });

  it("isStillOutputFormat only for png/webp/jpeg", () => {
    expect(isStillOutputFormat("png")).toBe(true);
    expect(isStillOutputFormat("mp4")).toBe(false);
    expect(isStillOutputFormat("gif")).toBe(false);
  });
});
