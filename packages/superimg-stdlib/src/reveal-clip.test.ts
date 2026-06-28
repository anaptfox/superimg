import { describe, it, expect } from "vitest";
import { revealClip } from "./reveal.js";

describe("reveal.clip", () => {
  describe("circle", () => {
    it("returns 0% radius at progress 0", () => {
      expect(revealClip.circle(0)).toContain("circle(0%");
    });

    it("returns full radius at progress 1", () => {
      const result = revealClip.circle(1);
      expect(result).toContain("circle(");
      expect(result).toContain("at 50% 50%");
    });

    it("respects cx/cy options", () => {
      const result = revealClip.circle(0.5, { cx: 0.3, cy: 0.7 });
      expect(result).toContain("at 30% 70%");
    });
  });

  describe("wipe", () => {
    it("returns fully clipped at progress 0", () => {
      expect(revealClip.wipe(0, "right")).toContain("100%");
    });

    it("returns fully visible at progress 1", () => {
      expect(revealClip.wipe(1, "right")).toBe("inset(0 0% 0 0)");
    });

    it("supports all directions", () => {
      expect(revealClip.wipe(0.5, "left")).toContain("inset(");
      expect(revealClip.wipe(0.5, "up")).toContain("inset(");
      expect(revealClip.wipe(0.5, "down")).toContain("inset(");
    });
  });

  describe("inset", () => {
    it("returns fully clipped at progress 0", () => {
      expect(revealClip.inset(0)).toContain("50%");
    });

    it("returns fully visible at progress 1", () => {
      expect(revealClip.inset(1)).toBe("inset(0% 0% 0% 0%)");
    });
  });

  describe("iris", () => {
    it("returns polygon at any progress", () => {
      expect(revealClip.iris(0.5, 6)).toContain("polygon(");
    });

    it("defaults to 6 sides", () => {
      const result = revealClip.iris(0.5);
      const points = result.replace("polygon(", "").replace(")", "").split(",");
      expect(points).toHaveLength(6);
    });
  });
});