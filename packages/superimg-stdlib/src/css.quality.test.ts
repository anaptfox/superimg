import { describe, it, expect } from "vitest";
import { ditherNoise, appleGlass } from "./css.js";
import { appleGlass as glassPanel } from "./backgrounds.js";

describe("quality craft helpers", () => {
  it("ditherNoise returns SVG data-uri grain style", () => {
    const s = ditherNoise({ opacity: 0.05 });
    expect(s).toContain("background-image:");
    expect(s).toContain("data:image/svg+xml");
    expect(s).toContain("opacity:0.05");
    expect(s).toContain("mix-blend-mode:overlay");
  });

  it("appleGlass returns backdrop-filter glass recipe", () => {
    const s = appleGlass({ blur: 24 });
    expect(s).toContain("backdrop-filter:");
    expect(s).toContain("blur(24px)");
    expect(s).toContain("background:");
  });

  it("backgrounds.appleGlass returns style + html shell", () => {
    const panel = glassPanel({ content: "<span>Hi</span>", radius: 12 });
    expect(panel.html).toContain("<span>Hi</span>");
    expect(panel.style).toContain("backdrop-filter:");
    expect(panel.html).toContain("border-radius:12px");
  });
});
