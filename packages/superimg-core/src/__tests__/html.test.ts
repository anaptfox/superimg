import { describe, it, expect } from "vitest";
import { buildPageShell } from "../html/html.js";
import { buildTailwindScript, TAILWIND_CDN_URL } from "../html/css.js";

describe("buildTailwindScript", () => {
  it("returns empty string when tailwind is falsy", () => {
    expect(buildTailwindScript(undefined)).toBe("");
    expect(buildTailwindScript(false)).toBe("");
  });

  it("returns CDN script when tailwind is true", () => {
    const result = buildTailwindScript(true);
    expect(result).toBe(`<script src="${TAILWIND_CDN_URL}"></script>`);
  });

  it("returns CDN script with custom CSS when config has css", () => {
    const result = buildTailwindScript({
      css: `@theme { --color-brand: #ff6b35; }`,
    });
    expect(result).toContain(`<script src="${TAILWIND_CDN_URL}"></script>`);
    expect(result).toContain('<style type="text/tailwindcss">');
    expect(result).toContain("--color-brand: #ff6b35");
  });

  it("returns only CDN script when config has no css", () => {
    const result = buildTailwindScript({});
    expect(result).toBe(`<script src="${TAILWIND_CDN_URL}"></script>`);
  });
});

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

  it("injects Tailwind CDN script when tailwind is true", () => {
    const shell = buildPageShell({
      fonts: [],
      tailwind: true,
    });
    expect(shell).toContain(`<script src="${TAILWIND_CDN_URL}"></script>`);
  });

  it("injects Tailwind CDN with custom theme CSS", () => {
    const shell = buildPageShell({
      fonts: [],
      tailwind: {
        css: `@theme { --color-brand: #ff6b35; }`,
      },
    });
    expect(shell).toContain(`<script src="${TAILWIND_CDN_URL}"></script>`);
    expect(shell).toContain('<style type="text/tailwindcss">');
    expect(shell).toContain("--color-brand: #ff6b35");
  });

  it("places Tailwind script before other styles", () => {
    const shell = buildPageShell({
      fonts: ["Inter"],
      stylesheets: ["https://example.com/custom.css"],
      inlineCss: [".my-class { color: red; }"],
      tailwind: true,
    });
    const tailwindIndex = shell.indexOf(TAILWIND_CDN_URL);
    const fontIndex = shell.indexOf("fonts.googleapis.com");
    const stylesheetIndex = shell.indexOf("example.com/custom.css");
    const inlineIndex = shell.indexOf("@layer reset");
    // Tailwind should come first
    expect(tailwindIndex).toBeLessThan(fontIndex);
    expect(tailwindIndex).toBeLessThan(stylesheetIndex);
    expect(tailwindIndex).toBeLessThan(inlineIndex);
  });
});
