import { describe, it, expect } from "vitest";
import { mermaid } from "./mermaid.js";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><g class="node" id="flowchart-api-1"><rect/></g><g class="node" id="flowchart-db-2"><rect/></g></svg>`;

describe("std.viz.mermaid", () => {
  it("wraps pre-rendered svg with opacity", () => {
    const html = mermaid(SAMPLE_SVG, { progress: 0.5, width: 800, height: 400 });
    expect(html).toContain("superimg-mermaid");
    expect(html).toContain("opacity:0.500");
    expect(html).toContain("flowchart-api");
  });

  it("adds highlight rules when nodes provided", () => {
    const html = mermaid(SAMPLE_SVG, {
      highlight: { nodes: ["api"], progress: 1 },
    });
    expect(html).toContain("<style>");
    expect(html).toContain("api");
  });

  it("keeps revealed marks fully lit", () => {
    const html = mermaid(SAMPLE_SVG, {
      highlight: {
        revealed: ["client"],
        nodes: ["api"],
        progress: 0.5,
      },
      dimOpacity: 0.2,
    });
    expect(html).toContain("client");
    expect(html).toContain("opacity: 1.000");
  });

  it("throws on empty svg", () => {
    expect(() => mermaid("")).toThrow(/svg/);
  });
});
