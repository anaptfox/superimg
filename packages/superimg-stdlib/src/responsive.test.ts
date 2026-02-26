import { describe, it, expect } from "vitest";
import { responsive } from "./responsive.js";

describe("responsive", () => {
  it("returns portrait value when isPortrait", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { portrait: "col", landscape: "row", square: "row", default: "row" },
        ctx
      )
    ).toBe("col");
  });

  it("returns landscape value when isLandscape", () => {
    const ctx = { isPortrait: false, isLandscape: true, isSquare: false };
    expect(
      responsive(
        { portrait: "col", landscape: "row", square: "row", default: "row" },
        ctx
      )
    ).toBe("row");
  });

  it("returns square value when isSquare", () => {
    const ctx = { isPortrait: false, isLandscape: false, isSquare: true };
    expect(
      responsive(
        { portrait: "col", landscape: "row", square: "sq", default: "row" },
        ctx
      )
    ).toBe("sq");
  });

  it("square takes precedence over portrait/landscape when isSquare", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: true };
    expect(
      responsive(
        { portrait: "col", landscape: "row", square: "sq" },
        ctx
      )
    ).toBe("sq");
  });

  it("falls back to default when no orientation match", () => {
    const ctx = { isPortrait: false, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { default: "fallback" },
        ctx
      )
    ).toBe("fallback");
  });

  it("falls back to landscape when portrait not set and isPortrait", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { landscape: "row", default: "def" },
        ctx
      )
    ).toBe("def");
  });

  it("falls back to default when no orientation match", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { portrait: "col" },
        ctx
      )
    ).toBe("col");
  });

  it("returns landscape when portrait undefined and isPortrait", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { landscape: "row", default: "def" },
        ctx
      )
    ).toBe("def");
  });

  it("falls back to landscape then portrait when default not set", () => {
    const ctx = { isPortrait: false, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { portrait: "col", landscape: "row" },
        ctx
      )
    ).toBe("row");
  });

  it("returns undefined when all options are undefined", () => {
    const ctx = { isPortrait: false, isLandscape: false, isSquare: false };
    expect(responsive({}, ctx)).toBeUndefined();
  });

  it("works with numbers", () => {
    const ctx = { isPortrait: true, isLandscape: false, isSquare: false };
    expect(
      responsive(
        { portrait: 48, landscape: 72, default: 64 },
        ctx
      )
    ).toBe(48);
  });
});
