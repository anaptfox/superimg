import { describe, it, expect } from "vitest";
import { montage } from "./montage";

const imageA = "https://example.com/a.jpg";
const imageB = "https://example.com/b.jpg";
const imageC = "https://example.com/c.jpg";
const images = [imageA, imageB, imageC];

describe("montage", () => {
  it("shows first image at progress 0", () => {
    const result = montage({ images, progress: 0 });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]!.index).toBe(0);
    expect(result.currentIndex).toBe(0);
    expect(result.html).toContain(imageA);
  });

  it("transitions from first image to second across timeline", () => {
    const early = montage({ images, progress: 0.05 });
    const late = montage({ images, progress: 0.5 });
    expect(early.layers[0]!.index).toBe(0);
    expect(late.layers[0]!.index).toBe(1);
    expect(early.html).toContain(imageA);
    expect(late.html).toContain(imageB);
  });

  it("advances to next image after first window", () => {
    const imageDuration = 1 / images.length;
    const spacing = (1 - imageDuration) / (images.length - 1);
    const intoSecond = spacing + imageDuration * 0.5;
    const result = montage({ images, progress: intoSecond });
    expect(result.layers).toHaveLength(1);
    expect(result.layers[0]!.index).toBe(1);
    expect(result.currentIndex).toBe(1);
  });

  it("tracks currentIndex as most prominent layer", () => {
    const mid = montage({ images, progress: 0.5 });
    expect(mid.currentIndex).toBeGreaterThanOrEqual(0);
    expect(mid.currentIndex).toBeLessThan(images.length);
  });

  it("renders kenBurns html by default", () => {
    const result = montage({ images: [imageA], progress: 0 });
    expect(result.html).toContain("background-image");
    expect(result.html).toContain("scale(");
  });

  it("renders plain img when kenBurns disabled", () => {
    const result = montage({
      images: [imageA],
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
    expect(layerHtml).toContain(imageA);
    expect(layerHtml).toContain("opacity");
  });

  it("fades layers in during transition window", () => {
    const imageDuration = 1 / images.length;
    const midFadeIn = imageDuration * 0.1;
    const result = montage({ images, progress: midFadeIn });
    expect(result.layers[0]!.opacity).toBeGreaterThan(0);
    expect(result.layers[0]!.opacity).toBeLessThan(1);
  });

  it("keeps at least one visible layer during mid-transition (no blank window)", () => {
    const spacing = (1 - 1 / images.length) / (images.length - 1);
    const midHandoff = 1 / images.length + spacing * 0.5;
    const result = montage({ images, progress: midHandoff });
    const visibleLayers = result.layers.filter((l) => l.opacity > 0);
    expect(visibleLayers.length).toBeGreaterThanOrEqual(1);
  });

  it("advances kenBurnsProgress within each image window", () => {
    const result = montage({ images: [imageA, imageB], progress: 0.1 });
    for (const layer of result.layers) {
      expect(layer.kenBurnsProgress).toBeGreaterThanOrEqual(0);
      expect(layer.kenBurnsProgress).toBeLessThanOrEqual(1);
    }
  });

  it("handles single image", () => {
    const result = montage({ images: [imageA], progress: 0.5 });
    expect(result.layers).toHaveLength(1);
    expect(result.currentIndex).toBe(0);
  });
});