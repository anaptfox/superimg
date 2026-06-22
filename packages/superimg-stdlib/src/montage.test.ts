import { describe, it, expect } from "vitest";
import { montage } from "./montage";

const images = [
  "https://example.com/a.jpg",
  "https://example.com/b.jpg",
  "https://example.com/c.jpg",
];

describe("montage", () => {
  it("shows first image at progress 0", () => {
    const result = montage({ images, progress: 0 });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].index).toBe(0);
    expect(result.currentIndex).toBe(0);
    expect(result.html).toContain(images[0]);
  });

  it("transitions from first image to second across timeline", () => {
    const early = montage({ images, progress: 0.05 });
    const late = montage({ images, progress: 0.5 });
    expect(early.layers[0].index).toBe(0);
    expect(late.layers[0].index).toBe(1);
    expect(early.html).toContain(images[0]);
    expect(late.html).toContain(images[1]);
  });

  it("advances to next image after first window", () => {
    const imageDuration = 1 / images.length;
    const spacing = (1 - imageDuration) / (images.length - 1);
    const intoSecond = spacing + imageDuration * 0.5;
    const result = montage({ images, progress: intoSecond });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0].index).toBe(1);
    expect(result.currentIndex).toBe(1);
  });

  it("tracks currentIndex as most prominent layer", () => {
    const mid = montage({ images, progress: 0.5 });
    expect(mid.currentIndex).toBeGreaterThanOrEqual(0);
    expect(mid.currentIndex).toBeLessThan(images.length);
  });

  it("renders kenBurns html by default", () => {
    const result = montage({ images: [images[0]], progress: 0 });
    expect(result.html).toContain("background-image");
    expect(result.html).toContain("scale(");
  });

  it("renders plain img when kenBurns disabled", () => {
    const result = montage({
      images: [images[0]],
      progress: 0,
      kenBurns: { enabled: false },
    });
    expect(result.html).toContain("<img");
    expect(result.html).not.toContain("background-image");
  });

  it("renderLayer returns empty string for inactive index", () => {
    const result = montage({ images, progress: 0 });
    expect(result.renderLayer(99)).toBe("");
  });

  it("renderLayer returns html for active index", () => {
    const result = montage({ images, progress: 0 });
    const layerHtml = result.renderLayer(0);
    expect(layerHtml).toContain(images[0]);
    expect(layerHtml).toContain("opacity");
  });

  it("fades layers in during transition window", () => {
    const imageDuration = 1 / images.length;
    const midFadeIn = imageDuration * 0.1;
    const result = montage({ images, progress: midFadeIn });
    expect(result.layers[0].opacity).toBeGreaterThan(0);
    expect(result.layers[0].opacity).toBeLessThan(1);
  });

  it("advances kenBurnsProgress within each image window", () => {
    const result = montage({ images: [images[0], images[1]], progress: 0.1 });
    for (const layer of result.layers) {
      expect(layer.kenBurnsProgress).toBeGreaterThanOrEqual(0);
      expect(layer.kenBurnsProgress).toBeLessThanOrEqual(1);
    }
  });

  it("handles single image", () => {
    const result = montage({ images: [images[0]], progress: 0.5 });
    expect(result.layers).toHaveLength(1);
    expect(result.currentIndex).toBe(0);
  });
});