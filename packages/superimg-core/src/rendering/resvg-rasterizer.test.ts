import { describe, expect, it } from "vitest";
import { SuperImgError } from "@superimg/types";
import { countSvgTextElements, rasterizeSvgSync } from "./resvg-rasterizer.js";

const SHAPES_ONLY = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">
  <rect width="120" height="80" fill="#0a0a0a"/>
  <circle cx="60" cy="40" r="24" fill="#667eea"/>
</svg>`;

describe("countSvgTextElements", () => {
  it("returns 0 for shapes only", () => {
    expect(countSvgTextElements(SHAPES_ONLY)).toBe(0);
  });

  it("counts text, tspan, and textPath, including a namespace prefix", () => {
    const svg = `<svg>
      <text>hi<tspan>there</tspan></text>
      <svg:textPath href="#p">x</svg:textPath>
    </svg>`;
    expect(countSvgTextElements(svg)).toBe(3);
  });

  it("ignores text-bearing tags inside XML comments", () => {
    const svg = `<svg><!-- <text>hi</text> <tspan/> <textPath>z</textPath> --><rect/></svg>`;
    expect(countSvgTextElements(svg)).toBe(0);
  });

  it("counts text elements that carry attributes", () => {
    expect(countSvgTextElements(`<text x="10" y="50">hi</text>`)).toBe(1);
    expect(countSvgTextElements(`<svg:text x="1">a</svg:text>`)).toBe(1);
    expect(countSvgTextElements(`<tspan dx="2">a</tspan>`)).toBe(1);
    expect(
      countSvgTextElements(`<text data-si-primitive="VectorText" x="10" y="50">hello</text>`),
    ).toBe(1);
  });

  it("does not count names that only start with a text element name", () => {
    expect(countSvgTextElements(`<textarea>`)).toBe(0);
    expect(countSvgTextElements(`<texts>`)).toBe(0);
  });
});

describe("rasterizeSvgSync text without fonts", () => {
  it("throws SVG_TEXT_NO_FONT before constructing Resvg when no fontBuffers are supplied", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>hi</text></svg>`;
    let caught: unknown;
    try {
      rasterizeSvgSync(svg, { width: 32, height: 32 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SuperImgError);
    expect(caught).toMatchObject({
      code: "SVG_TEXT_NO_FONT",
      details: { textElements: 1 },
    });
    expect((caught as SuperImgError).suggestion).toMatch(/fontBuffers/);
    expect((caught as SuperImgError).suggestion).toMatch(/media definition/);
  });
});
