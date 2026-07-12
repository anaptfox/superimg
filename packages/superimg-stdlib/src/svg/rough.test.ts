import { describe, it, expect } from "vitest";
import { path, rect, circle, line } from "./rough.js";

describe("std.svg.rough", () => {
  it("same seed yields identical output", () => {
    const a = rect(10, 10, 100, 40, { seed: 42, fill: "#5b8cff", fillStyle: "hachure" });
    const b = rect(10, 10, 100, 40, { seed: 42, fill: "#5b8cff", fillStyle: "hachure" });
    expect(a).toBe(b);
    expect(a).toContain("<path");
  });

  it("different seeds differ", () => {
    const a = rect(10, 10, 100, 40, { seed: 1 });
    const b = rect(10, 10, 100, 40, { seed: 99 });
    expect(a).not.toBe(b);
  });

  it("remaps seed 0 to deterministic default", () => {
    const a = circle(50, 50, 20, { seed: 0 });
    const b = circle(50, 50, 20, { seed: 1 });
    expect(a).toBe(b);
  });

  it("rejects fillStyle dots", () => {
    expect(() =>
      rect(0, 0, 10, 10, { seed: 2, fill: "#fff", fillStyle: "dots" as "hachure" }),
    ).toThrow(/dots/);
  });

  it("roughens path d strings", () => {
    const d = "M0 0 L100 0 L100 50 Z";
    const html = path(d, { seed: 7, stroke: "#fff", fill: "none" });
    expect(html).toContain("<path");
    expect(html).toContain('d="');
  });

  it("line emits path", () => {
    expect(line(0, 0, 40, 40, { seed: 3 })).toContain("<path");
  });
});
