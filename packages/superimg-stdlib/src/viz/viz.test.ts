import { describe, it, expect } from "vitest";
import { createCoords, axes, grid, numberLine, camera } from "./coords";
import { tracker } from "./tracker";
import { plot } from "./plot";
import { equation } from "./katex";

describe("viz.createCoords", () => {
  const coords = createCoords({ width: 400, height: 300 });

  it("maps origin to plot center pixel", () => {
    const { px, py } = coords.toPixel(0, 0);
    expect(px).toBeCloseTo(200, 0);
    expect(py).toBeCloseTo(150, 0);
  });

  it("inverts y axis (math up = pixel up)", () => {
    const top = coords.toPixel(0, 5);
    const bottom = coords.toPixel(0, -5);
    expect(top.py).toBeLessThan(bottom.py);
  });

  it("round-trips toPixel and toMath", () => {
    const { px, py } = coords.toPixel(2.5, -1.5);
    const { x, y } = coords.toMath(px, py);
    expect(x).toBeCloseTo(2.5, 5);
    expect(y).toBeCloseTo(-1.5, 5);
  });

  it("respects custom ranges and padding", () => {
    const custom = createCoords({
      width: 200,
      height: 100,
      xRange: [0, 10],
      yRange: [0, 5],
      padding: 10,
    });
    expect(custom.plotLeft).toBe(10);
    expect(custom.plotWidth).toBe(180);
    expect(custom.plotHeight).toBe(80);
  });
});

describe("viz.axes", () => {
  it("returns SVG group with axis lines", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const svg = axes(coords);
    expect(svg).toContain("<g>");
    expect(svg).toContain("<line");
  });

  it("animates with progress < 1", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const svg = axes(coords, { progress: 0.5 });
    expect(svg).toContain("stroke-dasharray");
  });
});

describe("viz.grid", () => {
  it("returns path element", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const svg = grid(coords);
    expect(svg).toContain("<path");
    expect(svg).toContain('stroke="#222"');
  });
});

describe("viz.numberLine", () => {
  it("renders line with ticks", () => {
    const svg = numberLine({ x1: 10, y1: 50, x2: 190, y2: 50, min: 0, max: 10 });
    expect(svg).toContain("<line");
    expect(svg).toContain("<text");
  });
});

describe("viz.camera", () => {
  it("returns transform and style for pan/zoom", () => {
    const coords = createCoords({ width: 400, height: 300 });
    const { transform, style } = camera(coords, { zoom: 2, pan: [1, 1] });
    expect(transform).toContain("scale(2)");
    expect(style).toContain("transform:");
  });
});

describe("viz.tracker", () => {
  it("returns eased progress per window", () => {
    const result = tracker(0.5, { intro: [0, 0.5], main: [0.5, 1] });
    expect(result.intro).toBeGreaterThan(0);
    expect(result.intro).toBeLessThanOrEqual(1);
    expect(result.main).toBeGreaterThanOrEqual(0);
    expect(result.main).toBeLessThanOrEqual(1);
  });

  it("returns 1 for zero-span windows", () => {
    const result = tracker(0.3, { snap: [0.2, 0.2] });
    expect(result.snap).toBe(1);
  });

  it("clamps before window start", () => {
    const result = tracker(0, { fade: [0.5, 1] });
    expect(result.fade).toBe(0);
  });

  it("clamps after window end", () => {
    const result = tracker(1, { fade: [0, 0.5] });
    expect(result.fade).toBe(1);
  });
});

describe("viz.plot", () => {
  it("generates SVG path for a function", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const svg = plot(coords, (x) => x * x);
    expect(svg).toContain('<path d="M');
    expect(svg).toContain('stroke="#4a9eff"');
  });

  it("supports progress for draw-on animation", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const partial = plot(coords, (x) => Math.sin(x), { progress: 0.5 });
    expect(partial).toContain("stroke-dasharray");
    expect(partial).toContain("stroke-dashoffset");
  });

  it("includes fill path when fill option is set", () => {
    const coords = createCoords({ width: 200, height: 200 });
    const svg = plot(coords, (x) => x, { fill: true });
    expect(svg).toContain('fill-opacity="0.15"');
  });
});

describe("viz.equation", () => {
  it("renders LaTeX to HTML", () => {
    const html = equation("E = mc^2");
    expect(html).toContain("<span");
    expect(html).toContain("E");
  });

  it("applies fontSize and color options", () => {
    const html = equation("x^2", { fontSize: 24, color: "#fff", progress: 0.5 });
    expect(html).toContain("font-size:24px");
    expect(html).toContain("color:#fff");
    expect(html).toContain("opacity:0.5");
  });
});