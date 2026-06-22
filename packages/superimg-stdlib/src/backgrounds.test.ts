import { describe, expect, it } from "vitest";
import { kenBurns } from "./backgrounds.js";

describe("backgrounds.kenBurns", () => {
  const src = "https://example.com/photo.jpg";

  it("starts at zoomFrom when progress is 0", () => {
    const result = kenBurns({ src, progress: 0, zoomFrom: 1, zoomTo: 1.2 });
    expect(result.zoom).toBeCloseTo(1, 5);
    expect(result.html).toContain(`url(${src})`);
    expect(result.html).toContain("scale(1)");
  });

  it("ends at zoomTo when progress is 1", () => {
    const result = kenBurns({ src, progress: 1, zoomFrom: 1, zoomTo: 1.2 });
    expect(result.zoom).toBeCloseTo(1.2, 5);
    expect(result.html).toContain("scale(1.2)");
  });

  it("interpolates zoom at mid progress", () => {
    const result = kenBurns({ src, progress: 0.5, zoomFrom: 1, zoomTo: 1.1 });
    expect(result.zoom).toBeCloseTo(1.05, 5);
  });

  it("includes overlay color in html", () => {
    const overlay = "rgba(0,0,0,0.6)";
    const result = kenBurns({ src, progress: 0.5, overlay });
    expect(result.html).toContain(overlay);
    expect(result.overlayStyle).toContain(overlay);
  });

  it("returns background and overlay divs", () => {
    const result = kenBurns({ src, progress: 0.3 });
    expect(result.html.match(/<div/g)?.length).toBe(2);
  });
});