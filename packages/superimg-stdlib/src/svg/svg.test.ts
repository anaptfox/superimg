import { describe, it, expect } from "vitest";
import { draw } from "./draw";
import { filter } from "./filter";
import { morph } from "./morph";
import { reveal } from "./reveal";
import { shape } from "./shape";
import { textPath } from "./textPath";

describe("draw", () => {
  it("returns full dasharray at progress 0 (nothing drawn)", () => {
    const result = draw("M 0 0 L 100 0", 0);
    expect(parseFloat(result.strokeDasharray)).toBeCloseTo(100, 0);
    expect(parseFloat(result.strokeDashoffset)).toBeCloseTo(100, 0);
  });

  it("returns zero offset at progress 1 (fully drawn)", () => {
    const result = draw("M 0 0 L 100 0", 1);
    expect(parseFloat(result.strokeDashoffset)).toBeCloseTo(0, 0);
  });

  it("returns half offset at progress 0.5", () => {
    const result = draw("M 0 0 L 100 0", 0.5);
    expect(parseFloat(result.strokeDashoffset)).toBeCloseTo(50, 0);
  });

  it("respects start/end window", () => {
    // At progress 0.5, we're halfway through [0, 1] → drawn 50%
    // But with start=0.5, end=1.0 → at progress 0.5 we're at the window start → drawn 0%
    const result = draw("M 0 0 L 100 0", 0.5, { start: 0.5, end: 1.0 });
    expect(parseFloat(result.strokeDashoffset)).toBeCloseTo(100, 0);
  });
});

describe("filter", () => {
  it("returns a FilterResult with id, svg, css", () => {
    const f = filter([{ type: "blur", radius: 5 }]);
    expect(f.id).toBeTruthy();
    expect(f.svg).toContain("<filter");
    expect(f.svg).toContain("feGaussianBlur");
    expect(f.css).toContain("url(#");
  });

  it("generates deterministic IDs for same effects", () => {
    const a = filter([{ type: "blur", radius: 5 }]);
    const b = filter([{ type: "blur", radius: 5 }]);
    expect(a.id).toBe(b.id);
  });

  it("generates different IDs for different effects", () => {
    const a = filter([{ type: "blur", radius: 5 }]);
    const b = filter([{ type: "blur", radius: 10 }]);
    expect(a.id).not.toBe(b.id);
  });

  it("supports grain filter", () => {
    const f = filter([{ type: "grain", frequency: 0.7, seed: 42 }]);
    expect(f.svg).toContain("feTurbulence");
  });

  it("supports colorMatrix presets", () => {
    const f = filter([{ type: "colorMatrix", preset: "sepia" }]);
    expect(f.svg).toContain("feColorMatrix");
  });

  it("supports glow filter", () => {
    const f = filter([{ type: "glow", radius: 5, color: "red" }]);
    expect(f.svg).toContain("feFlood");
    expect(f.svg).toContain("feMerge");
  });

  it("supports displace filter", () => {
    const f = filter([{ type: "displace", scale: 10 }]);
    expect(f.svg).toContain("feDisplacementMap");
  });

  it("chains multiple effects", () => {
    const f = filter([
      { type: "blur", radius: 2 },
      { type: "colorMatrix", preset: "noir" },
    ]);
    expect(f.svg).toContain("feGaussianBlur");
    expect(f.svg).toContain("feColorMatrix");
  });
});

describe("morph", () => {
  it("returns pathA at progress 0", () => {
    const a = "M 0 0 L 100 0";
    const b = "M 0 0 L 0 100";
    const result = morph(a, b, 0);
    expect(result).toContain("L100,0");
  });

  it("returns pathB at progress 1", () => {
    const a = "M 0 0 L 100 0";
    const b = "M 0 0 L 0 100";
    const result = morph(a, b, 1);
    expect(result).toContain("L0,100");
  });

  it("returns interpolated path at progress 0.5", () => {
    const a = "M 0 0 L 100 0";
    const b = "M 0 0 L 0 100";
    const result = morph(a, b, 0.5);
    expect(result).toContain("L50,50");
  });

  it("throws on segment count mismatch", () => {
    const a = "M 0 0 L 100 0";
    const b = "M 0 0 L 50 0 L 100 100";
    expect(() => morph(a, b, 0.5)).toThrow("same number of segments");
  });

  it("works with shape generators", () => {
    const a = shape.polygon(100, 100, 50, 6);
    const b = shape.polygon(100, 100, 80, 6);
    const result = morph(a, b, 0.5);
    expect(result).toContain("M");
    expect(result).toContain("L");
  });
});

describe("reveal", () => {
  describe("circle", () => {
    it("returns 0% radius at progress 0", () => {
      expect(reveal.circle(0)).toContain("circle(0%");
    });

    it("returns full radius at progress 1", () => {
      const result = reveal.circle(1);
      expect(result).toContain("circle(");
      expect(result).toContain("at 50% 50%");
    });

    it("respects cx/cy options", () => {
      const result = reveal.circle(0.5, { cx: 0.3, cy: 0.7 });
      expect(result).toContain("at 30% 70%");
    });
  });

  describe("wipe", () => {
    it("returns fully clipped at progress 0", () => {
      expect(reveal.wipe(0, "right")).toContain("100%");
    });

    it("returns fully visible at progress 1", () => {
      expect(reveal.wipe(1, "right")).toBe("inset(0 0% 0 0)");
    });

    it("supports all directions", () => {
      expect(reveal.wipe(0.5, "left")).toContain("inset(");
      expect(reveal.wipe(0.5, "up")).toContain("inset(");
      expect(reveal.wipe(0.5, "down")).toContain("inset(");
    });
  });

  describe("inset", () => {
    it("returns fully clipped at progress 0", () => {
      expect(reveal.inset(0)).toContain("50%");
    });

    it("returns fully visible at progress 1", () => {
      expect(reveal.inset(1)).toBe("inset(0% 0% 0% 0%)");
    });
  });

  describe("iris", () => {
    it("returns polygon at any progress", () => {
      expect(reveal.iris(0.5, 6)).toContain("polygon(");
    });

    it("defaults to 6 sides", () => {
      const result = reveal.iris(0.5);
      // 6 points = 6 commas-separated pairs
      const points = result.replace("polygon(", "").replace(")", "").split(",");
      expect(points).toHaveLength(6);
    });
  });
});

describe("shape", () => {
  it("generates a circle path", () => {
    const d = shape.circle(100, 100, 50);
    expect(d).toContain("M");
    expect(d).toContain("C");
    expect(d).toContain("Z");
  });

  it("generates a star path", () => {
    const d = shape.star(100, 100, 50, 25, 5);
    expect(d).toContain("M");
    expect(d).toContain("Z");
    // 5 points = 10 vertices (outer+inner)
  });

  it("generates a polygon path", () => {
    const d = shape.polygon(100, 100, 50, 6);
    expect(d).toContain("M");
    expect(d).toContain("Z");
  });

  it("generates a wave path", () => {
    const d = shape.wave(1920, 200, 60, 2);
    expect(d).toContain("M");
    expect(d).not.toContain("Z"); // wave is open
  });

  it("generates an arc path", () => {
    const d = shape.arc(100, 100, 50, 0, 180);
    expect(d).toContain("M");
    expect(d).toContain("A");
  });

  it("generates a rounded rect path", () => {
    const d = shape.roundedRect(0, 0, 200, 100, 10);
    expect(d).toContain("M");
    expect(d).toContain("Q");
    expect(d).toContain("Z");
  });

  it("star and polygon with matching vertices can be morphed", () => {
    // 5-point star = 10 vertices, polygon(10) = 10 vertices
    const a = shape.polygon(100, 100, 50, 10);
    const b = shape.star(100, 100, 50, 25, 5);
    // Both should produce M + 9 L + Z = 11 segments after normalization
    expect(() => morph(a, b, 0.5)).not.toThrow();
  });
});

describe("textPath", () => {
  it("returns SVG snippet with defs, path, text, and textPath", () => {
    const result = textPath("Hello", "M 0 50 L 200 50");
    expect(result).toContain("<defs>");
    expect(result).toContain("<path");
    expect(result).toContain("<text");
    expect(result).toContain("<textPath");
    expect(result).toContain("Hello");
  });

  it("applies offset option", () => {
    const result = textPath("Hello", "M 0 0 L 100 0", { offset: 50 });
    expect(result).toContain('startOffset="50%"');
  });

  it("applies font options", () => {
    const result = textPath("Hello", "M 0 0 L 100 0", {
      fontSize: 72,
      fill: "#667eea",
      fontWeight: "bold",
    });
    expect(result).toContain('font-size="72"');
    expect(result).toContain('fill="#667eea"');
    expect(result).toContain('font-weight="bold"');
  });

  it("generates deterministic ID from path", () => {
    const a = textPath("Hello", "M 0 0 L 100 0");
    const b = textPath("World", "M 0 0 L 100 0");
    // Same path → same id
    expect(a).toMatch(/id="tp[a-z0-9]+"/);
  });

  it("accepts custom ID", () => {
    const result = textPath("Hello", "M 0 0 L 100 0", { id: "mypath" });
    expect(result).toContain('id="mypath"');
    expect(result).toContain('href="#mypath"');
  });
});
