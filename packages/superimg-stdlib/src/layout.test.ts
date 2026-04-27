import { describe, it, expect } from "vitest";
import { stack, inset, type Box } from "./layout";

const area: Box = { x: 0, y: 0, width: 1920, height: 1080 };

describe("stack", () => {
  it("lays out three fixed rows top-to-bottom", () => {
    const [a, b, c] = stack(area, [{ height: 100 }, { height: 200 }, { height: 300 }]);
    expect(a).toEqual({ x: 0, y: 0, width: 1920, height: 100 });
    expect(b).toEqual({ x: 0, y: 100, width: 1920, height: 200 });
    expect(c).toEqual({ x: 0, y: 300, width: 1920, height: 300 });
  });

  it("inherits area.x/width on each row", () => {
    const offset: Box = { x: 50, y: 10, width: 800, height: 600 };
    const [a] = stack(offset, [{ height: 100 }]);
    expect(a.x).toBe(50);
    expect(a.width).toBe(800);
    expect(a.y).toBe(10);
  });

  it("fill row consumes remaining height", () => {
    const [a, b, c] = stack(area, [{ height: 162 }, { fill: true }, { height: 58 }]);
    expect(a.height).toBe(162);
    expect(b.y).toBe(162);
    expect(b.height).toBe(1080 - 162 - 58);
    expect(c.y).toBe(1080 - 58);
    expect(c.height).toBe(58);
  });

  it("applies gap between rows, not before first or after last", () => {
    const [a, b, c] = stack(area, [{ height: 100 }, { height: 100 }, { height: 100 }], {
      gap: 20,
    });
    expect(a.y).toBe(0);
    expect(b.y).toBe(120);
    expect(c.y).toBe(240);
  });

  it("gap is included when computing fill height", () => {
    const [, b] = stack(area, [{ height: 100 }, { fill: true }, { height: 100 }], { gap: 50 });
    expect(b.height).toBe(1080 - 100 - 100 - 50 - 50);
  });

  it("allows fixed rows to under-fill the area (unused space below)", () => {
    const [a, b] = stack(area, [{ height: 100 }, { height: 100 }]);
    expect(a.height).toBe(100);
    expect(b.height).toBe(100);
    expect(b.y + b.height).toBe(200);
  });

  it("throws when fixed rows + gaps exceed area height", () => {
    expect(() => stack(area, [{ height: 800 }, { height: 400 }])).toThrow(/exceed area height/);
  });

  it("throws when more than one fill row is specified", () => {
    expect(() => stack(area, [{ fill: true }, { fill: true }])).toThrow(/at most one row/);
  });

  it("throws on negative height", () => {
    expect(() => stack(area, [{ height: -10 }])).toThrow(/non-negative/);
  });

  it("throws on negative gap", () => {
    expect(() => stack(area, [{ height: 10 }], { gap: -5 })).toThrow(/non-negative/);
  });

  it("handles an empty row list", () => {
    expect(stack(area, [])).toEqual([]);
  });

  it("treats missing height as 0", () => {
    const [a, b] = stack(area, [{}, { height: 50 }]);
    expect(a.height).toBe(0);
    expect(b.y).toBe(0);
    expect(b.height).toBe(50);
  });
});

describe("inset", () => {
  it("shrinks by x/y shorthands", () => {
    expect(inset(area, { x: 100, y: 50 })).toEqual({
      x: 100,
      y: 50,
      width: 1720,
      height: 980,
    });
  });

  it("explicit sides take precedence over x/y shorthand", () => {
    const out = inset(area, { x: 100, y: 50, left: 10, bottom: 5 });
    expect(out.x).toBe(10);
    expect(out.y).toBe(50);
    expect(out.width).toBe(1920 - 10 - 100);
    expect(out.height).toBe(1080 - 50 - 5);
  });

  it("supports all four side fields independently", () => {
    const out = inset(area, { top: 10, right: 20, bottom: 30, left: 40 });
    expect(out).toEqual({ x: 40, y: 10, width: 1860, height: 1040 });
  });

  it("returns zero dimensions rather than negative when over-inset", () => {
    const out = inset(area, { x: 2000 });
    expect(out.width).toBe(0);
    expect(out.height).toBe(1080);
  });

  it("empty padding is a no-op", () => {
    expect(inset(area, {})).toEqual(area);
    expect(inset(area)).toEqual(area);
  });

  it("throws on negative padding", () => {
    expect(() => inset(area, { x: -1 })).toThrow(/non-negative/);
  });
});
