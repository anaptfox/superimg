import { describe, it, expect } from "vitest";
import { buildEncodingOptions } from "./render-encoding.js";
import type { RenderOptions } from "./render-targets.js";

describe("buildEncodingOptions capture/still", () => {
  it("requests native capture reuse only when explicitly enabled", () => {
    expect(buildEncodingOptions({ captureCache: true })).toEqual({ capture: { cache: true } });
    expect(buildEncodingOptions({ captureCache: false })).toBeUndefined();
    expect(buildEncodingOptions({ noCache: true })).toBeUndefined();
  });
  it("maps --dpr --capture --color-profile into encoding.capture", () => {
    const enc = buildEncodingOptions({
      dpr: "1",
      capture: "jpeg",
      colorProfile: "srgb",
    } satisfies RenderOptions);
    expect(enc?.format).toBeUndefined();
    expect(enc?.capture).toEqual({
      dpr: 1,
      intermediate: "jpeg",
      colorProfile: "srgb",
    });
  });

  it("maps --still-quality and --lossless into encoding.still", () => {
    const enc = buildEncodingOptions({
      stillQuality: "90",
      lossless: true,
    } satisfies RenderOptions);
    expect(enc?.still).toEqual({ quality: 90, lossless: true });
  });

  it("keeps video --quality as encoder quality not capture", () => {
    const enc = buildEncodingOptions({
      quality: "very-high",
    } satisfies RenderOptions);
    expect(enc?.video?.quality).toBe("very-high");
    expect(enc?.capture).toBeUndefined();
  });

  it("combines bitrate and bitrate mode into one portable quality request", () => {
    const enc = buildEncodingOptions({
      videoBitrate: "8000000",
      bitrateMode: "constant",
      audioBitrate: "192000",
      audioBitrateMode: "variable",
    } satisfies RenderOptions);
    expect(enc?.video?.quality).toEqual({ bitrate: 8_000_000, mode: "constant" });
    expect(enc?.audio?.quality).toEqual({ bitrate: 192_000, mode: "variable" });
  });

  it("rejects invalid quality input instead of silently selecting a default", () => {
    expect(() => buildEncodingOptions({ quality: "cinema" } satisfies RenderOptions)).toThrow(/Unknown quality/);
    expect(() => buildEncodingOptions({ videoBitrate: "0" } satisfies RenderOptions)).toThrow(/positive integer/);
    expect(() => buildEncodingOptions({ bitrateMode: "constant" } satisfies RenderOptions)).toThrow(/requires --video-bitrate/);
  });

  it("provides opaque and transparent ProRes master presets", () => {
    expect(buildEncodingOptions({ preset: "prores-master" } satisfies RenderOptions)).toMatchObject({
      format: "mov", video: { codec: "prores", quality: "very-high", alpha: "discard" },
    });
    expect(buildEncodingOptions({ preset: "prores-master-alpha" } satisfies RenderOptions)).toMatchObject({
      format: "mov", video: { codec: "prores", quality: "very-high", alpha: "keep" },
    });
  });

  it("maps explicit alpha and quantizer quality and rejects ambiguity", () => {
    expect(buildEncodingOptions({ alpha: "keep", videoQuantizer: "18" } satisfies RenderOptions)?.video).toMatchObject({ alpha: "keep", quality: { quantizer: 18 } });
    expect(() => buildEncodingOptions({ alpha: "opaque" } satisfies RenderOptions)).toThrow(/--alpha/);
    expect(() => buildEncodingOptions({ videoQuantizer: "-1" } satisfies RenderOptions)).toThrow(/quantizer/);
    expect(() => buildEncodingOptions({ quality: "high", videoBitrate: "1000" } satisfies RenderOptions)).toThrow(/cannot be combined/);
  });

  it("maps --deband and --still-bit-depth into encoding.still", () => {
    const enc = buildEncodingOptions({
      deband: "blue-noise",
      debandStrength: "0.4",
      stillBitDepth: "16",
    } satisfies RenderOptions);
    expect(enc?.still).toEqual({
      deband: "blue-noise",
      debandStrength: 0.4,
      bitDepth: 16,
    });
  });

  it.each([
    ["malformed DPR suffix", { dpr: "2x" }, /--dpr/],
    ["non-finite DPR", { dpr: "Infinity" }, /--dpr/],
    ["unsupported capture intermediate", { capture: "webp" }, /--capture/],
    ["unsupported color profile", { colorProfile: "hdr" }, /--color-profile/],
    ["unsupported video codec", { videoCodec: "h264" }, /Unknown video codec/],
    ["unsupported latency mode", { latencyMode: "fast" }, /Unknown latency mode/],
    ["unsupported hardware hint", { hardwareAccel: "gpu" }, /Unknown hardware acceleration/],
    ["non-positive keyframe interval", { keyframeInterval: "0" }, /keyframe-interval/],
    ["malformed cluster duration", { clusterDuration: "1s" }, /cluster-duration/],
  ] as const)("rejects %s", (_label, options, message) => {
    expect(() => buildEncodingOptions(options satisfies RenderOptions)).toThrow(message);
  });

  it.each([
    ["alpha value", { alpha: "opaque" }, /--alpha/],
    ["negative quantizer", { videoQuantizer: "-1" }, /quantizer/],
    ["non-finite quantizer", { videoQuantizer: "NaN" }, /quantizer/],
    ["quality and bitrate conflict", { quality: "high", videoBitrate: "1000" }, /cannot be combined/],
    ["bitrate mode without bitrate", { bitrateMode: "constant" }, /requires --video-bitrate/],
  ] as const)("rejects invalid quality combination: %s", (_label, options, message) => {
    expect(() => buildEncodingOptions(options satisfies RenderOptions)).toThrow(message);
  });
});
