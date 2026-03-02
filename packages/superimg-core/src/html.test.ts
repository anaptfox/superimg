import { describe, it, expect } from "vitest";
import { buildPageShell } from "./html.js";

describe("buildPageShell", () => {
  it("injects stylesheet links when stylesheets provided", () => {
    const shell = buildPageShell({
      fonts: [],
      stylesheets: ["https://example.com/tailwind.css"],
    });
    expect(shell).toContain('<link rel="stylesheet" href="https://example.com/tailwind.css">');
  });

  it("injects inline CSS when inlineCss provided", () => {
    const shell = buildPageShell({
      fonts: [],
      inlineCss: [".text-xl { font-size: 1.25rem; }"],
    });
    expect(shell).toContain("<style>");
    // CSS is minified and wrapped in @layer user
    expect(shell).toContain("@layer user");
    expect(shell).toContain(".text-xl");
    expect(shell).toContain("font-size:");
  });

  it("uses cascade layers for correct CSS priority", () => {
    const shell = buildPageShell({
      fonts: [],
      inlineCss: ["body { background: #0f0f23; }"],
    });
    // Should have all three layers in correct order
    expect(shell).toContain("@layer reset");
    expect(shell).toContain("@layer base");
    expect(shell).toContain("@layer user");
    // User CSS should be in the user layer
    expect(shell).toContain("background:");
  });
});
