import { describe, it, expect } from "vitest";
import { parseDuration } from "../shared/utils.js";

describe("parseDuration", () => {
  it("returns numeric seconds as-is", () => {
    expect(parseDuration(2.5)).toBe(2.5);
    expect(parseDuration(0)).toBe(0);
  });

  it("defaults to 5 seconds when undefined", () => {
    expect(parseDuration(undefined)).toBe(5);
  });

  it("parses second strings", () => {
    expect(parseDuration("5s")).toBe(5);
    expect(parseDuration("2.5s")).toBe(2.5);
  });

  it("parses millisecond strings", () => {
    expect(parseDuration("500ms")).toBe(0.5);
    expect(parseDuration("1500ms")).toBe(1.5);
  });

  it("parses frame strings when fps is provided", () => {
    expect(parseDuration("30f", "duration", 30)).toBe(1);
    expect(parseDuration("60f", "duration", 30)).toBe(2);
    expect(parseDuration("15f", "duration", 30)).toBe(0.5);
  });

  it("throws for frame strings without fps", () => {
    expect(() => parseDuration("30f")).toThrow(/requires fps/);
  });

  it("throws for invalid format with field name", () => {
    expect(() => parseDuration("5sec", "scene.duration")).toThrow(
      /Invalid scene\.duration.*"5sec"/
    );
  });
});