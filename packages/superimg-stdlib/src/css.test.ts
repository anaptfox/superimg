import { describe, it, expect } from "vitest";
import { css, fill, center, stack, row } from "./css";

describe("css", () => {
  it("serializes style object to inline string", () => {
    expect(css({ width: 100, height: 200 })).toBe("width:100px;height:200px");
  });

  it("converts camelCase to kebab-case", () => {
    expect(css({ alignItems: "center" })).toBe("align-items:center");
    expect(css({ justifyContent: "flex-end" })).toBe("justify-content:flex-end");
  });

  it("appends px to numeric values for dimension properties", () => {
    expect(css({ width: 1920 })).toContain("width:1920px");
    expect(css({ fontSize: 24 })).toContain("font-size:24px");
    expect(css({ padding: 16 })).toContain("padding:16px");
  });

  it("does not append px to unitless properties", () => {
    expect(css({ opacity: 0.5 })).toBe("opacity:0.5");
    expect(css({ zIndex: 10 })).toBe("z-index:10");
    expect(css({ fontWeight: 700 })).toBe("font-weight:700");
    expect(css({ flex: 1 })).toBe("flex:1");
  });

  it("ignores null and undefined values", () => {
    expect(css({ width: 100, height: undefined })).toBe("width:100px");
    expect(css({ width: 100, opacity: null })).toBe("width:100px");
  });

  it("passes through string values as-is", () => {
    expect(css({ display: "flex" })).toBe("display:flex");
    expect(css({ color: "red" })).toBe("color:red");
  });

  it("handles complex combinations", () => {
    const result = css({
      width: 1920,
      height: 1080,
      display: "flex",
      alignItems: "center",
      opacity: 0.8,
    });
    expect(result).toContain("width:1920px");
    expect(result).toContain("height:1080px");
    expect(result).toContain("display:flex");
    expect(result).toContain("align-items:center");
    expect(result).toContain("opacity:0.8");
  });

  it("returns empty string for empty object", () => {
    expect(css({})).toBe("");
  });

  it("handles zero values with px", () => {
    expect(css({ width: 0 })).toBe("width:0px");
    expect(css({ margin: 0 })).toBe("margin:0px");
  });

  it("handles vendor prefixes with leading dash", () => {
    expect(css({ WebkitTransform: "scale(1)" })).toBe("-webkit-transform:scale(1)");
    expect(css({ MozTransition: "all 0.3s" })).toBe("-moz-transition:all 0.3s");
    expect(css({ msFlexAlign: "center" })).toBe("-ms-flex-align:center");
  });

  it("appends px to flexBasis (not unitless)", () => {
    expect(css({ flexBasis: 200 })).toBe("flex-basis:200px");
  });

  it("uses canonical unitless list (lineHeight, WebkitLineClamp)", () => {
    expect(css({ lineHeight: 1.2 })).toBe("line-height:1.2");
    expect(css({ WebkitLineClamp: 2 })).toBe("-webkit-line-clamp:2");
  });

  it("treats CSS custom properties as unitless", () => {
    expect(css({ "--progress": 0.5 })).toBe("--progress:0.5");
  });
});

describe("fill", () => {
  it("returns fill preset styles", () => {
    const result = fill();
    expect(result).toContain("position:absolute");
    expect(result).toContain("top:0");
    expect(result).toContain("left:0");
    expect(result).toContain("width:100%");
    expect(result).toContain("height:100%");
  });
});

describe("center", () => {
  it("returns flex center preset styles", () => {
    const result = center();
    expect(result).toContain("display:flex");
    expect(result).toContain("align-items:center");
    expect(result).toContain("justify-content:center");
  });
});

describe("stack", () => {
  it("returns flex column preset styles", () => {
    const result = stack();
    expect(result).toContain("display:flex");
    expect(result).toContain("flex-direction:column");
  });
});

describe("row", () => {
  it("returns flex row preset styles", () => {
    const result = row();
    expect(result).toContain("display:flex");
    expect(result).toContain("flex-direction:row");
  });
});
