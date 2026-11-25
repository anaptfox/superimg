import { describe, expect, it } from "vitest";
import { launchLayout } from "./layout.js";

describe("launch art direction", () => {
  it("recomposes the product below the title for square delivery", () => {
    const landscape = launchLayout(960, 540);
    const square = launchLayout(540, 540);
    expect(landscape.product.x).toBeGreaterThan(landscape.title.x + landscape.title.width);
    expect(square.product.y).toBeGreaterThan(square.title.y + square.title.height);
    expect(square.product.width).toBeGreaterThan(landscape.product.width);
  });
  it.each([[960, 540], [540, 540]])("contains focal content at %ix%i", (width, height) => {
    for (const bounds of Object.values(launchLayout(width, height)).filter((value) => typeof value === "object")) {
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
    }
  });
});
