import { describe, it, expect } from "vitest";
import { buildPageShell } from "./html.js";

describe("buildPageShell", () => {
  it("accepts array (fonts) for backward compatibility", () => {
    const shell = buildPageShell(["Inter:wght@400"]);
    expect(shell).toContain("fonts.googleapis.com");
    expect(shell).toContain("Inter");
    expect(shell).toContain("<div id=\"frame\"");
  });

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
    expect(shell).toContain(".text-xl { font-size: 1.25rem; }");
  });
});
