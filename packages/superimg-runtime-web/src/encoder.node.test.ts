import { describe, expect, it } from "vitest";
import { validateFrameDimensions } from "./encoder.js";

describe("validateFrameDimensions", () => {
  it("does not throw when dimensions match", () => {
    expect(() =>
      validateFrameDimensions({ width: 640, height: 360 }, 640, 360)
    ).not.toThrow();
  });

  it("throws when width does not match", () => {
    expect(() =>
      validateFrameDimensions({ width: 320, height: 360 }, 640, 360)
    ).toThrow(
      "Frame dimensions 320x360 do not match encoder dimensions 640x360"
    );
  });

  it("throws when height does not match", () => {
    expect(() =>
      validateFrameDimensions({ width: 640, height: 180 }, 640, 360)
    ).toThrow(
      "Frame dimensions 640x180 do not match encoder dimensions 640x360"
    );
  });

  it("throws when both dimensions do not match", () => {
    expect(() =>
      validateFrameDimensions({ width: 320, height: 180 }, 640, 360)
    ).toThrow(
      "Frame dimensions 320x180 do not match encoder dimensions 640x360"
    );
  });
});
